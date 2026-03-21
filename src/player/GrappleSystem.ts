import * as THREE from 'three'

export class GrappleSystem {
  isGrappling = false
  private anchor = new THREE.Vector3()
  private cooldown = 0
  private line: THREE.Line | null = null
  private scene: THREE.Scene
  private lineMat: THREE.LineBasicMaterial
  private lineGeo: THREE.BufferGeometry
  private positions = new Float32Array(9) // 3 points for bezier curve

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x5c3a1e, linewidth: 2 })
    this.lineGeo = new THREE.BufferGeometry()
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
  }

  tryFire(camera: THREE.Camera, scene: THREE.Scene): boolean {
    if (this.cooldown > 0 || this.isGrappling) return false

    const raycaster = new THREE.Raycaster()
    raycaster.far = 40
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)

    const intersects = raycaster.intersectObjects(scene.children, true)
    for (const hit of intersects) {
      if (hit.distance > 2 && hit.object.type === 'Mesh') {
        this.anchor.copy(hit.point)
        this.isGrappling = true

        // Create line visual
        this.line = new THREE.Line(this.lineGeo, this.lineMat)
        this.line.frustumCulled = false
        this.scene.add(this.line)
        return true
      }
    }
    return false
  }

  release() {
    this.isGrappling = false
    this.cooldown = 0.5
    if (this.line) {
      this.scene.remove(this.line)
      this.line = null
    }
  }

  update(delta: number, playerPos: THREE.Vector3, velocity: THREE.Vector3): THREE.Vector3 | null {
    this.cooldown = Math.max(0, this.cooldown - delta)

    if (!this.isGrappling) return null

    // Check if reached anchor
    const dist = playerPos.distanceTo(this.anchor)
    if (dist < 2) {
      this.release()
      return null
    }

    // Pull toward anchor
    const dir = new THREE.Vector3().subVectors(this.anchor, playerPos).normalize()
    const pullSpeed = 15

    // Blend velocity toward grapple direction
    velocity.lerp(dir.multiplyScalar(pullSpeed), delta * 5)

    // Update line visual with slight sag (quadratic bezier)
    const mid = new THREE.Vector3().addVectors(playerPos, this.anchor).multiplyScalar(0.5)
    mid.y -= dist * 0.1 // sag

    this.positions[0] = playerPos.x
    this.positions[1] = playerPos.y
    this.positions[2] = playerPos.z
    this.positions[3] = mid.x
    this.positions[4] = mid.y
    this.positions[5] = mid.z
    this.positions[6] = this.anchor.x
    this.positions[7] = this.anchor.y
    this.positions[8] = this.anchor.z

    const attr = this.lineGeo.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true

    return dir
  }
}
