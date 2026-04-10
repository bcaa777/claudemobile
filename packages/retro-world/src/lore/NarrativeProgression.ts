import { BiomeType } from '../biomes/types'
import { WorldState } from '../systems/WorldState'

// ── Per-biome observation state ─────────────────────────────────────────────
export interface BiomeObservation {
  loreFound: number
  creatureBehaviorWitnessed: boolean
  weatherRevealWitnessed: boolean
  npcSpokenTo: boolean
  ritualCompleted: boolean
}

function emptyObservation(): BiomeObservation {
  return {
    loreFound: 0,
    creatureBehaviorWitnessed: false,
    weatherRevealWitnessed: false,
    npcSpokenTo: false,
    ritualCompleted: false,
  }
}

// ── Hypotheses — hints toward the ritual per biome ──────────────────────────
const HYPOTHESES = new Map<BiomeType, string>([
  [BiomeType.Forest,    'The deer seem drawn to the grove at dusk. They circle as if remembering a dance...'],
  [BiomeType.Desert,    'The camels kneel toward something buried when dawn breaks after a storm...'],
  [BiomeType.Swamp,     'The frogs croak in unison at the ziggurat when fog rolls in at night...'],
  [BiomeType.Snow,      'The mammoths gather at the frozen lake under clear midnight skies...'],
  [BiomeType.Volcanic,  'The wurms surface along the lava channels in a pattern...'],
  [BiomeType.Crystal,   'Every creature near the cathedral hums the same note. All except one crystal...'],
  [BiomeType.Jungle,    'When it rains, the birds trace something in the canopy...'],
  [BiomeType.Mesa,      'The fossils in the cliff glow at sunset. They seem to be in order...'],
  [BiomeType.CoralReef, 'The tidal pools form patterns when the water recedes...'],
  [BiomeType.Heaven,    'The skywhales sing what sounds like a complete chord...'],
  [BiomeType.Hell,      'The dissonance here drowns everything. But with enough harmony...'],
])

// ── Biome display names for auto-log messages ───────────────────────────────
const BIOME_NAMES: Record<number, string> = {
  [BiomeType.Forest]:    'Forest',
  [BiomeType.Desert]:    'Desert',
  [BiomeType.Swamp]:     'Swamp',
  [BiomeType.Snow]:      'Snow',
  [BiomeType.Volcanic]:  'Volcanic Wastes',
  [BiomeType.Crystal]:   'Crystal Fields',
  [BiomeType.Jungle]:    'Jungle',
  [BiomeType.Mesa]:      'Mesa',
  [BiomeType.CoralReef]: 'Coral Reef',
  [BiomeType.Heaven]:    'Heaven',
  [BiomeType.Hell]:      'Hell',
}

const LANDMARK_NAMES: Record<number, string> = {
  [BiomeType.Forest]:    'Druid Ring Temple',
  [BiomeType.Desert]:    'Great Pyramid',
  [BiomeType.Swamp]:     'Swamp Ziggurat',
  [BiomeType.Snow]:      'Ice Palace',
  [BiomeType.Volcanic]:  'Obsidian Citadel',
  [BiomeType.Crystal]:   'Crystal Cathedral',
  [BiomeType.Jungle]:    'Jungle Pyramid',
  [BiomeType.Mesa]:      'Mesa Citadel',
  [BiomeType.CoralReef]: 'Coral Palace',
  [BiomeType.Heaven]:    'Cloud Temple',
  [BiomeType.Hell]:      'Infernal Citadel',
}

// ── Auto-log entry produced by observation detection ────────────────────────
export interface NarrativeLogEntry {
  text: string
  biome: BiomeType
  type: 'creature_behavior' | 'weather_reveal'
}

// ── Main class ──────────────────────────────────────────────────────────────
export class NarrativeProgression {
  private observations: Map<BiomeType, BiomeObservation> = new Map()

  /** Keys of auto-log entries already emitted (avoid duplication). */
  private emittedLogs: Set<string> = new Set()

  /** Pending auto-log entries to be consumed by the JournalSystem this frame. */
  pendingLogs: NarrativeLogEntry[] = []

  constructor() {
    for (let i = 0; i <= 10; i++) {
      this.observations.set(i as BiomeType, emptyObservation())
    }
  }

  // ── Observation accessors ───────────────────────────────────────────────
  getObservation(biome: BiomeType): BiomeObservation {
    return this.observations.get(biome) || emptyObservation()
  }

  // ── Hypothesis generation ───────────────────────────────────────────────
  getHypothesis(biome: BiomeType): string | null {
    const obs = this.observations.get(biome)
    if (!obs || obs.loreFound < 2) return null
    if (obs.creatureBehaviorWitnessed && !obs.ritualCompleted) {
      return HYPOTHESES.get(biome) || null
    }
    return null
  }

  /** Get all currently available hypotheses, keyed by biome. */
  getAllHypotheses(): Map<BiomeType, string> {
    const result = new Map<BiomeType, string>()
    for (let i = 0; i <= 10; i++) {
      const biome = i as BiomeType
      const h = this.getHypothesis(biome)
      if (h) result.set(biome, h)
    }
    return result
  }

  // ── Phase tracking ──────────────────────────────────────────────────────
  getPhase(): 1 | 2 | 3 | 4 {
    let totalObservations = 0
    let ritualsCompleted = 0

    for (const obs of this.observations.values()) {
      totalObservations += obs.loreFound
      if (obs.creatureBehaviorWitnessed) totalObservations++
      if (obs.weatherRevealWitnessed) totalObservations++
      if (obs.npcSpokenTo) totalObservations++
      if (obs.ritualCompleted) ritualsCompleted++
    }

    // Phase 4: 8+ rituals completed
    if (ritualsCompleted >= 8) return 4
    // Phase 3: 1+ rituals completed
    if (ritualsCompleted >= 1) return 3
    // Phase 2: 3+ observations
    if (totalObservations >= 3) return 2
    // Phase 1: early exploration
    return 1
  }

  // ── Update from world state (call every few seconds) ────────────────────
  updateFromWorldState(worldState: WorldState): void {
    this.pendingLogs = []

    for (let i = 0; i <= 10; i++) {
      const biome = i as BiomeType
      const obs = this.observations.get(biome)!

      // Ritual completion
      if (worldState.activatedSites.has(biome)) {
        obs.ritualCompleted = true
      }

      // Weather reveals
      const reveals = worldState.weatherReveals.get(biome)
      if (reveals && reveals.size > 0 && !obs.weatherRevealWitnessed) {
        obs.weatherRevealWitnessed = true
        // Auto-log
        const weatherName = worldState.currentWeather || 'strange weather'
        const landmark = LANDMARK_NAMES[biome] || 'landmark'
        const logKey = `weather_reveal_${biome}`
        if (!this.emittedLogs.has(logKey)) {
          this.emittedLogs.add(logKey)
          this.pendingLogs.push({
            text: `The ${weatherName} revealed something at the ${landmark}.`,
            biome,
            type: 'weather_reveal',
          })
        }
      }

      // Ritual observations (creature behavior + lore count from RitualSystem)
      const ritObs = worldState.ritualObservations.get(biome)
      if (ritObs) {
        obs.loreFound = ritObs.loreCount
        if (ritObs.creatureBehavior && !obs.creatureBehaviorWitnessed) {
          obs.creatureBehaviorWitnessed = true
          // Auto-log
          const biomeName = BIOME_NAMES[biome] || 'this biome'
          const landmark = LANDMARK_NAMES[biome] || 'landmark'
          const logKey = `creature_behavior_${biome}`
          if (!this.emittedLogs.has(logKey)) {
            this.emittedLogs.add(logKey)
            this.pendingLogs.push({
              text: `Witnessed creatures behaving strangely near the ${landmark} in the ${biomeName}.`,
              biome,
              type: 'creature_behavior',
            })
          }
        }
        if (ritObs.weatherReveal && !obs.weatherRevealWitnessed) {
          obs.weatherRevealWitnessed = true
        }
      }
    }
  }
}
