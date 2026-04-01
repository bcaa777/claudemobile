import * as THREE from 'three'
import { Creature } from './Creature'
import { getCreatureStats } from './CreatureDNA'
import type { BodyPlan } from './CreatureDNA'
import { WorldState, ResonanceSite } from '../systems/WorldState'
import { BiomeType } from '../biomes/types'

// Site awareness radius — creatures within this distance are affected
const SITE_RADIUS = 30
const SITE_RADIUS_SQ = SITE_RADIUS * SITE_RADIUS

// Ritual orbit radius and speed
const ORBIT_RADIUS = 8
const ORBIT_SPEED = 1.5 // units/sec — angular speed derived from this

// States that should never be overridden by site awareness
const PRIORITY_STATES = new Set(['dead', 'flee', 'mating', 'courtship'])

// Attuned body plans per biome — these creatures glow and perform ritual orbits
const BIOME_ATTUNED_PLANS: Partial<Record<BiomeType, Set<BodyPlan> | null>> = {
  [BiomeType.Forest]:   new Set<BodyPlan>(['quadruped']),
  [BiomeType.Desert]:   new Set<BodyPlan>(['quadruped', 'serpentine']),
  [BiomeType.Swamp]:    new Set<BodyPlan>(['insectoid', 'aquatic']),
  [BiomeType.Snow]:     new Set<BodyPlan>(['quadruped']),
  [BiomeType.Volcanic]: new Set<BodyPlan>(['serpentine']),
  [BiomeType.Crystal]:  null,  // any creature
  [BiomeType.Jungle]:   new Set<BodyPlan>(['avian', 'insectoid']),
  [BiomeType.Mesa]:     new Set<BodyPlan>(['quadruped']),
  [BiomeType.Heaven]:   new Set<BodyPlan>(['avian']),
}

// Biome-themed glow colors for attuned creatures
const BIOME_GLOW_COLORS: Partial<Record<BiomeType, number>> = {
  [BiomeType.Forest]:   0x44ff66,
  [BiomeType.Desert]:   0xffcc44,
  [BiomeType.Swamp]:    0x66ff88,
  [BiomeType.Snow]:     0x88ccff,
  [BiomeType.Volcanic]: 0xff6622,
  [BiomeType.Crystal]:  0xcc88ff,
  [BiomeType.Jungle]:   0x33ff55,
  [BiomeType.Mesa]:     0xff9944,
  [BiomeType.Heaven]:   0xeeeeff,
}

// Reusable vector to avoid per-frame allocation
const _tmpVec = new THREE.Vector3()

/**
 * Check if a creature is attuned to a given biome's resonance site.
 */
function isAttuned(creature: Creature, biome: BiomeType): boolean {
  const plans = BIOME_ATTUNED_PLANS[biome]
  if (plans === undefined) return false
  if (plans === null) return true  // Crystal: any creature
  if (creature.dna) return plans.has(creature.dna.bodyPlan)
  // Legacy fallback
  return creature.species === 'deer' || creature.species === 'camel' || creature.species === 'toad'
}

/**
 * Apply site awareness behavior to a creature.
 * This is the HIGHEST priority behavior layer — runs before weather and ecology.
 * Returns true if the creature's behavior was overridden (caller should skip other layers).
 */
export function applySiteAwareness(
  creature: Creature,
  worldState: WorldState,
): boolean {
  // Never override high-priority states
  if (PRIORITY_STATES.has(creature.state)) {
    creature.glowing = false
    return false
  }

  const sp = getCreatureStats(creature)

  // Find the nearest resonance site within range
  let nearestSite: ResonanceSite | null = null
  let nearestDistSq = Infinity

  for (const site of worldState.resonanceSites.values()) {
    const dx = creature.position.x - site.position.x
    const dz = creature.position.z - site.position.z
    const distSq = dx * dx + dz * dz
    if (distSq < SITE_RADIUS_SQ && distSq < nearestDistSq) {
      nearestDistSq = distSq
      nearestSite = site
    }
  }

  // Not near any site — clear glow and let normal behavior proceed
  if (!nearestSite) {
    if (creature.glowing) {
      creature.glowing = false
    }
    // If creature was in reverence/resonating, revert to idle
    if (creature.state === 'reverence' || creature.state === 'resonating') {
      creature.state = 'idle'
      creature.stateTimer = 0
      creature.velocity.set(0, 0, 0)
    }
    return false
  }

  // --- Within site radius ---

  // Predators: truce zone — stop hunting, revert to idle
  if (sp.role === 'predator') {
    if (creature.state === 'hunt' || creature.state === 'chase' || creature.state === 'attack') {
      creature.state = 'idle'
      creature.stateTimer = 0
      creature.velocity.set(0, 0, 0)
      creature.targetId = null
      creature.targetPos = null
    }
    creature.glowing = false
    // Predators don't enter reverence — just stop hunting
    return true
  }

  // --- Herbivores ---
  const attuned = isAttuned(creature, nearestSite.biome)

  if (attuned) {
    // Attuned creature: glow and perform ritual orbit
    creature.glowing = true
    creature.glowColor = BIOME_GLOW_COLORS[nearestSite.biome] ?? 0xffffff

    if (creature.state !== 'resonating') {
      creature.state = 'resonating'
      creature.stateTimer = 0
    }

    // Circular orbit around site center
    // Use creature id to offset the angle so multiple creatures spread out
    const idNum = parseInt(creature.id.slice(1)) || 0
    const baseAngle = idNum * 2.399 // golden angle in radians for even distribution
    const angularSpeed = ORBIT_SPEED / ORBIT_RADIUS // radians/sec
    const angle = baseAngle + creature.stateTimer * angularSpeed

    // Target position on the orbit circle
    if (!creature.targetPos) creature.targetPos = new THREE.Vector3()
    creature.targetPos.set(
      nearestSite.position.x + Math.cos(angle) * ORBIT_RADIUS,
      creature.position.y,
      nearestSite.position.z + Math.sin(angle) * ORBIT_RADIUS
    )

    // Steer toward orbit position at slow speed
    const dx = creature.targetPos.x - creature.position.x
    const dz = creature.targetPos.z - creature.position.z
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len > 0.3) {
      const speed = Math.min(ORBIT_SPEED, len * 2) // slow down when close
      creature.velocity.set((dx / len) * speed, 0, (dz / len) * speed)
    } else {
      // Very close to target — advance along orbit tangent
      const tx = -Math.sin(angle) * ORBIT_SPEED
      const tz = Math.cos(angle) * ORBIT_SPEED
      creature.velocity.set(tx, 0, tz)
    }

    // Face the site center
    _tmpVec.set(nearestSite.position.x - creature.position.x, 0, nearestSite.position.z - creature.position.z)
    if (_tmpVec.lengthSq() > 0.01) {
      creature.heading = Math.atan2(_tmpVec.x, _tmpVec.z)
    }

    creature.stateTimer += 0 // stateTimer incremented by state machine
    return true
  }

  // Non-attuned herbivore: enter reverence — face site, stand still
  if (creature.state !== 'reverence') {
    creature.state = 'reverence'
    creature.stateTimer = 0
    creature.velocity.set(0, 0, 0)
    creature.targetId = null
  }
  creature.glowing = false

  // Face the site
  _tmpVec.set(nearestSite.position.x - creature.position.x, 0, nearestSite.position.z - creature.position.z)
  if (_tmpVec.lengthSq() > 0.01) {
    creature.heading = Math.atan2(_tmpVec.x, _tmpVec.z)
  }

  // Occasionally shift position very slowly (deliberate, not random wander)
  // Move slightly toward/around the site in a slow deliberate pattern
  if (creature.stateTimer > 4) {
    const dist = Math.sqrt(nearestDistSq)
    if (dist > 5) {
      // Slowly approach the site
      const speed = 0.5
      creature.velocity.set(
        (_tmpVec.x / dist) * speed,
        0,
        (_tmpVec.z / dist) * speed
      )
    }
    // Reset timer for next deliberate shift
    if (creature.stateTimer > 6) {
      creature.stateTimer = 0
      creature.velocity.set(0, 0, 0)
    }
  }

  return true
}
