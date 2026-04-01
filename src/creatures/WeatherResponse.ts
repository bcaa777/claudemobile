import * as THREE from 'three'
import { Creature } from './Creature'
import { getCreatureStats } from './CreatureDNA'
import { WorldState } from '../systems/WorldState'
import { WATER_LEVEL } from '../world/TerrainGenerator'

// States that should never be overridden by weather response
const PRIORITY_STATES = new Set(['dead', 'flee', 'attack', 'chase', 'mating', 'courtship'])

const _tmpVec = new THREE.Vector3()

/**
 * Apply weather-based behavior overrides to a creature.
 * Called each frame before the normal state machine tick.
 */
export function applyWeatherResponse(
  creature: Creature,
  worldState: WorldState,
  nearbyLandmarks: THREE.Vector3[],
): void {
  // Never override high-priority combat/death states
  if (PRIORITY_STATES.has(creature.state)) return

  const sp = getCreatureStats(creature)
  const weather = worldState.currentWeather
  const severity = worldState.weatherSeverity
  const timeOfDay = worldState.timeOfDay

  // --- Severe storm: all creatures hunker down ---
  if (severity > 0.7) {
    if (creature.state !== 'sheltering') {
      creature.state = 'sheltering'
      creature.stateTimer = 0
      creature.velocity.set(0, 0, 0)
    }
    return
  }

  // --- Rain behavior ---
  if (weather === 'rain' || weather === 'storm') {
    if (sp.role === 'herbivore') {
      // Move toward nearest landmark for shelter
      const shelter = findNearest(creature.position, nearbyLandmarks)
      if (shelter && creature.state !== 'sheltering') {
        const dist = creature.position.distanceTo(shelter)
        if (dist < 3) {
          // Already at shelter
          creature.state = 'sheltering'
          creature.stateTimer = 0
          creature.velocity.set(0, 0, 0)
        } else if (dist < 60) {
          // Move toward shelter
          creature.state = 'migrating'
          creature.stateTimer = 0
          if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
          creature.targetPos.copy(shelter)
          steerToward(creature, shelter, sp.maxSpeed * 0.6)
        }
      }
      return
    }
    if (sp.role === 'predator') {
      // Predators are more active in rain — prey is distracted
      // Boost handled by not overriding state; the hunt range increase
      // is applied in CreatureManager via the huntRangeMultiplier
      return
    }
  }

  // --- Sandstorm: herbivores seek water ---
  if (weather === 'sandstorm') {
    if (sp.role === 'herbivore') {
      if (creature.state !== 'migrating' && creature.state !== 'seek_water' && creature.state !== 'drinking') {
        // Move toward low ground (water areas)
        const waterTarget = findWaterDirection(creature.position)
        if (waterTarget) {
          creature.state = 'migrating'
          creature.stateTimer = 0
          if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
          creature.targetPos.copy(waterTarget)
          steerToward(creature, waterTarget, sp.maxSpeed * 0.5)
        }
      }
      return
    }
  }

  // --- Clear night: nocturnal/diurnal behavior ---
  const isNight = timeOfDay > 0.8 || timeOfDay < 0.2
  if (isNight && weather === 'clear') {
    if (sp.role === 'herbivore') {
      // Diurnal herbivores sleep at night (unless already handled by state machine)
      if (creature.state === 'idle' || creature.state === 'wander') {
        creature.state = 'sleep'
        creature.stateTimer = 0
        creature.velocity.set(0, 0, 0)
      }
    }
    // Nocturnal predators are more active — no override needed, they just
    // don't sleep. The existing state machine already handles hunt behavior.
  }

  // --- Exit sheltering/migrating when conditions clear ---
  if (creature.state === 'sheltering' && severity <= 0.3 && weather === 'clear') {
    creature.state = 'idle'
    creature.stateTimer = 0
  }
  if (creature.state === 'migrating' && creature.stateTimer > 10) {
    // Timeout migration after 10s
    creature.state = 'idle'
    creature.stateTimer = 0
  }
}

/**
 * Get the rain hunt range multiplier for predators.
 * Returns 1.5 during rain, 1.0 otherwise.
 */
export function getWeatherHuntRangeMultiplier(worldState: WorldState): number {
  const weather = worldState.currentWeather
  if ((weather === 'rain' || weather === 'storm') && worldState.weatherSeverity <= 0.7) {
    return 1.5
  }
  return 1.0
}

// --- Helpers ---

function findNearest(pos: THREE.Vector3, candidates: THREE.Vector3[]): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null
  let bestDistSq = Infinity
  for (const c of candidates) {
    const dx = c.x - pos.x
    const dz = c.z - pos.z
    const d2 = dx * dx + dz * dz
    if (d2 < bestDistSq) {
      bestDistSq = d2
      best = c
    }
  }
  return best
}

function findWaterDirection(pos: THREE.Vector3): THREE.Vector3 | null {
  // Move toward the nearest point at water level
  // Simple heuristic: move downhill toward Y = WATER_LEVEL
  if (pos.y <= WATER_LEVEL + 1) return null // already near water
  // Pick a random-ish direction biased toward lower ground
  _tmpVec.set(
    pos.x + (Math.random() - 0.5) * 40,
    WATER_LEVEL,
    pos.z + (Math.random() - 0.5) * 40
  )
  return _tmpVec.clone()
}

function steerToward(creature: Creature, target: THREE.Vector3, speed: number) {
  const dx = target.x - creature.position.x
  const dz = target.z - creature.position.z
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len < 0.1) { creature.velocity.set(0, 0, 0); return }
  creature.velocity.set((dx / len) * speed, 0, (dz / len) * speed)
}
