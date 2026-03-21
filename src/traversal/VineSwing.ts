import * as THREE from 'three'

export class VineSwing {
  state: 'idle' | 'swinging' | 'launched' = 'idle'
  private vineTop = new THREE.Vector3()
  private ropeLength = 0
  private angle = 0
  private angularVelocity = 0
  private line: THREE.Line | null = null
  private lineMat: THREE.LineBasicMaterial
  private lineGeo: THREE.BufferGeometry
  private scene: THREE.Scene
  private launchVelocity = new THREE.Vector3()

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x336622, linewidth: 2 })
    this.lineGeo = new THREE.BufferGeometry()
  }

  start(vineTop: THREE.Vector3, ropeLength: number) {
    this.vineTop.copy(vineTop)
    this.ropeLength = ropeLength
    this.angle = 0
    this.angularVelocity = 0
    this.state = 'swinging'

    const positions = new Float32Array(6)
    this.lineGeo = new THREE.BufferGeometry()
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.line = new THREE.Line(this.lineGeo, this.lineMat)
    this.line.frustumCulled = false
    this.scene.add(this.line)
  }

  /**
   * Returns new player position, or null if not swinging.
   * lateralInput: -1 (left/A), 0, +1 (right/D)
   */
  update(delta: number, playerPos: THREE.Vector3, lateralInput: number, releasePressed: boolean): { pos: THREE.Vector3; velocity: THREE.Vector3 } | null {
    if (this.state !== 'swinging') return null

    // Pendulum physics
    const gravity = 9.8
    const angularAccel = -(gravity / this.ropeLength) * Math.sin(this.angle)
    this.angularVelocity += angularAccel * delta
    this.angularVelocity += lateralInput * 2.0 * delta // player input
    this.angularVelocity *= 0.995 // damping
    this.angle += this.angularVelocity * delta

    // Clamp angle
    this.angle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.angle))

    // Position on pendulum arc
    const pos = new THREE.Vector3(
      this.vineTop.x + Math.sin(this.angle) * this.ropeLength,
      this.vineTop.y - Math.cos(this.angle) * this.ropeLength,
      this.vineTop.z,
    )

    // Tangent velocity for launch
    const tangentSpeed = this.angularVelocity * this.ropeLength
    this.launchVelocity.set(
      Math.cos(this.angle) * tangentSpeed,
      Math.sin(this.angle) * Math.abs(tangentSpeed) * 0.5 + 5, // upward boost
      0,
    )

    // Update line visual
    if (this.line) {
      const attr = this.lineGeo.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      arr[0] = this.vineTop.x; arr[1] = this.vineTop.y; arr[2] = this.vineTop.z
      arr[3] = pos.x; arr[4] = pos.y; arr[5] = pos.z
      attr.needsUpdate = true
    }

    if (releasePressed) {
      this.finish()
      return { pos, velocity: this.launchVelocity.clone() }
    }

    return { pos, velocity: new THREE.Vector3() }
  }

  private finish() {
    this.state = 'launched'
    if (this.line) {
      this.scene.remove(this.line)
      this.lineGeo.dispose()
      this.line = null
    }
    setTimeout(() => { this.state = 'idle' }, 0)
  }

  get isSwinging(): boolean {
    return this.state === 'swinging'
  }
}
