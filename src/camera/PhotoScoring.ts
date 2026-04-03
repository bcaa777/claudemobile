import { CreatureState } from '../creatures/Creature'
import { calculateRarityScore, getRarityTier, RarityTier } from '../creatures/CreatureVariant'
import { CreatureDNA } from '../creatures/CreatureDNA'

/** Behavior multipliers for photo scoring */
const BEHAVIOR_MULTIPLIERS: Partial<Record<CreatureState, number>> = {
  idle: 1.0, wander: 1.0,
  eating: 1.2, drinking: 1.2, sleep: 1.2, sheltering: 1.2,
  seek_food: 1.0, seek_water: 1.0,
  flee: 1.8, hunt: 1.8, chase: 1.8, attack: 1.8,
  seek_mate: 1.5, courtship: 2.0, mating: 2.0,
  reverence: 2.5, resonating: 3.0,
  migrating: 1.5, dead: 0.5,
}

export interface PhotoResult {
  variantId: string
  species: string
  behavior: CreatureState
  rarityTier: RarityTier
  rarityScore: number
  behaviorMultiplier: number
  isNewDiscovery: boolean
  finalScore: number
  stars: number  // 1-5
}

export function scorePhoto(
  dna: CreatureDNA,
  variantId: string,
  species: string,
  behavior: CreatureState,
  isNew: boolean,
): PhotoResult {
  const rarityScore = calculateRarityScore(dna)
  const rarityTier = getRarityTier(rarityScore)
  const baseScore = rarityScore * 100
  const behaviorMult = BEHAVIOR_MULTIPLIERS[behavior] ?? 1.0
  const discoveryMult = isNew ? 2.0 : 1.0
  const finalScore = baseScore * behaviorMult * discoveryMult
  const stars = scoreToStars(finalScore)
  return { variantId, species, behavior, rarityTier, rarityScore, behaviorMultiplier: behaviorMult, isNewDiscovery: isNew, finalScore, stars }
}

export function scoreToStars(score: number): number {
  if (score >= 80) return 5
  if (score >= 50) return 4
  if (score >= 25) return 3
  if (score >= 10) return 2
  return 1
}
