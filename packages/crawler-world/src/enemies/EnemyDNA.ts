import type { CreatureDNA } from '@engine/core'
import { mutateDNA } from '@engine/core'
import { BiomeType } from '@engine/core'

export type EnemyArchetype = 'rusher' | 'shooter' | 'flyer' | 'tank'

// Base DNA templates per archetype.
// CreatureDNA fields: bodyPlan, bodyLength, bodyWidth, bodyHeight, headSize,
// neckLength, legCount, legLength, legThickness, hasWings, wingSpan, hasTail,
// tailLength, hasHorns, hornSize, hasClaws, clawSize, hasMandibles, hasFins,
// finSize, hasAntennae, bodyColor, accentColor, eyeSize, eyeCount, speed,
// aggression, size
export const ARCHETYPE_DNA: Record<EnemyArchetype, CreatureDNA> = {
  rusher: {
    bodyPlan: 'quadruped',
    bodyLength: 0.8, bodyWidth: 0.6, bodyHeight: 0.5,
    headSize: 0.5, neckLength: 0.3,
    legCount: 0.5,  // quantizes to 4 legs
    legLength: 0.4, legThickness: 0.15,
    hasWings: 0, wingSpan: 0,
    hasTail: 0.5, tailLength: 0.4,
    hasHorns: 0, hornSize: 0,
    hasClaws: 0.8, clawSize: 0.4,
    hasMandibles: 0, hasFins: 0, finSize: 0, hasAntennae: 0,
    bodyColor: [0.8, 0.2, 0.2],     // red
    accentColor: [1.0, 0.3, 0.1],
    eyeSize: 0.3, eyeCount: 0.2,    // quantizes to 2 eyes
    speed: 0.7, aggression: 0.8,
    size: 1.0,
  },
  shooter: {
    bodyPlan: 'insectoid',
    bodyLength: 0.7, bodyWidth: 0.5, bodyHeight: 0.4,
    headSize: 0.6, neckLength: 0.2,
    legCount: 0.5,  // 4 legs
    legLength: 0.35, legThickness: 0.12,
    hasWings: 0, wingSpan: 0,
    hasTail: 0.3, tailLength: 0.5,
    hasHorns: 0.4, hornSize: 0.3,
    hasClaws: 0.2, clawSize: 0.1,
    hasMandibles: 0.8, hasFins: 0, finSize: 0, hasAntennae: 0.7,
    bodyColor: [0.85, 0.45, 0.1],   // orange
    accentColor: [1.0, 0.6, 0.0],
    eyeSize: 0.4, eyeCount: 0.5,    // 4 eyes
    speed: 0.45, aggression: 0.5,
    size: 0.9,
  },
  flyer: {
    bodyPlan: 'avian',
    bodyLength: 0.5, bodyWidth: 0.4, bodyHeight: 0.35,
    headSize: 0.4, neckLength: 0.5,
    legCount: 0.25, // 2 legs
    legLength: 0.25, legThickness: 0.08,
    hasWings: 1.0, wingSpan: 0.8,
    hasTail: 0.7, tailLength: 0.5,
    hasHorns: 0, hornSize: 0,
    hasClaws: 0.6, clawSize: 0.3,
    hasMandibles: 0, hasFins: 0, finSize: 0, hasAntennae: 0,
    bodyColor: [0.2, 0.8, 0.85],    // cyan
    accentColor: [0.4, 1.0, 1.0],
    eyeSize: 0.35, eyeCount: 0.2,
    speed: 0.8, aggression: 0.6,
    size: 0.7,
  },
  tank: {
    bodyPlan: 'quadruped',
    bodyLength: 1.2, bodyWidth: 1.0, bodyHeight: 0.9,
    headSize: 0.7, neckLength: 0.2,
    legCount: 0.75, // 6 legs
    legLength: 0.5, legThickness: 0.3,
    hasWings: 0, wingSpan: 0,
    hasTail: 0.8, tailLength: 0.6,
    hasHorns: 0.9, hornSize: 0.7,
    hasClaws: 0.9, clawSize: 0.6,
    hasMandibles: 0, hasFins: 0, finSize: 0, hasAntennae: 0,
    bodyColor: [0.55, 0.1, 0.75],   // purple
    accentColor: [0.8, 0.3, 1.0],
    eyeSize: 0.4, eyeCount: 0.2,
    speed: 0.2, aggression: 0.9,
    size: 1.6,
  },
}

export interface BiomeEnemyTemplate {
  archetype: EnemyArchetype
  dna: CreatureDNA
}

// Helper to build a DNA override merged with archetype base
function makeTemplate(
  archetype: EnemyArchetype,
  color: [number, number, number],
  accent: [number, number, number],
  overrides: Partial<CreatureDNA> = {},
): BiomeEnemyTemplate {
  return {
    archetype,
    dna: {
      ...ARCHETYPE_DNA[archetype],
      bodyColor: color,
      accentColor: accent,
      ...overrides,
    },
  }
}

export const BIOME_ENEMY_TEMPLATES: Record<BiomeType, BiomeEnemyTemplate[]> = {
  [BiomeType.Forest]: [
    makeTemplate('rusher',  [0.6,  0.6,  0.65], [0.75, 0.75, 0.8],   { bodyPlan: 'quadruped', hasClaws: 0.9, size: 1.0 }),   // wolf
    makeTemplate('tank',    [0.5,  0.3,  0.1],  [0.65, 0.4,  0.15],  { hasHorns: 1.0, hornSize: 0.5, size: 1.5 }),           // boar
    makeTemplate('flyer',   [0.5,  0.35, 0.15], [0.7,  0.5,  0.2],   { wingSpan: 1.0 }),                                     // hawk
    makeTemplate('shooter', [0.1,  0.05, 0.05], [0.25, 0.1,  0.1],   { bodyPlan: 'insectoid', legCount: 1.0, hasAntennae: 0.5 }), // spider
  ],
  [BiomeType.Desert]: [
    makeTemplate('shooter', [0.8,  0.7,  0.4],  [1.0,  0.85, 0.5],   { bodyPlan: 'insectoid', hasTail: 1.0, tailLength: 0.8 }), // scorpion
    makeTemplate('tank',    [0.85, 0.8,  0.1],  [1.0,  0.9,  0.2],   { bodyPlan: 'serpentine', legCount: 0, size: 1.8 }),     // sandworm
    makeTemplate('flyer',   [0.88, 0.84, 0.72], [1.0,  0.95, 0.82],  { wingSpan: 0.9 }),                                     // vulture
    makeTemplate('rusher',  [0.8,  0.72, 0.45], [0.95, 0.85, 0.55],  { speed: 0.75 }),                                       // jackal
  ],
  [BiomeType.Swamp]: [
    makeTemplate('tank',    [0.15, 0.45, 0.15], [0.2,  0.6,  0.2],   { bodyPlan: 'quadruped', hasTail: 1.0, size: 1.7 }),    // croc
    makeTemplate('rusher',  [0.4,  0.5,  0.1],  [0.55, 0.65, 0.15],  { legCount: 0.25, size: 0.9 }),                         // toad
    makeTemplate('flyer',   [0.1,  0.1,  0.08], [0.2,  0.15, 0.1],   { hasAntennae: 1.0, wingSpan: 0.6, size: 0.5 }),        // mosquito
    makeTemplate('shooter', [0.1,  0.5,  0.1],  [0.15, 0.7,  0.15],  { bodyPlan: 'serpentine', hasTail: 1.0, legCount: 0 }), // viper
  ],
  [BiomeType.Snow]: [
    makeTemplate('tank',    [0.9,  0.95, 1.0],  [1.0,  1.0,  1.0],   { hasHorns: 1.0, hornSize: 0.9, size: 2.0 }),           // mammoth
    makeTemplate('rusher',  [0.7,  0.85, 0.95], [0.85, 0.95, 1.0],   { speed: 0.8 }),                                        // frost fox
    makeTemplate('flyer',   [0.95, 0.95, 0.9],  [1.0,  1.0,  0.95],  { wingSpan: 1.0 }),                                     // snow owl
    makeTemplate('shooter', [0.4,  0.65, 0.95], [0.55, 0.8,  1.0],   { bodyPlan: 'insectoid', legCount: 1.0 }),               // ice spider
  ],
  [BiomeType.Volcanic]: [
    makeTemplate('rusher',  [0.85, 0.1,  0.1],  [1.0,  0.2,  0.0],   { size: 0.7, speed: 0.85 }),                            // imp
    makeTemplate('tank',    [0.45, 0.0,  0.0],  [0.65, 0.05, 0.0],   { size: 1.8, hasHorns: 0.8 }),                          // magma beast
    makeTemplate('flyer',   [1.0,  0.45, 0.0],  [1.0,  0.65, 0.1],   { wingSpan: 0.7, size: 0.6 }),                          // fire bat
    makeTemplate('shooter', [0.8,  0.1,  0.05], [1.0,  0.15, 0.05],  { hasMandibles: 0.8 }),                                 // lava spitter
  ],
  [BiomeType.Crystal]: [
    makeTemplate('tank',    [0.0,  0.85, 0.9],  [0.2,  1.0,  1.0],   { size: 1.7, hasHorns: 0.6 }),                          // golem
    makeTemplate('shooter', [0.65, 0.0,  0.85], [0.8,  0.2,  1.0],   { bodyPlan: 'quadruped', eyeCount: 0.8 }),               // prism
    makeTemplate('flyer',   [0.95, 0.95, 1.0],  [1.0,  1.0,  1.0],   { size: 0.4, wingSpan: 0.5 }),                          // wisp
    makeTemplate('rusher',  [0.2,  0.5,  0.95], [0.35, 0.7,  1.0],   { speed: 0.9, hasClaws: 1.0 }),                         // shard
  ],
  [BiomeType.Jungle]: [
    makeTemplate('rusher',  [0.05, 0.25, 0.05], [0.1,  0.4,  0.1],   { speed: 0.9, hasClaws: 1.0, size: 1.1 }),              // panther
    makeTemplate('tank',    [0.4,  0.25, 0.1],  [0.55, 0.35, 0.15],  { bodyPlan: 'quadruped', size: 1.6, legCount: 0.25 }),  // ape
    makeTemplate('flyer',   [0.8,  0.3,  0.1],  [1.0,  0.55, 0.2],   { wingSpan: 0.8 }),                                     // parrot
    makeTemplate('shooter', [0.15, 0.55, 0.15], [0.25, 0.7,  0.2],   { bodyPlan: 'serpentine', hasTail: 1.0, legCount: 0 }), // snake
  ],
  [BiomeType.Mesa]: [
    makeTemplate('flyer',   [0.5,  0.35, 0.15], [0.65, 0.5,  0.2],   { wingSpan: 1.0 }),                                     // hawk
    makeTemplate('shooter', [0.9,  0.5,  0.1],  [1.0,  0.65, 0.2],   { bodyPlan: 'quadruped', legCount: 0.25 }),             // nomad
    makeTemplate('rusher',  [0.6,  0.6,  0.6],  [0.75, 0.75, 0.75],  { hasHorns: 0.9, hornSize: 0.4 }),                      // goat
    makeTemplate('tank',    [0.45, 0.3,  0.15], [0.6,  0.4,  0.2],   { bodyPlan: 'insectoid', hasTail: 1.0, legCount: 1.0 }), // scorpion-tank
  ],
  [BiomeType.CoralReef]: [
    makeTemplate('rusher',  [0.5,  0.55, 0.6],  [0.65, 0.7,  0.75],  { bodyPlan: 'aquatic', hasFins: 1.0, finSize: 0.8, legCount: 0 }), // shark
    makeTemplate('flyer',   [1.0,  0.6,  0.75], [1.0,  0.75, 0.85],  { bodyPlan: 'aquatic', wingSpan: 0.4, size: 0.6, legCount: 0 }),   // jellyfish
    makeTemplate('tank',    [0.85, 0.2,  0.15], [1.0,  0.35, 0.25],  { bodyPlan: 'insectoid', legCount: 1.0, hasClaws: 1.0, size: 1.5 }), // crab
    makeTemplate('shooter', [0.95, 0.9,  0.2],  [1.0,  1.0,  0.35],  { bodyPlan: 'aquatic', hasFins: 0.8, finSize: 0.5 }),              // puffer
  ],
  [BiomeType.Heaven]: [
    makeTemplate('flyer',   [0.95, 0.95, 0.95], [1.0,  1.0,  1.0],   { hasWings: 1.0, wingSpan: 1.2, bodyPlan: 'avian', legCount: 0.25 }),  // angel
    makeTemplate('shooter', [0.95, 0.85, 0.2],  [1.0,  0.95, 0.4],   { bodyPlan: 'avian', hasHorns: 0, eyeCount: 0.8 }),                 // seraph
    makeTemplate('tank',    [0.92, 0.92, 0.95], [1.0,  1.0,  1.0],   { size: 1.8, hasHorns: 0.3, bodyPlan: 'quadruped' }),               // guardian
    makeTemplate('rusher',  [0.85, 0.9,  1.0],  [0.95, 0.98, 1.0],   { size: 0.65, hasWings: 0.7, wingSpan: 0.5, speed: 0.75 }),         // cherub
  ],
  [BiomeType.Hell]: [
    makeTemplate('rusher',  [0.5,  0.0,  0.0],  [0.75, 0.05, 0.05],  { hasHorns: 1.0, hornSize: 0.6, speed: 0.85, bodyPlan: 'quadruped' }), // demon
    makeTemplate('tank',    [0.05, 0.05, 0.05], [0.2,  0.0,  0.0],   { size: 2.0, hasHorns: 1.0, hornSize: 0.8 }),                       // infernal
    makeTemplate('shooter', [0.75, 0.0,  0.1],  [0.9,  0.05, 0.15],  { bodyPlan: 'quadruped', hasHorns: 0.6, hasTail: 1.0 }),             // imp lord
    makeTemplate('flyer',   [0.2,  0.0,  0.05], [0.35, 0.05, 0.1],   { wingSpan: 0.9, size: 0.65 }),                                     // hell bat
  ],
}

// ─── Underground biome enemy templates ───────────────────────────────────────
// Keyed by the numeric UndergroundBiomeId (100, 101, 102).
export const UNDERGROUND_ENEMY_TEMPLATES: Record<number, BiomeEnemyTemplate[]> = {
  // 100 = Caverns
  100: [
    makeTemplate('flyer',   [0.15, 0.12, 0.12], [0.25, 0.18, 0.18],  { wingSpan: 0.7, size: 0.5, hasAntennae: 0.6 }),  // bat swarm
    makeTemplate('tank',    [0.35, 0.30, 0.25], [0.50, 0.42, 0.35],  { bodyPlan: 'serpentine', legCount: 0, size: 1.9 }),  // cave worm
    makeTemplate('rusher',  [0.05, 0.05, 0.10], [0.10, 0.08, 0.20],  { size: 0.75, speed: 0.85, hasClaws: 0.9 }),       // shadow
    makeTemplate('shooter', [0.40, 0.38, 0.35], [0.55, 0.50, 0.45],  { bodyPlan: 'quadruped', hasHorns: 0.8, hornSize: 0.5 }),  // stalactite
  ],
  // 101 = Lava Tunnels
  101: [
    makeTemplate('rusher',  [0.90, 0.25, 0.05], [1.00, 0.40, 0.10],  { size: 0.8, speed: 0.9, hasClaws: 0.7 }),         // fire elemental
    makeTemplate('tank',    [0.30, 0.05, 0.00], [0.50, 0.10, 0.00],  { size: 2.0, hasHorns: 0.7, bodyPlan: 'quadruped' }),  // magma golem
    makeTemplate('flyer',   [1.00, 0.55, 0.10], [1.00, 0.70, 0.20],  { wingSpan: 0.6, size: 0.45 }),                    // flame wisp
    makeTemplate('shooter', [0.80, 0.15, 0.05], [1.00, 0.25, 0.05],  { hasMandibles: 0.9, hasTail: 0.8 }),              // lava spitter
  ],
  // 102 = Crystal Depths
  102: [
    makeTemplate('tank',    [0.05, 0.70, 0.90], [0.15, 0.85, 1.00],  { size: 1.8, hasHorns: 0.5, bodyPlan: 'quadruped' }),  // crystal golem
    makeTemplate('shooter', [0.55, 0.0,  0.85], [0.70, 0.15, 1.00],  { bodyPlan: 'quadruped', eyeCount: 0.9 }),           // refraction shard
    makeTemplate('flyer',   [0.80, 0.80, 1.00], [0.95, 0.95, 1.00],  { size: 0.35, wingSpan: 0.5 }),                     // prism wisp
    makeTemplate('rusher',  [0.15, 0.40, 0.85], [0.25, 0.55, 1.00],  { speed: 0.95, hasClaws: 1.0 }),                    // gem crawler
  ],
}

export function createEnemyDNA(
  archetype: EnemyArchetype,
  _waveNumber: number,
  mutationMultiplier = 1.0,
  biome?: BiomeType,
  undergroundId?: number,
): CreatureDNA {
  // Pick biome-specific base if available — underground overrides surface
  let base: CreatureDNA
  if (undergroundId !== undefined && UNDERGROUND_ENEMY_TEMPLATES[undergroundId]) {
    const templates = UNDERGROUND_ENEMY_TEMPLATES[undergroundId].filter(t => t.archetype === archetype)
    if (templates.length > 0) {
      const chosen = templates[Math.floor(Math.random() * templates.length)]
      base = {
        ...chosen.dna,
        bodyColor: [...chosen.dna.bodyColor] as [number, number, number],
        accentColor: [...chosen.dna.accentColor] as [number, number, number],
      }
    } else {
      base = { ...ARCHETYPE_DNA[archetype], bodyColor: [...ARCHETYPE_DNA[archetype].bodyColor] as [number, number, number], accentColor: [...ARCHETYPE_DNA[archetype].accentColor] as [number, number, number] }
    }
  } else if (biome !== undefined && BIOME_ENEMY_TEMPLATES[biome]) {
    const templates = BIOME_ENEMY_TEMPLATES[biome].filter(t => t.archetype === archetype)
    if (templates.length > 0) {
      const chosen = templates[Math.floor(Math.random() * templates.length)]
      base = {
        ...chosen.dna,
        bodyColor: [...chosen.dna.bodyColor] as [number, number, number],
        accentColor: [...chosen.dna.accentColor] as [number, number, number],
      }
    } else {
      base = {
        ...ARCHETYPE_DNA[archetype],
        bodyColor: [...ARCHETYPE_DNA[archetype].bodyColor] as [number, number, number],
        accentColor: [...ARCHETYPE_DNA[archetype].accentColor] as [number, number, number],
      }
    }
  } else {
    base = {
      ...ARCHETYPE_DNA[archetype],
      bodyColor: [...ARCHETYPE_DNA[archetype].bodyColor] as [number, number, number],
      accentColor: [...ARCHETYPE_DNA[archetype].accentColor] as [number, number, number],
    }
  }

  // mutateDNA uses internal mutation constants; accumulate drift on higher waves.
  // mutationMultiplier doubles iterations when corruption is active.
  const iterations = Math.round(Math.min(_waveNumber, 4) * mutationMultiplier)
  let dna = base
  for (let i = 0; i < iterations; i++) {
    dna = mutateDNA(dna)
  }
  return dna
}
