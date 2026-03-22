import { BiomeType } from '../biomes/types'
import * as THREE from 'three'

export interface ResonanceSite {
  biome: BiomeType
  position: THREE.Vector3
  activated: boolean
}

const SAVE_KEY = 'worldState'

export class WorldState {
  // Progression
  activatedSites: Set<BiomeType> = new Set()
  globalHarmony: number = 0 // 0-1, activatedSites.size / 11

  // Per-biome stability (1 = stable, 0 = fully destabilized)
  biomeStability: Map<BiomeType, number> = new Map()

  // Resonance site positions (populated by LandmarkManager)
  resonanceSites: Map<BiomeType, ResonanceSite> = new Map()

  // Current weather (written by WeatherSystem)
  currentWeather: string = 'clear'
  weatherSeverity: number = 0 // 0-1

  // Weather-site reveal tracking (populated by WeatherSystem)
  // Maps BiomeType → Set of reveal keys e.g. 'rain_reveal', 'fog_reveal', etc.
  weatherReveals: Map<BiomeType, Set<string>> = new Map()

  // Time (written by DayNightCycle)
  timeOfDay: number = 0.5 // 0-1
  isDawn: boolean = false  // 0.23-0.27
  isDusk: boolean = false  // 0.73-0.77

  // Player state
  playerPosition: THREE.Vector3 = new THREE.Vector3()
  playerBiome: BiomeType = BiomeType.Forest
  isInCombat: boolean = false

  // Companion
  companionSpecies: string | null = null

  // Ritual observation tracking per biome (populated by RitualSystem)
  ritualObservations: Map<BiomeType, { creatureBehavior: boolean; weatherReveal: boolean; loreCount: number }> = new Map()

  // Ritual activation message (consumed by HUD in Layer 4)
  activationMessage: string | null = null
  activationMessageTimer: number = 0

  // Brief camera lock after ritual activation (3 seconds)
  ritualCinematicActive: boolean = false
  ritualCinematicTimer: number = 0

  // Endgame state
  chordComplete: boolean = false

  // Hazard zones (repopulated each update by HazardSystem — used for journal/mystery tracking)
  hazardZones: Array<{
    type: string        // 'lava', 'toxic_gas', 'crystal_shards', 'ice'
    position: THREE.Vector3
    radius: number
    biome: BiomeType
  }> = []

  // Derived modifiers (recalculated each frame)
  creatureAggressionModifier: number = 1.0
  weatherIntensityModifier: number = 1.0
  hellTransformFactor: number = 0 // 0 = normal red, 1 = peaceful purple-blue

  constructor() {
    // Initialize all biome stabilities to 1.0
    for (let i = 0; i <= 10; i++) {
      this.biomeStability.set(i as BiomeType, 1.0)
    }
  }

  update(): void {
    this.globalHarmony = this.activatedSites.size / 11

    // Recalculate biome stability:
    // - Base stability from globalHarmony contribution
    // - Activated biomes get +0.3 bonus
    // - Hell biome has lowest base stability; distance from Hell increases base
    const hellIdx = BiomeType.Hell // 10
    for (let i = 0; i <= 10; i++) {
      const biome = i as BiomeType
      // Base stability: distance from Hell index gives slight bonus (0 to ~0.2)
      const distFromHell = Math.abs(i - hellIdx) / 10
      let stability = 0.5 + distFromHell * 0.2

      // Global harmony raises all biome stability
      stability += this.globalHarmony * 0.3

      // Activated biomes get a bonus
      if (this.activatedSites.has(biome)) {
        stability += 0.3
      }

      this.biomeStability.set(biome, Math.min(1, stability))
    }

    // Recalculate derived modifiers
    // Higher harmony = less aggression
    this.creatureAggressionModifier = 1.0 - this.globalHarmony * 0.5

    // Higher harmony = calmer weather
    // Post-completion: weather fully calm
    this.weatherIntensityModifier = this.chordComplete ? 0 : 1.0 - this.globalHarmony * 0.3

    // Hell color tint shift: when 8+ sites are activated, Hell's tint shifts
    // from deep red toward purple-blue (tracked as a 0-1 factor)
    this.hellTransformFactor = this.chordComplete
      ? 1.0
      : this.activatedSites.size >= 8
        ? Math.min(1.0, (this.activatedSites.size - 8) / 3) // 8→0.0, 9→0.33, 10→0.66, 11→1.0
        : 0
  }

  // Save/load for persistence (localStorage)
  save(): string {
    // Serialize weatherReveals as an array of [biomeIndex, revealKey[]] pairs
    const revealsArray = Array.from(this.weatherReveals.entries()).map(
      ([biome, keys]) => [biome, Array.from(keys)] as [number, string[]]
    )
    // Serialize ritualObservations as [biomeIndex, {creatureBehavior, weatherReveal, loreCount}][]
    const obsArray = Array.from(this.ritualObservations.entries()).map(
      ([biome, obs]) => [biome, obs] as [number, { creatureBehavior: boolean; weatherReveal: boolean; loreCount: number }]
    )
    return JSON.stringify({
      activatedSites: Array.from(this.activatedSites),
      weatherReveals: revealsArray,
      ritualObservations: obsArray,
      chordComplete: this.chordComplete,
    })
  }

  load(data: string): void {
    try {
      const parsed = JSON.parse(data)
      if (parsed.activatedSites) {
        this.activatedSites = new Set(parsed.activatedSites)
      }
      if (Array.isArray(parsed.weatherReveals)) {
        this.weatherReveals = new Map()
        for (const [biome, keys] of parsed.weatherReveals as [number, string[]][]) {
          this.weatherReveals.set(biome as BiomeType, new Set(keys))
        }
      }
      if (Array.isArray(parsed.ritualObservations)) {
        this.ritualObservations = new Map()
        for (const [biome, obs] of parsed.ritualObservations as [number, { creatureBehavior: boolean; weatherReveal: boolean; loreCount: number }][]) {
          this.ritualObservations.set(biome as BiomeType, obs)
        }
      }
      if (parsed.chordComplete) {
        this.chordComplete = true
      }
    } catch {
      // Ignore corrupt data
    }
  }

  /** Record that the player witnessed a weather event near a biome's resonance site */
  addWeatherReveal(biome: BiomeType, revealKey: string): boolean {
    let reveals = this.weatherReveals.get(biome)
    if (!reveals) {
      reveals = new Set()
      this.weatherReveals.set(biome, reveals)
    }
    if (reveals.has(revealKey)) return false // already known
    reveals.add(revealKey)
    return true // newly discovered
  }

  /** Check whether a specific weather reveal has been witnessed */
  hasWeatherReveal(biome: BiomeType, revealKey: string): boolean {
    return this.weatherReveals.get(biome)?.has(revealKey) ?? false
  }

  /** Register a resonance site from LandmarkManager */
  registerResonanceSite(biome: BiomeType, position: THREE.Vector3): void {
    this.resonanceSites.set(biome, {
      biome,
      position: position.clone(),
      activated: this.activatedSites.has(biome),
    })
  }

  /** Try loading saved state from localStorage */
  loadFromStorage(): void {
    try {
      const data = localStorage.getItem(SAVE_KEY)
      if (data) {
        this.load(data)
      }
    } catch {
      // localStorage may be unavailable
    }
  }

  /** Persist current state to localStorage */
  saveToStorage(): void {
    try {
      localStorage.setItem(SAVE_KEY, this.save())
    } catch {
      // localStorage may be unavailable
    }
  }
}
