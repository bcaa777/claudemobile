import * as THREE from 'three'

import { RENDER_CONFIG } from '../config'

const MAX_BEACON_PARTICLES = 500
const PARTICLES_PER_OBJECT = 5
const RISE_SPEED = 1.5

export interface BeaconSource {
  position: THREE.Vector3
  color: THREE.Color
  height: number
}

export class InteractiveBeacons {
  private points: THREE.Points
  private positions: Float32Array
  private colors: Float32Array
  private activeCount = 0
  private elapsed = 0
  private phases: Float32Array

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_BEACON_PARTICLES * 3)
    this.colors = new Float32Array(MAX_BEACON_PARTICLES * 3)
    this.phases = new Float32Array(MAX_BEACON_PARTICLES)

    for (let i = 0; i < MAX_BEACON_PARTICLES; i++) {
      this.phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      fog: false,
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 10
    scene.add(this.points)
  }

  update(dt: number, cameraPos: THREE.Vector3, sources: BeaconSource[]): void {
    this.elapsed += dt
    let idx = 0

    for (const src of sources) {
      const dx = src.position.x - cameraPos.x
      const dz = src.position.z - cameraPos.z
      const distSq = dx * dx + dz * dz
      if (distSq > RENDER_CONFIG.drawParticles ** 2) continue

      for (let p = 0; p < PARTICLES_PER_OBJECT; p++) {
        if (idx >= MAX_BEACON_PARTICLES) break

        const phase = this.phases[idx]
        const t = ((this.elapsed * RISE_SPEED / src.height + p / PARTICLES_PER_OBJECT + phase / (Math.PI * 2)) % 1)

        const wobbleX = Math.sin(this.elapsed * 2 + phase) * 0.3
        const wobbleZ = Math.cos(this.elapsed * 1.7 + phase * 1.3) * 0.3

        this.positions[idx * 3]     = src.position.x + wobbleX
        this.positions[idx * 3 + 1] = src.position.y + t * src.height + 1
        this.positions[idx * 3 + 2] = src.position.z + wobbleZ

        this.colors[idx * 3]     = src.color.r
        this.colors[idx * 3 + 1] = src.color.g
        this.colors[idx * 3 + 2] = src.color.b

        idx++
      }
      if (idx >= MAX_BEACON_PARTICLES) break
    }

    this.activeCount = idx
    this.points.geometry.setDrawRange(0, this.activeCount)
    ;(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}
