import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { MaterialCache } from '../utils/MaterialCache'
import { texGen } from '../utils/PixelTextureGenerator'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'
import { CHUNK_SIZE } from '../world/TerrainGenerator'
import { buildIceSlides } from './IceSlide'
import { buildLavaRocks } from './LavaRocks'
import type { TraversalAnchor, LavaRockState } from './traversalTypes'
import type { WalkableBox } from '../world/Chunk'

/** Biomes that get ziplines */
const ZIPLINE_BIOMES = new Set([BiomeType.Alpine, BiomeType.Cliffs, BiomeType.FloatingIslands])
/** Biomes that get vine swings */
const VINE_BIOMES = new Set([BiomeType.Jungle, BiomeType.Forest])
/** Biomes that get ice slides */
const ICE_BIOMES = new Set([BiomeType.Snow, BiomeType.Tundra])
/** Biomes that get lava rocks */
const LAVA_BIOMES = new Set([BiomeType.Volcanic, BiomeType.Hell])

/**
 * Builds biome-specific traversal features for a single chunk.
 */
export function buildBiomeFeatures(
  cx: number,
  cz: number,
  biomeMap: BiomeMap,
  heightGrid: Float32Array,
  group: THREE.Group,
  matCache: MaterialCache,
  scene: THREE.Scene,
): {
  meshes: THREE.Object3D[]
  walkables: WalkableBox[]
  anchors: TraversalAnchor[]
  lavaRocks: LavaRockState[]
} {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []
  const anchors: TraversalAnchor[] = []
  const lavaRocks: LavaRockState[] = []

  const centerBiome = biomeMap.getBiomeAt(
    cx * CHUNK_SIZE + CHUNK_SIZE / 2,
    cz * CHUNK_SIZE + CHUNK_SIZE / 2,
  )

  const rng = new SeededRandom(chunkSeed(cx, cz, 7777))

  // Ziplines
  if (ZIPLINE_BIOMES.has(centerBiome)) {
    const result = buildZiplines(cx, cz, rng, heightGrid, group, matCache, scene)
    meshes.push(...result.meshes)
    walkables.push(...result.walkables)
    anchors.push(...result.anchors)
  }

  // Vine swings
  if (VINE_BIOMES.has(centerBiome)) {
    const result = buildVines(cx, cz, rng, heightGrid, group, matCache, scene)
    meshes.push(...result.meshes)
    anchors.push(...result.anchors)
  }

  // Ice slides
  if (ICE_BIOMES.has(centerBiome)) {
    const result = buildIceSlides(cx, cz, rng, heightGrid, group, matCache)
    meshes.push(...result.meshes)
    walkables.push(...result.walkables)
  }

  // Lava rocks
  if (LAVA_BIOMES.has(centerBiome)) {
    const result = buildLavaRocks(cx, cz, rng, heightGrid, group, matCache)
    meshes.push(...result.meshes)
    walkables.push(...result.walkables)
    lavaRocks.push(...result.rocks)
  }

  return { meshes, walkables, anchors, lavaRocks }
}

// ── Zipline builder ──────────────────────────────────────────────────────────

function buildZiplines(
  cx: number, cz: number,
  rng: SeededRandom,
  heightGrid: Float32Array,
  group: THREE.Group,
  matCache: MaterialCache,
  scene: THREE.Scene,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[]; anchors: TraversalAnchor[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []
  const anchors: TraversalAnchor[] = []

  const cableMat = matCache.getLambert(0x5c3a1e)
  const postMat = matCache.getLambert(0x3a2a1a, { map: texGen.getTexture('wood', 0x3a2a1a).map })
  const platMat = matCache.getLambert(0x4a3828, { map: texGen.getTexture('wood', 0x4a3828).map })

  const count = 3 + rng.int(0, 2)

  for (let z = 0; z < count; z++) {
    // Sample two elevated points
    let h1 = -Infinity, x1 = 0, z1 = 0
    let h2 = -Infinity, x2 = 0, z2 = 0

    for (let probe = 0; probe < 10; probe++) {
      const lx = 4 + rng.range(0, CHUNK_SIZE - 8)
      const lz = 4 + rng.range(0, CHUNK_SIZE - 8)
      const h = sampleH(heightGrid, lx, lz)
      if (h > h1) { h2 = h1; x2 = x1; z2 = z1; h1 = h; x1 = lx; z1 = lz }
      else if (h > h2) { h2 = h; x2 = lx; z2 = lz }
    }

    const dx = x2 - x1
    const dz = z2 - z1
    const dist = Math.sqrt(dx * dx + dz * dz)
    const heightDiff = Math.abs(h1 - h2)

    if (dist < 20 || heightDiff < 8) continue

    // Post height
    const postH1 = 10
    const postH2 = 10
    const top1Y = h1 + postH1
    const top2Y = h2 + postH2

    // Posts — thick wooden poles
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, postH1, 0.8), postMat)
    post1.position.set(x1, h1 + postH1 / 2, z1)
    group.add(post1); meshes.push(post1)

    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, postH2, 0.8), postMat)
    post2.position.set(x2, h2 + postH2 / 2, z2)
    group.add(post2); meshes.push(post2)

    // Platforms — wider, more visible
    const plat1 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), platMat)
    plat1.position.set(x1, h1 + postH1, z1)
    group.add(plat1); meshes.push(plat1)
    walkables.push({ minX: x1 - 1.5, maxX: x1 + 1.5, minZ: z1 - 1.5, maxZ: z1 + 1.5, y: h1 + postH1 + 0.25 })

    const plat2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), platMat)
    plat2.position.set(x2, h2 + postH2, z2)
    group.add(plat2); meshes.push(plat2)
    walkables.push({ minX: x2 - 1.5, maxX: x2 + 1.5, minZ: z2 - 1.5, maxZ: z2 + 1.5, y: h2 + postH2 + 0.25 })

    // Cable with catenary
    const cablePoints: THREE.Vector3[] = []
    const worldX = cx * CHUNK_SIZE
    const worldZ = cz * CHUNK_SIZE
    const segments = 15
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const px = x1 + dx * t
      const pz = z1 + dz * t
      const py = top1Y + (top2Y - top1Y) * t - Math.sin(Math.PI * t) * dist * 0.05 // sag
      cablePoints.push(new THREE.Vector3(worldX + px, py, worldZ + pz))
    }

    // Cable — box segments for visibility (Lines are often invisible at distance)
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments
      const t1 = (i + 1) / segments
      const px0 = x1 + dx * t0, pz0 = z1 + dz * t0
      const py0 = top1Y + (top2Y - top1Y) * t0 - Math.sin(Math.PI * t0) * dist * 0.05
      const px1 = x1 + dx * t1, pz1 = z1 + dz * t1
      const py1 = top1Y + (top2Y - top1Y) * t1 - Math.sin(Math.PI * t1) * dist * 0.05
      const segLen = Math.sqrt((px1 - px0) ** 2 + (py1 - py0) ** 2 + (pz1 - pz0) ** 2)
      const cableSeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, segLen),
        cableMat,
      )
      cableSeg.position.set((px0 + px1) / 2, (py0 + py1) / 2, (pz0 + pz1) / 2)
      // lookAt needs world-space target; add group offset
      const gp = group.position
      cableSeg.lookAt(gp.x + px1, gp.y + py1, gp.z + pz1)
      group.add(cableSeg)
      meshes.push(cableSeg)
    }

    // Invisible anchor meshes for interaction
    const anchorGeo = new THREE.BoxGeometry(2, 2, 2)
    const anchorMat = new THREE.MeshBasicMaterial({ visible: false })

    const anchor1 = new THREE.Mesh(anchorGeo, anchorMat)
    anchor1.position.set(x1, h1 + postH1 + 1, z1)
    anchor1.userData.type = 'zipline'
    anchor1.userData.cablePoints = cablePoints
    group.add(anchor1)
    meshes.push(anchor1)

    const anchor2 = new THREE.Mesh(anchorGeo, anchorMat)
    anchor2.position.set(x2, h2 + postH2 + 1, z2)
    anchor2.userData.type = 'zipline'
    anchor2.userData.cablePoints = [...cablePoints].reverse()
    group.add(anchor2)
    meshes.push(anchor2)

    // Track anchors for Engine-level interaction
    anchors.push({
      type: 'zipline',
      mesh: anchor1,
      startPos: new THREE.Vector3(worldX + x1, h1 + postH1, worldZ + z1),
      endPos: new THREE.Vector3(worldX + x2, h2 + postH2, worldZ + z2),
      cablePoints,
    })
    anchors.push({
      type: 'zipline',
      mesh: anchor2,
      startPos: new THREE.Vector3(worldX + x2, h2 + postH2, worldZ + z2),
      endPos: new THREE.Vector3(worldX + x1, h1 + postH1, worldZ + z1),
      cablePoints: [...cablePoints].reverse(),
    })
  }

  return { meshes, walkables, anchors }
}

// ── Vine builder ─────────────────────────────────────────────────────────────

function buildVines(
  cx: number, cz: number,
  rng: SeededRandom,
  heightGrid: Float32Array,
  group: THREE.Group,
  matCache: MaterialCache,
  scene: THREE.Scene,
): { meshes: THREE.Object3D[]; anchors: TraversalAnchor[] } {
  const meshes: THREE.Object3D[] = []
  const anchors: TraversalAnchor[] = []

  const vineTrunkMat = matCache.getLambert(0x3a5520, { map: texGen.getTexture('vine', 0x3a5520).map })
  const leafMat = matCache.getLambert(0x228822)

  const count = 3 + rng.int(0, 2)

  for (let v = 0; v < count; v++) {
    const lx = 6 + rng.range(0, CHUNK_SIZE - 12)
    const lz = 6 + rng.range(0, CHUNK_SIZE - 12)
    const h = sampleH(heightGrid, lx, lz)
    if (h < 5) continue

    const vineHeight = 12
    const topY = h + vineHeight
    const grabY = h + 3
    const ropeLen = topY - grabY

    // Vine rope — thick cylinder-like box for visibility
    const rope = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, ropeLen, 0.4),
      vineTrunkMat,
    )
    rope.position.set(lx, grabY + ropeLen / 2, lz)
    group.add(rope)
    meshes.push(rope)

    // Horizontal branch at top
    const branch = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.3, 0.3),
      vineTrunkMat,
    )
    branch.position.set(lx, topY, lz)
    group.add(branch)
    meshes.push(branch)

    // Leaf cluster at grab point — larger and more visible
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(1.5 + rng.range(0, 0.8), 0.3, 1.5 + rng.range(0, 0.8)),
        leafMat,
      )
      leaf.position.set(
        lx + rng.range(-0.8, 0.8),
        grabY + rng.range(-0.5, 0.5),
        lz + rng.range(-0.8, 0.8),
      )
      leaf.rotation.set(rng.range(-0.3, 0.3), rng.range(0, Math.PI), rng.range(-0.3, 0.3))
      group.add(leaf)
      meshes.push(leaf)
    }

    // Invisible anchor for interaction
    const anchorGeo = new THREE.BoxGeometry(2, 2, 2)
    const anchorMat = new THREE.MeshBasicMaterial({ visible: false })
    const anchor = new THREE.Mesh(anchorGeo, anchorMat)
    anchor.position.set(lx, grabY, lz)
    anchor.userData.type = 'vine'
    group.add(anchor)
    meshes.push(anchor)

    const worldX = cx * CHUNK_SIZE
    const worldZ = cz * CHUNK_SIZE

    anchors.push({
      type: 'vine',
      mesh: anchor,
      startPos: new THREE.Vector3(worldX + lx, grabY, worldZ + lz),
      endPos: new THREE.Vector3(worldX + lx, topY, worldZ + lz),
      vineTop: new THREE.Vector3(worldX + lx, topY, worldZ + lz),
      ropeLength: vineHeight - 3,
    })
  }

  return { meshes, anchors }
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
