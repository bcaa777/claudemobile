import * as THREE from 'three'
import { LORE_TEXTS } from './JournalData'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'
import { sampleWorldHeight } from '../world/TerrainGenerator'
import { BiomeMap } from '../world/BiomeMap'
import { CHUNK_SIZE, WATER_LEVEL } from '../world/TerrainGenerator'
import { RENDER_CONFIG } from '../config'

const STONE_COLLECT_DIST_SQ = 9 // 3^2
const BASE_STONE_VISIBLE_DIST = 30 // base distance, scaled by RENDER_CONFIG
const FOX_STONE_VISIBLE_DIST = 50  // fox companion extends visibility

export interface LoreStoneInstance {
  position: THREE.Vector3
  loreIndex: number
  collected: boolean
  mesh: THREE.Group | null
  nightOnly: boolean
}

export class LoreStoneManager {
  private stones: Map<string, LoreStoneInstance[]> = new Map()
  private scene: THREE.Scene
  private biomeMap: BiomeMap
  private collectedSet: Set<number> = new Set()
  foxBonusActive = false

  constructor(scene: THREE.Scene, biomeMap: BiomeMap) {
    this.scene = scene
    this.biomeMap = biomeMap
    this.loadCollected()
  }

  ensureChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`
    if (this.stones.has(key)) return

    const rng = new SeededRandom(chunkSeed(cx, cz, 777))
    const count = rng.next() < 0.6 ? 1 : 2
    const instances: LoreStoneInstance[] = []

    for (let i = 0; i < count; i++) {
      const wx = cx * CHUNK_SIZE + rng.range(8, CHUNK_SIZE - 8)
      const wz = cz * CHUNK_SIZE + rng.range(8, CHUNK_SIZE - 8)
      const h = sampleWorldHeight(wx, wz, this.biomeMap)
      if (h < WATER_LEVEL + 0.5) continue

      const loreIndex = rng.int(0, LORE_TEXTS.length - 1)
      const collected = this.collectedSet.has(loreIndex)
      // ~30% of stones are night-only (seeded by position hash)
      const posHash = (Math.floor(wx) * 73856093) ^ (Math.floor(wz) * 19349663)
      const nightOnly = ((posHash >>> 0) % 100) < 30

      instances.push({
        position: new THREE.Vector3(wx, h + 0.4, wz),
        loreIndex,
        collected,
        mesh: null,
        nightOnly,
      })
    }

    this.stones.set(key, instances)
  }

  removeChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`
    const instances = this.stones.get(key)
    if (instances) {
      for (const s of instances) {
        if (s.mesh) {
          this.scene.remove(s.mesh)
          s.mesh = null
        }
      }
      this.stones.delete(key)
    }
  }

  /** Returns all loaded lore stone instances (used by companion affinities). */
  getAllStones(): LoreStoneInstance[] {
    const result: LoreStoneInstance[] = []
    for (const instances of this.stones.values()) {
      for (const s of instances) {
        result.push(s)
      }
    }
    return result
  }

  update(playerPos: THREE.Vector3, timeOfDay = 0.5): { loreIndex: number; text: string } | null {
    let collected: { loreIndex: number; text: string } | null = null
    const baseDist = this.foxBonusActive ? FOX_STONE_VISIBLE_DIST : BASE_STONE_VISIBLE_DIST
    const visDist = (baseDist * RENDER_CONFIG.renderScale) ** 2

    // Night window: timeOfDay 0.8–1.0 and 0.0–0.2
    const isNight = timeOfDay >= 0.8 || timeOfDay <= 0.2

    for (const instances of this.stones.values()) {
      for (const s of instances) {
        if (s.collected) {
          if (s.mesh) {
            this.scene.remove(s.mesh)
            s.mesh = null
          }
          continue
        }

        // Night-only stones are invisible and non-interactive during day
        if (s.nightOnly && !isNight) {
          if (s.mesh) {
            this.scene.remove(s.mesh)
            s.mesh = null
          }
          continue
        }

        const dx = s.position.x - playerPos.x
        const dz = s.position.z - playerPos.z
        const distSq = dx * dx + dz * dz

        // Create/destroy mesh based on distance
        if (distSq < visDist) {
          if (!s.mesh) {
            s.mesh = this.createMesh(s.position, s.nightOnly)
            this.scene.add(s.mesh)
          }
          // Pulse glow
          const pulse = 0.6 + Math.sin(Date.now() * 0.003 + s.position.x) * 0.4
          const emissiveMesh = s.mesh.children[0] as THREE.Mesh
          if (emissiveMesh?.material instanceof THREE.MeshBasicMaterial) {
            emissiveMesh.material.opacity = pulse
          }
        } else if (s.mesh) {
          this.scene.remove(s.mesh)
          s.mesh = null
        }

        // Collect — night-only stones only collectible at night
        if (distSq < STONE_COLLECT_DIST_SQ && !s.collected) {
          s.collected = true
          this.collectedSet.add(s.loreIndex)
          this.saveCollected()
          if (s.mesh) {
            this.scene.remove(s.mesh)
            s.mesh = null
          }
          collected = { loreIndex: s.loreIndex, text: LORE_TEXTS[s.loreIndex] }
        }
      }
    }

    return collected
  }

  private createMesh(pos: THREE.Vector3, nightOnly = false): THREE.Group {
    const group = new THREE.Group()
    group.position.copy(pos)

    // Night-only stones glow silver/white; regular stones glow blue-gold
    const outerColor = nightOnly ? 0xddeeff : 0x88ccff
    const innerColor = nightOnly ? 0xffffff : 0xffffff

    // Glowing box
    const geo = new THREE.BoxGeometry(0.4, 0.6, 0.2)
    const mat = new THREE.MeshBasicMaterial({
      color: outerColor,
      transparent: true,
      opacity: 0.8,
    })
    const mesh = new THREE.Mesh(geo, mat)
    group.add(mesh)

    // Inner glow
    const innerGeo = new THREE.BoxGeometry(0.25, 0.4, 0.12)
    const innerMat = new THREE.MeshBasicMaterial({
      color: innerColor,
      transparent: true,
      opacity: nightOnly ? 0.7 : 0.4,
    })
    const inner = new THREE.Mesh(innerGeo, innerMat)
    group.add(inner)

    return group
  }

  private saveCollected() {
    try {
      localStorage.setItem('lore_collected', JSON.stringify([...this.collectedSet]))
    } catch { /* ignore */ }
  }

  private loadCollected() {
    try {
      const raw = localStorage.getItem('lore_collected')
      if (raw) {
        const arr = JSON.parse(raw) as number[]
        for (const n of arr) this.collectedSet.add(n)
      }
    } catch { /* ignore */ }
  }
}
