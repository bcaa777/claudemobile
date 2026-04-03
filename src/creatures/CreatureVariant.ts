import type { CreatureDNA } from './CreatureDNA'
import { DNA_PRESETS } from './DNAPresets'

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary'

// ---------------------------------------------------------------------------
// Variant ID helpers
// ---------------------------------------------------------------------------

function sizeBucket(size: number): string {
  if (size < 0.33) return 'S'
  if (size < 0.66) return 'M'
  return 'L'
}

/** 7-bit flag string derived from boolean-like appendage genes (> 0.5 = present) */
function appendageFlags(dna: CreatureDNA): string {
  const bits = [
    dna.hasWings,
    dna.hasTail,
    dna.hasHorns,
    dna.hasClaws,
    dna.hasMandibles,
    dna.hasFins,
    dna.hasAntennae,
  ]
  return bits.map(v => (v > 0.5 ? '1' : '0')).join('')
}

/** Map RGB (0-1 each) to one of 8 hue buckets (0-7) */
function colorFamily(rgb: [number, number, number]): number {
  const [r, g, b] = rgb
  // Convert to hue via a simple approximation
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  if (delta < 0.05) {
    // Achromatic: bucket 7 for white/grey/black
    return 7
  }

  let hue: number
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  hue = ((hue * 60) + 360) % 360
  return Math.floor(hue / 45) % 8 // 8 buckets of 45 degrees each
}

/** Map legCount gene (0-1) to a bucket: 0, 2, 4, or 6+ */
function legCountBucket(gene: number): string {
  const count = Math.round(gene * 8)
  if (count === 0) return '0'
  if (count <= 2) return '2'
  if (count <= 4) return '4'
  return '6+'
}

/**
 * Compute a stable variant ID string from key DNA fields.
 * Format: <bodyPlan>-<sizeBucket>-<appendageFlags>-<colorFamily>-<legCountBucket>
 */
export function getVariantId(dna: CreatureDNA): string {
  const parts = [
    dna.bodyPlan,
    sizeBucket(dna.size),
    appendageFlags(dna),
    String(colorFamily(dna.bodyColor)),
    legCountBucket(dna.legCount),
  ]
  return parts.join('-')
}

// ---------------------------------------------------------------------------
// Rarity system
// ---------------------------------------------------------------------------

const PRESET_VALUES = Object.values(DNA_PRESETS)

/**
 * Gene group weights for distance computation.
 * appendages: hasWings, hasTail, hasHorns, hasClaws, hasMandibles, hasFins, hasAntennae (weight 3.0)
 * body proportions: bodyLength, bodyWidth, bodyHeight (weight 2.0)
 * limbs: legCount, legLength, legThickness (weight 2.0)
 * head/eye: headSize, neckLength, eyeSize, eyeCount (weight 1.0)
 * behavioral: speed, aggression, size (weight 0.5)
 */
interface WeightedGene {
  key: keyof CreatureDNA
  weight: number
}

const WEIGHTED_GENES: WeightedGene[] = [
  // appendages (3.0)
  { key: 'hasWings',     weight: 3.0 },
  { key: 'hasTail',      weight: 3.0 },
  { key: 'hasHorns',     weight: 3.0 },
  { key: 'hasClaws',     weight: 3.0 },
  { key: 'hasMandibles', weight: 3.0 },
  { key: 'hasFins',      weight: 3.0 },
  { key: 'hasAntennae',  weight: 3.0 },
  // body proportions (2.0)
  { key: 'bodyLength',   weight: 2.0 },
  { key: 'bodyWidth',    weight: 2.0 },
  { key: 'bodyHeight',   weight: 2.0 },
  // limbs (2.0)
  { key: 'legCount',     weight: 2.0 },
  { key: 'legLength',    weight: 2.0 },
  { key: 'legThickness', weight: 2.0 },
  // head/eye (1.0)
  { key: 'headSize',     weight: 1.0 },
  { key: 'neckLength',   weight: 1.0 },
  { key: 'eyeSize',      weight: 1.0 },
  { key: 'eyeCount',     weight: 1.0 },
  // behavioral (0.5)
  { key: 'speed',        weight: 0.5 },
  { key: 'aggression',   weight: 0.5 },
  { key: 'size',         weight: 0.5 },
]

/** Weighted squared distance between two DNA objects (numeric genes only). */
function weightedDistance(a: CreatureDNA, b: CreatureDNA): number {
  let sum = 0
  for (const { key, weight } of WEIGHTED_GENES) {
    const av = a[key] as number
    const bv = b[key] as number
    const diff = av - bv
    sum += weight * diff * diff
  }
  return sum
}

/** Maximum possible weighted squared distance (all genes differ by 1). */
const MAX_WEIGHTED_DISTANCE: number = WEIGHTED_GENES.reduce(
  (acc, { weight }) => acc + weight,
  0,
)

/**
 * Calculate rarity score as weighted distance from the nearest preset DNA.
 * Returns a value in [0, 1] where 1 is maximally distant from all presets.
 */
export function calculateRarityScore(dna: CreatureDNA): number {
  let minDist = Infinity

  for (const preset of PRESET_VALUES) {
    // Only compare within the same body plan for meaningful distance
    if (preset.bodyPlan !== dna.bodyPlan) continue
    const d = weightedDistance(dna, preset)
    if (d < minDist) minDist = d
  }

  // If no preset matched the body plan (shouldn't happen with valid DNA), fall back
  if (!isFinite(minDist)) {
    for (const preset of PRESET_VALUES) {
      const d = weightedDistance(dna, preset)
      if (d < minDist) minDist = d
    }
  }

  return Math.min(1, minDist / MAX_WEIGHTED_DISTANCE)
}

/** Classify a rarity score into a named tier. */
export function getRarityTier(score: number): RarityTier {
  if (score < 0.10) return 'common'
  if (score < 0.25) return 'uncommon'
  if (score < 0.50) return 'rare'
  return 'legendary'
}

/** Get the display colour associated with a rarity tier. */
export function getRarityColor(tier: RarityTier): string {
  switch (tier) {
    case 'common':    return '#a0a0a0'
    case 'uncommon':  return '#4fc34f'
    case 'rare':      return '#4fa8c3'
    case 'legendary': return '#c3a04f'
  }
}
