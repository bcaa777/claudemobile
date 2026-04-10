import * as THREE from 'three'
import type { IWorld } from 'bitecs'
import { BiomeType } from '@engine/core'
import type { EventBus } from '@engine/core'
import type { EnemyManager } from './EnemyFactory'
import { BOSS_DEFS, UNDERGROUND_BOSS_DEFS } from './BossDefs'
import type { BossDef, BossPhase } from './BossDefs'
import { isUndergroundId } from '../expedition/UndergroundBiomes'
import { BIOME_ENEMY_TEMPLATES } from './EnemyDNA'
import type { EnemyArchetype } from './EnemyDNA'

const BOSS_HIT_RADIUS = 3
const BOSS_DAMAGE_COOLDOWN = 1.0
const CHARGE_PAUSE = 0.8
const BURST_PROJECTILE_COUNT = 4

export class BossSystem {
  private def: BossDef | null = null
  private mesh: THREE.Mesh | null = null
  private healthBar: HTMLElement | null = null
  private healthFill: HTMLElement | null = null
  private healthLabel: HTMLElement | null = null
  private hp = 0
  private maxHp = 0
  private currentPhaseIndex = 0
  private chargeTimer = 0
  private actionTimer = 0
  private damageCooldown = 0
  private scene: THREE.Scene | null = null
  active = false

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  spawn(
    world: IWorld,
    scene: THREE.Scene,
    playerPos: THREE.Vector3,
    biome: BiomeType | number,
  ): void {
    this.scene = scene

    const biomeType = biome as BiomeType
    this.def = (isUndergroundId(biome as number)
      ? UNDERGROUND_BOSS_DEFS[biome as number]
      : BOSS_DEFS[biomeType]) ?? BOSS_DEFS[BiomeType.Forest]

    this.maxHp = this.def.hp
    this.hp = this.maxHp
    this.currentPhaseIndex = 0
    this.chargeTimer = 0
    this.actionTimer = 0
    this.damageCooldown = 0

    // Spawn 40 units in front of player
    const spawnX = playerPos.x + 40
    const spawnZ = playerPos.z
    const spawnY = playerPos.y

    const s = this.def.size
    const geo = new THREE.BoxGeometry(s, s * 1.5, s)
    const mat = new THREE.MeshLambertMaterial({
      color: this.def.color,
      emissive: new THREE.Color(
        ((this.def.color >> 16) & 0xff) / 255 * 0.35,
        ((this.def.color >> 8)  & 0xff) / 255 * 0.35,
        ( this.def.color        & 0xff) / 255 * 0.35,
      ),
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(spawnX, spawnY + s * 0.75, spawnZ)
    scene.add(this.mesh)

    this.active = true
    this._createHealthBar()

    console.log(`[BossSystem] ${this.def.name} spawned — HP: ${this.maxHp}`)
  }

  getPosition(): THREE.Vector3 | null {
    return this.mesh ? this.mesh.position : null
  }

  takeDamage(amount: number): void {
    if (!this.active) return
    this.hp = Math.max(0, this.hp - amount)

    if (this.mesh) {
      const mat = this.mesh.material as THREE.MeshLambertMaterial
      mat.emissive.setRGB(1, 0.3, 0.3)
      setTimeout(() => {
        if (mat) mat.emissive.setRGB(0.15, 0, 0)
      }, 100)
    }
  }

  update(
    delta: number,
    world: IWorld,
    enemyManager: EnemyManager,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    eventBus: EventBus,
  ): void {
    if (!this.active || !this.mesh || !this.def) return

    if (this.hp <= 0) {
      this._die(eventBus)
      return
    }

    // Advance to highest applicable phase
    const hpFrac = this.hp / this.maxHp
    for (let i = this.def.phases.length - 1; i >= 0; i--) {
      if (hpFrac < this.def.phases[i].hpThreshold) {
        this.currentPhaseIndex = i
        break
      }
    }

    this._updateHealthBar()

    // Contact damage
    if (this.damageCooldown > 0) this.damageCooldown -= delta
    const dx = this.mesh.position.x - playerPos.x
    const dz = this.mesh.position.z - playerPos.z
    if (Math.sqrt(dx * dx + dz * dz) < BOSS_HIT_RADIUS && this.damageCooldown <= 0) {
      const phase = this._currentPhase()
      eventBus.emit('bossDamagePlayer', { amount: phase.attackDamage })
      this.damageCooldown = BOSS_DAMAGE_COOLDOWN
    }

    // Drive behavior from phase definition
    const phase = this._currentPhase()
    switch (phase.behavior) {
      case 'charge':
        this._behaviorCharge(delta, playerPos, sampleHeight, phase)
        break
      case 'ranged_burst':
        this._behaviorRangedBurst(delta, playerPos, sampleHeight, phase, eventBus)
        break
      case 'summon':
        this._behaviorSummon(delta, world, enemyManager, playerPos, sampleHeight, phase)
        break
      case 'aoe_slam':
        this._behaviorAoeSlam(delta, playerPos, sampleHeight, phase, eventBus)
        break
      case 'enraged':
        this._behaviorEnraged(delta, world, enemyManager, playerPos, sampleHeight, phase)
        break
    }
  }

  dispose(): void {
    if (!this.active) return
    this.active = false
    this._cleanupMesh()
    this._removeHealthBar()
  }

  // -----------------------------------------------------------------------
  // Phase behaviors
  // -----------------------------------------------------------------------

  private _behaviorCharge(
    delta: number,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    phase: BossPhase,
  ): void {
    if (!this.mesh) return

    if (this.chargeTimer > 0) {
      this.chargeTimer -= delta
      return
    }

    const dx = playerPos.x - this.mesh.position.x
    const dz = playerPos.z - this.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 2) {
      this.chargeTimer = CHARGE_PAUSE
      return
    }

    const nx = dx / dist
    const nz = dz / dist
    this.mesh.position.x += nx * phase.speed * delta
    this.mesh.position.z += nz * phase.speed * delta
    this.mesh.position.y =
      sampleHeight(this.mesh.position.x, this.mesh.position.z) + (this.def?.size ?? 3) * 0.75
  }

  private _behaviorRangedBurst(
    delta: number,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    phase: BossPhase,
    eventBus: EventBus,
  ): void {
    if (!this.mesh) return

    // Slowly drift toward player but stay at range
    const dx = playerPos.x - this.mesh.position.x
    const dz = playerPos.z - this.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 12) {
      const nx = dx / dist
      const nz = dz / dist
      this.mesh.position.x += nx * phase.speed * delta
      this.mesh.position.z += nz * phase.speed * delta
      this.mesh.position.y =
        sampleHeight(this.mesh.position.x, this.mesh.position.z) + (this.def?.size ?? 3) * 0.75
    }

    this.actionTimer += delta
    if (this.actionTimer >= phase.attackCooldown) {
      this.actionTimer = 0
      // Emit event so Game/ProjectileSystem can spawn boss projectiles
      eventBus.emit('bossRangedBurst', {
        origin: this.mesh.position.clone(),
        target: playerPos.clone(),
        count: BURST_PROJECTILE_COUNT,
        damage: phase.attackDamage,
      })
    }
  }

  private _behaviorSummon(
    delta: number,
    world: IWorld,
    enemyManager: EnemyManager,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    phase: BossPhase,
  ): void {
    if (!this.mesh) return

    // Slow drift
    const dx = playerPos.x - this.mesh.position.x
    const dz = playerPos.z - this.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 15) {
      const nx = dx / dist
      const nz = dz / dist
      this.mesh.position.x += nx * phase.speed * delta
      this.mesh.position.z += nz * phase.speed * delta
      this.mesh.position.y =
        sampleHeight(this.mesh.position.x, this.mesh.position.z) + (this.def?.size ?? 3) * 0.75
    }

    this.actionTimer += delta
    if (this.actionTimer >= phase.attackCooldown) {
      this.actionTimer = 0
      const count = phase.summonCount ?? 3
      this._spawnMinions(world, enemyManager, count, sampleHeight)
    }
  }

  private _behaviorAoeSlam(
    delta: number,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    phase: BossPhase,
    eventBus: EventBus,
  ): void {
    if (!this.mesh) return

    // Close in then slam
    const dx = playerPos.x - this.mesh.position.x
    const dz = playerPos.z - this.mesh.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > 6) {
      const nx = dx / dist
      const nz = dz / dist
      this.mesh.position.x += nx * phase.speed * delta
      this.mesh.position.z += nz * phase.speed * delta
      this.mesh.position.y =
        sampleHeight(this.mesh.position.x, this.mesh.position.z) + (this.def?.size ?? 3) * 0.75
    }

    this.actionTimer += delta
    if (this.actionTimer >= phase.attackCooldown) {
      this.actionTimer = 0
      const radius = phase.aoeRadius ?? 6
      const d2 = dx * dx + dz * dz
      if (d2 < radius * radius) {
        // Player is in range — slam!
        eventBus.emit('bossDamagePlayer', { amount: phase.attackDamage })
        this.damageCooldown = BOSS_DAMAGE_COOLDOWN
      }
    }
  }

  private _behaviorEnraged(
    delta: number,
    world: IWorld,
    enemyManager: EnemyManager,
    playerPos: THREE.Vector3,
    sampleHeight: (x: number, z: number) => number,
    phase: BossPhase,
  ): void {
    // Fast charge
    this._behaviorCharge(delta, playerPos, sampleHeight, phase)

    // Occasional summons
    this.actionTimer += delta
    if (this.actionTimer >= phase.attackCooldown * 3) {
      this.actionTimer = 0
      const count = phase.summonCount ?? 1
      this._spawnMinions(world, enemyManager, count, sampleHeight)
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private _currentPhase(): BossPhase {
    if (!this.def) {
      return { hpThreshold: 1.0, behavior: 'charge', speed: 8, attackCooldown: 1.0, attackDamage: 20 }
    }
    return this.def.phases[this.currentPhaseIndex]
  }

  private _spawnMinions(
    world: IWorld,
    enemyManager: EnemyManager,
    count: number,
    sampleHeight: (x: number, z: number) => number,
  ): void {
    if (!this.mesh || !this.def) return

    // Pick a biome-appropriate archetype for minions
    const templates = BIOME_ENEMY_TEMPLATES[this.def.biome] ?? []
    const archetypes: EnemyArchetype[] = templates.length > 0
      ? templates.map(t => t.archetype)
      : ['rusher']

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const r = 6 + Math.random() * 4
      const x = this.mesh.position.x + Math.cos(angle) * r
      const z = this.mesh.position.z + Math.sin(angle) * r
      const y = sampleHeight(x, z)
      const archetype = archetypes[Math.floor(Math.random() * archetypes.length)]
      enemyManager.spawn(world, { x, y, z }, archetype, 1, this.def.biome)
    }
  }

  private _die(eventBus: EventBus): void {
    if (!this.active) return
    this.active = false
    this._cleanupMesh()
    this._removeHealthBar()
    const name = this.def?.name ?? 'Boss'
    eventBus.emit('bossDied', { goldDrop: 100 + (this.def?.hp ?? 0) / 5 })
    console.log(`[BossSystem] ${name} defeated!`)
    this.def = null
  }

  private _cleanupMesh(): void {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh)
      ;(this.mesh.material as THREE.Material).dispose()
      this.mesh.geometry.dispose()
      this.mesh = null
    }
  }

  // -----------------------------------------------------------------------
  // Health bar UI
  // -----------------------------------------------------------------------

  private _createHealthBar(): void {
    const bar = document.createElement('div')
    bar.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: 480px;
      background: rgba(0,0,0,0.75);
      border: 2px solid #660000;
      border-radius: 4px;
      padding: 6px 10px;
      z-index: 200;
      font-family: 'Courier New', monospace;
      pointer-events: none;
    `

    const label = document.createElement('div')
    label.style.cssText = `
      color: #ff4444;
      font-size: 12px;
      letter-spacing: 2px;
      text-align: center;
      margin-bottom: 4px;
      text-shadow: 0 0 8px #ff0000;
    `
    label.textContent = this.def?.name.toUpperCase() ?? 'BOSS'
    bar.appendChild(label)
    this.healthLabel = label

    const track = document.createElement('div')
    track.style.cssText = `
      width: 100%;
      height: 14px;
      background: #330000;
      border-radius: 2px;
      overflow: hidden;
    `
    bar.appendChild(track)

    const fill = document.createElement('div')
    fill.style.cssText = `
      width: 100%;
      height: 100%;
      background: #cc0000;
      transition: width 0.1s linear;
    `
    track.appendChild(fill)
    this.healthFill = fill

    document.body.appendChild(bar)
    this.healthBar = bar
  }

  private _removeHealthBar(): void {
    if (this.healthBar) {
      this.healthBar.parentElement?.removeChild(this.healthBar)
      this.healthBar = null
      this.healthFill = null
      this.healthLabel = null
    }
  }

  private _updateHealthBar(): void {
    if (!this.healthFill || !this.healthLabel || !this.def) return
    const pct = Math.max(0, this.hp / this.maxHp) * 100
    this.healthFill.style.width = `${pct}%`
    const phase = this._currentPhase()
    const phaseLabel = phase.behavior === 'enraged' ? ' [ENRAGED]'
      : this.currentPhaseIndex === 1 ? ' [PHASE 2]'
      : this.currentPhaseIndex >= 2 ? ' [PHASE 3]'
      : ''
    this.healthLabel.textContent =
      `${this.def.name.toUpperCase()}${phaseLabel}  ${Math.ceil(this.hp)} / ${this.maxHp}`
  }
}
