import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { MaterialCache } from '../utils/MaterialCache'
import { texGen } from '../utils/PixelTextureGenerator'
import { WATER_LEVEL, CHUNK_SIZE } from '../world/TerrainGenerator'
import type { RoadWaypoint } from './traversalTypes'
import type { WalkableBox } from '../world/Chunk'

interface SlabStyle {
  color: number
  tex: 'stone' | 'wood' | 'sand'
  w: number         // road width
  h: number         // slab thickness
  elevated: boolean // wooden walkway mode
  stepping: boolean // gaps between slabs
  emissive?: number
  wide: boolean     // double-width road
  curbColor: number // curb edge color
}

function getStyleForBiome(biome: BiomeType): SlabStyle {
  switch (biome) {
    case BiomeType.Forest:
    case BiomeType.Taiga:
    case BiomeType.Jungle:
    case BiomeType.Bog:
      return { color: 0x8a6838, tex: 'sand', w: 5, h: 0.5, elevated: false, stepping: false, wide: false, curbColor: 0x6a4820 }

    case BiomeType.Desert:
    case BiomeType.Mesa:
    case BiomeType.Savanna:
    case BiomeType.Badlands:
    case BiomeType.Oasis:
      return { color: 0x908070, tex: 'stone', w: 6, h: 0.55, elevated: false, stepping: false, wide: true, curbColor: 0x706050 }

    case BiomeType.Swamp:
    case BiomeType.CoralReef:
      return { color: 0x7a5228, tex: 'wood', w: 4, h: 0.4, elevated: true, stepping: false, wide: false, curbColor: 0x5a3210 }

    case BiomeType.Volcanic:
    case BiomeType.Hell:
      return { color: 0x3a1810, tex: 'stone', w: 3.5, h: 0.7, elevated: false, stepping: true, wide: false, curbColor: 0x2a1008 }

    case BiomeType.Snow:
    case BiomeType.Tundra:
    case BiomeType.Alpine:
    case BiomeType.Cliffs:
      return { color: 0x9aa8b8, tex: 'stone', w: 5.5, h: 0.55, elevated: false, stepping: false, wide: true, curbColor: 0x7a8898 }

    case BiomeType.Crystal:
    case BiomeType.Mushroom:
    case BiomeType.AshWastes:
      return { color: 0x8a8a98, tex: 'stone', w: 5.5, h: 0.55, elevated: false, stepping: false, wide: true, curbColor: 0x6a6a78 }

    case BiomeType.Heaven:
      return { color: 0xeeeeff, tex: 'stone', w: 6, h: 0.5, elevated: false, stepping: false, emissive: 0x556688, wide: true, curbColor: 0xccccdd }

    case BiomeType.FloatingIslands:
      return { color: 0x808080, tex: 'stone', w: 4, h: 0.8, elevated: false, stepping: true, wide: false, curbColor: 0x606060 }

    default:
      return { color: 0x7a7060, tex: 'stone', w: 5, h: 0.5, elevated: false, stepping: false, wide: false, curbColor: 0x5a5040 }
  }
}

/** Minimum float height above terrain — road gently hovers */
const FLOAT_MIN = 0.4
/** Extra smoothing: road Y never drops more than this per waypoint step */
const MAX_Y_DROP_PER_STEP = 1.5

/**
 * Builds road plank meshes spanning between consecutive waypoints.
 * Roads float gently above terrain for smooth walking.
 */
export function buildRoadSegments(
  cx: number,
  cz: number,
  waypoints: RoadWaypoint[],
  biomeMap: BiomeMap,
  matCache: MaterialCache,
  group: THREE.Group,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []

  if (waypoints.length < 2) return { meshes, walkables }

  const chunkX = cx * CHUNK_SIZE
  const chunkZ = cz * CHUNK_SIZE

  // ── First pass: compute smooth floating Y for each waypoint ──────────
  // Road Y = max(terrain + FLOAT_MIN, previous_Y - MAX_Y_DROP_PER_STEP)
  // This means the road floats above dips and descends gently on slopes.
  const smoothY = new Float64Array(waypoints.length)

  // Forward pass: gentle descent
  smoothY[0] = waypoints[0].y + FLOAT_MIN
  for (let i = 1; i < waypoints.length; i++) {
    const terrainFloor = waypoints[i].y + FLOAT_MIN
    const gentleDescent = smoothY[i - 1] - MAX_Y_DROP_PER_STEP
    smoothY[i] = Math.max(terrainFloor, gentleDescent)
  }
  // Backward pass: gentle ascent (prevents steep ramps going the other direction)
  for (let i = waypoints.length - 2; i >= 0; i--) {
    const gentleAscent = smoothY[i + 1] - MAX_Y_DROP_PER_STEP
    smoothY[i] = Math.max(smoothY[i], gentleAscent)
  }

  // ── Second pass: build elongated planks between pairs ────────────────
  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp0 = waypoints[i]
    const wp1 = waypoints[i + 1]

    const style = getStyleForBiome(wp0.biome)

    // Stepping stones: skip every other
    if (style.stepping && i % 2 === 1) continue

    // Biome-boundary blending
    const blend = biomeMap.getBlend(wp0.x, wp0.z)
    let effectiveStyle = style
    if (blend.blend > 0.2 && blend.primary !== blend.secondary && i % 2 === 1) {
      effectiveStyle = getStyleForBiome(blend.secondary)
    }

    const lx0 = wp0.x - chunkX
    const lz0 = wp0.z - chunkZ
    const lx1 = wp1.x - chunkX
    const lz1 = wp1.z - chunkZ

    const y0 = smoothY[i]
    const y1 = smoothY[i + 1]

    // Direction and length of this segment
    const dx = lx1 - lx0
    const dz = lz1 - lz0
    const segLen = Math.sqrt(dx * dx + dz * dz)
    if (segLen < 0.5) continue

    // Midpoint
    const mx = (lx0 + lx1) / 2
    const mz = (lz0 + lz1) / 2
    const my = (y0 + y1) / 2

    // Angle in XZ plane
    const angle = Math.atan2(dx, dz)

    // Slope angle
    const slopeAngle = Math.atan2(y1 - y0, segLen)

    const matOpts: Record<string, unknown> = {
      map: texGen.getTexture(effectiveStyle.tex, effectiveStyle.color).map,
    }
    if (effectiveStyle.emissive) {
      matOpts.emissive = new THREE.Color(effectiveStyle.emissive)
      matOpts.emissiveIntensity = 0.3
    }
    const mat = matCache.getLambert(effectiveStyle.color, matOpts)

    const roadW = effectiveStyle.wide ? effectiveStyle.w * 1.5 : effectiveStyle.w

    // Elevated walkway mode (terrain below water)
    if (effectiveStyle.elevated || Math.min(wp0.y, wp1.y) < WATER_LEVEL) {
      buildElevatedSegment(
        mx, mz, segLen, angle, effectiveStyle, matCache, group, meshes, walkables,
        Math.min(wp0.y, wp1.y),
      )
      continue
    }

    // ── Road plank: elongated box along road direction ──
    // Extra length overlap (+1) to fill gaps between segments
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(roadW, effectiveStyle.h, segLen + 1),
      mat,
    )
    plank.position.set(mx, my + effectiveStyle.h / 2, mz)
    plank.rotation.y = angle
    plank.rotation.x = slopeAngle
    group.add(plank)
    meshes.push(plank)

    // Walkable AABB — axis-aligned bounding box covering the rotated plank
    const halfW = roadW / 2
    const halfL = (segLen + 1) / 2
    // Conservative AABB for rotated rect
    const cos = Math.abs(Math.cos(angle))
    const sin = Math.abs(Math.sin(angle))
    const aabbHalfX = halfW * cos + halfL * sin
    const aabbHalfZ = halfW * sin + halfL * cos
    walkables.push({
      minX: mx - aabbHalfX, maxX: mx + aabbHalfX,
      minZ: mz - aabbHalfZ, maxZ: mz + aabbHalfZ,
      y: my + effectiveStyle.h,
    })

    // ── Curb edges ──
    if (!effectiveStyle.stepping) {
      const curbMat = matCache.getLambert(effectiveStyle.curbColor, {
        map: texGen.getTexture(effectiveStyle.tex, effectiveStyle.curbColor).map,
      })
      const curbH = effectiveStyle.h * 0.5
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, curbH + effectiveStyle.h, segLen + 1),
          curbMat,
        )
        curb.position.set(
          mx + Math.cos(angle) * halfW * side,
          my + effectiveStyle.h / 2 + curbH / 2,
          mz - Math.sin(angle) * halfW * side,
        )
        curb.rotation.y = angle
        curb.rotation.x = slopeAngle
        group.add(curb)
        meshes.push(curb)
      }
    }

    // ── Support posts where road floats high above terrain ──
    const floatHeight = my - Math.max(wp0.y, wp1.y)
    if (floatHeight > 2 && i % 3 === 0) {
      const postMat = matCache.getLambert(0x3a2a1a, { map: texGen.getTexture('wood', 0x3a2a1a).map })
      const postH = floatHeight + effectiveStyle.h
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, postH, 0.6),
        postMat,
      )
      post.position.set(mx, my - floatHeight / 2, mz)
      group.add(post)
      meshes.push(post)
    }
  }

  return { meshes, walkables }
}

function buildElevatedSegment(
  mx: number, mz: number,
  segLen: number, angle: number,
  style: SlabStyle,
  matCache: MaterialCache,
  group: THREE.Group,
  meshes: THREE.Object3D[],
  walkables: WalkableBox[],
  terrainY: number,
) {
  const deckY = WATER_LEVEL + 0.5
  const postMat = matCache.getLambert(0x3a2010, { map: texGen.getTexture('wood', 0x3a2010).map })
  const plankMat = matCache.getLambert(0x7a5228, { map: texGen.getTexture('wood', 0x7a5228).map })

  // Plank spanning segment
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(style.w, 0.2, segLen + 1),
    plankMat,
  )
  plank.position.set(mx, deckY, mz)
  plank.rotation.y = angle
  group.add(plank)
  meshes.push(plank)

  // AABB
  const halfW = style.w / 2
  const halfL = (segLen + 1) / 2
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  walkables.push({
    minX: mx - (halfW * cos + halfL * sin),
    maxX: mx + (halfW * cos + halfL * sin),
    minZ: mz - (halfW * sin + halfL * cos),
    maxZ: mz + (halfW * sin + halfL * cos),
    y: deckY + 0.1,
  })

  // Railings
  const railMat = matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 1.2, segLen + 1),
      railMat,
    )
    rail.position.set(
      mx + Math.cos(angle) * halfW * side,
      deckY + 0.6,
      mz - Math.sin(angle) * halfW * side,
    )
    rail.rotation.y = angle
    group.add(rail)
    meshes.push(rail)
  }

  // Support posts
  const postH = deckY - terrainY + 1
  if (postH > 0.5) {
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, postH, 0.3),
        postMat,
      )
      post.position.set(
        mx + Math.cos(angle) * (halfW - 0.3) * sx,
        deckY - postH / 2,
        mz - Math.sin(angle) * (halfW - 0.3) * sx,
      )
      group.add(post)
      meshes.push(post)
    }
  }
}
