import * as THREE from 'three'
import { InterpolatedVisual } from './BiomeTransition'
import { AtmosphereParticleType } from '../biomes/types'

const MAX_PARTICLES = 300
const SPAWN_HALF_X = 30
const SPAWN_HALF_Z = 30
const SPAWN_Y_MIN = 0
const SPAWN_Y_MAX = 20

interface Particle {
  x: number
  y: number
  z: number
  phase: number      // random offset for sine wobble / pulsing
  speed: number      // individual speed multiplier
}

export class AtmosphereParticles {
  private mesh: THREE.InstancedMesh
  private particles: Particle[] = []
  private dummy = new THREE.Object3D()
  private material: THREE.MeshBasicMaterial
  private currentType: AtmosphereParticleType = 'none'
  private currentCount = 0
  private targetCount = 0
  private color = new THREE.Color()
  private particleSize = 0.15
  private particleSpeed = 1.0
  private elapsed = 0
  /** When >= 0, overrides biome particle count (debug panel) */
  public countOverride = -1

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1, 1)
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    })

    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_PARTICLES)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    scene.add(this.mesh)

    // Pre-allocate all particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: 0, y: 0, z: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.6,
      })
    }
  }

  update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera, visual: InterpolatedVisual) {
    this.elapsed += dt

    const atmo = visual.atmosphere
    const type = atmo.particleType
    const rawCount = this.countOverride >= 0 ? this.countOverride : atmo.particleCount
    this.targetCount = type === 'none' && this.countOverride < 0 ? 0 : Math.round(Math.min(MAX_PARTICLES, rawCount))
    this.particleSize = atmo.particleSize
    this.particleSpeed = atmo.particleSpeed

    // Crossfade instance count toward target over ~3 seconds
    const countDelta = this.targetCount - this.currentCount
    if (Math.abs(countDelta) > 0.5) {
      this.currentCount += countDelta * Math.min(1, dt / 3)
    } else {
      this.currentCount = this.targetCount
    }

    const activeCount = Math.round(Math.max(0, this.currentCount))

    // When type changes, update stored type
    if (type !== this.currentType) {
      this.currentType = type
    }

    // Update color
    this.color.setRGB(atmo.particleColor[0], atmo.particleColor[1], atmo.particleColor[2])
    this.material.color.copy(this.color)

    // Determine blend mode
    const additive = type === 'fireflies' || type === 'embers'
    this.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending
    this.material.opacity = additive ? 0.8 : 0.5

    // Billboard quaternion — face camera
    const camQ = camera.quaternion

    const spd = this.particleSpeed * dt

    for (let i = 0; i < activeCount; i++) {
      const p = this.particles[i]

      // If particle is uninitialized (first spawn or recycled), place around player
      if (p.x === 0 && p.y === 0 && p.z === 0) {
        this.spawnParticle(p, playerPos)
      }

      // Move particle based on type
      this.moveParticle(p, spd, type)

      // Wrap particles that leave the box around player
      const dx = p.x - playerPos.x
      const dy = p.y - playerPos.y
      const dz = p.z - playerPos.z

      if (dx < -SPAWN_HALF_X) p.x += SPAWN_HALF_X * 2
      else if (dx > SPAWN_HALF_X) p.x -= SPAWN_HALF_X * 2
      if (dz < -SPAWN_HALF_Z) p.z += SPAWN_HALF_Z * 2
      else if (dz > SPAWN_HALF_Z) p.z -= SPAWN_HALF_Z * 2
      if (dy < SPAWN_Y_MIN - 2) p.y = playerPos.y + SPAWN_Y_MAX
      else if (dy > SPAWN_Y_MAX + 2) p.y = playerPos.y + SPAWN_Y_MIN

      // Set transform
      this.dummy.position.set(p.x, p.y, p.z)
      this.dummy.quaternion.copy(camQ)

      // Size — fireflies pulse
      let s = this.particleSize
      if (type === 'fireflies') {
        s *= 0.5 + 0.5 * Math.sin(this.elapsed * 3 + p.phase * 5)
      }
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.mesh.count = activeCount
    if (activeCount > 0) {
      this.mesh.instanceMatrix.needsUpdate = true
    }
  }

  private spawnParticle(p: Particle, playerPos: THREE.Vector3) {
    p.x = playerPos.x + (Math.random() - 0.5) * SPAWN_HALF_X * 2
    p.y = playerPos.y + SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN)
    p.z = playerPos.z + (Math.random() - 0.5) * SPAWN_HALF_Z * 2
    p.phase = Math.random() * Math.PI * 2
    p.speed = 0.7 + Math.random() * 0.6
  }

  private moveParticle(p: Particle, spd: number, type: AtmosphereParticleType) {
    const s = spd * p.speed
    const t = this.elapsed

    switch (type) {
      case 'dust':
      case 'motes':
        // Slow drift with sine wobble
        p.x += Math.sin(t * 0.5 + p.phase) * s * 0.3
        p.y += Math.sin(t * 0.3 + p.phase * 1.7) * s * 0.15
        p.z += Math.cos(t * 0.4 + p.phase * 1.3) * s * 0.3
        break

      case 'snow':
        // Fall slowly with horizontal drift
        p.y -= s * 1.2
        p.x += Math.sin(t * 0.7 + p.phase) * s * 0.4
        p.z += Math.cos(t * 0.5 + p.phase * 1.5) * s * 0.3
        break

      case 'embers':
      case 'smoke':
      case 'ash':
        // Rise upward slowly
        p.y += s * 0.8
        p.x += Math.sin(t * 0.6 + p.phase) * s * 0.5
        p.z += Math.cos(t * 0.4 + p.phase * 2) * s * 0.3
        break

      case 'rain':
        // Fall fast and straight
        p.y -= s * 8.0
        p.x += s * 0.1
        break

      case 'sand':
      case 'spray':
        // Horizontal drift with gravity
        p.x += s * 1.5
        p.z += Math.sin(t * 0.8 + p.phase) * s * 0.5
        p.y -= s * 0.3
        break

      case 'fireflies':
        // Erratic slow movement
        p.x += Math.sin(t * 1.2 + p.phase * 3) * s * 0.4
        p.y += Math.sin(t * 0.8 + p.phase * 2) * s * 0.25
        p.z += Math.cos(t * 1.0 + p.phase * 4) * s * 0.4
        break

      case 'spores':
        // Float upward very slowly
        p.y += s * 0.3
        p.x += Math.sin(t * 0.3 + p.phase) * s * 0.2
        p.z += Math.cos(t * 0.25 + p.phase * 1.2) * s * 0.2
        break

      case 'none':
        break
    }
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
