import * as THREE from 'three'
import { Creature } from './Creature'
import { CreatureMesh } from './CreatureMesh'
import { SpatialGrid } from './SpatialGrid'
import { SPECIES, SpeciesId } from './Species'
import { dnaToStats, dnaToSpeciesId, getCreatureStats } from './CreatureDNA'
import type { CreatureDNA } from './CreatureDNA'
import { BIOME_DNA_TABLE, getPresetDNA } from './DNAPresets'
import { breedDNA } from './DNABreeding'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'
import { HollowType, ENEMY_DEFS } from '../combat/EnemyTypes'
import { World } from '../world/World'
import { CHUNK_SIZE, WATER_LEVEL } from '../world/TerrainGenerator'
import { BiomeType } from '../biomes/types'
import { WORLD_CONFIG, CREATURE_CONFIG, RENDER_CONFIG } from '../config'
import { WorldState } from '../systems/WorldState'
import { applyWeatherResponse, getWeatherHuntRangeMultiplier } from './WeatherResponse'
import { applyEcologyBehavior } from './EcologyBehavior'
import { applySiteAwareness } from './SiteAwareness'
import { tickEnemyAI } from '../combat/EnemyAI'

const VIEW_RADIUS = WORLD_CONFIG.viewRadius
const MAX_POPULATION = 500
// Creature mesh visibility uses the unified draw distance from RENDER_CONFIG
const MAX_VISIBLE_MESHES = 150  // hard cap on total creature meshes
const BATCH_SIZE = 30     // max state-machine ticks per frame
const PLAYER_ID = '__player__'

// Hoisted constant set to avoid per-frame allocation (Phase 5b)
const ACTIVE_STATES = new Set(['flee', 'chase', 'hunt', 'wander', 'seek_food', 'seek_water', 'seek_mate', 'courtship', 'attack', 'migrating', 'resonating'])

export class CreatureManager {
  readonly creatures: Map<string, Creature> = new Map()
  campfirePositions: THREE.Vector3[] = []
  private meshes: Map<string, CreatureMesh> = new Map()
  private initializedChunks: Set<string> = new Set()
  grid: SpatialGrid<Creature> = new SpatialGrid(32)
  private rng: SeededRandom
  private scene: THREE.Scene
  private batchOffset = 0

  // Accumulated knockback for Engine to consume
  pendingKnockback = 0

  // WorldState reference for weather response
  worldState: WorldState | null = null

  constructor(worldSeed: number, scene: THREE.Scene) {
    this.rng = new SeededRandom(worldSeed + 1)
    this.scene = scene
  }

  spawnForChunk(cx: number, cz: number, world: World): void {
    const key = `${cx},${cz}`
    if (this.initializedChunks.has(key)) return
    // No global population cap here — let every loaded chunk spawn its creatures.
    // The excess population cull in update() removes oldest creatures to stay near MAX.

    const centerX = cx * CHUNK_SIZE + CHUNK_SIZE * 0.5
    const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE * 0.5
    const biome = world.getBiomeAt(centerX, centerZ)

    const rng = new SeededRandom(chunkSeed(cx, cz, 42))

    // DNA-based spawning — limit per chunk so population spreads across chunks
    const MAX_PER_CHUNK = 30
    let chunkSpawned = 0

    const dnaPresets = BIOME_DNA_TABLE[biome]
    if (dnaPresets && dnaPresets.length > 0) {
      // Pick a random subset of presets (3-5) instead of iterating all
      const presetCount = Math.min(dnaPresets.length, 3 + rng.int(0, 2))
      const shuffled = [...dnaPresets]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = rng.int(0, i)
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      for (let p = 0; p < presetCount; p++) {
        const presetName = shuffled[p]
        const peekDna = getPresetDNA(presetName, rng)
        const peekStats = dnaToStats(peekDna)
        if (peekStats.isGiant) {
          if (rng.next() > 0.05) continue
        }
        const count = peekStats.isGiant ? 1 : Math.round(rng.int(4, 10) * CREATURE_CONFIG.spawnMultiplier)
        for (let i = 0; i < count; i++) {
          if (chunkSpawned >= MAX_PER_CHUNK) break

          const wx = cx * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
          const wz = cz * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
          const h = world.getHeightAt(wx, wz)
          if (h === null) continue

          // Reuse peeked DNA for first creature, generate fresh for rest
          const creatureDna = i === 0 ? peekDna : getPresetDNA(presetName, rng)
          const stats = i === 0 ? peekStats : dnaToStats(creatureDna)
          const speciesId = dnaToSpeciesId(creatureDna)

          let spawnY: number
          if (stats.mobility === 'water') {
            if (h > WATER_LEVEL - 0.3) continue
            spawnY = WATER_LEVEL - 0.5
          } else if (stats.mobility === 'air') {
            if (h < WATER_LEVEL - 1) continue
            spawnY = h + rng.range(6, 15)
          } else {
            if (h < WATER_LEVEL) continue
            spawnY = h + stats.bodyH * stats.adultScale + 0.1
          }

          const creature = new Creature(speciesId, new THREE.Vector3(wx, spawnY, wz), stats.babyScale)
          creature.dna = creatureDna
          creature.stats = stats
          creature.scale = stats.adultScale
          creature.age = rng.range(30, stats.maxAge * 0.6)
          creature.reproductionCooldown = rng.range(0, 60)
          this.creatures.set(creature.id, creature)
          chunkSpawned++
        }
      }
      this.initializedChunks.add(key)
      return
    }
  }

  update(delta: number, playerPos: THREE.Vector3, world: World, dayTime: number): void {
    this._frameCounter++
    // Rebuild spatial grid (Phase 4)
    this.grid.clear()
    this.grid.insertAll(this.creatures.values())
    const all = this.grid.flat
    const total = all.length

    // Determine batch window
    const start = this.batchOffset % Math.max(1, total)
    const end = Math.min(start + BATCH_SIZE, total)

    // Pre-compute squared distance threshold — creature draw distance
    const rs = RENDER_CONFIG.renderScale
    const dd = RENDER_CONFIG.drawCreatures
    const farThreshSq = dd * dd
    const meshViewDistSq = dd * dd
    let meshesCreated = 0

    for (let i = 0; i < total; i++) {
      const c = all[i]
      const dx = c.position.x - playerPos.x
      const dz = c.position.z - playerPos.z
      const distSq = dx * dx + dz * dz
      const farAway = distSq > farThreshSq

      // Stats tick always (far = quarter rate)
      if (!farAway || i % 4 === 0) {
        this.tickStats(c, delta)
      }

      // Skip AI for companion creatures
      if (c.isCompanion) continue

      // Site awareness — HIGHEST priority, overrides weather and ecology when near a site
      let siteOverride = false
      if (i >= start && i < end && this.worldState) {
        siteOverride = applySiteAwareness(c, this.worldState)
      }

      // Weather response — before state machine so weather can override idle/wander
      if (!siteOverride && i >= start && i < end && this.worldState) {
        const shelterPositions = this.getShelterPositions()
        applyWeatherResponse(c, this.worldState, shelterPositions)
      }

      // Ecology behavior — after weather response, before state machine
      if (!siteOverride && i >= start && i < end) {
        applyEcologyBehavior(c, this.grid, this._frameCounter)
      }

      // State machine — batched
      if (i >= start && i < end) {
        this.tickStateMachine(c, delta, playerPos, world, dayTime)
      }

      // Movement
      if (!farAway || i % 4 === 0) {
        this.applyMovement(c, delta, world)
      }

      // Mesh lifecycle (limit mesh creation to 4 per frame, cap total visible)
      // Giants visible from much farther away
      const sp2 = getCreatureStats(c)
      const effectiveMeshDistSq = sp2.isGiant ? meshViewDistSq * 9 : meshViewDistSq
      if (distSq <= effectiveMeshDistSq) {
        if (!c.hasMesh && meshesCreated < 4 && this.meshes.size < MAX_VISIBLE_MESHES) {
          const mesh = new CreatureMesh(c, this.scene, distSq)
          this.meshes.set(c.id, mesh)
          c.hasMesh = true
          meshesCreated++
        }
        if (c.hasMesh) {
          const mesh = this.meshes.get(c.id)
          if (mesh) {
            mesh.updateLOD(c, distSq, this.scene)
            mesh.update(c, delta)
          }
        }
      } else if (c.hasMesh) {
        this.disposeMesh(c)
      }
    }

    this.batchOffset = (this.batchOffset + BATCH_SIZE) % Math.max(1, total)

    // Remove creatures whose death animation is done
    for (let i = all.length - 1; i >= 0; i--) {
      const c = all[i]
      if (c.state === 'dead') {
        c.deathTimer += delta
        if (c.deathTimer > 4) {
          this.disposeMesh(c)
          this.creatures.delete(c.id)
        }
      }
    }

    // Clear initializedChunks for far-away chunks so they can respawn when revisited
    const playerCX = Math.floor(playerPos.x / CHUNK_SIZE)
    const playerCZ = Math.floor(playerPos.z / CHUNK_SIZE)
    const cullChunkRadius = Math.ceil(dd * 1.2 / CHUNK_SIZE)
    for (const key of this.initializedChunks) {
      const [kcx, kcz] = key.split(',').map(Number)
      if (Math.abs(kcx - playerCX) > cullChunkRadius || Math.abs(kcz - playerCZ) > cullChunkRadius) {
        this.initializedChunks.delete(key)
      }
    }

    // Cull creatures beyond unified draw distance (with margin for creatures near the edge)
    const cullDistSq = (dd * 1.2) ** 2
    for (let i = all.length - 1; i >= 0; i--) {
      const c2 = all[i]
      if (c2.state === 'dead') continue
      const cdx = c2.position.x - playerPos.x
      const cdz = c2.position.z - playerPos.z
      if (cdx * cdx + cdz * cdz > cullDistSq) {
        this.disposeMesh(c2)
        this.creatures.delete(c2.id)
      }
    }

    // Cull excess population (remove oldest first) - only when significantly over limit
    if (this.creatures.size > MAX_POPULATION) {
      // Sort the flat array by age descending (reuse grid.flat to avoid new allocation)
      all.sort((a, b) => b.age - a.age)
      const target = Math.floor(MAX_POPULATION * 0.9)
      let idx = all.length - 1
      while (this.creatures.size > target && idx >= 0) {
        const victim = all[idx--]
        this.disposeMesh(victim)
        this.creatures.delete(victim.id)
      }
    }
  }

  getCount(): number {
    return this.creatures.size
  }

  /** Spawn an enemy creature (Hollow) at the given position */
  spawnEnemy(type: HollowType, position: THREE.Vector3): Creature {
    const speciesId = `hollow_${type}` as SpeciesId
    const def = ENEMY_DEFS[type]
    const sp = SPECIES[speciesId]
    const creature = new Creature(speciesId, position, sp.adultScale)
    creature.scale = def.scale
    creature.isEnemy = true
    creature.enemyType = type
    creature.health = def.hp
    creature.hunger = 0
    creature.thirst = 0
    creature.energy = 200
    creature.age = 0
    creature.reproductionCooldown = 99999
    this.creatures.set(creature.id, creature)
    return creature
  }

  /** Damage a creature by amount; triggers death state if health <= 0 */
  damageCreature(creatureId: string, amount: number): void {
    const c = this.creatures.get(creatureId)
    if (!c || c.state === 'dead') return
    c.health -= amount
    if (c.health <= 0) {
      c.health = 0
      c.state = 'dead'
      c.velocity.set(0, 0, 0)
    }
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /** Collect shelter positions from worldState resonance sites + campfires */
  private _shelterCache: THREE.Vector3[] = []
  private _shelterCacheFrame = -1
  private _frameCounter = 0

  private getShelterPositions(): THREE.Vector3[] {
    // Cache per frame to avoid rebuilding for every creature
    if (this._shelterCacheFrame === this._frameCounter) return this._shelterCache
    this._shelterCacheFrame = this._frameCounter

    this._shelterCache.length = 0
    // Resonance sites as shelter
    if (this.worldState) {
      for (const site of this.worldState.resonanceSites.values()) {
        this._shelterCache.push(site.position)
      }
    }
    // Campfires as shelter
    for (const pos of this.campfirePositions) {
      this._shelterCache.push(pos)
    }
    return this._shelterCache
  }

  private disposeMesh(c: Creature) {
    const mesh = this.meshes.get(c.id)
    if (mesh) {
      mesh.dispose(this.scene)
      this.meshes.delete(c.id)
      c.hasMesh = false
    }
  }

  private tickStats(c: Creature, delta: number) {
    if (c.state === 'dead') return
    const sp = getCreatureStats(c)

    c.age += delta

    // Grow from baby to adult over 60 s
    if (c.scale < sp.adultScale) {
      c.scale = Math.min(sp.adultScale, c.scale + delta * (sp.adultScale - sp.babyScale) / 60)
    }

    // Hunger (fish always in water, skip)
    if (sp.mobility !== 'water') {
      const hungerRate = c.state === 'eating' ? -8 : 0.5
      c.hunger = Math.max(0, Math.min(sp.maxHunger, c.hunger + delta * hungerRate))
    }

    // Thirst
    if (sp.maxThirst > 0) {
      const thirstRate = c.state === 'drinking' ? -8 : 0.3
      c.thirst = Math.max(0, Math.min(sp.maxThirst, c.thirst + delta * thirstRate))
    }

    // Energy
    const energyRate = c.state === 'sleep' ? 15 : ACTIVE_STATES.has(c.state) ? -3 : 5
    c.energy = Math.max(0, Math.min(sp.maxEnergy, c.energy + delta * energyRate))

    if (c.reproductionCooldown > 0) c.reproductionCooldown -= delta

    // Death checks
    if (c.hunger >= sp.maxHunger || c.age >= sp.maxAge || c.health <= 0) {
      c.state = 'dead'
      c.velocity.set(0, 0, 0)
    }
  }

  private tickStateMachine(
    c: Creature,
    delta: number,
    playerPos: THREE.Vector3,
    world: World,
    dayTime: number
  ) {
    if (c.state === 'dead') return

    // Route enemy creatures to dedicated Enemy AI state machine
    if (c.isEnemy && c.enemyType) {
      tickEnemyAI(c, delta, playerPos, this)
      return
    }

    const sp = getCreatureStats(c)
    c.stateTimer += delta

    // Sleep / wake
    const isNight = dayTime > 0.75 || dayTime < 0.25
    if (isNight && c.energy < 30 && c.state !== 'flee' && c.state !== 'chase' && c.state !== 'attack') {
      if (c.state !== 'sleep') { c.state = 'sleep'; c.stateTimer = 0; c.velocity.set(0, 0, 0) }
      return
    }
    if (c.state === 'sleep' && (!isNight || c.energy > 90)) {
      c.state = 'idle'; c.stateTimer = 0
    }

    // Campfire awareness — predators flee, herbivores attracted
    if (this.campfirePositions.length > 0) {
      for (const cfPos of this.campfirePositions) {
        const cdx = c.position.x - cfPos.x
        const cdz = c.position.z - cfPos.z
        const cfDistSq = cdx * cdx + cdz * cdz
        if (sp.role === 'predator' && cfDistSq < 225) { // 15^2
          this.startFlee(c, cfPos)
          return
        }
        if (sp.role === 'herbivore' && cfDistSq < 400 && cfDistSq > 9) { // 20^2, > 3^2
          if (c.state === 'idle' || c.state === 'wander') {
            if (!c.targetPos) c.targetPos = new THREE.Vector3()
            c.targetPos.copy(cfPos)
            c.state = 'wander'
            this.steerToTarget(c, sp.maxSpeed * 0.3)
            return
          }
        }
      }
    }

    const threat = sp.role === 'herbivore' ? this.findThreat(c, playerPos) : null

    switch (c.state) {
      case 'idle':
        if (threat) { this.startFlee(c, threat); break }
        if (sp.role === 'predator') { this.tryHunt(c); break }
        if (sp.maxThirst > 0 && c.thirst > sp.maxThirst * 0.7) { this.beginSeek(c, 'seek_water'); break }
        if (c.hunger > sp.maxHunger * 0.5)                     { this.beginSeek(c, 'seek_food'); break }
        if (c.hunger < sp.maxHunger * 0.3 && c.reproductionCooldown <= 0) { this.beginSeek(c, 'seek_mate'); break }
        if (c.stateTimer > 2) { c.state = 'wander'; c.stateTimer = 0; c.targetPos = this.wanderTarget(c) }
        break

      case 'wander':
        if (threat) { this.startFlee(c, threat); break }
        if (sp.role === 'predator') { this.tryHunt(c); break }
        if (sp.maxThirst > 0 && c.thirst > sp.maxThirst * 0.7) { this.beginSeek(c, 'seek_water'); break }
        if (c.hunger > sp.maxHunger * 0.5)                     { this.beginSeek(c, 'seek_food'); break }
        if (c.hunger < sp.maxHunger * 0.3 && c.reproductionCooldown <= 0) { this.beginSeek(c, 'seek_mate'); break }
        if (this.atTarget(c) || c.stateTimer > 8) { c.state = 'idle'; c.stateTimer = 0; c.velocity.set(0, 0, 0) }
        else this.steerToTarget(c, sp.maxSpeed)
        break

      case 'seek_food': {
        if (threat) { this.startFlee(c, threat); break }
        if (!c.targetPos || c.stateTimer > 5) { c.targetPos = this.findFood(c, world); c.stateTimer = 0 }
        if (c.targetPos) {
          if (this.atTarget(c, 1.5)) { c.state = 'eating'; c.stateTimer = 0; c.velocity.set(0, 0, 0) }
          else this.steerToTarget(c, sp.maxSpeed)
        } else { this.goWander(c) }
        break
      }

      case 'eating':
        if (threat) { this.startFlee(c, threat); break }
        if (c.hunger <= 0 || c.stateTimer > 4) { c.state = 'idle'; c.stateTimer = 0 }
        break

      case 'seek_water': {
        if (threat) { this.startFlee(c, threat); break }
        if (!c.targetPos || c.stateTimer > 5) { c.targetPos = this.findWater(c, world); c.stateTimer = 0 }
        if (c.targetPos) {
          if (this.atTarget(c, 2)) { c.state = 'drinking'; c.stateTimer = 0; c.velocity.set(0, 0, 0) }
          else this.steerToTarget(c, sp.maxSpeed)
        } else { this.goWander(c) }
        break
      }

      case 'drinking':
        if (threat) { this.startFlee(c, threat); break }
        if (c.thirst <= 0 || c.stateTimer > 4) { c.state = 'idle'; c.stateTimer = 0 }
        break

      case 'flee':
        if (!threat || c.stateTimer > 6) { c.state = 'idle'; c.stateTimer = 0; c.velocity.set(0, 0, 0); break }
        this.steerAwayFrom(c, threat, sp.fleeSpeed)
        break

      case 'seek_mate': {
        if (threat) { this.startFlee(c, threat); break }
        if (!c.targetId) {
          const mate = this.findMate(c)
          if (mate) {
            c.targetId = mate.id
            mate.targetId = c.id
            c.state = 'courtship'; c.stateTimer = 0
            mate.state = 'courtship'; mate.stateTimer = 0
          } else { this.goWander(c) }
        }
        break
      }

      case 'courtship': {
        if (threat) { this.startFlee(c, threat); break }
        const mate = c.targetId ? this.creatures.get(c.targetId) : null
        if (!mate || mate.state === 'dead') { c.state = 'idle'; c.targetId = null; break }
        // Orbit mate (Phase 5b: reuse targetPos)
        const angle = c.stateTimer * 1.5
        if (!c.targetPos) c.targetPos = new THREE.Vector3()
        c.targetPos.set(
          mate.position.x + Math.cos(angle) * 3,
          mate.position.y,
          mate.position.z + Math.sin(angle) * 3
        )
        this.steerToTarget(c, sp.maxSpeed * 0.6)
        if (c.stateTimer > 3) {
          c.state = 'mating'; c.stateTimer = 0
          if (mate.state === 'courtship') { mate.state = 'mating'; mate.stateTimer = 0 }
        }
        break
      }

      case 'mating': {
        c.velocity.set(0, 0, 0)
        if (c.stateTimer > 1.5) {
          const mate = c.targetId ? this.creatures.get(c.targetId) : null
          // Only the creature with numerically lower id spawns the baby
          const myNum  = parseInt(c.id.slice(1))
          const mateNum = c.targetId ? parseInt(c.targetId.slice(1)) : Infinity
          if (mate && myNum < mateNum && this.creatures.size < MAX_POPULATION * 0.95) this.spawnBaby(c, mate)
          c.reproductionCooldown = 120
          c.state = 'idle'; c.stateTimer = 0; c.targetId = null
        }
        break
      }

      case 'hunt': {
        const prey = this.findPrey(c, playerPos)
        if (!prey) { this.goWander(c); break }
        c.targetId = prey
        const target = prey === PLAYER_ID ? playerPos : this.creatures.get(prey)?.position
        if (!target) { this.goWander(c); break }
        const dist = c.position.distanceTo(target)
        if (dist <= sp.attackRange) { c.state = 'attack'; c.stateTimer = 0 }
        else if (dist <= sp.sightRange * 2) { c.state = 'chase'; c.stateTimer = 0 }
        else { if (!c.targetPos) c.targetPos = new THREE.Vector3(); c.targetPos.copy(target); this.steerToTarget(c, sp.maxSpeed * 0.5) }
        break
      }

      case 'chase': {
        const chaseTarget = c.targetId === PLAYER_ID
          ? playerPos
          : (c.targetId ? this.creatures.get(c.targetId)?.position : null)
        if (!chaseTarget || (c.targetId !== PLAYER_ID && this.creatures.get(c.targetId!)?.state === 'dead')) {
          c.state = 'idle'; c.targetId = null; break
        }
        if (!c.targetPos) c.targetPos = new THREE.Vector3()
        c.targetPos.copy(chaseTarget)
        const dist = c.position.distanceTo(chaseTarget)
        if (dist <= sp.attackRange) { c.state = 'attack'; c.stateTimer = 0 }
        else if (dist > sp.sightRange * 3) { c.state = 'hunt'; c.stateTimer = 0 }
        else this.steerToTarget(c, sp.fleeSpeed)
        break
      }

      case 'attack': {
        const attackTarget = c.targetId === PLAYER_ID
          ? playerPos
          : (c.targetId ? this.creatures.get(c.targetId)?.position : null)
        const preyCreature = c.targetId !== PLAYER_ID && c.targetId
          ? this.creatures.get(c.targetId)
          : null

        if (!attackTarget || (preyCreature && preyCreature.state === 'dead')) {
          if (preyCreature) c.hunger = Math.max(0, c.hunger - getCreatureStats(c).maxHunger * 0.7)
          c.state = 'idle'; c.targetId = null; break
        }

        if (!c.targetPos) c.targetPos = new THREE.Vector3()
        c.targetPos.copy(attackTarget)
        this.steerToTarget(c, sp.maxSpeed)

        if (c.stateTimer > 0.5) {
          c.stateTimer = 0
          if (c.targetId === PLAYER_ID) {
            // Y distance check — skip damage if player is too high/low
            const dy = Math.abs(c.position.y - playerPos.y)
            if (dy <= 4) {
              this.pendingKnockback = 1.0
            }
          } else if (preyCreature) {
            preyCreature.health -= sp.attackDamage
          }
        }
        break
      }

      case 'sheltering':
        // Sheltering: stay put, wait for weather to clear
        // (applyWeatherResponse handles exit condition)
        c.velocity.set(0, 0, 0)
        break

      case 'migrating':
        // Migrating: steer toward targetPos set by weather response
        if (this.atTarget(c, 3) || c.stateTimer > 12) {
          c.state = 'idle'; c.stateTimer = 0; c.velocity.set(0, 0, 0)
        } else {
          this.steerToTarget(c, sp.maxSpeed * 0.6)
        }
        break

      case 'reverence':
        // Reverence: minimal movement, facing site — handled by SiteAwareness
        // If we reach the state machine, site awareness is no longer active, revert
        c.state = 'idle'; c.stateTimer = 0; c.velocity.set(0, 0, 0)
        break

      case 'resonating':
        // Resonating: circular ritual path — handled by SiteAwareness
        // If we reach the state machine, site awareness is no longer active, revert
        c.state = 'idle'; c.stateTimer = 0; c.velocity.set(0, 0, 0)
        c.glowing = false
        break
    }
  }

  private applyMovement(c: Creature, delta: number, world: World) {
    if (c.state === 'dead' || c.state === 'sleep' || c.state === 'sheltering') return
    if (c.velocity.lengthSq() < 0.001) return
    const sp = getCreatureStats(c)

    c.position.addScaledVector(c.velocity, delta)

    if (sp.mobility === 'ground') {
      const h = world.getHeightAt(c.position.x, c.position.z)
      if (h !== null) {
        c.position.y = h + sp.bodyH * c.scale * 0.5 + 0.1
      }
    } else if (sp.mobility === 'water') {
      c.position.y = WATER_LEVEL - 0.5
    } else {
      // Air: gentle hover bob
      c.position.y += Math.sin(Date.now() * 0.001 + c.position.z * 0.1) * 0.008
    }

    if (c.velocity.lengthSq() > 0.01) {
      c.heading = Math.atan2(c.velocity.x, c.velocity.z)
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  private atTarget(c: Creature, threshold = 2): boolean {
    if (!c.targetPos) return true
    const dx = c.targetPos.x - c.position.x
    const dz = c.targetPos.z - c.position.z
    return dx * dx + dz * dz < threshold * threshold
  }

  private steerToTarget(c: Creature, speed: number) {
    if (!c.targetPos) return
    const dx = c.targetPos.x - c.position.x
    const dz = c.targetPos.z - c.position.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len < 0.1) { c.velocity.set(0, 0, 0); return }
    const s = speed * CREATURE_CONFIG.speedMultiplier
    c.velocity.set((dx / len) * s, 0, (dz / len) * s)
  }

  private steerAwayFrom(c: Creature, threat: THREE.Vector3, speed: number) {
    const dx = c.position.x - threat.x
    const dz = c.position.z - threat.z
    const len = Math.sqrt(dx * dx + dz * dz)
    const s = speed * CREATURE_CONFIG.speedMultiplier
    if (len < 0.1) { c.velocity.set(s, 0, 0); return }
    c.velocity.set((dx / len) * s, 0, (dz / len) * s)
  }

  private wanderTarget(c: Creature): THREE.Vector3 {
    const angle = this.rng.range(0, Math.PI * 2)
    const dist  = this.rng.range(5, 20)
    return new THREE.Vector3(
      c.position.x + Math.cos(angle) * dist,
      c.position.y,
      c.position.z + Math.sin(angle) * dist
    )
  }

  private beginSeek(c: Creature, state: Creature['state']) {
    c.state = state; c.stateTimer = 0; c.targetPos = null
  }

  private goWander(c: Creature) {
    c.state = 'wander'; c.stateTimer = 0; c.targetPos = this.wanderTarget(c)
  }

  private startFlee(c: Creature, threat: THREE.Vector3) {
    c.state = 'flee'; c.stateTimer = 0; c.targetId = null; c.targetPos = null
    this.steerAwayFrom(c, threat, getCreatureStats(c).fleeSpeed)
  }

  private tryHunt(c: Creature) {
    const prey = this.findPrey(c, null)
    if (prey) { c.state = 'hunt'; c.stateTimer = 0; c.targetId = prey }
  }

  // ─── Query helpers ────────────────────────────────────────────────────────────

  private findThreat(c: Creature, playerPos: THREE.Vector3): THREE.Vector3 | null {
    const sp = getCreatureStats(c)
    const sr = sp.sightRange * CREATURE_CONFIG.aggroRange

    // Check player distance with squared comparison (Phase 5c)
    const pdx = c.position.x - playerPos.x
    const pdz = c.position.z - playerPos.z
    if (pdx * pdx + pdz * pdz < sr * sr) return playerPos

    // Use spatial grid instead of iterating all creatures (Phase 4)
    const threat = this.grid.queryNearest(c.position, sr, (other) =>
      other !== c && getCreatureStats(other).role === 'predator'
    )
    return threat ? threat.position : null
  }

  private findFood(c: Creature, world: World): THREE.Vector3 | null {
    const R = 30, step = 8
    let best: THREE.Vector3 | null = null
    let bestDist = Infinity
    for (let dz = -R; dz <= R; dz += step) {
      for (let dx = -R; dx <= R; dx += step) {
        const wx = c.position.x + dx
        const wz = c.position.z + dz
        if (world.getFoodAt(wx, wz)) {
          const d2 = dx * dx + dz * dz
          if (d2 < bestDist) {
            bestDist = d2
            const h = world.getHeightAt(wx, wz) ?? c.position.y
            best = new THREE.Vector3(wx, h, wz)
          }
        }
      }
    }
    return best
  }

  private findWater(c: Creature, world: World): THREE.Vector3 | null {
    const R = 40, step = 8
    let best: THREE.Vector3 | null = null
    let bestDist = Infinity
    for (let dz = -R; dz <= R; dz += step) {
      for (let dx = -R; dx <= R; dx += step) {
        const wx = c.position.x + dx
        const wz = c.position.z + dz
        if (world.getWaterAt(wx, wz)) {
          const d2 = dx * dx + dz * dz
          if (d2 < bestDist) {
            bestDist = d2
            best = new THREE.Vector3(wx, WATER_LEVEL, wz)
          }
        }
      }
    }
    return best
  }

  private findMate(c: Creature): Creature | null {
    return this.grid.queryNearest(c.position, 30, (other) => {
      if (other === c) return false
      if (other.state !== 'seek_mate' && other.state !== 'idle' && other.state !== 'wander') return false
      if (other.reproductionCooldown > 0) return false

      // DNA creatures: allow any body plan (breedDNA handles the 15% chance for cross-body)
      if (c.dna && other.dna) return true

      // Legacy: same species only
      return other.species === c.species
    })
  }

  // Returns a creature id or PLAYER_ID or null
  private findPrey(c: Creature, playerPos: THREE.Vector3 | null): string | null {
    const sp = getCreatureStats(c)
    const aggroSight = sp.sightRange * CREATURE_CONFIG.aggroRange
    const range = aggroSight * 2

    // Use spatial grid (Phase 4)
    const prey = this.grid.queryNearest(c.position, range, (other) =>
      other !== c && getCreatureStats(other).role === 'herbivore' && other.state !== 'dead'
    )

    let best: string | null = prey ? prey.id : null
    let bestDist = prey
      ? Math.sqrt((prey.position.x - c.position.x) ** 2 + (prey.position.z - c.position.z) ** 2)
      : range

    // Also consider the player as prey (secondary)
    if (playerPos) {
      const pdx = c.position.x - playerPos.x
      const pdz = c.position.z - playerPos.z
      const distToPlayer = Math.sqrt(pdx * pdx + pdz * pdz)
      if (distToPlayer < aggroSight && distToPlayer < bestDist) {
        best = PLAYER_ID
      }
    }

    return best
  }

  private spawnBaby(parentA: Creature, parentB: Creature) {
    if (this.creatures.size >= MAX_POPULATION) return

    const mid = new THREE.Vector3(
      (parentA.position.x + parentB.position.x) * 0.5,
      (parentA.position.y + parentB.position.y) * 0.5,
      (parentA.position.z + parentB.position.z) * 0.5
    )

    // DNA breeding path
    if (parentA.dna && parentB.dna) {
      const childDna = breedDNA(parentA.dna, parentB.dna)
      if (!childDna) return  // cross-body breeding failed

      const stats = dnaToStats(childDna)
      const speciesId = dnaToSpeciesId(childDna)
      const baby = new Creature(speciesId, mid, stats.babyScale)
      baby.dna = childDna
      baby.stats = stats
      this.creatures.set(baby.id, baby)
    } else {
      // Legacy fallback
      const sp = SPECIES[parentA.species]
      const baby = new Creature(parentA.species, mid, sp.babyScale)
      this.creatures.set(baby.id, baby)
    }

    parentB.reproductionCooldown = 120
    parentB.state = 'idle'; parentB.stateTimer = 0; parentB.targetId = null
  }
}
