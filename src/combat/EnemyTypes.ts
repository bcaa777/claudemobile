import { BiomeType } from '../biomes/types'

export type HollowType = 'shambler' | 'spitter' | 'stalker' | 'warden'

export interface EnemyDef {
  type: HollowType
  hp: number
  damage: number
  speed: number
  xp: number
  aggroRange: number
  attackRange: number
  attackCooldown: number
  scale: number          // mesh scale multiplier
  bodyColor: number      // hex
  emissiveColor: number  // hex
}

export const ENEMY_DEFS: Record<HollowType, EnemyDef> = {
  shambler: { type: 'shambler', hp: 30, damage: 8, speed: 2.5, xp: 10, aggroRange: 12, attackRange: 2.5, attackCooldown: 1.0, scale: 1.0, bodyColor: 0x2a1030, emissiveColor: 0xff00aa },
  spitter:  { type: 'spitter',  hp: 45, damage: 12, speed: 4, xp: 25, aggroRange: 20, attackRange: 30, attackCooldown: 2.5, scale: 1.2, bodyColor: 0x1a0a30, emissiveColor: 0xff00aa },
  stalker:  { type: 'stalker',  hp: 60, damage: 15, speed: 10, xp: 40, aggroRange: 20, attackRange: 3, attackCooldown: 3.0, scale: 0.9, bodyColor: 0x150820, emissiveColor: 0xff2266 },
  warden:   { type: 'warden',   hp: 250, damage: 25, speed: 3, xp: 150, aggroRange: 25, attackRange: 4, attackCooldown: 3.0, scale: 3.0, bodyColor: 0x0a0510, emissiveColor: 0xff00aa },
}

export const ENEMY_SPAWN_TABLE: Partial<Record<BiomeType, { types: HollowType[], density: number }>> = {
  [BiomeType.Forest]:   { types: ['shambler'], density: 0.15 },
  [BiomeType.Desert]:   { types: ['shambler', 'shambler'], density: 0.2 },
  [BiomeType.Swamp]:    { types: ['shambler', 'spitter'], density: 0.25 },
  [BiomeType.Snow]:     { types: ['shambler', 'stalker'], density: 0.2 },
  [BiomeType.Jungle]:   { types: ['shambler', 'spitter'], density: 0.2 },
  [BiomeType.Mesa]:     { types: ['shambler', 'stalker'], density: 0.2 },
  [BiomeType.Hell]:     { types: ['shambler', 'shambler', 'spitter', 'stalker', 'warden'], density: 0.8 },
  [BiomeType.Volcanic]: { types: ['shambler', 'shambler', 'spitter'], density: 0.4 },
  [BiomeType.Crystal]:  { types: ['spitter'], density: 0.15 },
}
