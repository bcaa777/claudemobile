import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { TRAIL_CONFIG } from '../config'
import type { BiomeMap } from '../world/BiomeMap'
import type { TrailWaypoint, TrailEdge } from './traversalTypes'
import { findTrailPath } from './TrailPathfinder'

interface POI {
  position: THREE.Vector3
  biome: BiomeType
}

export class TrailNetwork {
  readonly edges: TrailEdge[] = []
  private chunkIndex = new Map<string, TrailEdge[]>()

  constructor(
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
    housePositions: THREE.Vector3[],
    portalPositions: { position: THREE.Vector3; biome: BiomeType }[],
    biomeMap: BiomeMap,
  ) {
    if (!TRAIL_CONFIG.enableTrails) return

    // Collect Phase 1 POIs (exclude Heaven/Hell — accessed via portals)
    const pois: POI[] = []

    for (const [biome, pos] of landmarkPositions) {
      if (biome === BiomeType.Heaven || biome === BiomeType.Hell) continue
      pois.push({ position: pos, biome })
    }

    for (const pos of housePositions) {
      const biome = biomeMap.getBiomeAt(pos.x, pos.z)
      if (biome === BiomeType.Heaven || biome === BiomeType.Hell) continue
      pois.push({ position: pos, biome })
    }

    for (const p of portalPositions) {
      if (p.biome === BiomeType.Heaven || p.biome === BiomeType.Hell) continue
      pois.push({ position: p.position, biome: p.biome })
    }

    // Merge POIs that are too close
    const merged = this.mergePOIs(pois)

    // Build connections
    this.buildBackbone(merged, biomeMap)

    // Index waypoints by chunk
    this.buildChunkIndex()

    console.log(`[Trails] Phase 1: ${this.edges.length} backbone trails, ${this.edges.reduce((s, e) => s + e.waypoints.length, 0)} waypoints`)
  }

  private mergePOIs(pois: POI[]): POI[] {
    const minDistSq = TRAIL_CONFIG.minPOIDistance ** 2
    const merged: POI[] = []
    for (const poi of pois) {
      let tooClose = false
      for (const existing of merged) {
        const dx = poi.position.x - existing.position.x
        const dz = poi.position.z - existing.position.z
        if (dx * dx + dz * dz < minDistSq) { tooClose = true; break }
      }
      if (!tooClose) merged.push(poi)
    }
    return merged
  }

  private buildBackbone(pois: POI[], biomeMap: BiomeMap) {
    const maxDistSq = TRAIL_CONFIG.maxDistance ** 2
    const maxConn = TRAIL_CONFIG.maxConnections
    const connectionCount = new Map<number, number>()

    // Build candidate edges sorted by distance (greedy shortest-first)
    const candidates: { i: number; j: number; distSq: number }[] = []
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) {
        const dx = pois[i].position.x - pois[j].position.x
        const dz = pois[i].position.z - pois[j].position.z
        const distSq = dx * dx + dz * dz
        if (distSq <= maxDistSq) candidates.push({ i, j, distSq })
      }
    }
    candidates.sort((a, b) => a.distSq - b.distSq)

    for (const { i, j } of candidates) {
      const ci = connectionCount.get(i) ?? 0
      const cj = connectionCount.get(j) ?? 0
      if (ci >= maxConn || cj >= maxConn) continue

      const a = pois[i].position
      const b = pois[j].position
      const waypoints = findTrailPath(a.x, a.z, b.x, b.z, biomeMap)
      if (!waypoints || waypoints.length < 2) continue

      this.edges.push({ waypoints })
      connectionCount.set(i, ci + 1)
      connectionCount.set(j, cj + 1)
    }
  }

  private buildChunkIndex() {
    this.chunkIndex.clear()
    for (const edge of this.edges) {
      // Index each edge into every chunk it passes through
      const chunks = new Set<string>()
      for (const wp of edge.waypoints) chunks.add(`${wp.cx},${wp.cz}`)
      for (const key of chunks) {
        let arr = this.chunkIndex.get(key)
        if (!arr) { arr = []; this.chunkIndex.set(key, arr) }
        arr.push(edge)
      }
    }
  }

  getEdgesForChunk(cx: number, cz: number): TrailEdge[] {
    return this.chunkIndex.get(`${cx},${cz}`) ?? []
  }
}
