import { BiomeType } from '@engine/core'
import { UNDERGROUND_BIOME_ID } from '../expedition/UndergroundBiomes'

export type BossBehavior =
  | 'charge'
  | 'ranged_burst'
  | 'summon'
  | 'aoe_slam'
  | 'enraged'

export interface BossPhase {
  /** Phase activates when boss HP drops below this fraction (0..1). */
  hpThreshold: number
  behavior: BossBehavior
  speed: number
  attackCooldown: number
  attackDamage: number
  /** Number of minions to summon (summon / enraged behaviors). */
  summonCount?: number
  /** Radius for aoe_slam damage. */
  aoeRadius?: number
}

export interface BossDef {
  name: string
  biome: BiomeType
  /** 0xRRGGBB hex color for the boss mesh. */
  color: number
  hp: number
  size: number
  phases: BossPhase[]
}

// -------------------------------------------------------------------------
// 11 boss definitions – one per biome.
// Phase array is ordered from first (hp near 100%) to last (hp near 0%).
// The active phase is the last one whose hpThreshold > current hp fraction.
// -------------------------------------------------------------------------

// Underground bosses are keyed by UndergroundBiomeId (100, 101, 102)
export const UNDERGROUND_BOSS_DEFS: Record<number, BossDef> = {
  // 100 = Caverns → Worm Queen
  [UNDERGROUND_BIOME_ID.Caverns]: {
    name: 'Worm Queen',
    biome: BiomeType.CoralReef,
    color: 0x7a5533,
    hp: 800,
    size: 4.5,
    phases: [
      { hpThreshold: 1.0, behavior: 'summon',   speed: 3,  attackCooldown: 4.5, attackDamage: 18, summonCount: 5 },
      { hpThreshold: 0.6, behavior: 'aoe_slam', speed: 2,  attackCooldown: 3.0, attackDamage: 45, aoeRadius: 9 },
      { hpThreshold: 0.3, behavior: 'enraged',  speed: 12, attackCooldown: 0.5, attackDamage: 35, summonCount: 3 },
    ],
  },
  // 101 = Lava Tunnels → Magma Serpent
  [UNDERGROUND_BIOME_ID.LavaTunnels]: {
    name: 'Magma Serpent',
    biome: BiomeType.Volcanic,
    color: 0xcc2200,
    hp: 1000,
    size: 5.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'charge',       speed: 10, attackCooldown: 1.2, attackDamage: 30 },
      { hpThreshold: 0.6, behavior: 'ranged_burst',  speed: 5,  attackCooldown: 1.5, attackDamage: 22 },
      { hpThreshold: 0.3, behavior: 'enraged',       speed: 18, attackCooldown: 0.4, attackDamage: 50, summonCount: 4 },
    ],
  },
  // 102 = Crystal Depths → Crystal Heart (FINAL BOSS, 4 phases)
  [UNDERGROUND_BIOME_ID.CrystalDepths]: {
    name: 'Crystal Heart',
    biome: BiomeType.Crystal,
    color: 0x88ddff,
    hp: 1500,
    size: 6.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst',  speed: 4,  attackCooldown: 1.8, attackDamage: 20 },
      { hpThreshold: 0.75, behavior: 'summon',        speed: 3,  attackCooldown: 4.0, attackDamage: 15, summonCount: 6 },
      { hpThreshold: 0.45, behavior: 'aoe_slam',      speed: 5,  attackCooldown: 2.5, attackDamage: 55, aoeRadius: 12 },
      { hpThreshold: 0.2,  behavior: 'enraged',       speed: 16, attackCooldown: 0.35, attackDamage: 60, summonCount: 5 },
    ],
  },
}

export const BOSS_DEFS: Record<BiomeType, BossDef> = {
  [BiomeType.Forest]: {
    name: 'Great Stag',
    biome: BiomeType.Forest,
    color: 0x5a3e1b,
    hp: 600,
    size: 3.5,
    phases: [
      { hpThreshold: 1.0, behavior: 'charge',   speed: 8,  attackCooldown: 1.0, attackDamage: 20 },
      { hpThreshold: 0.6, behavior: 'summon',   speed: 4,  attackCooldown: 5.0, attackDamage: 10, summonCount: 4 },
      { hpThreshold: 0.3, behavior: 'enraged',  speed: 14, attackCooldown: 0.6, attackDamage: 30, summonCount: 2 },
    ],
  },
  [BiomeType.Desert]: {
    name: 'Sand Wyrm',
    biome: BiomeType.Desert,
    color: 0xd4a843,
    hp: 700,
    size: 4.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst', speed: 3,  attackCooldown: 2.0, attackDamage: 15 },
      { hpThreshold: 0.6, behavior: 'aoe_slam',     speed: 2,  attackCooldown: 3.5, attackDamage: 40, aoeRadius: 8 },
      { hpThreshold: 0.3, behavior: 'enraged',      speed: 10, attackCooldown: 0.8, attackDamage: 25, summonCount: 3 },
    ],
  },
  [BiomeType.Swamp]: {
    name: 'Bog Hydra',
    biome: BiomeType.Swamp,
    color: 0x2d5a2d,
    hp: 650,
    size: 3.8,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst', speed: 3,  attackCooldown: 2.5, attackDamage: 12 },
      { hpThreshold: 0.6, behavior: 'summon',       speed: 2,  attackCooldown: 4.0, attackDamage: 10, summonCount: 5 },
      { hpThreshold: 0.3, behavior: 'ranged_burst', speed: 5,  attackCooldown: 1.2, attackDamage: 18 },
    ],
  },
  [BiomeType.Snow]: {
    name: 'Frost Giant',
    biome: BiomeType.Snow,
    color: 0xa8cce8,
    hp: 800,
    size: 4.5,
    phases: [
      { hpThreshold: 1.0, behavior: 'aoe_slam', speed: 2,  attackCooldown: 3.0, attackDamage: 35, aoeRadius: 7 },
      { hpThreshold: 0.6, behavior: 'charge',   speed: 9,  attackCooldown: 1.0, attackDamage: 25 },
      { hpThreshold: 0.3, behavior: 'enraged',  speed: 13, attackCooldown: 0.7, attackDamage: 35, summonCount: 3 },
    ],
  },
  [BiomeType.Volcanic]: {
    name: 'Magma Colossus',
    biome: BiomeType.Volcanic,
    color: 0x8b1a00,
    hp: 750,
    size: 4.2,
    phases: [
      { hpThreshold: 1.0, behavior: 'aoe_slam', speed: 3,  attackCooldown: 3.5, attackDamage: 45, aoeRadius: 9 },
      { hpThreshold: 0.6, behavior: 'summon',   speed: 2,  attackCooldown: 4.5, attackDamage: 15, summonCount: 6 },
      { hpThreshold: 0.3, behavior: 'enraged',  speed: 11, attackCooldown: 0.5, attackDamage: 40, summonCount: 2 },
    ],
  },
  [BiomeType.Crystal]: {
    name: 'Prism Titan',
    biome: BiomeType.Crystal,
    color: 0x44ddee,
    hp: 700,
    size: 3.8,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst', speed: 4,  attackCooldown: 2.0, attackDamage: 18 },
      { hpThreshold: 0.6, behavior: 'ranged_burst', speed: 5,  attackCooldown: 1.0, attackDamage: 22 },
      { hpThreshold: 0.3, behavior: 'summon',       speed: 3,  attackCooldown: 3.5, attackDamage: 15, summonCount: 4 },
    ],
  },
  [BiomeType.Jungle]: {
    name: 'Vine Lord',
    biome: BiomeType.Jungle,
    color: 0x1a5e1a,
    hp: 680,
    size: 3.6,
    phases: [
      { hpThreshold: 1.0, behavior: 'summon',  speed: 3,  attackCooldown: 4.0, attackDamage: 12, summonCount: 4 },
      { hpThreshold: 0.6, behavior: 'aoe_slam', speed: 2, attackCooldown: 3.0, attackDamage: 38, aoeRadius: 8 },
      { hpThreshold: 0.3, behavior: 'enraged', speed: 12, attackCooldown: 0.6, attackDamage: 28, summonCount: 2 },
    ],
  },
  [BiomeType.Mesa]: {
    name: 'Stone Golem',
    biome: BiomeType.Mesa,
    color: 0x8b6914,
    hp: 850,
    size: 4.5,
    phases: [
      { hpThreshold: 1.0, behavior: 'charge',   speed: 7,  attackCooldown: 1.2, attackDamage: 22 },
      { hpThreshold: 0.6, behavior: 'aoe_slam', speed: 2,  attackCooldown: 3.5, attackDamage: 50, aoeRadius: 10 },
      { hpThreshold: 0.3, behavior: 'enraged',  speed: 14, attackCooldown: 0.5, attackDamage: 38, summonCount: 2 },
    ],
  },
  [BiomeType.CoralReef]: {
    name: 'Leviathan',
    biome: BiomeType.CoralReef,
    color: 0x2255aa,
    hp: 900,
    size: 5.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst', speed: 5,  attackCooldown: 2.5, attackDamage: 20 },
      { hpThreshold: 0.6, behavior: 'summon',       speed: 3,  attackCooldown: 4.0, attackDamage: 15, summonCount: 5 },
      { hpThreshold: 0.3, behavior: 'enraged',      speed: 12, attackCooldown: 0.7, attackDamage: 30, summonCount: 3 },
    ],
  },
  [BiomeType.Heaven]: {
    name: 'Arch Seraph',
    biome: BiomeType.Heaven,
    color: 0xf0d060,
    hp: 750,
    size: 4.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'ranged_burst', speed: 6,  attackCooldown: 1.8, attackDamage: 22 },
      { hpThreshold: 0.6, behavior: 'aoe_slam',     speed: 3,  attackCooldown: 3.0, attackDamage: 42, aoeRadius: 9 },
      { hpThreshold: 0.3, behavior: 'summon',       speed: 5,  attackCooldown: 4.0, attackDamage: 18, summonCount: 4 },
    ],
  },
  [BiomeType.Hell]: {
    name: 'Infernal Lord',
    biome: BiomeType.Hell,
    color: 0x550000,
    hp: 1000,
    size: 5.0,
    phases: [
      { hpThreshold: 1.0, behavior: 'summon',  speed: 4,  attackCooldown: 4.0, attackDamage: 20, summonCount: 6 },
      { hpThreshold: 0.6, behavior: 'ranged_burst', speed: 5, attackCooldown: 1.5, attackDamage: 28 },
      { hpThreshold: 0.3, behavior: 'enraged', speed: 16, attackCooldown: 0.4, attackDamage: 45, summonCount: 3 },
    ],
  },
}
