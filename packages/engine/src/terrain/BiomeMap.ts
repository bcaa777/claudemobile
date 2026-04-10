import { BiomeType } from './types'
import type { MegaMountain, BiomeProvider, BiomeBlend } from './TerrainGenerator'

// Mulberry32 — fast seeded PRNG (inline to avoid cross-package dependency)
class SeededRandom {
  private state: number
  constructor(seed: number) { this.state = seed >>> 0 }
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let z = this.state
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
  range(min: number, max: number): number { return min + this.next() * (max - min) }
  int(min: number, max: number): number { return Math.floor(this.range(min, max + 1)) }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length - 1)] }
}

interface VoronoiSeed {
  x: number
  z: number
  biome: BiomeType
}

const BIOME_TYPES = [
  BiomeType.Forest, BiomeType.Desert, BiomeType.Swamp, BiomeType.Snow,
  BiomeType.Volcanic, BiomeType.Crystal, BiomeType.Jungle,
  BiomeType.Mesa, BiomeType.CoralReef,
]

const DEFAULT_SEED_SPACING = 280

const HEAVEN_RADIUS = 300
const HEAVEN_BORDER = 40  // transition ring width

const HELL_RADIUS_DEFAULT = 300
const HELL_RADIUS_MIN = 135
const HELL_BORDER = 40

const MEGA_MOUNTAIN_COUNT = 8       // total peaks scattered around the world
const MEGA_MOUNTAIN_MIN_DIST = 400  // min distance between peaks

export interface BiomeMapConfig {
  seedSpacing?: number
}

export class BiomeMap implements BiomeProvider {
  private seeds: VoronoiSeed[] = []
  private rng: SeededRandom
  private heavenCenter: { x: number; z: number } | null = null
  private hellCenter: { x: number; z: number } | null = null
  readonly megaMountains: MegaMountain[] = []
  private hellRadius: number = HELL_RADIUS_DEFAULT
  private seedSpacing: number

  constructor(seed: number, config: BiomeMapConfig = {}) {
    this.seedSpacing = config.seedSpacing ?? DEFAULT_SEED_SPACING
    this.rng = new SeededRandom(seed)
    // Pre-generate seeds in a large area around origin
    this.generateSeeds(-3000, -3000, 3000, 3000)
    this.generateMegaMountains()
  }

  setHeavenCenter(x: number, z: number) { this.heavenCenter = { x, z } }
  getHeavenCenter() { return this.heavenCenter }

  setHellCenter(x: number, z: number) { this.hellCenter = { x, z } }
  getHellCenter() { return this.hellCenter }

  /** Shrink Hell's effective radius. Called after each site activation.
   *  Clamps to HELL_RADIUS_MIN (135) so Hell never fully disappears. */
  setHellRadius(r: number): void {
    this.hellRadius = Math.max(HELL_RADIUS_MIN, Math.min(HELL_RADIUS_DEFAULT, r))
  }

  getHellRadius(): number { return this.hellRadius }

  private generateMegaMountains() {
    const rng = new SeededRandom(this.rng.int(0, 999999))
    const placed: MegaMountain[] = []
    let attempts = 0
    while (placed.length < MEGA_MOUNTAIN_COUNT && attempts < 200) {
      attempts++
      const x = rng.range(-2000, 2000)
      const z = rng.range(-2000, 2000)
      // Keep away from origin (castle area)
      if (x * x + z * z < 300 * 300) continue
      // Keep away from other peaks
      let tooClose = false
      for (const p of placed) {
        const dx = p.x - x, dz = p.z - z
        if (dx * dx + dz * dz < MEGA_MOUNTAIN_MIN_DIST * MEGA_MOUNTAIN_MIN_DIST) { tooClose = true; break }
      }
      if (tooClose) continue
      placed.push({
        x, z,
        height: rng.range(45, 80),
        radius: rng.range(35, 60),
      })
    }
    this.megaMountains.push(...placed)
  }

  private generateSeeds(minX: number, minZ: number, maxX: number, maxZ: number) {
    const spacing = this.seedSpacing
    const cols = Math.ceil((maxX - minX) / spacing)
    const rows = Math.ceil((maxZ - minZ) / spacing)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = this.rng.range(-spacing * 0.4, spacing * 0.4)
        const jz = this.rng.range(-spacing * 0.4, spacing * 0.4)
        this.seeds.push({
          x: minX + c * spacing + spacing * 0.5 + jx,
          z: minZ + r * spacing + spacing * 0.5 + jz,
          biome: this.rng.pick(BIOME_TYPES),
        })
      }
    }
  }

  getClosestSeedOf(biomeType: BiomeType, minDist = 0): { x: number; z: number } {
    let best = Infinity
    let result = { x: 0, z: 0 }
    const minDistSq = minDist * minDist
    for (const seed of this.seeds) {
      if (seed.biome !== biomeType) continue
      const d = seed.x * seed.x + seed.z * seed.z
      if (d < minDistSq) continue
      if (d < best) { best = d; result = { x: seed.x, z: seed.z } }
    }
    return result
  }

  private heavenDist(wx: number, wz: number): number {
    if (!this.heavenCenter) return Infinity
    const dx = wx - this.heavenCenter.x
    const dz = wz - this.heavenCenter.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  private hellDist(wx: number, wz: number): number {
    if (!this.hellCenter) return Infinity
    const dx = wx - this.hellCenter.x
    const dz = wz - this.hellCenter.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  getBiomeAt(wx: number, wz: number): BiomeType {
    // Heaven override — circular region
    if (this.heavenDist(wx, wz) < HEAVEN_RADIUS) return BiomeType.Heaven
    // Hell override — circular region (radius shrinks with activations)
    if (this.hellDist(wx, wz) < this.hellRadius) return BiomeType.Hell

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
  getBlend(wx: number, wz: number): BiomeBlend {
    // Heaven override
    const hd = this.heavenDist(wx, wz)
    if (hd < HEAVEN_RADIUS) {
      return { primary: BiomeType.Heaven, secondary: BiomeType.Heaven, blend: 0 }
    }
    if (hd < HEAVEN_RADIUS + HEAVEN_BORDER) {
      // Border ring: blend between Heaven and nearest Voronoi biome
      const t = (hd - HEAVEN_RADIUS) / HEAVEN_BORDER  // 0 at inner edge, 1 at outer
      const voronoi = this.getVoronoiBiome(wx, wz)
      return { primary: BiomeType.Heaven, secondary: voronoi, blend: t }
    }

    // Hell override
    const helld = this.hellDist(wx, wz)
    if (helld < this.hellRadius) {
      return { primary: BiomeType.Hell, secondary: BiomeType.Hell, blend: 0 }
    }
    if (helld < this.hellRadius + HELL_BORDER) {
      const t = (helld - this.hellRadius) / HELL_BORDER
      const voronoi = this.getVoronoiBiome(wx, wz)
      return { primary: BiomeType.Hell, secondary: voronoi, blend: t }
    }

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
    const blend = Math.max(0, Math.min(1, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / (this.seedSpacing * 0.3)))
    return { primary: b1, secondary: b2, blend }
  }

  /** Expose seed positions for the journal map (read-only). */
  getSeeds(): ReadonlyArray<{ x: number; z: number; biome: BiomeType }> {
    return this.seeds
  }

  private getVoronoiBiome(wx: number, wz: number): BiomeType {
    let nearestDist = Infinity
    let nearest = BiomeType.Forest
    for (const seed of this.seeds) {
      const dx = seed.x - wx
      const dz = seed.z - wz
      const dist = dx * dx + dz * dz
      if (dist < nearestDist) { nearestDist = dist; nearest = seed.biome }
    }
    return nearest
  }
}
