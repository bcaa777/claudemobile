import * as THREE from 'three'
import { MaterialCache } from '../utils/MaterialCache'
import { texGen } from '../utils/PixelTextureGenerator'
import { SeededRandom } from '../utils/SeededRandom'
import { WATER_LEVEL, CHUNK_SIZE } from '../world/TerrainGenerator'
import type { LavaRockState } from './traversalTypes'
import type { WalkableBox } from '../world/Chunk'

const ROCK_COLOR = 0x2a1008
const ROCK_SIZE = 3
const ROCK_HEIGHT = 1.5
const SINK_RATE = 0.5
const RESET_DELAY = 5

/**
 * Places dark stone platforms over lava pools (terrain below WATER_LEVEL).
 */
export function buildLavaRocks(
  cx: number,
  cz: number,
  rng: SeededRandom,
  heightGrid: Float32Array,
  group: THREE.Group,
  matCache: MaterialCache,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[]; rocks: LavaRockState[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []
  const rocks: LavaRockState[] = []

  const mat = matCache.getLambert(ROCK_COLOR, {
    map: texGen.getTexture('stone', ROCK_COLOR).map,
    emissive: new THREE.Color(0x331100),
    emissiveIntensity: 0.2,
  })

  const count = 3 + rng.int(0, 2) // 3-5 clusters

  for (let c = 0; c < count; c++) {
    // Find a lava pool location (below WATER_LEVEL)
    let found = false
    let startX = 0, startZ = 0
    for (let attempt = 0; attempt < 12; attempt++) {
      const lx = 6 + rng.range(0, CHUNK_SIZE - 12)
      const lz = 6 + rng.range(0, CHUNK_SIZE - 12)
      const h = sampleH(heightGrid, lx, lz)
      if (h < WATER_LEVEL - 0.5) {
        startX = lx
        startZ = lz
        found = true
        break
      }
    }
    if (!found) continue

    // Place 4-6 rocks in a rough cluster
    const numRocks = 4 + rng.int(0, 2)
    for (let r = 0; r < numRocks; r++) {
      const lx = startX + rng.range(-12, 12)
      const lz = startZ + rng.range(-12, 12)
      if (lx < 2 || lx > CHUNK_SIZE - 2 || lz < 2 || lz > CHUNK_SIZE - 2) continue

      const h = sampleH(heightGrid, lx, lz)
      if (h >= WATER_LEVEL) continue // Only over lava

      const baseY = WATER_LEVEL + 0.5
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(ROCK_SIZE, ROCK_HEIGHT, ROCK_SIZE),
        mat,
      )
      mesh.position.set(lx, baseY, lz)
      group.add(mesh)
      meshes.push(mesh)

      const halfW = ROCK_SIZE / 2
      walkables.push({
        minX: lx - halfW, maxX: lx + halfW,
        minZ: lz - halfW, maxZ: lz + halfW,
        y: baseY + ROCK_HEIGHT / 2,
      })

      rocks.push({
        mesh,
        baseY,
        sinkTimer: 0,
        resetting: false,
        resetTimer: 0,
      })
    }
  }

  return { meshes, walkables, rocks }
}

/**
 * Tick sinking/resetting animation for lava rocks.
 * playerLX/playerLZ are in chunk-local coords.
 */
export function updateLavaRocks(
  rocks: LavaRockState[],
  delta: number,
  playerLX: number,
  playerLZ: number,
) {
  const STAND_RADIUS = ROCK_SIZE / 2 + 0.5

  for (const rock of rocks) {
    const dx = playerLX - rock.mesh.position.x
    const dz = playerLZ - rock.mesh.position.z
    const onRock = Math.abs(dx) < STAND_RADIUS && Math.abs(dz) < STAND_RADIUS &&
      rock.mesh.position.y > rock.baseY - 2

    if (onRock) {
      rock.resetting = false
      rock.resetTimer = 0
      rock.sinkTimer += delta
      if (rock.sinkTimer > 3) {
        // Sink
        rock.mesh.position.y -= SINK_RATE * delta
      }
    } else {
      if (rock.sinkTimer > 0 && !rock.resetting) {
        rock.resetting = true
        rock.resetTimer = 0
      }
      if (rock.resetting) {
        rock.resetTimer += delta
        if (rock.resetTimer > RESET_DELAY) {
          // Reset position
          rock.mesh.position.y += 2 * delta
          if (rock.mesh.position.y >= rock.baseY) {
            rock.mesh.position.y = rock.baseY
            rock.resetting = false
            rock.sinkTimer = 0
            rock.resetTimer = 0
          }
        }
      }
    }
  }
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
