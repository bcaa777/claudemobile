import * as THREE from 'three'
import { SeededRandom } from '../utils/SeededRandom'

export type ParticleType = 'snow' | 'ash' | 'fireflies' | 'embers'

interface Particle {
  velocity: THREE.Vector3
  phase: number      // for oscillation / twinkle
  baseY: number
}

export class ParticleSystem {
  public points: THREE.Points
  private particles: Particle[] = []
  private positions: Float32Array
  private count: number
  private type: ParticleType
  private center: THREE.Vector3
  private radius: number

  constructor(
    type: ParticleType,
    count: number,
    color: THREE.Color,
    center: THREE.Vector3,
    radius: number,
    rng: SeededRandom
  ) {
    this.type = type
    this.count = count
    this.center = center.clone()
    this.radius = radius

    this.positions = new Float32Array(count * 3)
    this.particles = []

    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2)
      const r = rng.range(0, radius)
      const x = center.x + Math.cos(angle) * r
      const z = center.z + Math.sin(angle) * r
      const y = center.y + rng.range(0.5, 8)

      this.positions[i*3]   = x
      this.positions[i*3+1] = y
      this.positions[i*3+2] = z

      this.particles.push({
        velocity: new THREE.Vector3(
          rng.range(-0.5, 0.5),
          type === 'snow' || type === 'ash' ? rng.range(-0.3, -0.8) : rng.range(0.2, 1.2),
          rng.range(-0.5, 0.5)
        ),
        phase: rng.range(0, Math.PI * 2),
        baseY: y,
      })
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const mat = new THREE.PointsMaterial({
      color,
      size: type === 'fireflies' ? 0.3 : 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: type === 'fireflies' ? 0.8 : 0.6,
      depthWrite: false,
    })

    this.points = new THREE.Points(geo, mat)
  }

  update(delta: number, time: number) {
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      let x = this.positions[i*3]
      let y = this.positions[i*3+1]
      let z = this.positions[i*3+2]

      if (this.type === 'fireflies') {
        // Drift and bob
        x += Math.sin(time * 0.8 + p.phase) * delta * 0.5
        y += Math.sin(time * 1.2 + p.phase * 1.3) * delta * 0.3
        z += Math.cos(time * 0.7 + p.phase) * delta * 0.5
        // Twinkle via opacity would need per-particle opacity, skip for perf
      } else if (this.type === 'embers') {
        x += p.velocity.x * delta
        y += p.velocity.y * delta + Math.sin(time + p.phase) * 0.3 * delta
        z += p.velocity.z * delta
      } else {
        // snow / ash: fall down
        x += p.velocity.x * delta + Math.sin(time * 0.5 + p.phase) * 0.2 * delta
        y += p.velocity.y * delta
        z += p.velocity.z * delta
      }

      // Wrap within bounds
      const dx = x - this.center.x
      const dz = z - this.center.z
      if (Math.abs(dx) > this.radius) x = this.center.x - dx
      if (Math.abs(dz) > this.radius) z = this.center.z - dz
      if (y < this.center.y - 1) y = this.center.y + 8
      if (y > this.center.y + 12) y = this.center.y + 0.5

      this.positions[i*3]   = x
      this.positions[i*3+1] = y
      this.positions[i*3+2] = z
    }

    attr.needsUpdate = true
  }

  dispose() {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}
