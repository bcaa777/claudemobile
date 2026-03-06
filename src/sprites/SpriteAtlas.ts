import * as THREE from 'three'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { getBiome } from '../biomes/BiomeRegistry'
import { generateSpriteTexture } from './SpriteGenerator'

// How many sprite variants per category
const VARIANTS = 4

type AtlasKey = `${BiomeType}_${SpriteCategory}_${number}`

export class SpriteAtlas {
  private cache: Map<AtlasKey, THREE.CanvasTexture> = new Map()

  getTexture(biome: BiomeType, category: SpriteCategory, variant: number): THREE.CanvasTexture {
    const key: AtlasKey = `${biome}_${category}_${variant}`
    if (!this.cache.has(key)) {
      const config = getBiome(biome)
      const seed = biome * 10000 + category.charCodeAt(0) * 100 + variant
      const tex = generateSpriteTexture(biome, category, config.palette, seed)
      this.cache.set(key, tex)
    }
    return this.cache.get(key)!
  }

  preloadBiome(biome: BiomeType) {
    const config = getBiome(biome)
    for (const spriteType of config.spriteTypes) {
      for (let v = 0; v < VARIANTS; v++) {
        this.getTexture(biome, spriteType.category, v)
      }
    }
  }

  dispose() {
    for (const tex of this.cache.values()) tex.dispose()
    this.cache.clear()
  }
}

export { VARIANTS }
