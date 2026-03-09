import * as THREE from 'three'
import { Chunk } from './Chunk'
import { BiomeMap } from './BiomeMap'
import { CHUNK_SIZE, WATER_LEVEL } from './TerrainGenerator'
import { SpriteAtlas } from '../sprites/SpriteAtlas'
import { PointLightPool } from '../lighting/PointLightPool'
import { ExplodableStructure } from './ExplodableStructure'
import { SeededRandom } from '../utils/SeededRandom'
import { WORLD_CONFIG } from '../config'
import { BiomeType } from '../biomes/types'
import type { CreatureManager } from '../creatures/CreatureManager'
import type { CastleWalkable } from '../castle/Castle'

const VIEW_RADIUS = WORLD_CONFIG.viewRadius

export class World {
  private scene: THREE.Scene
  private biomeMap: BiomeMap
  private atlas: SpriteAtlas
  private lightPool: PointLightPool
  private chunks: Map<string, Chunk> = new Map()
  private pendingGeneration: Set<string> = new Set()
  private explodables: ExplodableStructure[] = []
  private explodeRng = new SeededRandom(9999)
  private creatureManager: CreatureManager | null = null
  private pendingKnockback = 0
  private castleWalkables: CastleWalkable[] = []

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
      for (const chunk of this.chunks.values()) {
        chunk.update(1/60)
      }
      return
    }

    this.lastPlayerCX = cx
    this.lastPlayerCZ = cz

    const needed = new Set<string>()
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        needed.add(this.chunkKey(cx + dx, cz + dz))
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        // Remove this chunk's explodables from world list
        this.explodables = this.explodables.filter(e => !chunk.explodables.includes(e))
        chunk.dispose(this.scene, this.lightPool)
        this.chunks.delete(key)
        this.pendingGeneration.delete(key)
      }
    }

    for (const key of needed) {
      if (!this.chunks.has(key) && !this.pendingGeneration.has(key)) {
        this.pendingGeneration.add(key)
        const [kcx, kcz] = key.split(',').map(Number)
        setTimeout(() => this.generateChunk(kcx, kcz, key), 0)
      }
    }

    for (const chunk of this.chunks.values()) {
      chunk.update(1/60)
    }
  }

  setCreatureManager(cm: CreatureManager) {
    this.creatureManager = cm
  }

  setCastleWalkables(surfaces: CastleWalkable[]) {
    this.castleWalkables = surfaces
  }

  addMonumentWalkables(surfaces: CastleWalkable[]) {
    this.castleWalkables.push(...surfaces)
  }

  private generateChunk(cx: number, cz: number, key: string) {
    if (!this.pendingGeneration.has(key)) return
    const chunk = new Chunk(cx, cz, this.scene, this.biomeMap, this.atlas, this.lightPool)
    this.chunks.set(key, chunk)
    this.pendingGeneration.delete(key)
    for (const ex of chunk.explodables) {
      this.explodables.push(ex)
    }
    this.creatureManager?.spawnForChunk(cx, cz, this)
  }

  // Get terrain height at world position
  getHeightAt(wx: number, wz: number): number | null {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.chunks.get(this.chunkKey(cx, cz))
    if (!chunk) return null
    const lx = wx - cx * CHUNK_SIZE
    const lz = wz - cz * CHUNK_SIZE
    return chunk.getHeightAt(lx, lz)
  }

  // Get highest walkable object surface under the player's AABB (±0.4)
  getObjectFloorAt(wx: number, wz: number): number | null {
    const PAD = 0.4
    let best: number | null = null

    // Check 3×3 chunk neighbourhood (player AABB could overlap adjacent chunk)
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(this.chunkKey(cx + dx, cz + dz))
        if (!chunk) continue
        const offX = (cx + dx) * CHUNK_SIZE
        const offZ = (cz + dz) * CHUNK_SIZE
        // Convert world pos to chunk-local
        const lx = wx - offX
        const lz = wz - offZ

        for (const box of chunk.walkableSurfaces) {
          if (lx + PAD >= box.minX && lx - PAD <= box.maxX &&
              lz + PAD >= box.minZ && lz - PAD <= box.maxZ) {
            if (best === null || box.y > best) best = box.y
          }
        }
      }
    }
    // Castle walkables are already in world space
    for (const cbox of this.castleWalkables) {
      if (wx + PAD >= cbox.minX && wx - PAD <= cbox.maxX &&
          wz + PAD >= cbox.minZ && wz - PAD <= cbox.maxZ) {
        if (best === null || cbox.y > best) best = cbox.y
      }
    }

    return best
  }

  // Tick explodable structures — trigger when player is within radius
  tickExplodables(playerPos: THREE.Vector3, delta: number) {
    for (let i = this.explodables.length - 1; i >= 0; i--) {
      const ex = this.explodables[i]
      if (!ex.isDone()) {
        const dx = playerPos.x - ex.worldPos.x
        const dz = playerPos.z - ex.worldPos.z
        const distSq = dx * dx + dz * dz
        if (distSq < ex.radius * ex.radius) {
          ex.trigger()
        }
        ex.update(delta, this.explodeRng)
      }
      if (ex.isDone()) {
        this.explodables.splice(i, 1)
      }
    }
  }

  // Camera shake intensity (0–1) from nearby rumbling structures
  getRumbleStrength(playerPos: THREE.Vector3): number {
    for (const ex of this.explodables) {
      if (ex.isRumbling) {
        const dx = playerPos.x - ex.worldPos.x
        const dz = playerPos.z - ex.worldPos.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < ex.radius * 2) return 1 - dist / (ex.radius * 2)
      }
    }
    return 0
  }

  getFoodAt(wx: number, wz: number): boolean {
    const h = this.getHeightAt(wx, wz)
    if (h === null || h < WATER_LEVEL + 0.5) return false
    // Gradient check — flat terrain is grazeable
    const h1 = this.getHeightAt(wx + 2, wz) ?? h
    const h2 = this.getHeightAt(wx - 2, wz) ?? h
    const h3 = this.getHeightAt(wx, wz + 2) ?? h
    const h4 = this.getHeightAt(wx, wz - 2) ?? h
    const gradient = Math.max(Math.abs(h1 - h2), Math.abs(h3 - h4))
    return gradient < 2.0
  }

  getWaterAt(wx: number, wz: number): boolean {
    const h = this.getHeightAt(wx, wz)
    return h !== null && h < WATER_LEVEL + 1.5
  }

  getBiomeAt(wx: number, wz: number): BiomeType {
    return this.biomeMap.getBiomeAt(wx, wz)
  }

  addCreatureKnockback(amount: number) {
    this.pendingKnockback = Math.max(this.pendingKnockback, amount)
  }

  getCreatureKnockback(): number {
    const k = this.pendingKnockback
    this.pendingKnockback = 0
    return k
  }

  getBiomeMap(): BiomeMap {
    return this.biomeMap
  }
}
