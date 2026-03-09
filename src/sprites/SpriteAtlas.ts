import * as THREE from 'three'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { getBiome } from '../biomes/BiomeRegistry'
import { generateSpriteTexture } from './SpriteGenerator'
import { SPRITE_CONFIG } from '../config'
import { SeededRandom } from '../utils/SeededRandom'

export const VARIANTS = SPRITE_CONFIG.variants

type AtlasKey = `${BiomeType}_${SpriteCategory}_${number}`

export class SpriteAtlas {
  private cache: Map<AtlasKey, THREE.CanvasTexture> = new Map()

  getTexture(biome: BiomeType, category: SpriteCategory, variant: number): THREE.CanvasTexture {
    const key: AtlasKey = `${biome}_${category}_${variant}`
    if (!this.cache.has(key)) {
      const config = getBiome(biome)
      const seed = biome * 10000 + category.charCodeAt(0) * 100 + variant

      // Apply per-variant color variance to palette
      const variance = SPRITE_CONFIG.colorVariance
      const rng = new SeededRandom(seed ^ 0xdeadbeef)
      const palette = config.palette.map(([r, g, b]) => [
        Math.max(0, Math.min(1, r + rng.range(-1, 1) * variance)),
        Math.max(0, Math.min(1, g + rng.range(-1, 1) * variance)),
        Math.max(0, Math.min(1, b + rng.range(-1, 1) * variance)),
      ] as [number, number, number])

      const tex = generateSpriteTexture(biome, category, palette, seed, variant)
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
