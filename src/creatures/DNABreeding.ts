import type { CreatureDNA, BodyPlan } from './CreatureDNA'

const MUTATION_CHANCE = 0.03
const MUTATION_RANGE = 0.1
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

function mutateGene(value: number): number {
  if (Math.random() < MUTATION_CHANCE) {
    return clamp01(value + (Math.random() - 0.5) * 2 * MUTATION_RANGE)
  }
  return value
}

function blendColor(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  const t = 0.3 + Math.random() * 0.4
  return [
    clamp01(a[0] * t + b[0] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
    clamp01(a[1] * t + b[1] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
    clamp01(a[2] * t + b[2] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
  ]
}

export function breedDNA(parentA: CreatureDNA, parentB: CreatureDNA): CreatureDNA | null {
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
        chosenVal * (1 - CROSS_BODY_BLEED) + otherVal * CROSS_BODY_BLEED
      )
    } else {
      const picked = Math.random() < 0.5 ? aVal : bVal
      ;(child as unknown as Record<string, unknown>)[key] = mutateGene(picked)
    }
  }

  child.bodyColor = blendColor(parentA.bodyColor, parentB.bodyColor)
  child.accentColor = blendColor(parentA.accentColor, parentB.accentColor)

  return child
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
  return clone
}
