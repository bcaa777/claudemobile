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

  // Derived modifiers (recalculated each frame)
  creatureAggressionModifier: number = 1.0
  weatherIntensityModifier: number = 1.0

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
    this.weatherIntensityModifier = 1.0 - this.globalHarmony * 0.3
  }

  // Save/load for persistence (localStorage)
  save(): string {
    return JSON.stringify({
      activatedSites: Array.from(this.activatedSites),
    })
  }

  load(data: string): void {
    try {
      const parsed = JSON.parse(data)
      if (parsed.activatedSites) {
        this.activatedSites = new Set(parsed.activatedSites)
      }
    } catch {
      // Ignore corrupt data
    }
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
