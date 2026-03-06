import { BiomeType } from '../biomes/types'
import { SeededRandom } from '../utils/SeededRandom'

interface VoronoiSeed {
  x: number
  z: number
  biome: BiomeType
}

const BIOME_TYPES = [BiomeType.Forest, BiomeType.Desert, BiomeType.Volcanic, BiomeType.Snow]
// Distance between Voronoi seed points
const SEED_SPACING = 180

export class BiomeMap {
  private seeds: VoronoiSeed[] = []
  private rng: SeededRandom

  constructor(seed: number) {
    this.rng = new SeededRandom(seed)
    // Pre-generate seeds in a large area around origin
    this.generateSeeds(-3000, -3000, 3000, 3000)
  }

  private generateSeeds(minX: number, minZ: number, maxX: number, maxZ: number) {
    const cols = Math.ceil((maxX - minX) / SEED_SPACING)
    const rows = Math.ceil((maxZ - minZ) / SEED_SPACING)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = this.rng.range(-SEED_SPACING * 0.4, SEED_SPACING * 0.4)
        const jz = this.rng.range(-SEED_SPACING * 0.4, SEED_SPACING * 0.4)
        this.seeds.push({
          x: minX + c * SEED_SPACING + SEED_SPACING * 0.5 + jx,
          z: minZ + r * SEED_SPACING + SEED_SPACING * 0.5 + jz,
          biome: this.rng.pick(BIOME_TYPES),
        })
      }
    }
  }

  getBiomeAt(wx: number, wz: number): BiomeType {
    let nearestDist = Infinity
    let nearest = BiomeType.Forest

    // Only check seeds in nearby grid cells for perf
    for (const seed of this.seeds) {
      const dx = seed.x - wx
      const dz = seed.z - wz
      const dist = dx * dx + dz * dz
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = seed.biome
      }
    }
    return nearest
  }

  // Get blend weight between biomes at a point (for smooth transitions)
  // Returns the two nearest biomes and a blend factor 0..1
  getBlend(wx: number, wz: number): { primary: BiomeType; secondary: BiomeType; blend: number } {
    let d1 = Infinity, d2 = Infinity
    let b1 = BiomeType.Forest, b2 = BiomeType.Forest

    for (const seed of this.seeds) {
      const dx = seed.x - wx
      const dz = seed.z - wz
      const dist = dx * dx + dz * dz
      if (dist < d1) {
        d2 = d1; b2 = b1
        d1 = dist; b1 = seed.biome
      } else if (dist < d2) {
        d2 = dist; b2 = seed.biome
      }
    }

    // Blend factor based on ratio of distances
    const blend = Math.max(0, Math.min(1, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / (SEED_SPACING * 0.3)))
    return { primary: b1, secondary: b2, blend }
  }
}
