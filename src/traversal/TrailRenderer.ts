import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { MaterialCache } from '../utils/MaterialCache'
import { texGen } from '../utils/PixelTextureGenerator'
import { WATER_LEVEL, CHUNK_SIZE } from '../world/TerrainGenerator'
import type { TrailEdge, TrailStyle, TrailWaypoint } from './traversalTypes'
import type { WalkableBox } from '../world/Chunk'

// ─── Biome style lookup ───────────────────────────────────────────────────────

function getTrailStyle(biome: BiomeType): TrailStyle {
  switch (biome) {
    case BiomeType.Forest:
      return { color: 0x8a6838, tex: 'sand', w: 2.5, h: 0.2, elevated: false }
    case BiomeType.Desert:
      return { color: 0xb09868, tex: 'sand', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Jungle:
      return { color: 0x5a4020, tex: 'sand', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Swamp:
      return { color: 0x7a5228, tex: 'wood', w: 2.5, h: 0.25, elevated: true }
    case BiomeType.Volcanic:
      return { color: 0x3a3a3a, tex: 'slate', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Snow:
      return { color: 0xd8d8e0, tex: 'ice', w: 2.5, h: 0.15, elevated: false }
    case BiomeType.Crystal:
      return { color: 0x88aacc, tex: 'ice', w: 2.0, h: 0.2, elevated: false, emissive: 0x224466 }
    case BiomeType.Heaven:
      return { color: 0xeeeeff, tex: 'stone', w: 2.5, h: 0.2, elevated: false, emissive: 0x556688 }
    case BiomeType.Hell:
      return { color: 0x3a1810, tex: 'slate', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Mesa:
      return { color: 0xc08050, tex: 'sand', w: 2.5, h: 0.2, elevated: false }
    case BiomeType.CoralReef:
      return { color: 0xdd8899, tex: 'stone', w: 2.0, h: 0.25, elevated: true }
    default:
      return { color: 0x888888, tex: 'stone', w: 2.0, h: 0.2, elevated: false }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Converts TrailEdge waypoint pairs into visible ground-hugging trail geometry
 * plus walkable AABB surfaces for player collision.
 */
export function buildTrailSegments(
  cx: number,
  cz: number,
  edges: TrailEdge[],
  biomeMap: BiomeMap,
  matCache: MaterialCache,
  group: THREE.Group,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []

  for (const edge of edges) {
    const { waypoints } = edge
    if (waypoints.length < 2) continue

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a: TrailWaypoint = waypoints[i]
      const b: TrailWaypoint = waypoints[i + 1]

      // Only render segments that touch this chunk
      const aInChunk = a.cx === cx && a.cz === cz
      const bInChunk = b.cx === cx && b.cz === cz
      if (!aInChunk && !bInChunk) continue

      // Segment length guard — discontinuity detection
      const segDx = b.x - a.x
      const segDz = b.z - a.z
      const segLen = Math.sqrt(segDx * segDx + segDz * segDz)
      if (segLen > 12 || segLen < 0.5) continue

      const style = getTrailStyle(a.biome)

      // Midpoint in chunk-local coordinates
      const mx = (a.x + b.x) / 2 - cx * CHUNK_SIZE
      const mz = (a.z + b.z) / 2 - cz * CHUNK_SIZE

      // Rotation angle in XZ plane (matches RoadRenderer convention)
      const angle = Math.atan2(segDx, segDz)

      // Y position
      const avgY = (a.y + b.y) / 2
      let my: number
      if (style.elevated) {
        my = Math.max(WATER_LEVEL + 0.3, avgY) + 0.1
      } else {
        my = avgY + 0.1
      }

      // Slope tilt along travel direction
      const slopeAngle = Math.atan2(b.y - a.y, segLen)

      // Material
      const matOpts: Record<string, unknown> = {
        map: texGen.getTexture(style.tex as Parameters<typeof texGen.getTexture>[0], style.color).map,
      }
      if (style.emissive !== undefined) {
        matOpts.emissive = new THREE.Color(style.emissive)
        matOpts.emissiveIntensity = 0.3
      }
      const mat = matCache.getLambert(style.color, matOpts as Parameters<MaterialCache['getLambert']>[1])

      const trailW = style.w
      const trailH = style.h

      // Trail plank — narrow elongated box
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(trailW, trailH, segLen + 0.5),
        mat,
      )
      plank.position.set(mx, my + trailH / 2, mz)
      plank.rotation.y = angle
      plank.rotation.x = slopeAngle
      group.add(plank)
      meshes.push(plank)

      // Walkable AABB — conservative axis-aligned bounding box for the rotated rect
      const cos = Math.abs(Math.cos(angle))
      const sin = Math.abs(Math.sin(angle))
      const aabbHalfX = (trailW / 2) * cos + ((segLen + 0.5) / 2) * sin
      const aabbHalfZ = (trailW / 2) * sin + ((segLen + 0.5) / 2) * cos

      // WalkableBox uses chunk-local coords (same as RoadRenderer)
      walkables.push({
        minX: mx - aabbHalfX,
        maxX: mx + aabbHalfX,
        minZ: mz - aabbHalfZ,
        maxZ: mz + aabbHalfZ,
        y: my + trailH,
      })

      // Support post for elevated segments raised well above terrain
      if (style.elevated && my > a.y + 1) {
        const postH = my - a.y + trailH
        const postMat = matCache.getLambert(0x5a3a1a, {
          map: texGen.getTexture('wood', 0x5a3a1a).map,
        })
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, postH, 0.3),
          postMat,
        )
        post.position.set(mx, my - postH / 2, mz)
        group.add(post)
        meshes.push(post)
      }
    }
  }

  return { meshes, walkables }
}
