import { BiomeType } from '@engine/core'

// Underground biomes reuse existing BiomeType values (CoralReef, Volcanic, Crystal)
// but are identified by this map — any BiomeType in UNDERGROUND_BIOME_TYPES set is
// treated as an underground expedition by ExpeditionManager / WorldMap.

export const UNDERGROUND_BIOME_TYPES = new Set<BiomeType>([
  BiomeType.CoralReef, // → Caverns
  BiomeType.Volcanic,  // → Lava Tunnels  (also used as surface biome; underground
  BiomeType.Crystal,   //   variant distinguished by the UndergroundConfig path)
])

// Separate numeric IDs used as keys so the three *underground* variants don't
// conflict with the surface BiomeType values of the same name.  We define them
// as plain numbers living above the existing enum max (10) so they never
// overlap.
export const UNDERGROUND_BIOME_ID = {
  Caverns:       100,
  LavaTunnels:   101,
  CrystalDepths: 102,
} as const

export type UndergroundBiomeId = (typeof UNDERGROUND_BIOME_ID)[keyof typeof UNDERGROUND_BIOME_ID]

export interface UndergroundConfig {
  id: UndergroundBiomeId
  name: string
  /** Surface BiomeType reused for terrain generation. */
  biomeType: BiomeType
  terrainOverrides: { heightScale: number; groundColors: [number, number, number][] }
  fogColor: number
  fogDensity: number
  ambientColor: number
  ambientIntensity: number
  /** Whether to render a ceiling mesh above the terrain. */
  hasCeiling: boolean
  /** Point lights scattered through the biome: hex color + strength pairs. */
  pointLights: Array<{ color: number; intensity: number; count: number }>
  difficulty: number
}

export const UNDERGROUND_BIOMES: UndergroundConfig[] = [
  {
    id: UNDERGROUND_BIOME_ID.Caverns,
    name: 'Caverns',
    biomeType: BiomeType.CoralReef,
    terrainOverrides: {
      heightScale: 30,
      groundColors: [
        [0x44 / 255, 0x44 / 255, 0x44 / 255],
        [0x55 / 255, 0x55 / 255, 0x55 / 255],
        [0x33 / 255, 0x33 / 255, 0x33 / 255],
      ],
    },
    fogColor: 0x111122,
    fogDensity: 0.03,
    ambientColor: 0x334455,
    ambientIntensity: 0.3,
    hasCeiling: true,
    pointLights: [
      { color: 0x6688aa, intensity: 1.2, count: 8 },
    ],
    difficulty: 7,
  },
  {
    id: UNDERGROUND_BIOME_ID.LavaTunnels,
    name: 'Lava Tunnels',
    biomeType: BiomeType.Volcanic,
    terrainOverrides: {
      heightScale: 25,
      groundColors: [
        [0x22 / 255, 0x11 / 255, 0x11 / 255],
        [0x33 / 255, 0x11 / 255, 0x11 / 255],
        [0x11 / 255, 0x00 / 255, 0x00 / 255],
      ],
    },
    fogColor: 0x220500,
    fogDensity: 0.025,
    ambientColor: 0xff4400,
    ambientIntensity: 0.4,
    hasCeiling: true,
    pointLights: [
      { color: 0xff4400, intensity: 2.0, count: 12 },
      { color: 0xff8800, intensity: 1.2, count: 6 },
    ],
    difficulty: 8,
  },
  {
    id: UNDERGROUND_BIOME_ID.CrystalDepths,
    name: 'Crystal Depths',
    biomeType: BiomeType.Crystal,
    terrainOverrides: {
      heightScale: 35,
      groundColors: [
        [0x11 / 255, 0x22 / 255, 0x44 / 255],
        [0x22 / 255, 0x33 / 255, 0x55 / 255],
        [0x0a / 255, 0x11 / 255, 0x33 / 255],
      ],
    },
    fogColor: 0x0a0a22,
    fogDensity: 0.02,
    ambientColor: 0x4466aa,
    ambientIntensity: 0.5,
    hasCeiling: true,
    pointLights: [
      { color: 0x4499ff, intensity: 1.8, count: 10 },
      { color: 0xaa44ff, intensity: 1.4, count: 8 },
    ],
    difficulty: 9,
  },
]

/** Look up config by id. Returns undefined if not found. */
export function getUndergroundConfig(id: UndergroundBiomeId): UndergroundConfig | undefined {
  return UNDERGROUND_BIOMES.find(b => b.id === id)
}

/** Returns true when the given numeric id is an underground biome id. */
export function isUndergroundId(id: number): id is UndergroundBiomeId {
  return id === UNDERGROUND_BIOME_ID.Caverns
    || id === UNDERGROUND_BIOME_ID.LavaTunnels
    || id === UNDERGROUND_BIOME_ID.CrystalDepths
}
