import * as THREE from 'three'
import { BiomeType, SpriteCategory } from '../terrain/types'
import { generateSpriteTexture } from './SpriteGenerator'
import { SeededRandom } from '../utils/SeededRandom'

export const VARIANTS = 4
const COLOR_VARIANCE = 0.08

type AtlasKey = `${BiomeType}_${SpriteCategory}_${number}`

export class SpriteAtlas {
  private cache: Map<AtlasKey, THREE.CanvasTexture> = new Map()

  getTexture(
    biome: BiomeType,
    category: SpriteCategory,
    variant: number,
    palette: [number, number, number][],
  ): THREE.CanvasTexture {
    const key: AtlasKey = `${biome}_${category}_${variant}`
    if (!this.cache.has(key)) {
      const seed = biome * 10000 + category.charCodeAt(0) * 100 + variant

      // Apply per-variant color variance to palette
      const rng = new SeededRandom(seed ^ 0xdeadbeef)
      const variedPalette = palette.map(([r, g, b]) => [
        Math.max(0, Math.min(1, r + rng.range(-1, 1) * COLOR_VARIANCE)),
        Math.max(0, Math.min(1, g + rng.range(-1, 1) * COLOR_VARIANCE)),
        Math.max(0, Math.min(1, b + rng.range(-1, 1) * COLOR_VARIANCE)),
      ] as [number, number, number])

      const tex = generateSpriteTexture(biome, category, variedPalette, seed, variant)
      this.cache.set(key, tex)
    }
    return this.cache.get(key)!
  }

  dispose() {
    for (const tex of this.cache.values()) tex.dispose()
    this.cache.clear()
  }
}
