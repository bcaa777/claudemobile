import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { sampleWorldHeight, CHUNK_SIZE } from '../world/TerrainGenerator'
import { SeededRandom } from '../utils/SeededRandom'
import type { RoadWaypoint, RoadEdge } from './traversalTypes'

const MAX_CONNECTIONS = 3
const MAX_EDGE_LENGTH = 800
const WAYPOINT_SPACING = 8
const SMOOTHING_WINDOW = 5

export class RoadNetwork {
  readonly edges: RoadEdge[] = []
  private chunkIndex = new Map<string, RoadWaypoint[]>()

  constructor(
    positions: Map<BiomeType, THREE.Vector3>,
    biomeMap: BiomeMap,
    seed: number,
  ) {
    const rng = new SeededRandom(seed + 5000)

    // Step 1: Build adjacency graph with greedy shortest-edges
    const nodes = Array.from(positions.entries())
    if (nodes.length < 2) return

    // All pairs sorted by distance
    const pairs: { i: number; j: number; dist: number }[] = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i][1].x - nodes[j][1].x
        const dz = nodes[i][1].z - nodes[j][1].z
        const dist = Math.sqrt(dx * dx + dz * dz)
        pairs.push({ i, j, dist })
      }
    }
    pairs.sort((a, b) => a.dist - b.dist)

    const connectionCount = new Map<number, number>()
    const selectedEdges: { i: number; j: number }[] = []

    for (const pair of pairs) {
      if (pair.dist > MAX_EDGE_LENGTH) break
      const ci = connectionCount.get(pair.i) ?? 0
      const cj = connectionCount.get(pair.j) ?? 0
      if (ci >= MAX_CONNECTIONS || cj >= MAX_CONNECTIONS) continue

      // Add some randomness: 15% chance to skip an edge
      if (rng.next() < 0.15) continue

      selectedEdges.push(pair)
      connectionCount.set(pair.i, ci + 1)
      connectionCount.set(pair.j, cj + 1)
    }

    console.log(`[RoadNetwork] Selected ${selectedEdges.length} edges from ${nodes.length} landmarks`)

    // Step 2: Compute terrain-following waypoints per edge
    for (const { i, j } of selectedEdges) {
      const [biomeA, posA] = nodes[i]
      const [biomeB, posB] = nodes[j]

      const dx = posB.x - posA.x
      const dz = posB.z - posA.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const numWaypoints = Math.max(2, Math.floor(dist / WAYPOINT_SPACING))

      const rawWaypoints: { x: number; y: number; z: number; biome: BiomeType }[] = []
      for (let k = 0; k <= numWaypoints; k++) {
        const t = k / numWaypoints
        const wx = posA.x + dx * t
        const wz = posA.z + dz * t
        const wy = sampleWorldHeight(wx, wz, biomeMap)
        const biome = biomeMap.getBiomeAt(wx, wz)
        rawWaypoints.push({ x: wx, y: wy, z: wz, biome })
      }

      // 5-point moving average smoothing on Y
      const smoothed: RoadWaypoint[] = []
      for (let k = 0; k < rawWaypoints.length; k++) {
        let sumY = 0
        let count = 0
        const half = Math.floor(SMOOTHING_WINDOW / 2)
        for (let m = k - half; m <= k + half; m++) {
          if (m >= 0 && m < rawWaypoints.length) {
            sumY += rawWaypoints[m].y
            count++
          }
        }
        const wp = rawWaypoints[k]
        const cx = Math.floor(wp.x / CHUNK_SIZE)
        const cz = Math.floor(wp.z / CHUNK_SIZE)
        smoothed.push({
          x: wp.x,
          y: sumY / count,
          z: wp.z,
          biome: wp.biome,
          cx,
          cz,
        })
      }

      this.edges.push({ from: biomeA, to: biomeB, waypoints: smoothed })

      // Step 3: Index by chunk
      for (const wp of smoothed) {
        const key = `${wp.cx},${wp.cz}`
        let arr = this.chunkIndex.get(key)
        if (!arr) { arr = []; this.chunkIndex.set(key, arr) }
        arr.push(wp)
      }
    }
  }

  /** Returns all chunk keys that have road waypoints */
  getIndexedChunks(): string[] {
    return Array.from(this.chunkIndex.keys())
  }

  getWaypointsForChunk(cx: number, cz: number): RoadWaypoint[] {
    return this.chunkIndex.get(`${cx},${cz}`) ?? []
  }
}
