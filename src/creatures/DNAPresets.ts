import { BiomeType } from '../biomes/types'
import type { CreatureDNA } from './CreatureDNA'

function dna(plan: CreatureDNA['bodyPlan'], overrides: Partial<CreatureDNA>): CreatureDNA {
  return {
    bodyPlan: plan,
    bodyLength: 0.5, bodyWidth: 0.5, bodyHeight: 0.5,
    headSize: 0.5, neckLength: 0.3,
    legCount: 0.5, legLength: 0.5, legThickness: 0.5,
    hasWings: 0, wingSpan: 0.5,
    hasTail: 0.3, tailLength: 0.5,
    hasHorns: 0, hornSize: 0.5,
    hasClaws: 0, clawSize: 0.5,
    hasMandibles: 0, hasFins: 0, finSize: 0.5, hasAntennae: 0,
    bodyColor: [0.5, 0.4, 0.3], accentColor: [0.6, 0.5, 0.4],
    eyeSize: 0.5, eyeCount: 0.2,
    speed: 0.5, aggression: 0.2, size: 0.5,
    ...overrides,
  }
}

export const PRESET_ELK = dna('quadruped', {
  bodyLength: 0.8, bodyWidth: 0.5, bodyHeight: 0.6,
  headSize: 0.5, neckLength: 0.6,
  legCount: 0.5, legLength: 0.8, legThickness: 0.4,
  hasHorns: 0.9, hornSize: 0.8,
  hasTail: 0.6, tailLength: 0.3,
  bodyColor: [0.55, 0.35, 0.15], accentColor: [0.65, 0.45, 0.2],
  speed: 0.7, aggression: 0.1, size: 0.65,
})

export const PRESET_WOLF = dna('quadruped', {
  bodyLength: 0.6, bodyWidth: 0.4, bodyHeight: 0.45,
  headSize: 0.55, neckLength: 0.4,
  legCount: 0.5, legLength: 0.6, legThickness: 0.45,
  hasClaws: 0.7, clawSize: 0.4,
  hasTail: 0.8, tailLength: 0.6,
  bodyColor: [0.4, 0.4, 0.42], accentColor: [0.55, 0.55, 0.5],
  speed: 0.7, aggression: 0.75, size: 0.5,
})

export const PRESET_BEAR = dna('quadruped', {
  bodyLength: 0.8, bodyWidth: 0.7, bodyHeight: 0.7,
  headSize: 0.6, neckLength: 0.2,
  legCount: 0.5, legLength: 0.5, legThickness: 0.8,
  hasClaws: 0.8, clawSize: 0.6,
  hasTail: 0.6, tailLength: 0.15,
  bodyColor: [0.35, 0.22, 0.1], accentColor: [0.4, 0.28, 0.15],
  speed: 0.45, aggression: 0.65, size: 0.75,
})

export const PRESET_FOX = dna('quadruped', {
  bodyLength: 0.5, bodyWidth: 0.3, bodyHeight: 0.35,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.5, legLength: 0.55, legThickness: 0.3,
  hasTail: 0.9, tailLength: 0.8,
  bodyColor: [0.8, 0.45, 0.1], accentColor: [0.9, 0.85, 0.8],
  speed: 0.7, aggression: 0.3, size: 0.3,
})

export const PRESET_RABBIT = dna('quadruped', {
  bodyLength: 0.3, bodyWidth: 0.3, bodyHeight: 0.3,
  headSize: 0.6, neckLength: 0.1,
  legCount: 0.5, legLength: 0.4, legThickness: 0.3,
  hasTail: 0.6, tailLength: 0.1,
  bodyColor: [0.65, 0.6, 0.5], accentColor: [0.8, 0.75, 0.7],
  speed: 0.8, aggression: 0.05, size: 0.15,
})

export const PRESET_MAMMOTH = dna('quadruped', {
  bodyLength: 0.9, bodyWidth: 0.8, bodyHeight: 0.85,
  headSize: 0.7, neckLength: 0.2,
  legCount: 0.5, legLength: 0.6, legThickness: 0.9,
  hasHorns: 0.9, hornSize: 0.9,
  hasTail: 0.6, tailLength: 0.2,
  bodyColor: [0.4, 0.32, 0.25], accentColor: [0.5, 0.42, 0.35],
  speed: 0.25, aggression: 0.15, size: 0.9,
})

export const PRESET_BEETLE = dna('insectoid', {
  bodyLength: 0.4, bodyWidth: 0.5, bodyHeight: 0.4,
  headSize: 0.4, neckLength: 0.05,
  legCount: 0.7, legLength: 0.3, legThickness: 0.5,
  hasMandibles: 0.8, hasClaws: 0.6, clawSize: 0.3,
  bodyColor: [0.15, 0.12, 0.08], accentColor: [0.2, 0.18, 0.1],
  eyeCount: 0.5,
  speed: 0.2, aggression: 0.2, size: 0.25,
})

export const PRESET_SPIDER = dna('insectoid', {
  bodyLength: 0.35, bodyWidth: 0.4, bodyHeight: 0.3,
  headSize: 0.45, neckLength: 0.05,
  legCount: 0.9, legLength: 0.8, legThickness: 0.2,
  hasClaws: 0.7, clawSize: 0.3,
  bodyColor: [0.2, 0.15, 0.1], accentColor: [0.7, 0.1, 0.05],
  eyeCount: 0.9,
  speed: 0.6, aggression: 0.7, size: 0.3,
})

export const PRESET_MANTIS = dna('insectoid', {
  bodyLength: 0.6, bodyWidth: 0.25, bodyHeight: 0.55,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.7, legLength: 0.7, legThickness: 0.2,
  hasClaws: 0.9, clawSize: 0.8,
  bodyColor: [0.2, 0.6, 0.15], accentColor: [0.3, 0.7, 0.2],
  eyeCount: 0.5,
  speed: 0.5, aggression: 0.8, size: 0.4,
})

export const PRESET_ANT = dna('insectoid', {
  bodyLength: 0.3, bodyWidth: 0.2, bodyHeight: 0.2,
  headSize: 0.5, neckLength: 0.15,
  legCount: 0.7, legLength: 0.4, legThickness: 0.25,
  hasMandibles: 0.7, hasAntennae: 0.9,
  bodyColor: [0.15, 0.08, 0.02], accentColor: [0.2, 0.12, 0.05],
  eyeCount: 0.3,
  speed: 0.4, aggression: 0.1, size: 0.1,
})

export const PRESET_CENTIPEDE = dna('insectoid', {
  bodyLength: 0.9, bodyWidth: 0.25, bodyHeight: 0.15,
  headSize: 0.35, neckLength: 0.05,
  legCount: 0.9, legLength: 0.3, legThickness: 0.2,
  hasMandibles: 0.6, hasAntennae: 0.7,
  bodyColor: [0.5, 0.25, 0.08], accentColor: [0.6, 0.35, 0.1],
  eyeCount: 0.3,
  speed: 0.5, aggression: 0.4, size: 0.3,
})

export const PRESET_EAGLE = dna('avian', {
  bodyLength: 0.5, bodyWidth: 0.4, bodyHeight: 0.4,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.3, legLength: 0.4, legThickness: 0.3,
  hasWings: 0.95, wingSpan: 0.9,
  hasClaws: 0.8, clawSize: 0.6,
  hasTail: 0.7, tailLength: 0.5,
  bodyColor: [0.35, 0.25, 0.12], accentColor: [0.9, 0.88, 0.8],
  speed: 0.8, aggression: 0.7, size: 0.5,
})

export const PRESET_SONGBIRD = dna('avian', {
  bodyLength: 0.25, bodyWidth: 0.25, bodyHeight: 0.25,
  headSize: 0.55, neckLength: 0.15,
  legCount: 0.3, legLength: 0.35, legThickness: 0.2,
  hasWings: 0.9, wingSpan: 0.5,
  hasTail: 0.7, tailLength: 0.4,
  bodyColor: [0.3, 0.5, 0.7], accentColor: [0.9, 0.8, 0.2],
  speed: 0.7, aggression: 0.05, size: 0.12,
})

export const PRESET_PARROT = dna('avian', {
  bodyLength: 0.35, bodyWidth: 0.3, bodyHeight: 0.3,
  headSize: 0.55, neckLength: 0.15,
  legCount: 0.3, legLength: 0.3, legThickness: 0.25,
  hasWings: 0.9, wingSpan: 0.65,
  hasTail: 0.85, tailLength: 0.8,
  bodyColor: [0.1, 0.7, 0.2], accentColor: [0.9, 0.15, 0.1],
  speed: 0.6, aggression: 0.1, size: 0.2,
})

export const PRESET_BAT = dna('avian', {
  bodyLength: 0.25, bodyWidth: 0.2, bodyHeight: 0.2,
  headSize: 0.5, neckLength: 0.1,
  legCount: 0.3, legLength: 0.2, legThickness: 0.2,
  hasWings: 0.95, wingSpan: 0.85,
  hasTail: 0.3, tailLength: 0.15,
  bodyColor: [0.15, 0.12, 0.1], accentColor: [0.2, 0.15, 0.12],
  eyeSize: 0.7,
  speed: 0.6, aggression: 0.3, size: 0.15,
})

export const PRESET_SHARK = dna('aquatic', {
  bodyLength: 0.8, bodyWidth: 0.4, bodyHeight: 0.35,
  headSize: 0.5, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.95, finSize: 0.8,
  hasTail: 0.9, tailLength: 0.6,
  bodyColor: [0.35, 0.38, 0.42], accentColor: [0.7, 0.72, 0.75],
  speed: 0.8, aggression: 0.85, size: 0.65,
})

export const PRESET_GOLDFISH = dna('aquatic', {
  bodyLength: 0.3, bodyWidth: 0.35, bodyHeight: 0.35,
  headSize: 0.55, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.9, finSize: 0.7,
  hasTail: 0.85, tailLength: 0.5,
  bodyColor: [0.95, 0.6, 0.1], accentColor: [1.0, 0.85, 0.3],
  eyeSize: 0.7,
  speed: 0.35, aggression: 0.05, size: 0.15,
})

export const PRESET_EEL = dna('aquatic', {
  bodyLength: 0.95, bodyWidth: 0.15, bodyHeight: 0.15,
  headSize: 0.35, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.6, finSize: 0.3,
  hasTail: 0.7, tailLength: 0.3,
  bodyColor: [0.2, 0.25, 0.18], accentColor: [0.3, 0.35, 0.25],
  speed: 0.5, aggression: 0.4, size: 0.35,
})

export const PRESET_SNAKE = dna('serpentine', {
  bodyLength: 0.8, bodyWidth: 0.15, bodyHeight: 0.12,
  headSize: 0.4, neckLength: 0.15,
  legCount: 0.0,
  hasTail: 0.7, tailLength: 0.6,
  bodyColor: [0.3, 0.45, 0.15], accentColor: [0.5, 0.6, 0.2],
  speed: 0.5, aggression: 0.55, size: 0.25,
})

export const PRESET_WYRM = dna('serpentine', {
  bodyLength: 0.95, bodyWidth: 0.5, bodyHeight: 0.45,
  headSize: 0.6, neckLength: 0.3,
  legCount: 0.0,
  hasHorns: 0.85, hornSize: 0.7,
  hasTail: 0.8, tailLength: 0.7,
  bodyColor: [0.25, 0.1, 0.08], accentColor: [0.6, 0.2, 0.05],
  eyeSize: 0.7,
  speed: 0.35, aggression: 0.8, size: 0.85,
})

export const DNA_PRESETS: Record<string, CreatureDNA> = {
  elk: PRESET_ELK, wolf: PRESET_WOLF, bear: PRESET_BEAR,
  fox: PRESET_FOX, rabbit: PRESET_RABBIT, mammoth: PRESET_MAMMOTH,
  beetle: PRESET_BEETLE, spider: PRESET_SPIDER, mantis: PRESET_MANTIS,
  ant: PRESET_ANT, centipede: PRESET_CENTIPEDE,
  eagle: PRESET_EAGLE, songbird: PRESET_SONGBIRD, parrot: PRESET_PARROT, bat: PRESET_BAT,
  shark: PRESET_SHARK, goldfish: PRESET_GOLDFISH, eel: PRESET_EEL,
  snake: PRESET_SNAKE, wyrm: PRESET_WYRM,
}

export const BIOME_DNA_TABLE: Partial<Record<BiomeType, string[]>> = {
  [BiomeType.Forest]:    ['rabbit', 'rabbit', 'elk', 'elk', 'songbird', 'wolf', 'bear', 'fox', 'beetle', 'ant'],
  [BiomeType.Desert]:    ['fox', 'fox', 'rabbit', 'spider', 'eagle', 'snake', 'ant', 'centipede'],
  [BiomeType.Swamp]:     ['rabbit', 'elk', 'songbird', 'goldfish', 'goldfish', 'centipede', 'beetle', 'bat', 'snake', 'eel'],
  [BiomeType.Snow]:      ['rabbit', 'elk', 'songbird', 'wolf', 'mammoth', 'bear', 'fox', 'eagle', 'bat'],
  [BiomeType.Volcanic]:  ['wyrm', 'bat', 'spider', 'snake'],
  [BiomeType.Crystal]:   ['songbird', 'elk', 'eagle', 'parrot'],
  [BiomeType.Jungle]:    ['parrot', 'parrot', 'mantis', 'spider', 'fox', 'centipede', 'ant'],
  [BiomeType.Mesa]:      ['eagle', 'spider', 'snake', 'fox'],
  [BiomeType.CoralReef]: ['goldfish', 'goldfish', 'eel', 'shark', 'beetle'],
  [BiomeType.Heaven]:    ['songbird', 'songbird', 'songbird', 'elk', 'eagle', 'bat', 'parrot'],
  [BiomeType.Hell]:      ['wyrm', 'spider', 'bat', 'snake', 'centipede'],
}

export function getPresetDNA(name: string, rng: { next(): number }): CreatureDNA {
  const base = DNA_PRESETS[name] ?? DNA_PRESETS['rabbit']
  const clone: CreatureDNA = {
    ...base,
    bodyColor: [...base.bodyColor] as [number, number, number],
    accentColor: [...base.accentColor] as [number, number, number],
  }
  const vary = (v: number) => Math.max(0, Math.min(1, v + (rng.next() - 0.5) * 0.1))
  clone.bodyLength = vary(clone.bodyLength)
  clone.bodyWidth = vary(clone.bodyWidth)
  clone.bodyHeight = vary(clone.bodyHeight)
  clone.headSize = vary(clone.headSize)
  clone.legLength = vary(clone.legLength)
  clone.legThickness = vary(clone.legThickness)
  clone.speed = vary(clone.speed)
  clone.size = vary(clone.size)
  clone.bodyColor[0] = vary(clone.bodyColor[0])
  clone.bodyColor[1] = vary(clone.bodyColor[1])
  clone.bodyColor[2] = vary(clone.bodyColor[2])
  clone.accentColor[0] = vary(clone.accentColor[0])
  clone.accentColor[1] = vary(clone.accentColor[1])
  clone.accentColor[2] = vary(clone.accentColor[2])
  return clone
}
