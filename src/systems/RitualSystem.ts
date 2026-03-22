import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { WorldState } from './WorldState'
import { RITUAL_BY_BIOME } from './RitualData'
import { ResonanceSiteVisual } from './ResonanceSite'
import { HarmonicTone } from '../audio/HarmonicTone'
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

  // Final ritual state (Hell endgame 10-second stand mechanic)
  private finalRitualProgress: number = 0 // 0-10 seconds
  private finalRitualLastCrescendoIndex: number = -1
  private lastPlayerPos: THREE.Vector3 = new THREE.Vector3()
  private finalRitualActive: boolean = false

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
    // Tick down activation message timer
    this.updateActivationMessage(dt, worldState)

    // Boost Hell resonance site glow when 8+ sites activated
    this.updateHellSiteGlow(worldState)

    // Track final ritual progress for Hell endgame
    this.updateFinalRitual(dt, worldState, playerPos)

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

      // Hell uses the special 10-second final ritual — skip normal activation
      if (biome === BiomeType.Hell) continue

      // All conditions met — activate!
      this.activateSite(biome, worldState)
    }
  }

  /** Increase Hell resonance site glow intensity when 8+ sites are activated */
  private updateHellSiteGlow(worldState: WorldState): void {
    if (worldState.activatedSites.size < 8) return
    if (worldState.activatedSites.has(BiomeType.Hell)) return

    for (const visual of this.resonanceSiteVisuals) {
      if (visual.biome === BiomeType.Hell && !visual.activated) {
        // Boost the ring glow based on how many sites are activated (8-10)
        visual.setGlowBoost(worldState.activatedSites.size >= 8
          ? 0.3 + (worldState.activatedSites.size - 8) * 0.15
          : 0)
        break
      }
    }
  }

  /**
   * Final ritual mechanic: player must stand within 3 units of Hell site
   * for 10 continuous seconds with 8+ sites activated.
   * Moving away resets progress. Each second triggers a harmonic crescendo.
   */
  private updateFinalRitual(dt: number, worldState: WorldState, playerPos: THREE.Vector3): void {
    // Skip if Hell already activated or chord already complete
    if (worldState.activatedSites.has(BiomeType.Hell) || worldState.chordComplete) return

    // Need 8+ sites activated
    if (worldState.activatedSites.size < 8) {
      this.finalRitualProgress = 0
      this.finalRitualActive = false
      return
    }

    const hellSite = worldState.resonanceSites.get(BiomeType.Hell)
    if (!hellSite) return

    const dx = playerPos.x - hellSite.position.x
    const dz = playerPos.z - hellSite.position.z
    const distSq = dx * dx + dz * dz
    const RITUAL_RADIUS = 3

    // Check if player is within radius and essentially standing still
    const moveThreshold = 0.5 // allow tiny sway
    const playerMoved = this.lastPlayerPos.distanceTo(playerPos) > moveThreshold * dt * 10

    if (distSq > RITUAL_RADIUS * RITUAL_RADIUS || playerMoved) {
      // Player moved away or too far — reset
      if (this.finalRitualActive && this.finalRitualProgress > 0) {
        console.log('[Ritual] Final ritual progress reset')
      }
      this.finalRitualProgress = 0
      this.finalRitualLastCrescendoIndex = -1
      this.finalRitualActive = false
      this.lastPlayerPos.copy(playerPos)
      return
    }

    this.lastPlayerPos.copy(playerPos)
    this.finalRitualActive = true
    this.finalRitualProgress += dt

    // Each second, trigger a harmonic crescendo on one tone
    const currentSecond = Math.floor(this.finalRitualProgress)
    if (currentSecond > this.finalRitualLastCrescendoIndex && currentSecond < 10) {
      this.finalRitualLastCrescendoIndex = currentSecond
      this.triggerCrescendoAtIndex(currentSecond)
    }

    // At 10 seconds: complete the ritual
    if (this.finalRitualProgress >= 10) {
      this.activateSite(BiomeType.Hell, worldState)
      this.completeChord(worldState)
      this.finalRitualActive = false
      this.finalRitualProgress = 0
    }
  }

  /** Trigger a crescendo swell on one harmonic tone (by index in activation order) */
  private triggerCrescendoAtIndex(index: number): void {
    // Find activated site visuals and swell their tones in sequence
    const activatedVisuals = this.resonanceSiteVisuals.filter(v => v.activated && v.harmonicTone)
    if (index < activatedVisuals.length) {
      activatedVisuals[index].harmonicTone?.crescendo()
    }
    console.log(`[Ritual] Crescendo tone ${index + 1}`)
  }

  /** Complete the chord — all 11 sites activated, transform the world */
  private completeChord(worldState: WorldState): void {
    worldState.chordComplete = true

    // Trigger final crescendo on all tones
    for (const visual of this.resonanceSiteVisuals) {
      if (visual.harmonicTone) {
        visual.harmonicTone.crescendo()
      }
    }

    // Set the final activation message
    worldState.activationMessage = 'The chord is complete. The world remembers its song.'
    worldState.activationMessageTimer = 10.0 // longer display for the finale

    worldState.saveToStorage()
    console.log('[Ritual] THE CHORD IS COMPLETE')
  }

  /** Get current final ritual progress (0-10) for UI display */
  getFinalRitualProgress(): number {
    return this.finalRitualActive ? this.finalRitualProgress : 0
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

  /** Force-activate a biome site from the debug panel */
  forceActivateSite(biome: BiomeType, worldState: WorldState): void {
    if (worldState.activatedSites.has(biome)) return
    this.activateSite(biome, worldState)
  }

  private activateSite(biome: BiomeType, worldState: WorldState): void {
    worldState.activatedSites.add(biome)

    // Mark the resonance site record as activated
    const site = worldState.resonanceSites.get(biome)
    if (site) site.activated = true

    // Find and activate the visual
    let sitePosition: THREE.Vector3 | null = null
    let siteScene: THREE.Scene | null = null
    for (const visual of this.resonanceSiteVisuals) {
      if (visual.biome === biome && !visual.activated) {
        visual.activate()
        sitePosition = visual.position
        siteScene = visual.mesh.parent as THREE.Scene | null
        break
      }
    }

    // Trigger per-biome burst effect
    if (sitePosition && siteScene) {
      this.activateVisualEffect(biome, sitePosition, siteScene)
    }

    // Set activation message for HUD
    const biomeName = BIOME_DISPLAY_NAMES[biome] ?? BiomeType[biome]
    worldState.activationMessage = `The ${biomeName} resonates once more.`
    worldState.activationMessageTimer = 5.0 // display for 5 seconds

    // Brief cinematic camera lock — 3 seconds
    worldState.ritualCinematicActive = true
    worldState.ritualCinematicTimer = 3.0

    // Persist
    worldState.saveToStorage()

    console.log(`[Ritual] Site activated: ${BiomeType[biome]} (${worldState.activatedSites.size}/11)`)
  }

  /**
   * Per-biome activation visual effect — spawns a burst of 80 instanced particles
   * that rise/expand over ~4 seconds then are removed from the scene.
   */
  activateVisualEffect(biome: BiomeType, sitePosition: THREE.Vector3, scene: THREE.Scene): void {
    const config = BIOME_EFFECT_CONFIG[biome]
    if (!config) return

    const PARTICLE_COUNT = 80
    const DURATION = 4.0 // seconds

    const geo = new THREE.PlaneGeometry(0.4, 0.4)
    const mat = new THREE.MeshBasicMaterial({
      color: config.primaryColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.InstancedMesh(geo, mat, PARTICLE_COUNT)
    mesh.frustumCulled = false
    mesh.position.copy(sitePosition)
    scene.add(mesh)

    // Pre-compute per-particle data
    const angles = new Float32Array(PARTICLE_COUNT)
    const speeds = new Float32Array(PARTICLE_COUNT)
    const radii = new Float32Array(PARTICLE_COUNT)
    const yOffsets = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      angles[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.5 + Math.random() * 1.0
      radii[i] = Math.random() * 4
      yOffsets[i] = Math.random() * 0.5
    }

    const dummy = new THREE.Object3D()
    const startTime = performance.now() / 1000
    const secondaryColor = new THREE.Color(config.secondaryColor)

    const animate = () => {
      const elapsed = performance.now() / 1000 - startTime
      const t = Math.min(elapsed / DURATION, 1.0)

      if (t >= 1.0) {
        // Cleanup
        scene.remove(mesh)
        geo.dispose()
        mat.dispose()
        return
      }

      // Fade out in last 40%
      mat.opacity = t > 0.6 ? 0.9 * (1.0 - (t - 0.6) / 0.4) : 0.9

      // Lerp color from primary to secondary over time
      const baseColor = new THREE.Color(config.primaryColor)
      baseColor.lerp(secondaryColor, t * 0.5)
      mat.color.copy(baseColor)

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = angles[i] + elapsed * speeds[i] * config.spinSpeed
        const expandRadius = radii[i] + t * config.expandRate
        const x = Math.cos(angle) * expandRadius
        const z = Math.sin(angle) * expandRadius
        // For negative riseSpeed (Jungle rain-down), start particles high
        const baseY = config.riseSpeed < 0 ? 12.0 : 0
        const y = baseY + yOffsets[i] + elapsed * config.riseSpeed * speeds[i]

        dummy.position.set(x, y, z)
        const scale = (1.0 - t * 0.6) * (0.5 + speeds[i] * 0.5)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  /** Tick down activation message timer and cinematic lock */
  updateActivationMessage(dt: number, worldState: WorldState): void {
    if (worldState.activationMessageTimer > 0) {
      worldState.activationMessageTimer -= dt
      if (worldState.activationMessageTimer <= 0) {
        worldState.activationMessage = null
        worldState.activationMessageTimer = 0
      }
    }

    if (worldState.ritualCinematicActive) {
      worldState.ritualCinematicTimer -= dt
      if (worldState.ritualCinematicTimer <= 0) {
        worldState.ritualCinematicActive = false
        worldState.ritualCinematicTimer = 0
      }
    }
  }
}

/** Display names for biomes */
const BIOME_DISPLAY_NAMES: Record<BiomeType, string> = {
  [BiomeType.Forest]: 'Forest',
  [BiomeType.Desert]: 'Desert',
  [BiomeType.Swamp]: 'Swamp',
  [BiomeType.Snow]: 'Snow',
  [BiomeType.Volcanic]: 'Volcanic Reach',
  [BiomeType.Crystal]: 'Crystal Cavern',
  [BiomeType.Jungle]: 'Jungle',
  [BiomeType.Mesa]: 'Mesa',
  [BiomeType.CoralReef]: 'Coral Coast',
  [BiomeType.Heaven]: 'Heaven',
  [BiomeType.Hell]: 'Hell',
}

/** Per-biome visual effect configuration */
interface BiomeEffectConfig {
  primaryColor: number
  secondaryColor: number
  riseSpeed: number    // units/sec upward
  spinSpeed: number    // radians/sec rotation multiplier
  expandRate: number   // how much radius expands over full duration
}

const BIOME_EFFECT_CONFIG: Record<BiomeType, BiomeEffectConfig> = {
  // Forest: Golden particle burst upward from ring, ring turns golden
  [BiomeType.Forest]: {
    primaryColor: 0xffdd44,
    secondaryColor: 0xffee88,
    riseSpeed: 3.0,
    spinSpeed: 0.3,
    expandRate: 2.0,
  },
  // Desert: Sand-colored particles spiral upward, ground lightens
  [BiomeType.Desert]: {
    primaryColor: 0xeebb66,
    secondaryColor: 0xffddaa,
    riseSpeed: 2.5,
    spinSpeed: 1.5,
    expandRate: 3.0,
  },
  // Swamp: Green/purple particles rise, fog clears in expanding circle
  [BiomeType.Swamp]: {
    primaryColor: 0x44ff66,
    secondaryColor: 0xaa44ff,
    riseSpeed: 1.8,
    spinSpeed: 0.5,
    expandRate: 4.0,
  },
  // Snow: White/blue crystal particles, bright flash
  [BiomeType.Snow]: {
    primaryColor: 0xccddff,
    secondaryColor: 0x88bbff,
    riseSpeed: 2.0,
    spinSpeed: 0.8,
    expandRate: 3.0,
  },
  // Volcanic: Orange-red particles stream from ground, lava glow pulse
  [BiomeType.Volcanic]: {
    primaryColor: 0xff4400,
    secondaryColor: 0xff8800,
    riseSpeed: 4.0,
    spinSpeed: 0.2,
    expandRate: 1.5,
  },
  // Crystal: All-direction blue light burst, prismatic particles
  [BiomeType.Crystal]: {
    primaryColor: 0x4488ff,
    secondaryColor: 0xaa88ff,
    riseSpeed: 2.5,
    spinSpeed: 2.0,
    expandRate: 5.0,
  },
  // Jungle: Green particles rain from above, golden light shaft
  [BiomeType.Jungle]: {
    primaryColor: 0x44ff44,
    secondaryColor: 0xffdd44,
    riseSpeed: -2.0, // negative = rain down from above
    spinSpeed: 0.4,
    expandRate: 2.0,
  },
  // Mesa: Terracotta particles rise in layers, amber glow
  [BiomeType.Mesa]: {
    primaryColor: 0xcc6633,
    secondaryColor: 0xffaa44,
    riseSpeed: 2.0,
    spinSpeed: 0.3,
    expandRate: 2.5,
  },
  // Coral Coast: Turquoise particles spiral, water shimmer effect
  [BiomeType.CoralReef]: {
    primaryColor: 0x44ddcc,
    secondaryColor: 0x88eeff,
    riseSpeed: 1.5,
    spinSpeed: 1.8,
    expandRate: 3.5,
  },
  // Heaven: Bright white/gold burst, ascending particles
  [BiomeType.Heaven]: {
    primaryColor: 0xffffff,
    secondaryColor: 0xffeeaa,
    riseSpeed: 4.0,
    spinSpeed: 0.5,
    expandRate: 4.0,
  },
  // Hell: Dark-to-light transition, red particles transform to white
  [BiomeType.Hell]: {
    primaryColor: 0xff2200,
    secondaryColor: 0xffffff,
    riseSpeed: 3.0,
    spinSpeed: 1.0,
    expandRate: 3.0,
  },
}
