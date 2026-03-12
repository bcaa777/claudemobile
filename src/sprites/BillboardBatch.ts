import * as THREE from 'three'

const _sharedGeo = new THREE.PlaneGeometry(1, 1)

interface SpriteEntry {
  x: number
  y: number
  z: number
  scale: number
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

    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true,
    })

    this.mesh = new THREE.InstancedMesh(_sharedGeo, mat, sprites.length)
    this.mesh.frustumCulled = false

    // Write initial matrices directly (column-major Float32Array)
    const array = this.mesh.instanceMatrix.array as Float32Array
    if (!billboard) {
      // Ground decals: flat on ground (rotation around X by -PI/2)
      // Rotation matrix for X-axis -90deg: row-major [1,0,0; 0,0,1; 0,-1,0]
      // Column-major with scale:
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i]
        const sc = s.scale
        const j = i * 16
        array[j]    = sc;  array[j+1]  = 0;   array[j+2]  = 0;   array[j+3]  = 0
        array[j+4]  = 0;   array[j+5]  = 0;   array[j+6]  = -sc; array[j+7]  = 0
        array[j+8]  = 0;   array[j+9]  = sc;  array[j+10] = 0;   array[j+11] = 0
        array[j+12] = s.x; array[j+13] = s.y + 0.05; array[j+14] = s.z; array[j+15] = 1
      }
      this.mesh.instanceMatrix.needsUpdate = true
    }
  }

  /**
   * Approximate billboard: single yaw for entire batch.
   * Writes rotation matrix directly as raw floats — no compose() overhead.
   * Column-major Y-axis rotation with uniform scale + translation.
   */
  updateBillboard(cameraX: number, cameraZ: number, chunkCenterX: number, chunkCenterZ: number) {
    if (!this.isBillboard) return

    const dx = cameraX - chunkCenterX
    const dz = cameraZ - chunkCenterZ
    const yaw = Math.atan2(dx, dz)

    // Skip update if rotation barely changed (~1 degree)
    if (Math.abs(yaw - this.lastYaw) < 0.017) return
    this.lastYaw = yaw

    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)
    const array = this.mesh.instanceMatrix.array as Float32Array
    const entries = this.entries

    // Column-major Y-rotation matrix with scale & translation:
    // col0: [cos*s, 0, -sin*s, 0]
    // col1: [0, s, 0, 0]
    // col2: [sin*s, 0, cos*s, 0]
    // col3: [tx, ty, tz, 1]
    for (let i = 0, len = entries.length; i < len; i++) {
      const e = entries[i]
      const sc = e.scale
      const cs = cosY * sc
      const ss = sinY * sc
      const j = i * 16
      array[j]    = cs;  array[j+1]  = 0;   array[j+2]  = -ss; array[j+3]  = 0
      array[j+4]  = 0;   array[j+5]  = sc;  array[j+6]  = 0;   array[j+7]  = 0
      array[j+8]  = ss;  array[j+9]  = 0;   array[j+10] = cs;  array[j+11] = 0
      array[j+12] = e.x; array[j+13] = e.y + sc * 0.5; array[j+14] = e.z; array[j+15] = 1
    }

    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.mesh.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
