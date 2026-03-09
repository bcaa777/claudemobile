import * as THREE from 'three'

const COLLECT_RADIUS_SQ = 3 * 3   // 3 world units
const SHRINK_SPEED = 4.0           // scale units/second after collection

export class LandmarkCrystal {
  private group: THREE.Group
  private light: THREE.PointLight
  private halo: THREE.Points
  private baseIntensity: number
  private floatPhase: number
  collected = false
  private shrink = 1.0
  readonly worldPos: THREE.Vector3

  constructor(pos: THREE.Vector3, scene: THREE.Scene, color: number) {
    this.worldPos = pos.clone()
    this.floatPhase = Math.random() * Math.PI * 2
    this.baseIntensity = 1.6

    this.group = new THREE.Group()
    this.group.position.copy(pos)
    scene.add(this.group)

    // Glowing core
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2),
      new THREE.MeshBasicMaterial({ color })
    )
    this.group.add(core)

    // Transparent outer shell
    const shell = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.9),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 })
    )
    this.group.add(shell)

    // Point light glow
    this.light = new THREE.PointLight(color, this.baseIntensity, 14)
    this.group.add(this.light)

    // 8 orbiting halo particles
    const count = 8
    const pPos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = i * (Math.PI * 2 / count)
      pPos[i * 3 + 0] = Math.cos(a) * 2.5
      pPos[i * 3 + 1] = 0
      pPos[i * 3 + 2] = Math.sin(a) * 2.5
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    this.halo = new THREE.Points(geo, new THREE.PointsMaterial({
      color,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }))
    this.group.add(this.halo)
  }

  /** Returns true on the frame the crystal is first collected. */
  tryCollect(playerPos: THREE.Vector3): boolean {
    if (this.collected) return false
    const dx = playerPos.x - this.worldPos.x
    const dy = playerPos.y - this.worldPos.y
    const dz = playerPos.z - this.worldPos.z
    if (dx * dx + dy * dy + dz * dz < COLLECT_RADIUS_SQ) {
      this.collected = true
      // Flash the light briefly
      this.light.intensity = this.baseIntensity * 4
      return true
    }
    return false
  }

  update(delta: number, time: number) {
    if (this.collected) {
      this.shrink = Math.max(0, this.shrink - delta * SHRINK_SPEED)
      this.group.scale.setScalar(this.shrink)
      this.light.intensity = this.shrink * this.baseIntensity
      return
    }

    // Float up and down
    this.group.position.y = this.worldPos.y + Math.sin(time * 1.5 + this.floatPhase) * 0.5
    // Slow spin
    this.group.rotation.y = time * 1.2
    // Gentle light pulse
    this.light.intensity = this.baseIntensity * (0.8 + 0.3 * Math.sin(time * 4 + this.floatPhase))

    // Orbit halo particles
    const attr = this.halo.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < attr.count; i++) {
      const a = i * (Math.PI * 2 / attr.count) + time * 1.5
      attr.setX(i, Math.cos(a) * 2.5)
      attr.setY(i, Math.sin(time * 0.8 + i * 0.7) * 0.6)
      attr.setZ(i, Math.sin(a) * 2.5)
    }
    attr.needsUpdate = true
  }
}
