import type { CreatureDNA, BodyPlan } from './CreatureDNA'

const MUTATION_CHANCE = 0.15      // 15% per gene — keeps variation alive
const MUTATION_RANGE = 0.25       // +/- 25% — noticeable mutations
const RADICAL_CHANCE = 0.04       // 4% chance to completely randomize a gene
const COLOR_SHIFT_CHANCE = 0.12   // 12% chance per channel for hue-shifting mutation
const COLOR_WILD_CHANCE = 0.06    // 6% chance for a completely new random color
const CROSS_BODY_SUCCESS_RATE = 0.15
const CROSS_BODY_BLEED = 0.4

const NUMERIC_GENES: (keyof CreatureDNA)[] = [
  'bodyLength', 'bodyWidth', 'bodyHeight', 'headSize', 'neckLength',
  'legCount', 'legLength', 'legThickness',
  'hasWings', 'wingSpan', 'hasTail', 'tailLength',
  'hasHorns', 'hornSize', 'hasClaws', 'clawSize',
  'hasMandibles', 'hasFins', 'finSize', 'hasAntennae',
  'eyeSize', 'eyeCount',
  'speed', 'aggression', 'size',
]

const APPENDAGE_GENES: (keyof CreatureDNA)[] = [
  'hasWings', 'wingSpan', 'hasTail', 'tailLength',
  'hasHorns', 'hornSize', 'hasClaws', 'clawSize',
  'hasMandibles', 'hasFins', 'finSize', 'hasAntennae',
]

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function mutateGene(value: number, rateMultiplier = 1.0): number {
  // Radical mutation: completely random new value
  if (Math.random() < RADICAL_CHANCE * rateMultiplier) {
    return Math.random()
  }
  // Normal mutation: shift by up to +/- MUTATION_RANGE
  if (Math.random() < MUTATION_CHANCE * rateMultiplier) {
    return clamp01(value + (Math.random() * 2 - 1) * MUTATION_RANGE * Math.min(rateMultiplier, 2.0))
  }
  return value
}

// --- HSL helpers for vivid color mutations ---
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)]
}

function blendColor(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  // Wild mutation: completely new random vivid color
  if (Math.random() < COLOR_WILD_CHANCE) {
    const h = Math.random()
    const s = 0.5 + Math.random() * 0.5   // always saturated
    const l = 0.3 + Math.random() * 0.4   // medium brightness
    return hslToRgb(h, s, l)
  }

  // Blend parents in HSL space to preserve vibrancy
  const [ah, as, al] = rgbToHsl(a[0], a[1], a[2])
  const [bh, bs, bl] = rgbToHsl(b[0], b[1], b[2])
  const t = 0.3 + Math.random() * 0.4

  // Hue blending on the circle (shortest arc)
  let hDiff = bh - ah
  if (hDiff > 0.5) hDiff -= 1
  if (hDiff < -0.5) hDiff += 1
  let h = ah + hDiff * (1 - t)
  if (h < 0) h += 1; if (h > 1) h -= 1

  let s = as * t + bs * (1 - t)
  let l = al * t + bl * (1 - t)

  // Hue shift mutation: rotate hue significantly
  if (Math.random() < COLOR_SHIFT_CHANCE) {
    h = (h + 0.15 + Math.random() * 0.3) % 1.0  // shift 15-45% around the wheel
  }
  // Saturation boost: fight desaturation drift
  if (Math.random() < COLOR_SHIFT_CHANCE) {
    s = clamp01(s + 0.1 + Math.random() * 0.3)   // push saturation up
  }
  // Lightness jitter
  if (Math.random() < MUTATION_CHANCE) {
    l = clamp01(l + (Math.random() - 0.5) * 0.3)
  }

  return hslToRgb(clamp01(h), clamp01(s), clamp01(l))
}

export function breedDNA(parentA: CreatureDNA, parentB: CreatureDNA, mutationRateMultiplier = 1.0): CreatureDNA | null {
  const sameBody = parentA.bodyPlan === parentB.bodyPlan

  if (!sameBody && Math.random() > CROSS_BODY_SUCCESS_RATE) {
    return null
  }

  let bodyPlan: BodyPlan
  if (sameBody) {
    bodyPlan = parentA.bodyPlan
  } else {
    bodyPlan = Math.random() < 0.5 ? parentA.bodyPlan : parentB.bodyPlan
  }

  const chosen = bodyPlan === parentA.bodyPlan ? parentA : parentB
  const other = bodyPlan === parentA.bodyPlan ? parentB : parentA

  const child: CreatureDNA = {
    bodyPlan,
    bodyLength: 0, bodyWidth: 0, bodyHeight: 0,
    headSize: 0, neckLength: 0,
    legCount: 0, legLength: 0, legThickness: 0,
    hasWings: 0, wingSpan: 0, hasTail: 0, tailLength: 0,
    hasHorns: 0, hornSize: 0, hasClaws: 0, clawSize: 0,
    hasMandibles: 0, hasFins: 0, finSize: 0, hasAntennae: 0,
    bodyColor: [0, 0, 0], accentColor: [0, 0, 0],
    eyeSize: 0, eyeCount: 0,
    speed: 0, aggression: 0, size: 0,
  }

  for (const key of NUMERIC_GENES) {
    const aVal = parentA[key] as number
    const bVal = parentB[key] as number

    if (!sameBody && APPENDAGE_GENES.includes(key)) {
      const chosenVal = chosen[key] as number
      const otherVal = other[key] as number
      ;(child as unknown as Record<string, unknown>)[key] = mutateGene(
        chosenVal * (1 - CROSS_BODY_BLEED) + otherVal * CROSS_BODY_BLEED,
        mutationRateMultiplier
      )
    } else {
      const picked = Math.random() < 0.5 ? aVal : bVal
      ;(child as unknown as Record<string, unknown>)[key] = mutateGene(picked, mutationRateMultiplier)
    }
  }

  child.bodyColor = blendColor(parentA.bodyColor, parentB.bodyColor)
  child.accentColor = blendColor(parentA.accentColor, parentB.accentColor)

  return child
}

function mutateColor(c: [number, number, number]): [number, number, number] {
  // Wild mutation: completely new random vivid color
  if (Math.random() < COLOR_WILD_CHANCE) {
    const h = Math.random()
    const s = 0.5 + Math.random() * 0.5
    const l = 0.3 + Math.random() * 0.4
    return hslToRgb(h, s, l)
  }
  const [h0, s0, l0] = rgbToHsl(c[0], c[1], c[2])
  let h = h0, s = s0, l = l0
  if (Math.random() < COLOR_SHIFT_CHANCE) {
    h = (h + 0.15 + Math.random() * 0.3) % 1.0
  }
  if (Math.random() < COLOR_SHIFT_CHANCE) {
    s = clamp01(s + 0.1 + Math.random() * 0.3)
  }
  if (Math.random() < MUTATION_CHANCE) {
    l = clamp01(l + (Math.random() - 0.5) * 0.3)
  }
  return hslToRgb(clamp01(h), clamp01(s), clamp01(l))
}

export function mutateDNA(dna: CreatureDNA): CreatureDNA {
  const clone: CreatureDNA = {
    ...dna,
    bodyColor: [...dna.bodyColor] as [number, number, number],
    accentColor: [...dna.accentColor] as [number, number, number],
  }
  for (const key of NUMERIC_GENES) {
    ;(clone as unknown as Record<string, unknown>)[key] = mutateGene(clone[key] as number)
  }
  clone.bodyColor = mutateColor(clone.bodyColor)
  clone.accentColor = mutateColor(clone.accentColor)
  return clone
}
