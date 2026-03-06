import * as THREE from 'three'
import { Chunk } from './Chunk'
import { BiomeMap } from './BiomeMap'
import { CHUNK_SIZE } from './TerrainGenerator'
import { SpriteAtlas } from '../sprites/SpriteAtlas'
import { PointLightPool } from '../lighting/PointLightPool'

const VIEW_RADIUS = 2  // 5x5 grid = radius 2

export class World {
  private scene: THREE.Scene
  private biomeMap: BiomeMap
  private atlas: SpriteAtlas
  private lightPool: PointLightPool
  private chunks: Map<string, Chunk> = new Map()
  private pendingGeneration: Set<string> = new Set()

  private lastPlayerCX = Infinity
  private lastPlayerCZ = Infinity

  constructor(scene: THREE.Scene, biomeMap: BiomeMap) {
    this.scene = scene
    this.biomeMap = biomeMap
    this.atlas = new SpriteAtlas()
    this.lightPool = new PointLightPool(scene, 24)
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`
  }

  update(playerPos: THREE.Vector3) {
    const cx = Math.floor(playerPos.x / CHUNK_SIZE)
    const cz = Math.floor(playerPos.z / CHUNK_SIZE)

    if (cx === this.lastPlayerCX && cz === this.lastPlayerCZ) {
      // Just update existing chunks (particles)
      for (const chunk of this.chunks.values()) {
        chunk.update(1/60)
      }
      return
    }

    this.lastPlayerCX = cx
    this.lastPlayerCZ = cz

    // Determine needed chunk set
    const needed = new Set<string>()
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        needed.add(this.chunkKey(cx + dx, cz + dz))
      }
    }

    // Remove out-of-range chunks
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        chunk.dispose(this.scene, this.lightPool)
        this.chunks.delete(key)
        this.pendingGeneration.delete(key)
      }
    }

    // Schedule new chunks
    for (const key of needed) {
      if (!this.chunks.has(key) && !this.pendingGeneration.has(key)) {
        this.pendingGeneration.add(key)
        const [kcx, kcz] = key.split(',').map(Number)
        // Stagger generation to avoid frame spikes
        setTimeout(() => this.generateChunk(kcx, kcz, key), 0)
      }
    }

    // Update active chunks
    for (const chunk of this.chunks.values()) {
      chunk.update(1/60)
    }
  }

  private generateChunk(cx: number, cz: number, key: string) {
    if (!this.pendingGeneration.has(key)) return  // cancelled
    const chunk = new Chunk(cx, cz, this.scene, this.biomeMap, this.atlas, this.lightPool)
    this.chunks.set(key, chunk)
    this.pendingGeneration.delete(key)
  }

  // Get height at a world position (for collision)
  getHeightAt(wx: number, wz: number): number | null {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.chunks.get(this.chunkKey(cx, cz))
    if (!chunk) return null
    const lx = wx - cx * CHUNK_SIZE
    const lz = wz - cz * CHUNK_SIZE
    return chunk.getHeightAt(lx, lz)
  }

  getBiomeMap(): BiomeMap {
    return this.biomeMap
  }
}
