import * as THREE from 'three'

export class ZiplineRide {
  state: 'idle' | 'riding' | 'done' = 'idle'
  private cablePoints: THREE.Vector3[] = []
  private progress = 0
  private speed = 15 // units/sec
  private line: THREE.Line | null = null
  private lineMat: THREE.LineBasicMaterial
  private lineGeo: THREE.BufferGeometry
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x5c3a1e, linewidth: 2 })
    this.lineGeo = new THREE.BufferGeometry()
  }

  start(cablePoints: THREE.Vector3[]) {
    this.cablePoints = cablePoints
    this.progress = 0
    this.state = 'riding'

    // Show rope line
    const positions = new Float32Array(6)
    this.lineGeo = new THREE.BufferGeometry()
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.line = new THREE.Line(this.lineGeo, this.lineMat)
    this.line.frustumCulled = false
    this.scene.add(this.line)
  }

  /** Returns new player position, or null if not riding */
  update(delta: number, playerPos: THREE.Vector3, releasePressed: boolean): THREE.Vector3 | null {
    if (this.state !== 'riding') return null
    if (this.cablePoints.length < 2) { this.finish(); return null }

    // Total cable length
    let totalLen = 0
    for (let i = 1; i < this.cablePoints.length; i++) {
      totalLen += this.cablePoints[i].distanceTo(this.cablePoints[i - 1])
    }

    this.progress += (this.speed * delta) / totalLen
    if (this.progress >= 1 || releasePressed) {
      this.finish()
      return null
    }

    // Interpolate position along cable
    const targetDist = this.progress * totalLen
    let accum = 0
    for (let i = 1; i < this.cablePoints.length; i++) {
      const segLen = this.cablePoints[i].distanceTo(this.cablePoints[i - 1])
      if (accum + segLen >= targetDist) {
        const t = (targetDist - accum) / segLen
        const pos = new THREE.Vector3().lerpVectors(this.cablePoints[i - 1], this.cablePoints[i], t)
        pos.y -= 1.5 // hang below cable

        // Update line visual
        if (this.line) {
          const attr = this.lineGeo.getAttribute('position') as THREE.BufferAttribute
          const arr = attr.array as Float32Array
          arr[0] = playerPos.x; arr[1] = playerPos.y + 1; arr[2] = playerPos.z
          arr[3] = pos.x; arr[4] = pos.y + 1.5; arr[5] = pos.z
          attr.needsUpdate = true
        }

        return pos
      }
      accum += segLen
    }

    this.finish()
    return null
  }

  private finish() {
    this.state = 'done'
    if (this.line) {
      this.scene.remove(this.line)
      this.lineGeo.dispose()
      this.line = null
    }
    // Reset to idle after one frame
    setTimeout(() => { this.state = 'idle' }, 0)
  }

  get isRiding(): boolean {
    return this.state === 'riding'
  }
}
