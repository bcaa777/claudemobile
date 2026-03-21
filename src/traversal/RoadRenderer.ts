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
  w: number
  h: number
  elevated: boolean
  stepping: boolean
  emissive?: number
  wide: boolean
}

function getStyleForBiome(biome: BiomeType): SlabStyle {
  switch (biome) {
    case BiomeType.Forest:
    case BiomeType.Taiga:
    case BiomeType.Jungle:
    case BiomeType.Bog:
      return { color: 0x8a6838, tex: 'sand', w: 5, h: 0.5, elevated: false, stepping: false, wide: false }

    case BiomeType.Desert:
    case BiomeType.Mesa:
    case BiomeType.Savanna:
    case BiomeType.Badlands:
    case BiomeType.Oasis:
      return { color: 0x908070, tex: 'stone', w: 6, h: 0.6, elevated: false, stepping: false, wide: true }

    case BiomeType.Swamp:
    case BiomeType.CoralReef:
      return { color: 0x7a5228, tex: 'wood', w: 4, h: 0.4, elevated: true, stepping: false, wide: false }

    case BiomeType.Volcanic:
    case BiomeType.Hell:
      return { color: 0x3a1810, tex: 'stone', w: 3.5, h: 0.7, elevated: false, stepping: true, wide: false }

    case BiomeType.Snow:
    case BiomeType.Tundra:
    case BiomeType.Alpine:
    case BiomeType.Cliffs:
      return { color: 0x9aa8b8, tex: 'stone', w: 5.5, h: 0.6, elevated: false, stepping: false, wide: true }

    case BiomeType.Crystal:
    case BiomeType.Mushroom:
    case BiomeType.AshWastes:
      return { color: 0x8a8a98, tex: 'stone', w: 5.5, h: 0.6, elevated: false, stepping: false, wide: true }

    case BiomeType.Heaven:
      return { color: 0xeeeeff, tex: 'stone', w: 6, h: 0.5, elevated: false, stepping: false, emissive: 0x556688, wide: true }

    case BiomeType.FloatingIslands:
      return { color: 0x808080, tex: 'stone', w: 4, h: 0.8, elevated: false, stepping: true, wide: false }

    default:
      return { color: 0x7a7060, tex: 'stone', w: 5, h: 0.5, elevated: false, stepping: false, wide: false }
  }
}

/**
 * Builds road slab meshes for a chunk's share of road waypoints.
 * Returns meshes to add to extras[] and walkable boxes.
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

  if (waypoints.length === 0) return { meshes, walkables }

  const chunkX = cx * CHUNK_SIZE
  const chunkZ = cz * CHUNK_SIZE

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]

    // Skip stepping stones with gaps (every other)
    const style = getStyleForBiome(wp.biome)
    if (style.stepping && i % 2 === 1) continue

    // Biome-boundary blending: alternate materials
    const blend = biomeMap.getBlend(wp.x, wp.z)
    let effectiveStyle = style
    if (blend.blend > 0.2 && blend.primary !== blend.secondary && i % 2 === 1) {
      effectiveStyle = getStyleForBiome(blend.secondary)
    }

    // Local coords within chunk
    const lx = wp.x - chunkX
    const lz = wp.z - chunkZ

    const matOpts: Record<string, unknown> = {
      map: texGen.getTexture(effectiveStyle.tex, effectiveStyle.color).map,
    }
    if (effectiveStyle.emissive) {
      matOpts.emissive = new THREE.Color(effectiveStyle.emissive)
      matOpts.emissiveIntensity = 0.3
    }
    const mat = matCache.getLambert(effectiveStyle.color, matOpts)

    // Elevated walkway mode (terrain below water)
    if (effectiveStyle.elevated || wp.y < WATER_LEVEL) {
      const deckY = WATER_LEVEL + 0.5
      const postMat = matCache.getLambert(0x3a2010, { map: texGen.getTexture('wood', 0x3a2010).map })
      const plankMat = matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })

      // Plank
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(effectiveStyle.w, 0.15, effectiveStyle.w),
        plankMat,
      )
      plank.position.set(lx, deckY, lz)
      group.add(plank)
      meshes.push(plank)
      walkables.push({
        minX: lx - effectiveStyle.w / 2, maxX: lx + effectiveStyle.w / 2,
        minZ: lz - effectiveStyle.w / 2, maxZ: lz + effectiveStyle.w / 2,
        y: deckY + 0.08,
      })

      // Support posts
      const postH = deckY - wp.y + 1
      if (postH > 0.5) {
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, postH, 0.2),
            postMat,
          )
          post.position.set(lx + sx * (effectiveStyle.w / 2 - 0.3), deckY - postH / 2, lz)
          group.add(post)
          meshes.push(post)
        }
      }
      continue
    }

    // Normal slab — raised 0.3 above terrain to be clearly visible
    const slabY = wp.y + 0.3 + effectiveStyle.h / 2
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(effectiveStyle.w, effectiveStyle.h, effectiveStyle.w),
      mat,
    )
    slab.position.set(lx, slabY, lz)
    group.add(slab)
    meshes.push(slab)

    const halfW = effectiveStyle.w / 2
    walkables.push({
      minX: lx - halfW, maxX: lx + halfW,
      minZ: lz - halfW, maxZ: lz + halfW,
      y: slabY + effectiveStyle.h / 2,
    })

    // Edge curb stones — small raised edges on sides of slab
    if (!effectiveStyle.stepping) {
      const curbH = effectiveStyle.h * 0.6
      const curbW = 0.3
      const curbMat = matCache.getLambert(
        effectiveStyle.color + 0x101010,
        { map: texGen.getTexture(effectiveStyle.tex, effectiveStyle.color + 0x101010).map },
      )

      // Determine road direction for curb placement
      let perpX = 0, perpZ = 1
      if (i > 0) {
        perpX = -(wp.z - waypoints[i - 1].z)
        perpZ = wp.x - waypoints[i - 1].x
      } else if (i < waypoints.length - 1) {
        perpX = -(waypoints[i + 1].z - wp.z)
        perpZ = waypoints[i + 1].x - wp.x
      }
      const pLen = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1
      perpX /= pLen; perpZ /= pLen

      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(curbW, curbH + effectiveStyle.h, effectiveStyle.w * 0.9),
          curbMat,
        )
        curb.position.set(
          lx + perpX * halfW * side,
          slabY + curbH / 2,
          lz + perpZ * halfW * side,
        )
        group.add(curb)
        meshes.push(curb)
      }
    }

    // Wider roads: place parallel slab
    if (effectiveStyle.wide && !effectiveStyle.stepping) {
      // Determine road direction from neighboring waypoints
      let dirX = 0, dirZ = 1
      if (i > 0) {
        dirX = wp.x - waypoints[i - 1].x
        dirZ = wp.z - waypoints[i - 1].z
      } else if (i < waypoints.length - 1) {
        dirX = waypoints[i + 1].x - wp.x
        dirZ = waypoints[i + 1].z - wp.z
      }
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1
      // Perpendicular offset
      const perpX = -dirZ / len * 2
      const perpZ = dirX / len * 2

      const slab2 = new THREE.Mesh(
        new THREE.BoxGeometry(effectiveStyle.w, effectiveStyle.h, effectiveStyle.w),
        mat,
      )
      slab2.position.set(lx + perpX, slabY, lz + perpZ)
      group.add(slab2)
      meshes.push(slab2)
      walkables.push({
        minX: lx + perpX - halfW, maxX: lx + perpX + halfW,
        minZ: lz + perpZ - halfW, maxZ: lz + perpZ + halfW,
        y: slabY + effectiveStyle.h / 2,
      })
    }
  }

  return { meshes, walkables }
}
