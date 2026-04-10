import { BiomeConfig, BiomeType } from './types'
import { forestBiome } from './definitions/forest'
import { desertBiome } from './definitions/desert'
import { volcanicBiome } from './definitions/volcanic'
import { snowBiome } from './definitions/snow'
import { swampBiome } from './definitions/swamp'
import { crystalBiome } from './definitions/crystal'
import { heavenBiome } from './definitions/heaven'
import { hellBiome } from './definitions/hell'
import { jungleBiome } from './definitions/jungle'
import { mesaBiome } from './definitions/mesa'
import { coralReefBiome } from './definitions/coralReef'

const registry: Map<BiomeType, BiomeConfig> = new Map([
  [BiomeType.Forest,          forestBiome],
  [BiomeType.Desert,          desertBiome],
  [BiomeType.Swamp,           swampBiome],
  [BiomeType.Snow,            snowBiome],
  [BiomeType.Volcanic,        volcanicBiome],
  [BiomeType.Crystal,         crystalBiome],
  [BiomeType.Jungle,          jungleBiome],
  [BiomeType.Mesa,            mesaBiome],
  [BiomeType.CoralReef,       coralReefBiome],
  [BiomeType.Heaven,          heavenBiome],
  [BiomeType.Hell,            hellBiome],
])

export function getBiome(type: BiomeType): BiomeConfig {
  return registry.get(type)!
}

export function getAllBiomes(): BiomeConfig[] {
  return Array.from(registry.values())
}

export { BiomeType }
