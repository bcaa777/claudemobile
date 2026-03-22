import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { WorldState } from './WorldState'
import { RITUAL_BY_BIOME } from './RitualData'
import { ResonanceSiteVisual } from './ResonanceSite'
import { Creature } from '../creatures/Creature'

export interface RitualObservation {
  creatureBehavior: boolean
  weatherReveal: boolean
  loreCount: number
}

/**
 * RitualSystem — manages observation tracking and activation detection
 * for all 11 biome resonance sites.
 *
 * Observations are tracked continuously:
 * - creatureBehavior: a creature in 'reverence' or 'resonating' near the site
 * - weatherReveal: any weather reveal recorded for this biome in WorldState
 * - loreCount: number of collected lore stones in this biome
 *
 * Activation is checked only when the player is within playerRadius of a site
 * and all observations are met.
 */
export class RitualSystem {
  private resonanceSiteVisuals: ResonanceSiteVisual[] = []

  // Reusable scratch vector
  private _tmpVec = new THREE.Vector3()

  constructor() {
    // Observations are stored in WorldState for persistence
  }

  /** Provide resonance site visuals so we can call activate() on them */
  setResonanceSites(sites: ResonanceSiteVisual[]): void {
    this.resonanceSiteVisuals = sites
  }

  update(
    dt: number,
    worldState: WorldState,
    creatures: Map<string, Creature>,
    playerPos: THREE.Vector3,
  ): void {
    // For each biome that has a resonance site registered
    for (const [biome, site] of worldState.resonanceSites) {
      // Skip already-activated sites
      if (worldState.activatedSites.has(biome)) continue

      const req = RITUAL_BY_BIOME.get(biome)
      if (!req) continue

      // Ensure observation entry exists
      let obs = worldState.ritualObservations.get(biome)
      if (!obs) {
        obs = { creatureBehavior: false, weatherReveal: false, loreCount: 0 }
        worldState.ritualObservations.set(biome, obs)
      }

      // --- Observation tracking (runs continuously) ---

      // 1. Creature behavior near site
      if (!obs.creatureBehavior && req.observations.creatureBehaviorNearSite) {
        for (const creature of creatures.values()) {
          if (creature.state !== 'reverence' && creature.state !== 'resonating') continue
          const dx = creature.position.x - site.position.x
          const dz = creature.position.z - site.position.z
          if (dx * dx + dz * dz < 30 * 30) {
            obs.creatureBehavior = true
            break
          }
        }
      }
      // If observation not required, mark as met
      if (!req.observations.creatureBehaviorNearSite) {
        obs.creatureBehavior = true
      }

      // 2. Weather reveal
      if (!obs.weatherReveal && req.observations.weatherReveal) {
        const reveals = worldState.weatherReveals.get(biome)
        if (reveals && reveals.size > 0) {
          obs.weatherReveal = true
        }
      }
      if (!req.observations.weatherReveal) {
        obs.weatherReveal = true
      }

      // 3. Lore count is tracked externally — we read it from worldState
      // (updated by Engine when lore is collected, stored in ritualObservations)

      // --- Activation check (only when player is near site) ---
      const pdx = playerPos.x - site.position.x
      const pdz = playerPos.z - site.position.z
      const playerDistSq = pdx * pdx + pdz * pdz
      const radiusSq = req.activation.playerRadius * req.activation.playerRadius

      if (playerDistSq > radiusSq) continue

      // Check all observations met
      if (!obs.creatureBehavior) continue
      if (!obs.weatherReveal) continue
      if (obs.loreCount < req.observations.loreFragmentsFound) continue

      // Check required activated count (e.g., Hell needs 8+)
      if (req.activation.requiredActivatedCount !== undefined) {
        if (worldState.activatedSites.size < req.activation.requiredActivatedCount) continue
      }

      // Check time of day
      if (!this.checkTimeOfDay(req.activation.timeOfDay, worldState.timeOfDay)) continue

      // Check weather
      if (!this.checkWeather(req.activation.weather, worldState.currentWeather)) continue

      // Check creature present near site
      if (req.activation.creaturePresent) {
        if (!this.checkCreaturePresent(
          req.activation.creaturePresent,
          req.activation.creatureState,
          site.position,
          creatures,
        )) continue
      }

      // All conditions met — activate!
      this.activateSite(biome, worldState)
    }
  }

  private checkTimeOfDay(required: string | undefined, timeOfDay: number): boolean {
    if (!required || required === 'any') return true

    switch (required) {
      case 'dawn':
        // 0.23 - 0.27
        return timeOfDay >= 0.23 && timeOfDay <= 0.27
      case 'dusk':
        // 0.73 - 0.77 (also support Mesa-specific 0.7-0.8)
        return timeOfDay >= 0.7 && timeOfDay <= 0.8
      case 'night':
        // After sunset, before sunrise: 0.8 - 1.0 and 0.0 - 0.2
        return timeOfDay >= 0.8 || timeOfDay <= 0.2
      case 'midnight':
        // 0.95 - 0.05 (wraps around midnight)
        return timeOfDay >= 0.95 || timeOfDay <= 0.05
      default:
        return true
    }
  }

  private checkWeather(required: string | undefined, current: string): boolean {
    if (!required) return true

    switch (required) {
      case 'clear':
        // Clear means no active weather event (or explicitly 'clear')
        return current === 'clear' || current === 'none' || current === ''
      case 'calm':
        // Calm means no ashfall, eruption, or sandstorm
        return current !== 'ashfall' && current !== 'eruption' && current !== 'sandstorm'
      case 'fog':
        return current === 'fog' || current === 'dense_fog'
      case 'rain':
        return current === 'rain' || current === 'heavy_rain' || current === 'storm'
      default:
        return current === required
    }
  }

  private checkCreaturePresent(
    species: string,
    requiredState: string | undefined,
    sitePos: THREE.Vector3,
    creatures: Map<string, Creature>,
  ): boolean {
    const radiusSq = 30 * 30 // Same radius as site awareness

    for (const creature of creatures.values()) {
      if (creature.species !== species) continue
      if (creature.state === 'dead') continue

      const dx = creature.position.x - sitePos.x
      const dz = creature.position.z - sitePos.z
      if (dx * dx + dz * dz > radiusSq) continue

      // If a specific state is required, check it
      if (requiredState && creature.state !== requiredState) continue

      return true
    }

    return false
  }

  private activateSite(biome: BiomeType, worldState: WorldState): void {
    worldState.activatedSites.add(biome)

    // Mark the resonance site record as activated
    const site = worldState.resonanceSites.get(biome)
    if (site) site.activated = true

    // Find and activate the visual
    for (const visual of this.resonanceSiteVisuals) {
      if (visual.biome === biome && !visual.activated) {
        visual.activate()
        break
      }
    }

    // Persist
    worldState.saveToStorage()

    console.log(`[Ritual] Site activated: ${BiomeType[biome]} (${worldState.activatedSites.size}/11)`)
  }
}
