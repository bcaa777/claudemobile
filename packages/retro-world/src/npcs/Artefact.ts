import * as THREE from 'three'

const COLLECT_RADIUS_SQ = 3 * 3
const SHRINK_SPEED = 4.0

export class Artefact {
  private group: THREE.Group
  private floatPhase: number
  collected = false
  private shrink = 1.0
  readonly worldPos: THREE.Vector3
  readonly name: string

  constructor(pos: THREE.Vector3, scene: THREE.Scene, color: number, name: string) {
    this.worldPos = pos.clone()
    this.name = name
    this.floatPhase = Math.random() * Math.PI * 2

    this.group = new THREE.Group()
    this.group.position.copy(pos)
    scene.add(this.group)

    // Glowing core — smaller than landmark crystals
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.8),
      new THREE.MeshBasicMaterial({ color })
    )
    this.group.add(core)

    // Transparent shell
    const shell = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 })
    )
    this.group.add(shell)

    // 6 orbiting particles
    const count = 6
    const pPos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = i * (Math.PI * 2 / count)
      pPos[i * 3 + 0] = Math.cos(a) * 1.8
      pPos[i * 3 + 1] = 0
      pPos[i * 3 + 2] = Math.sin(a) * 1.8
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const halo = new THREE.Points(geo, new THREE.PointsMaterial({
      color,
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }))
    this.group.add(halo)
  }

  tryCollect(playerPos: THREE.Vector3): boolean {
    if (this.collected) return false
    const dx = playerPos.x - this.worldPos.x
    const dy = playerPos.y - this.worldPos.y
    const dz = playerPos.z - this.worldPos.z
    if (dx * dx + dy * dy + dz * dz < COLLECT_RADIUS_SQ) {
      this.collected = true
      return true
    }
    return false
  }

  update(delta: number, time: number) {
    if (this.collected) {
      this.shrink = Math.max(0, this.shrink - delta * SHRINK_SPEED)
      this.group.scale.setScalar(this.shrink)
      if (this.shrink <= 0) this.group.visible = false
      return
    }

    this.group.position.y = this.worldPos.y + Math.sin(time * 1.5 + this.floatPhase) * 0.4
    this.group.rotation.y = time * 1.0

    // Orbit particles
    const points = this.group.children[2] as THREE.Points
    if (points) {
      const attr = points.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < attr.count; i++) {
        const a = i * (Math.PI * 2 / attr.count) + time * 1.2
        attr.setX(i, Math.cos(a) * 1.8)
        attr.setY(i, Math.sin(time * 0.7 + i * 0.5) * 0.4)
        attr.setZ(i, Math.sin(a) * 1.8)
      }
      attr.needsUpdate = true
    }
  }

  setPreCollected() {
    this.collected = true
    this.shrink = 0
    this.group.visible = false
  }
}
