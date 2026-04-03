import * as THREE from 'three'
import { makeNoise2D, fbm, Noise2DFn } from '../utils/Noise'
import { BiomeMap } from './BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType } from '../biomes/types'
import { TERRAIN_CONFIG } from '../config'

export const CHUNK_SIZE     = 64
export const CHUNK_SEGMENTS = 32
const VERTICES = CHUNK_SEGMENTS + 1

export const WATER_LEVEL = TERRAIN_CONFIG.waterLevel
export const HEAVEN_ALTITUDE = 100
export const HELL_DEPTH = -60
export const HELL_PIT_RADIUS = 50

// ─── Noise singletons ────────────────────────────────────────────────────────
let terrainNoise: Noise2DFn | null = null
let riverNoise:   Noise2DFn | null = null

function getTerrainNoise() { if (!terrainNoise) terrainNoise = makeNoise2D(12345); return terrainNoise }
function getRiverNoise()   { if (!riverNoise)   riverNoise   = makeNoise2D(77777); return riverNoise }

let continentalNoise: Noise2DFn | null = null

function getContinentalNoise() { if (!continentalNoise) continentalNoise = makeNoise2D(55555); return continentalNoise }

// ─── Height functions ────────────────────────────────────────────────────────

// Ridge FBM — raw noise in [-1,1] → 1 – |n|, squared for sharp peaks
function ridgeFbm(noise: Noise2DFn, x: number, z: number, freq: number, octaves: number): number {
  let value = 0, amp = 1, f = freq, maxVal = 0
  for (let i = 0; i < octaves; i++) {
    const n = noise(x * f, z * f)           // -1..1
    const ridge = 1.0 - Math.abs(n)
    value  += ridge * ridge * amp
    maxVal += amp
    amp *= 0.5
    f   *= 2.0
  }
  return value / maxVal                     // 0..1
}

// Domain-warped FBM — shifts sample coords for organic, non-repeating shapes
function warpFbm(noise: Noise2DFn, x: number, z: number, freq: number, octaves: number): number {
  const w  = TERRAIN_CONFIG.domainWarpStrength
  const wx = x + w * fbm(noise, x * 0.003,        z * 0.003 + 31.4, 2)
  const wz = z + w * fbm(noise, x * 0.003 + 17.3, z * 0.003,        2)
  return fbm(noise, wx * freq, wz * freq, octaves)
}

// Terrace — quantises height into stepped cliffs
function terrace(h: number, step: number, strength: number): number {
  if (strength <= 0) return h
  const snapped = Math.floor(h / step) * step + step * 0.5
  return h * (1 - strength) + snapped * strength
}

// River mask — 0 at river centreline, 1 far away
export function riverMask(wx: number, wz: number): number {
  if (!TERRAIN_CONFIG.enableRivers) return 1
  const rn = getRiverNoise()
  const n1 = Math.abs(rn(wx * 0.004,       wz * 0.004))
  const n2 = Math.abs(rn(wx * 0.003 + 100, wz * 0.003 + 50))
  const rv = Math.min(n1, n2)                 // low = near river
  return Math.min(1.0, rv / TERRAIN_CONFIG.riverWidth)
}

// ─── Continental elevation ───────────────────────────────────────────────────

/**
 * Compute the continental elevation offset at a world position.
 * Returns a height offset (0 for valley, ~120 for midland, ~250 for mountain)
 * with steep sigmoid transitions between tiers.
 */
export function continentalOffset(wx: number, wz: number): number {
  const cn = getContinentalNoise()
  const tn = getTerrainNoise()

  // Domain warp for organic, meandering tier boundaries
  const wf = TERRAIN_CONFIG.continentalWarpFrequency
  const ws = TERRAIN_CONFIG.continentalWarpStrength
  const warpX = wx + ws * fbm(tn, wx * wf,        wz * wf + 31.4, 2)
  const warpZ = wz + ws * fbm(tn, wx * wf + 17.3, wz * wf,        2)

  // Sample continental noise (0-1)
  const raw = fbm(cn, warpX * TERRAIN_CONFIG.continentalFrequency,
                      warpZ * TERRAIN_CONFIG.continentalFrequency, 3)

  // Spread fbm output (clusters around 0.5) to use more of the 0-1 range
  const spread = Math.min(1, Math.max(0, (raw - 0.25) * 2.0))

  // Sigmoid-based tier transitions — steep = cliff faces, gradual = passes
  const k = TERRAIN_CONFIG.continentalSigmoidSteepness
  const low  = TERRAIN_CONFIG.tierThresholdLow
  const high = TERRAIN_CONFIG.tierThresholdHigh

  const t1 = 1 / (1 + Math.exp(-k * (spread - low)))
  const t2 = 1 / (1 + Math.exp(-k * (spread - high)))

  return t1 * TERRAIN_CONFIG.midlandOffset
       + t2 * (TERRAIN_CONFIG.mountainOffset - TERRAIN_CONFIG.midlandOffset)
}

// ─── Per-vertex height ───────────────────────────────────────────────────────

function computeHeight(
  noise: Noise2DFn,
  domain: number,
  wx: number, wz: number,
  heightScale: number,
  heightFreq:  number,
  mountainScale: number,
  terraceStrength: number,
  terraceStep: number,
): number {
  let h: number

  if (domain < TERRAIN_CONFIG.plainsThreshold) {
    // ── Plains / valleys ──────────────────────────────────────────────────
    const t   = domain / TERRAIN_CONFIG.plainsThreshold   // 0..1
    const flat = fbm(noise, wx * 0.05, wz * 0.05, 2) * heightScale * 0.10
    const hill = warpFbm(noise, wx, wz, heightFreq, 4)   * heightScale * 0.35
    h = flat + (hill - flat) * (t * t)

  } else if (domain < TERRAIN_CONFIG.mountainThreshold) {
    // ── Rolling hills ─────────────────────────────────────────────────────
    h = warpFbm(noise, wx, wz, heightFreq, 5) * heightScale

  } else {
    // ── Mountain ridges ───────────────────────────────────────────────────
    const mt     = (domain - TERRAIN_CONFIG.mountainThreshold) / (1 - TERRAIN_CONFIG.mountainThreshold)
    const hillH  = warpFbm(noise, wx, wz, heightFreq,       5) * heightScale
    const mountH = ridgeFbm(noise, wx, wz, heightFreq * 0.5, 7) * heightScale * mountainScale
    h = hillH * (1 - mt) + mountH * mt
  }

  // Terracing (skip near water to keep riverbanks smooth)
  if (terraceStrength > 0 && h > WATER_LEVEL + 1) {
    h = terrace(h, terraceStep, terraceStrength)
  }

  return h
}

// ─── Public result type ──────────────────────────────────────────────────────

export interface HeightmapResult {
  positions:  Float32Array
  normals:    Float32Array
  colors:     Float32Array
  indices:    Uint32Array
  heightGrid: Float32Array
  hasWater:   boolean
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function generateHeightmap(cx: number, cz: number, biomeMap: BiomeMap): HeightmapResult {
  const noise      = getTerrainNoise()
  const worldOffX  = cx * CHUNK_SIZE
  const worldOffZ  = cz * CHUNK_SIZE
  const vertCount  = VERTICES * VERTICES

  const positions = new Float32Array(vertCount * 3)
  const normals   = new Float32Array(vertCount * 3)
  const colors    = new Float32Array(vertCount * 3)
  const heightGrid= new Float32Array(vertCount)
  let   hasWater  = false

  for (let row = 0; row < VERTICES; row++) {
    for (let col = 0; col < VERTICES; col++) {
      const wx = worldOffX + (col / CHUNK_SEGMENTS) * CHUNK_SIZE
      const wz = worldOffZ + (row / CHUNK_SEGMENTS) * CHUNK_SIZE

      const blend = biomeMap.getBlend(wx, wz)
      const bA    = getBiome(blend.primary)
      const bB    = getBiome(blend.secondary)

      // Single domain sample shared by both biomes for coherence
      const domain = fbm(noise, wx * TERRAIN_CONFIG.domainFrequency, wz * TERRAIN_CONFIG.domainFrequency, 3)

      const hA = computeHeight(noise, domain, wx, wz,
        bA.heightScale, bA.heightFrequency, bA.mountainScale, bA.terraceStrength, bA.terraceStep)
      const hB = computeHeight(noise, domain, wx, wz,
        bB.heightScale, bB.heightFrequency, bB.mountainScale, bB.terraceStrength, bB.terraceStep)

      let height = hA + (hB - hA) * blend.blend

      // Continental elevation — large-scale tier offset
      const contOffset = continentalOffset(wx, wz)
      height += contOffset

      // Mega mountain boost — sharp conical peaks scattered across the world
      for (const mt of biomeMap.megaMountains) {
        const mdx = wx - mt.x
        const mdz = wz - mt.z
        const dist = Math.sqrt(mdx * mdx + mdz * mdz)
        if (dist < mt.radius) {
          // Sharp peak: (1 - dist/radius)^2 gives a pointy cone shape
          const t = 1 - dist / mt.radius
          const peak = t * t * mt.height
          // Add ridge noise for craggy surface
          const ridgeDetail = ridgeFbm(noise, wx, wz, 0.02, 4) * mt.height * 0.15 * t
          height += peak + ridgeDetail
        } else if (dist < mt.radius * 1.6) {
          // Foothills: gentle falloff beyond the peak radius
          const t = 1 - (dist - mt.radius) / (mt.radius * 0.6)
          height += t * t * mt.height * 0.15
        }
      }

      // Hell pit carving
      const hellC = biomeMap.getHellCenter()
      if (hellC) {
        const hdx = wx - hellC.x, hdz = wz - hellC.z
        const hDist = Math.sqrt(hdx * hdx + hdz * hdz)
        if (hDist < HELL_PIT_RADIUS) {
          const ht = 1 - hDist / HELL_PIT_RADIUS
          height -= ht * ht * (height - HELL_DEPTH)
        }
      }

      // Local water level relative to continental base
      const localWater = contOffset + WATER_LEVEL

      // River carving
      const rm = riverMask(wx, wz)
      if (rm < 1) {
        const bed = localWater - TERRAIN_CONFIG.riverCarveDepth
        height = height * rm + bed * (1 - rm)
      }

      if (height < localWater) hasWater = true

      const idx = row * VERTICES + col
      heightGrid[idx]         = height
      positions[idx * 3 + 0] = (col / CHUNK_SEGMENTS) * CHUNK_SIZE
      positions[idx * 3 + 1] = height
      positions[idx * 3 + 2] = (row / CHUNK_SEGMENTS) * CHUNK_SIZE

      // Vertex colour
      if (height < localWater) {
        // Sandy riverbed / lakebed
        const sand: [number,number,number] = [0.46, 0.38, 0.20]
        colors[idx*3]   = Math.round(sand[0] * 31) / 31
        colors[idx*3+1] = Math.round(sand[1] * 31) / 31
        colors[idx*3+2] = Math.round(sand[2] * 31) / 31
      } else {
        const palA   = bA.groundColors
        const palB   = bB.groundColors
        const piA    = Math.floor(fbm(noise, wx*0.05+100, wz*0.05+100, 2) * palA.length) % palA.length
        const piB    = Math.floor(fbm(noise, wx*0.05+200, wz*0.05+200, 2) * palB.length) % palB.length
        const cA     = palA[piA]
        const cB     = palB[piB]
        const t      = blend.blend
        const r = cA[0] + (cB[0]-cA[0])*t
        const g = cA[1] + (cB[1]-cA[1])*t
        const b = cA[2] + (cB[2]-cA[2])*t
        colors[idx*3]   = Math.round(r * 31) / 31
        colors[idx*3+1] = Math.round(g * 31) / 31
        colors[idx*3+2] = Math.round(b * 31) / 31
      }
    }
  }

  // Build triangle indices
  const quadCount = CHUNK_SEGMENTS * CHUNK_SEGMENTS
  const indices   = new Uint32Array(quadCount * 6)
  let ii = 0
  for (let row = 0; row < CHUNK_SEGMENTS; row++) {
    for (let col = 0; col < CHUNK_SEGMENTS; col++) {
      const a = row * VERTICES + col
      const b = a + 1
      const c = (row+1) * VERTICES + col
      const d = c + 1
      indices[ii++] = a; indices[ii++] = c; indices[ii++] = b
      indices[ii++] = b; indices[ii++] = c; indices[ii++] = d
    }
  }

  computeNormals(positions, indices, normals)
  return { positions, normals, colors, indices, heightGrid, hasWater }
}

// ─── Normal computation ──────────────────────────────────────────────────────

function computeNormals(positions: Float32Array, indices: Uint32Array, normals: Float32Array) {
  const vc    = positions.length / 3
  const accum = new Float32Array(vc * 3)
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cross = new THREE.Vector3()

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i], ib = indices[i+1], ic = indices[i+2]
    vA.fromArray(positions, ia*3)
    vB.fromArray(positions, ib*3)
    vC.fromArray(positions, ic*3)
    e1.subVectors(vB, vA); e2.subVectors(vC, vA)
    cross.crossVectors(e1, e2)
    for (const idx of [ia, ib, ic]) {
      accum[idx*3]   += cross.x
      accum[idx*3+1] += cross.y
      accum[idx*3+2] += cross.z
    }
  }
  for (let i = 0; i < vc; i++) {
    const x = accum[i*3], y = accum[i*3+1], z = accum[i*3+2]
    const len = Math.sqrt(x*x + y*y + z*z) || 1
    normals[i*3]   = x/len; normals[i*3+1] = y/len; normals[i*3+2] = z/len
  }
}

// ─── Standalone world-space height query (for landmark placement etc.) ───────

export function sampleWorldHeight(wx: number, wz: number, biomeMap: BiomeMap): number {
  const noise = getTerrainNoise()

  const blend = biomeMap.getBlend(wx, wz)
  const bA    = getBiome(blend.primary)
  const bB    = getBiome(blend.secondary)

  const domain = fbm(noise, wx * TERRAIN_CONFIG.domainFrequency, wz * TERRAIN_CONFIG.domainFrequency, 3)

  const hA = computeHeight(noise, domain, wx, wz,
    bA.heightScale, bA.heightFrequency, bA.mountainScale, bA.terraceStrength, bA.terraceStep)
  const hB = computeHeight(noise, domain, wx, wz,
    bB.heightScale, bB.heightFrequency, bB.mountainScale, bB.terraceStrength, bB.terraceStep)

  let height = hA + (hB - hA) * blend.blend

  // Continental elevation
  const contOffset = continentalOffset(wx, wz)
  height += contOffset

  // Mega mountain boost
  for (const mt of biomeMap.megaMountains) {
    const mdx = wx - mt.x
    const mdz = wz - mt.z
    const dist = Math.sqrt(mdx * mdx + mdz * mdz)
    if (dist < mt.radius) {
      const t = 1 - dist / mt.radius
      height += t * t * mt.height + ridgeFbm(noise, wx, wz, 0.02, 4) * mt.height * 0.15 * t
    } else if (dist < mt.radius * 1.6) {
      const t = 1 - (dist - mt.radius) / (mt.radius * 0.6)
      height += t * t * mt.height * 0.15
    }
  }

  // Hell pit carving
  const hellC = biomeMap.getHellCenter()
  let inHellPit = false
  if (hellC) {
    const hdx = wx - hellC.x, hdz = wz - hellC.z
    const hDist = Math.sqrt(hdx * hdx + hdz * hdz)
    if (hDist < HELL_PIT_RADIUS) {
      const ht = 1 - hDist / HELL_PIT_RADIUS
      height -= ht * ht * (height - HELL_DEPTH)
      inHellPit = true
    }
  }

  // River carving — local water level relative to continental base
  const localWater = contOffset + WATER_LEVEL
  const rm = riverMask(wx, wz)
  if (rm < 1) {
    const bed = localWater - TERRAIN_CONFIG.riverCarveDepth
    height = height * rm + bed * (1 - rm)
  }

  return inHellPit ? height : Math.max(height, localWater)
}

// ─── Height sampler (bilinear) ───────────────────────────────────────────────

export function sampleHeight(heightGrid: Float32Array, lx: number, lz: number): number {
  const tx  = (lx / CHUNK_SIZE) * CHUNK_SEGMENTS
  const tz  = (lz / CHUNK_SIZE) * CHUNK_SEGMENTS
  const col = Math.max(0, Math.min(CHUNK_SEGMENTS-1, Math.floor(tx)))
  const row = Math.max(0, Math.min(CHUNK_SEGMENTS-1, Math.floor(tz)))
  const fx  = tx - col, fz = tz - row
  const h00 = heightGrid[ row    * VERTICES +  col]
  const h10 = heightGrid[ row    * VERTICES + (col+1)]
  const h01 = heightGrid[(row+1) * VERTICES +  col]
  const h11 = heightGrid[(row+1) * VERTICES + (col+1)]
  return h00*(1-fx)*(1-fz) + h10*fx*(1-fz) + h01*(1-fx)*fz + h11*fx*fz
}
