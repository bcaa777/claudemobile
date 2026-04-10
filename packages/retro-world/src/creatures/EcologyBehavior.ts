import * as THREE from 'three'
import { Creature, CreatureState } from './Creature'
import { getCreatureStats } from './CreatureDNA'
import { SpatialGrid } from './SpatialGrid'

/**
 * Ecology behavior system — handles creature-creature interactions:
 * - Herding: herbivores of same species flock together
 * - Food chain: predators hunting cause nearby prey to flee
 * - Territorial: wolf packs establish territories that deter other predators
 */

// States that ecology should never override
const ECOLOGY_PRIORITY_STATES = new Set<CreatureState>([
  'dead', 'attack', 'mating', 'courtship', 'sheltering', 'eating', 'drinking', 'sleep',
])

// Wolf-like species that form territorial packs
function isPackCreature(c: Creature): boolean {
  return c.dna ? (c.dna.aggression > 0.7 && c.dna.bodyPlan === 'quadruped') : (c.species === 'wolf' || c.species === 'hellhound')
}

const HERD_RADIUS = 20
const HERD_MIN_SIZE = 3
const TERRITORY_RADIUS = 30
const TERRITORY_MIN_WOLVES = 3

export interface TerritoryCenter {
  x: number
  z: number
  strength: number // number of wolves in the cluster
}

// Per-frame cache for wolf territory centers
let _territoryCacheFrame = -1
let _territoryCenters: TerritoryCenter[] = []

// Reusable vectors to avoid allocations
const _groupCenter = new THREE.Vector3()
const _avgVelocity = new THREE.Vector3()
const _fleeDir = new THREE.Vector3()

/**
 * Compute wolf/pack territory centers for this frame.
 * Cached so it only runs once per frame even if called for many creatures.
 */
export function computeTerritories(
  grid: SpatialGrid<Creature>,
  frameCounter: number,
): TerritoryCenter[] {
  if (_territoryCacheFrame === frameCounter) return _territoryCenters

  _territoryCacheFrame = frameCounter
  _territoryCenters.length = 0

  // Collect all living pack-species creatures
  const packCreatures: Creature[] = []
  const all = grid.flat
  for (let i = 0; i < all.length; i++) {
    const c = all[i]
    if (c.state !== 'dead' && isPackCreature(c)) {
      packCreatures.push(c)
    }
  }

  if (packCreatures.length < TERRITORY_MIN_WOLVES) return _territoryCenters

  // Simple clustering: for each pack creature, check if 3+ same-species
  // are within TERRITORY_RADIUS. Use a visited set to avoid duplicate clusters.
  const visited = new Set<string>()

  for (let i = 0; i < packCreatures.length; i++) {
    const wolf = packCreatures[i]
    if (visited.has(wolf.id)) continue

    const neighbors = grid.queryRadius(wolf.position, TERRITORY_RADIUS, (other) =>
      other !== wolf &&
      (wolf.dna ? isPackCreature(other) : other.species === wolf.species) &&
      other.state !== 'dead'
    )

    if (neighbors.length + 1 >= TERRITORY_MIN_WOLVES) {
      // Compute center of this cluster
      let cx = wolf.position.x
      let cz = wolf.position.z
      visited.add(wolf.id)
      for (let j = 0; j < neighbors.length; j++) {
        cx += neighbors[j].position.x
        cz += neighbors[j].position.z
        visited.add(neighbors[j].id)
      }
      const total = neighbors.length + 1
      _territoryCenters.push({
        x: cx / total,
        z: cz / total,
        strength: total,
      })
    }
  }

  return _territoryCenters
}

/**
 * Apply ecology behaviors to a single creature.
 * Called after weather response but before the normal state machine.
 *
 * Can set creature state to 'flee' (food chain) or adjust velocity (herding).
 */
export function applyEcologyBehavior(
  creature: Creature,
  grid: SpatialGrid<Creature>,
  frameCounter: number,
): void {
  // Never override high-priority states
  if (ECOLOGY_PRIORITY_STATES.has(creature.state)) return

  const sp = getCreatureStats(creature)

  // --- Food chain: predators in hunt/chase cause prey to flee ---
  if (sp.role === 'herbivore') {
    applyFoodChainFlee(creature, grid)
  }

  // --- Herding: herbivores flock with same species ---
  if (sp.role === 'herbivore' && (creature.state === 'idle' || creature.state === 'wander')) {
    applyHerding(creature, grid)
  }

  // --- Territorial: wolf territories deter other predators ---
  if (sp.role === 'predator' && !isPackCreature(creature)) {
    applyTerritoryAvoidance(creature, frameCounter, grid)
  }
}

/**
 * Food chain: if a predator nearby is in hunt/chase, this herbivore flees.
 */
function applyFoodChainFlee(creature: Creature, grid: SpatialGrid<Creature>): void {
  // Already fleeing — don't re-trigger
  if (creature.state === 'flee') return

  const sp = getCreatureStats(creature)
  const sightRange = sp.sightRange

  // Find nearest predator in hunt/chase within sight range
  const predator = grid.queryNearest(creature.position, sightRange, (other) =>
    other !== creature &&
    other.state !== 'dead' &&
    getCreatureStats(other).role === 'predator' &&
    (other.state === 'hunt' || other.state === 'chase')
  )

  if (predator) {
    creature.state = 'flee'
    creature.stateTimer = 0
    creature.targetId = null
    creature.targetPos = null

    // Steer away from predator
    const dx = creature.position.x - predator.position.x
    const dz = creature.position.z - predator.position.z
    const len = Math.sqrt(dx * dx + dz * dz)
    const speed = sp.fleeSpeed
    if (len > 0.1) {
      creature.velocity.set((dx / len) * speed, 0, (dz / len) * speed)
    } else {
      creature.velocity.set(speed, 0, 0)
    }
  }
}

/**
 * Herding: herbivores of same species align velocities and move toward group center.
 */
function applyHerding(creature: Creature, grid: SpatialGrid<Creature>): void {
  const neighbors = grid.queryRadius(creature.position, HERD_RADIUS, (other) =>
    other !== creature &&
    (creature.dna ? other.dna?.bodyPlan === creature.dna.bodyPlan : other.species === creature.species) &&
    other.state !== 'dead'
  )

  if (neighbors.length + 1 < HERD_MIN_SIZE) return

  // Compute group center and average velocity
  _groupCenter.set(creature.position.x, creature.position.y, creature.position.z)
  _avgVelocity.set(creature.velocity.x, 0, creature.velocity.z)

  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i]
    _groupCenter.x += n.position.x
    _groupCenter.z += n.position.z
    _avgVelocity.x += n.velocity.x
    _avgVelocity.z += n.velocity.z
  }

  const total = neighbors.length + 1
  _groupCenter.x /= total
  _groupCenter.z /= total
  _avgVelocity.x /= total
  _avgVelocity.z /= total

  // Blend creature velocity toward group center direction + average heading
  const sp = getCreatureStats(creature)
  const towardCenterX = _groupCenter.x - creature.position.x
  const towardCenterZ = _groupCenter.z - creature.position.z
  const centerLen = Math.sqrt(towardCenterX * towardCenterX + towardCenterZ * towardCenterZ)

  if (centerLen > 0.5) {
    // Cohesion: steer toward center (weight 0.3)
    // Alignment: match average velocity (weight 0.3)
    // Keep own velocity (weight 0.4)
    const cohesionWeight = 0.3
    const alignWeight = 0.3
    const selfWeight = 0.4
    const speed = sp.maxSpeed * 0.5

    const normCX = (towardCenterX / centerLen) * speed
    const normCZ = (towardCenterZ / centerLen) * speed

    creature.velocity.x = creature.velocity.x * selfWeight + normCX * cohesionWeight + _avgVelocity.x * alignWeight
    creature.velocity.z = creature.velocity.z * selfWeight + normCZ * cohesionWeight + _avgVelocity.z * alignWeight

    // Clamp to max speed
    const vLen = Math.sqrt(creature.velocity.x ** 2 + creature.velocity.z ** 2)
    if (vLen > sp.maxSpeed) {
      creature.velocity.x = (creature.velocity.x / vLen) * sp.maxSpeed
      creature.velocity.z = (creature.velocity.z / vLen) * sp.maxSpeed
    }

    // Ensure creature is in wander state so it moves
    if (creature.state === 'idle') {
      creature.state = 'wander'
      creature.stateTimer = 0
      if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
      creature.targetPos.set(_groupCenter.x, creature.position.y, _groupCenter.z)
    }
  }
}

/**
 * Territorial avoidance: non-wolf predators near wolf territory reduce aggression
 * and steer away from the territory center.
 */
function applyTerritoryAvoidance(
  creature: Creature,
  frameCounter: number,
  grid: SpatialGrid<Creature>,
): void {
  const territories = computeTerritories(grid, frameCounter)
  if (territories.length === 0) return

  for (let i = 0; i < territories.length; i++) {
    const t = territories[i]
    const dx = creature.position.x - t.x
    const dz = creature.position.z - t.z
    const distSq = dx * dx + dz * dz

    if (distSq < TERRITORY_RADIUS * TERRITORY_RADIUS) {
      // Inside a wolf territory — if hunting/chasing, revert to wander away
      if (creature.state === 'hunt' || creature.state === 'chase') {
        creature.state = 'wander'
        creature.stateTimer = 0
        creature.targetId = null

        // Set target position away from territory center
        const dist = Math.sqrt(distSq)
        if (dist > 0.1) {
          if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
          creature.targetPos.set(
            creature.position.x + (dx / dist) * TERRITORY_RADIUS,
            creature.position.y,
            creature.position.z + (dz / dist) * TERRITORY_RADIUS,
          )
        }
        return // Only respond to one territory
      }

      // If idle/wander near a territory, gently steer away
      if (creature.state === 'idle' || creature.state === 'wander') {
        const dist = Math.sqrt(distSq)
        if (dist > 0.1) {
          const sp = getCreatureStats(creature)
          const avoidSpeed = sp.maxSpeed * 0.4
          creature.velocity.x = (dx / dist) * avoidSpeed
          creature.velocity.z = (dz / dist) * avoidSpeed

          if (creature.state === 'idle') {
            creature.state = 'wander'
            creature.stateTimer = 0
            if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
            creature.targetPos.set(
              creature.position.x + (dx / dist) * 15,
              creature.position.y,
              creature.position.z + (dz / dist) * 15,
            )
          }
        }
        return
      }
    }
  }
}
