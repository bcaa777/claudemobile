import * as THREE from 'three'
import { MaterialCache } from '../utils/MaterialCache'
import { SeededRandom } from '../utils/SeededRandom'
import { CHUNK_SIZE } from '../world/TerrainGenerator'
import type { WalkableBox } from '../world/Chunk'

const ICE_COLOR = 0x88bbee

/**
 * Builds ice slide channels on snowy slopes.
 * Uses gradient descent to find downhill paths and places translucent icy slabs.
 */
export function buildIceSlides(
  cx: number,
  cz: number,
  rng: SeededRandom,
  heightGrid: Float32Array,
  group: THREE.Group,
  matCache: MaterialCache,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []

  const iceMat = matCache.getLambert(ICE_COLOR, {
    transparent: true,
    opacity: 0.8,
    emissive: new THREE.Color(0x4488bb),
    emissiveIntensity: 0.3,
  })

  const count = 3 + rng.int(0, 2) // 3-5 slides
  const SEGMENTS = 33

  for (let s = 0; s < count; s++) {
    // Find a high starting point
    let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2
    for (let probe = 0; probe < 8; probe++) {
      const lx = 6 + rng.range(0, CHUNK_SIZE - 12)
      const lz = 6 + rng.range(0, CHUNK_SIZE - 12)
      const h = sampleH(heightGrid, lx, lz)
      if (h > bestH) { bestH = h; bestX = lx; bestZ = lz }
    }

    if (bestH < 4) continue // need some elevation

    const stepLen = 4
    let px = bestX, pz = bestZ

    for (let i = 0; i < 8; i++) {
      px = Math.max(3, Math.min(CHUNK_SIZE - 3, px))
      pz = Math.max(3, Math.min(CHUNK_SIZE - 3, pz))
      const h = sampleH(heightGrid, px, pz)
      if (h < 4) break

      // Find downhill
      const hN = sampleH(heightGrid, px, Math.max(2, pz - stepLen))
      const hS = sampleH(heightGrid, px, Math.min(CHUNK_SIZE - 2, pz + stepLen))
      const hE = sampleH(heightGrid, Math.min(CHUNK_SIZE - 2, px + stepLen), pz)
      const hW = sampleH(heightGrid, Math.max(2, px - stepLen), pz)

      // Place ice slab — raised and thicker for visibility
      const slabY = h + 0.3
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 7), iceMat)
      slab.position.set(px, slabY, pz)

      // Rotate to face downhill
      const minH = Math.min(hN, hS, hE, hW)
      if (minH === hN || minH === hS) {
        // Slope along Z
      } else {
        slab.rotation.y = Math.PI / 2
      }

      group.add(slab)
      meshes.push(slab)
      walkables.push({
        minX: px - 1.5, maxX: px + 1.5,
        minZ: pz - 3.5, maxZ: pz + 3.5,
        y: slabY + 0.2,
      })

      // Step downhill
      if (minH === hN) pz -= stepLen
      else if (minH === hS) pz += stepLen
      else if (minH === hE) px += stepLen
      else px -= stepLen
    }
  }

  return { meshes, walkables }
}

function sampleH(grid: Float32Array, lx: number, lz: number): number {
  const SEGMENTS = 32
  const VERTICES = SEGMENTS + 1
  const gx = Math.min(SEGMENTS, Math.max(0, (lx / CHUNK_SIZE) * SEGMENTS))
  const gz = Math.min(SEGMENTS, Math.max(0, (lz / CHUNK_SIZE) * SEGMENTS))
  const ix = Math.floor(gx)
  const iz = Math.floor(gz)
  const fx = gx - ix
  const fz = gz - iz
  const ix1 = Math.min(ix + 1, SEGMENTS)
  const iz1 = Math.min(iz + 1, SEGMENTS)
  const h00 = grid[iz * VERTICES + ix]
  const h10 = grid[iz * VERTICES + ix1]
  const h01 = grid[iz1 * VERTICES + ix]
  const h11 = grid[iz1 * VERTICES + ix1]
  return (h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz)
}
