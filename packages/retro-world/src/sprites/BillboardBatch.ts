import * as THREE from 'three'
import { createSpriteMaterial } from './SpriteShader'

// Cross-plane geometry: two quads at 90° for volumetric look
function createCrossGeo(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()

  // Plane 1: facing Z (standard billboard plane)
  // Plane 2: facing X (rotated 90° around Y)
  const positions = new Float32Array([
    // Plane 1 (Z-facing): two triangles
    -0.5, -0.5, 0,    0.5, -0.5, 0,    0.5,  0.5, 0,
    -0.5, -0.5, 0,    0.5,  0.5, 0,   -0.5,  0.5, 0,
    // Plane 2 (X-facing): two triangles
     0, -0.5, -0.5,   0, -0.5,  0.5,   0,  0.5,  0.5,
     0, -0.5, -0.5,   0,  0.5,  0.5,   0,  0.5, -0.5,
  ])

  const uvs = new Float32Array([
    // Plane 1
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
    // Plane 2 (same UVs)
    0, 0,  1, 0,  1, 1,
    0, 0,  1, 1,  0, 1,
  ])

  const normals = new Float32Array([
    // Plane 1: normal = +Z
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Plane 2: normal = +X
    1, 0, 0,  1, 0, 0,  1, 0, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,
  ])

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geo
}

const _sharedCrossGeo = createCrossGeo()
const _sharedPlaneGeo = new THREE.PlaneGeometry(1, 1)  // kept for decals

interface SpriteEntry {
  x: number
  y: number
  z: number
  scale: number
  seed?: number
}

export class BillboardBatch {
  readonly mesh: THREE.InstancedMesh
  private entries: SpriteEntry[]
  private isBillboard: boolean
  private lastYaw = NaN  // cache to skip redundant updates

  constructor(
    texture: THREE.CanvasTexture,
    sprites: SpriteEntry[],
    billboard: boolean,
  ) {
    this.entries = sprites
    this.isBillboard = billboard

    const mat = createSpriteMaterial(texture, !billboard)

    const baseGeo = billboard ? _sharedCrossGeo : _sharedPlaneGeo
    this.mesh = new THREE.InstancedMesh(baseGeo, mat, sprites.length)
    // Clone geometry so aSeed attribute is per-batch (not shared globally)
    this.mesh.geometry = baseGeo.clone()
    const seedArray = new Float32Array(sprites.length)
    for (let i = 0; i < sprites.length; i++) {
      seedArray[i] = sprites[i].seed ?? (sprites[i].x * 127.1 + sprites[i].z * 311.7)
    }
    this.mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArray, 1))
    this.mesh.frustumCulled = false

    // Write initial matrices directly (column-major Float32Array)
    const array = this.mesh.instanceMatrix.array as Float32Array
    if (!billboard) {
      // Ground decals: flat on ground (rotation around X by -PI/2)
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i]
        const sc = s.scale
        const j = i * 16
        array[j]    = sc;  array[j+1]  = 0;   array[j+2]  = 0;   array[j+3]  = 0
        array[j+4]  = 0;   array[j+5]  = 0;   array[j+6]  = -sc; array[j+7]  = 0
        array[j+8]  = 0;   array[j+9]  = sc;  array[j+10] = 0;   array[j+11] = 0
        array[j+12] = s.x; array[j+13] = s.y + 0.05; array[j+14] = s.z; array[j+15] = 1
      }
    } else {
      // Cross-plane billboards: static Y-rotation per instance for variety
      // No per-frame billboard update needed — cross geometry is visible from all angles
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i]
        const sc = s.scale
        // Per-instance random Y rotation so crosses aren't all axis-aligned
        const yaw = (s.seed ?? (s.x * 127.1 + s.z * 311.7)) * 2.3
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        const cs = cosY * sc
        const ss = sinY * sc
        const j = i * 16
        array[j]    = cs;  array[j+1]  = 0;   array[j+2]  = -ss; array[j+3]  = 0
        array[j+4]  = 0;   array[j+5]  = sc;  array[j+6]  = 0;   array[j+7]  = 0
        array[j+8]  = ss;  array[j+9]  = 0;   array[j+10] = cs;  array[j+11] = 0
        array[j+12] = s.x; array[j+13] = s.y + sc * 0.5; array[j+14] = s.z; array[j+15] = 1
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Cross-plane sprites don't need per-frame billboard rotation.
   * Method kept for API compatibility — called by Chunk.update() but does nothing.
   */
  updateBillboard(_cameraX: number, _cameraZ: number, _chunkCenterX: number, _chunkCenterZ: number) {
    // Cross-plane geometry is visible from all angles — no rotation needed
  }

  dispose() {
    this.mesh.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
