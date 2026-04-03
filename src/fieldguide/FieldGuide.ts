import { CreatureDNA, BodyPlan } from '../creatures/CreatureDNA'
import { CreatureState } from '../creatures/Creature'
import { RarityTier } from '../creatures/CreatureVariant'
import { BiomeType } from '../biomes/types'

export type KnowledgeTier = 0 | 1 | 2 | 3 | 4
// 0=unknown, 1=silhouette, 2=documented, 3=studied, 4=mastered

const COMMON_BEHAVIORS: Set<CreatureState> = new Set([
  'idle', 'wander', 'eating', 'drinking', 'flee', 'sleep', 'sheltering',
])

const RARE_BEHAVIORS: Set<CreatureState> = new Set([
  'reverence', 'resonating', 'courtship', 'mating', 'hunt',
])

const STORAGE_KEY = 'field_guide'

export interface SpeciesEntry {
  variantId: string
  bodyPlan: BodyPlan
  species: string
  rarityTier: RarityTier
  biomeFound: BiomeType
  dnaSnapshot: CreatureDNA
  firstSeen: number
  behaviorsPhotographed: Set<CreatureState>
  bestScore: number
  bestBehavior: CreatureState
  tier: KnowledgeTier
}

interface SerializedEntry {
  variantId: string
  bodyPlan: BodyPlan
  species: string
  rarityTier: RarityTier
  biomeFound: BiomeType
  dnaSnapshot: {
    bodyPlan: BodyPlan
    bodyLength: number
    bodyWidth: number
    bodyHeight: number
    headSize: number
    neckLength: number
    legCount: number
    legLength: number
    legThickness: number
    hasWings: number
    wingSpan: number
    hasTail: number
    tailLength: number
    hasHorns: number
    hornSize: number
    hasClaws: number
    clawSize: number
    hasMandibles: number
    hasFins: number
    finSize: number
    hasAntennae: number
    bodyColor: [number, number, number]
    accentColor: [number, number, number]
    eyeSize: number
    eyeCount: number
    speed: number
    aggression: number
    size: number
  }
  firstSeen: number
  behaviorsPhotographed: CreatureState[]
  bestScore: number
  bestBehavior: CreatureState
  tier: KnowledgeTier
}

interface SerializedFieldGuide {
  entries: SerializedEntry[]
  silhouettes: string[]
}

export class FieldGuide {
  private entries: Map<string, SpeciesEntry> = new Map()
  private silhouettes: Set<string> = new Set()

  constructor() {
    this.load()
  }

  /**
   * Register a sighting of a variant (tier 1 — silhouette only).
   * Returns true if this is a brand new variant.
   */
  registerSighting(
    variantId: string,
    dna: CreatureDNA,
    species: string,
    biome: BiomeType,
  ): boolean {
    if (this.entries.has(variantId)) return false
    if (this.silhouettes.has(variantId)) return false

    this.silhouettes.add(variantId)
    this.save()
    return true
  }

  /**
   * Record a photograph of a creature variant.
   * Creates or updates an entry, updates tiers, returns true if this is a new variant.
   */
  recordPhoto(
    variantId: string,
    dna: CreatureDNA,
    species: string,
    behavior: CreatureState,
    score: number,
    rarityTier: RarityTier,
    biome: BiomeType,
  ): boolean {
    const isNew = !this.entries.has(variantId)

    if (isNew) {
      const entry: SpeciesEntry = {
        variantId,
        bodyPlan: dna.bodyPlan,
        species,
        rarityTier,
        biomeFound: biome,
        dnaSnapshot: {
          ...dna,
          bodyColor: [...dna.bodyColor] as [number, number, number],
          accentColor: [...dna.accentColor] as [number, number, number],
        },
        firstSeen: Date.now(),
        behaviorsPhotographed: new Set([behavior]),
        bestScore: score,
        bestBehavior: behavior,
        tier: 2,
      }
      this.entries.set(variantId, entry)
      // Remove from silhouettes if it was there
      this.silhouettes.delete(variantId)
    } else {
      const entry = this.entries.get(variantId)!
      entry.behaviorsPhotographed.add(behavior)
      if (score > entry.bestScore) {
        entry.bestScore = score
        entry.bestBehavior = behavior
      }
    }

    const entry = this.entries.get(variantId)!
    this.recalculateTier(entry)
    this.save()
    return isNew
  }

  /** Returns true if the variant has been photographed (tier >= 2). */
  isPhotographed(variantId: string): boolean {
    const entry = this.entries.get(variantId)
    return entry !== undefined && entry.tier >= 2
  }

  /** Returns true if the variant has been mastered (tier >= 4). */
  isMastered(variantId: string): boolean {
    const entry = this.entries.get(variantId)
    return entry !== undefined && entry.tier >= 4
  }

  /** Count of photographed entries (tier >= 2) per body plan. */
  getCountByBodyPlan(): Record<BodyPlan, number> {
    const counts: Record<BodyPlan, number> = {
      quadruped: 0,
      insectoid: 0,
      avian: 0,
      aquatic: 0,
      serpentine: 0,
    }
    for (const entry of this.entries.values()) {
      if (entry.tier >= 2) {
        counts[entry.bodyPlan]++
      }
    }
    return counts
  }

  /** All entries for a given body plan, sorted by bestScore descending. */
  getEntriesForBodyPlan(plan: BodyPlan): SpeciesEntry[] {
    const result: SpeciesEntry[] = []
    for (const entry of this.entries.values()) {
      if (entry.bodyPlan === plan) {
        result.push(entry)
      }
    }
    result.sort((a, b) => b.bestScore - a.bestScore)
    return result
  }

  /** Total number of mastered entries (tier >= 4). */
  getMasteredCount(): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 4) count++
    }
    return count
  }

  /** Number of mastered entries found in a specific biome. */
  getMasteredCountForBiome(biome: BiomeType): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 4 && entry.biomeFound === biome) count++
    }
    return count
  }

  /** Total number of photographed entries (tier >= 2). */
  getPhotographedCount(): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 2) count++
    }
    return count
  }

  /**
   * Recalculate the knowledge tier for an entry:
   * - tier 2: photographed (default on first photo)
   * - tier 3: 3+ common behaviors photographed
   * - tier 4: tier 3 + at least 1 rare behavior photographed
   */
  private recalculateTier(entry: SpeciesEntry): void {
    const behaviors = entry.behaviorsPhotographed

    let commonCount = 0
    let hasRare = false

    for (const behavior of behaviors) {
      if (COMMON_BEHAVIORS.has(behavior)) commonCount++
      if (RARE_BEHAVIORS.has(behavior)) hasRare = true
    }

    const hasTier3 = commonCount >= 3
    const hasTier4 = hasTier3 && hasRare

    if (hasTier4) {
      entry.tier = 4
    } else if (hasTier3) {
      entry.tier = 3
    } else {
      entry.tier = 2
    }
  }

  /** Serialize entries and silhouettes to localStorage. */
  private save(): void {
    const serialized: SerializedFieldGuide = {
      entries: Array.from(this.entries.values()).map(entry => ({
        variantId: entry.variantId,
        bodyPlan: entry.bodyPlan,
        species: entry.species,
        rarityTier: entry.rarityTier,
        biomeFound: entry.biomeFound,
        dnaSnapshot: {
          ...entry.dnaSnapshot,
          bodyColor: [...entry.dnaSnapshot.bodyColor] as [number, number, number],
          accentColor: [...entry.dnaSnapshot.accentColor] as [number, number, number],
        },
        firstSeen: entry.firstSeen,
        behaviorsPhotographed: Array.from(entry.behaviorsPhotographed),
        bestScore: entry.bestScore,
        bestBehavior: entry.bestBehavior,
        tier: entry.tier,
      })),
      silhouettes: Array.from(this.silhouettes),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized))
    } catch {
      // Storage quota exceeded or unavailable — silently fail
    }
  }

  /** Deserialize entries and silhouettes from localStorage. */
  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const data = JSON.parse(raw) as SerializedFieldGuide

      for (const serialized of data.entries) {
        const entry: SpeciesEntry = {
          variantId: serialized.variantId,
          bodyPlan: serialized.bodyPlan,
          species: serialized.species,
          rarityTier: serialized.rarityTier,
          biomeFound: serialized.biomeFound,
          dnaSnapshot: {
            ...serialized.dnaSnapshot,
            bodyColor: [...serialized.dnaSnapshot.bodyColor] as [number, number, number],
            accentColor: [...serialized.dnaSnapshot.accentColor] as [number, number, number],
          },
          firstSeen: serialized.firstSeen,
          behaviorsPhotographed: new Set(serialized.behaviorsPhotographed),
          bestScore: serialized.bestScore,
          bestBehavior: serialized.bestBehavior,
          tier: serialized.tier,
        }
        this.entries.set(entry.variantId, entry)
      }

      for (const id of data.silhouettes) {
        this.silhouettes.add(id)
      }
    } catch {
      // Corrupted or missing data — start fresh
    }
  }
}
