import { BiomeConfig, BiomeType } from './types'
import { forestBiome } from './definitions/forest'
import { desertBiome } from './definitions/desert'
import { volcanicBiome } from './definitions/volcanic'
import { snowBiome } from './definitions/snow'
import { swampBiome } from './definitions/swamp'
import { tundraBiome } from './definitions/tundra'
import { mushroomBiome } from './definitions/mushroom'
import { ashWastesBiome } from './definitions/ashwastes'
import { crystalBiome } from './definitions/crystal'
import { savannaBiome } from './definitions/savanna'
import { heavenBiome } from './definitions/heaven'
import { hellBiome } from './definitions/hell'
import { alpineBiome } from './definitions/alpine'
import { cliffsBiome } from './definitions/cliffs'
import { floatingIslandsBiome } from './definitions/floatingIslands'
import { jungleBiome } from './definitions/jungle'
import { mesaBiome } from './definitions/mesa'
import { coralReefBiome } from './definitions/coralReef'
import { bogBiome } from './definitions/bog'
import { badlandsBiome } from './definitions/badlands'
import { taigaBiome } from './definitions/taiga'
import { oasisBiome } from './definitions/oasis'

const registry: Map<BiomeType, BiomeConfig> = new Map([
  [BiomeType.Forest,          forestBiome],
  [BiomeType.Desert,          desertBiome],
  [BiomeType.Volcanic,        volcanicBiome],
  [BiomeType.Snow,            snowBiome],
  [BiomeType.Swamp,           swampBiome],
  [BiomeType.Tundra,          tundraBiome],
  [BiomeType.Mushroom,        mushroomBiome],
  [BiomeType.AshWastes,       ashWastesBiome],
  [BiomeType.Crystal,         crystalBiome],
  [BiomeType.Savanna,         savannaBiome],
  [BiomeType.Heaven,          heavenBiome],
  [BiomeType.Hell,            hellBiome],
  [BiomeType.Alpine,          alpineBiome],
  [BiomeType.Cliffs,          cliffsBiome],
  [BiomeType.FloatingIslands, floatingIslandsBiome],
  [BiomeType.Jungle,          jungleBiome],
  [BiomeType.Mesa,            mesaBiome],
  [BiomeType.CoralReef,       coralReefBiome],
  [BiomeType.Bog,             bogBiome],
  [BiomeType.Badlands,        badlandsBiome],
  [BiomeType.Taiga,           taigaBiome],
  [BiomeType.Oasis,           oasisBiome],
])

export function getBiome(type: BiomeType): BiomeConfig {
  return registry.get(type)!
}

export function getAllBiomes(): BiomeConfig[] {
  return Array.from(registry.values())
}

export { BiomeType }
