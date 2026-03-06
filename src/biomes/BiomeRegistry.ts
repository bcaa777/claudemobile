import { BiomeConfig, BiomeType } from './types'
import { forestBiome } from './definitions/forest'
import { desertBiome } from './definitions/desert'
import { volcanicBiome } from './definitions/volcanic'
import { snowBiome } from './definitions/snow'

const registry: Map<BiomeType, BiomeConfig> = new Map([
  [BiomeType.Forest,   forestBiome],
  [BiomeType.Desert,   desertBiome],
  [BiomeType.Volcanic, volcanicBiome],
  [BiomeType.Snow,     snowBiome],
])

export function getBiome(type: BiomeType): BiomeConfig {
  return registry.get(type)!
}

export function getAllBiomes(): BiomeConfig[] {
  return Array.from(registry.values())
}

export { BiomeType }
