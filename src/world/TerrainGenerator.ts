import * as THREE from 'three'
import { makeNoise2D, fbm, Noise2DFn } from '../utils/Noise'
import { BiomeMap } from './BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType } from '../biomes/types'

export const CHUNK_SIZE = 64      // world units per chunk
export const CHUNK_SEGMENTS = 32  // terrain grid resolution (32x32 quads)
const VERTICES = CHUNK_SEGMENTS + 1

let noise2d: Noise2DFn | null = null

function getOrCreateNoise(): Noise2DFn {
  if (!noise2d) noise2d = makeNoise2D(12345)
  return noise2d
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

export interface HeightmapResult {
  positions: Float32Array  // x,y,z per vertex
  normals: Float32Array
  colors: Float32Array     // r,g,b per vertex
  indices: Uint32Array
  heightGrid: Float32Array // (VERTICES x VERTICES) heights for collision
}

export function generateHeightmap(
  cx: number,
  cz: number,
  biomeMap: BiomeMap
): HeightmapResult {
  const noise = getOrCreateNoise()
  const worldOffX = cx * CHUNK_SIZE
  const worldOffZ = cz * CHUNK_SIZE

  const vertCount = VERTICES * VERTICES
  const positions = new Float32Array(vertCount * 3)
  const normals = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)
  const heightGrid = new Float32Array(vertCount)

  // Build vertex positions + colors
  for (let row = 0; row < VERTICES; row++) {
    for (let col = 0; col < VERTICES; col++) {
      const wx = worldOffX + (col / CHUNK_SEGMENTS) * CHUNK_SIZE
      const wz = worldOffZ + (row / CHUNK_SEGMENTS) * CHUNK_SIZE

      const blend = biomeMap.getBlend(wx, wz)
      const bA = getBiome(blend.primary)
      const bB = getBiome(blend.secondary)

      // Height: blend between biome height scales
      const hA = fbm(noise, wx * bA.heightFrequency, wz * bA.heightFrequency, 5) * bA.heightScale
      const hB = fbm(noise, wx * bB.heightFrequency, wz * bB.heightFrequency, 5) * bB.heightScale
      const height = hA + (hB - hA) * blend.blend

      const idx = row * VERTICES + col
      heightGrid[idx] = height

      positions[idx * 3 + 0] = (col / CHUNK_SEGMENTS) * CHUNK_SIZE
      positions[idx * 3 + 1] = height
      positions[idx * 3 + 2] = (row / CHUNK_SEGMENTS) * CHUNK_SIZE

      // Vertex color: blend biome ground palettes, pick based on height
      const palA = bA.groundColors
      const palB = bB.groundColors
      const palIdxA = Math.floor(fbm(noise, wx * 0.05 + 100, wz * 0.05 + 100, 2) * palA.length) % palA.length
      const palIdxB = Math.floor(fbm(noise, wx * 0.05 + 200, wz * 0.05 + 200, 2) * palB.length) % palB.length

      const cA = palA[palIdxA]
      const cB = palB[palIdxB]
      const c = lerpColor(cA, cB, blend.blend)

      // PS1-style quantize (5-bit per channel)
      colors[idx * 3 + 0] = Math.round(c[0] * 31) / 31
      colors[idx * 3 + 1] = Math.round(c[1] * 31) / 31
      colors[idx * 3 + 2] = Math.round(c[2] * 31) / 31
    }
  }

  // Build indices
  const quadCount = CHUNK_SEGMENTS * CHUNK_SEGMENTS
  const indices = new Uint32Array(quadCount * 6)
  let ii = 0
  for (let row = 0; row < CHUNK_SEGMENTS; row++) {
    for (let col = 0; col < CHUNK_SEGMENTS; col++) {
      const a = row * VERTICES + col
      const b = a + 1
      const c = (row + 1) * VERTICES + col
      const d = c + 1
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
    }
  }

  // Compute smooth normals
  computeNormals(positions, indices, normals)

  return { positions, normals, colors, indices, heightGrid }
}

function computeNormals(
  positions: Float32Array,
  indices: Uint32Array,
  normals: Float32Array
) {
  const vertCount = positions.length / 3
  const accum = new Float32Array(vertCount * 3)

  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const edge1 = new THREE.Vector3()
  const edge2 = new THREE.Vector3()
  const cross = new THREE.Vector3()

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i], ib = indices[i+1], ic = indices[i+2]
    vA.fromArray(positions, ia * 3)
    vB.fromArray(positions, ib * 3)
    vC.fromArray(positions, ic * 3)
    edge1.subVectors(vB, vA)
    edge2.subVectors(vC, vA)
    cross.crossVectors(edge1, edge2)
    for (const idx of [ia, ib, ic]) {
      accum[idx*3]   += cross.x
      accum[idx*3+1] += cross.y
      accum[idx*3+2] += cross.z
    }
  }

  for (let i = 0; i < vertCount; i++) {
    const x = accum[i*3], y = accum[i*3+1], z = accum[i*3+2]
    const len = Math.sqrt(x*x + y*y + z*z) || 1
    normals[i*3]   = x / len
    normals[i*3+1] = y / len
    normals[i*3+2] = z / len
  }
}

// Sample height at local (lx, lz) within a chunk (0..CHUNK_SIZE)
export function sampleHeight(heightGrid: Float32Array, lx: number, lz: number): number {
  const tx = (lx / CHUNK_SIZE) * CHUNK_SEGMENTS
  const tz = (lz / CHUNK_SIZE) * CHUNK_SEGMENTS
  const col = Math.max(0, Math.min(CHUNK_SEGMENTS - 1, Math.floor(tx)))
  const row = Math.max(0, Math.min(CHUNK_SEGMENTS - 1, Math.floor(tz)))
  const fx = tx - col
  const fz = tz - row
  const h00 = heightGrid[row * VERTICES + col]
  const h10 = heightGrid[row * VERTICES + (col+1)]
  const h01 = heightGrid[(row+1) * VERTICES + col]
  const h11 = heightGrid[(row+1) * VERTICES + (col+1)]
  return h00 * (1-fx)*(1-fz) + h10 * fx*(1-fz) + h01 * (1-fx)*fz + h11 * fx*fz
}
