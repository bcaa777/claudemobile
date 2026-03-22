import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { HarmonicTone } from '../audio/HarmonicTone'

/** Biome color for the resonance ring glow */
const BIOME_RING_COLORS: Record<BiomeType, number> = {
  [BiomeType.Forest]:    0x44ff88,
  [BiomeType.Desert]:    0xffcc44,
  [BiomeType.Swamp]:     0x88ff44,
  [BiomeType.Snow]:      0x88ddff,
  [BiomeType.Volcanic]:  0xff4422,
  [BiomeType.Crystal]:   0x88aaff,
  [BiomeType.Jungle]:    0x44ff66,
  [BiomeType.Mesa]:      0xffaa44,
  [BiomeType.CoralReef]: 0xff88cc,
  [BiomeType.Heaven]:    0xffeedd,
  [BiomeType.Hell]:      0xff4422,
}

const PARTICLE_COUNT = 25
const RING_INNER = 3
const RING_OUTER = 5

export class ResonanceSiteVisual {
  biome: BiomeType
  position: THREE.Vector3
  activated = false
  mesh: THREE.Group
  harmonicTone: HarmonicTone | null = null

  private ringMaterial!: THREE.MeshBasicMaterial
  private particleMesh: THREE.InstancedMesh | null = null
  private particleOffsets: Float32Array // per-particle random angle + speed
  private dummy = new THREE.Object3D()

  constructor(
    biome: BiomeType,
    position: THREE.Vector3,
    scene: THREE.Scene,
    audioCtx?: AudioContext,
    audioDestination?: AudioNode,
  ) {
    this.biome = biome
    this.position = position.clone()

    // Create harmonic tone if audio context available
    if (audioCtx && audioDestination) {
      this.harmonicTone = new HarmonicTone(biome, audioCtx, audioDestination)
    }

    this.mesh = this.createMesh()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)

    // Pre-compute particle random offsets
    this.particleOffsets = new Float32Array(PARTICLE_COUNT * 2)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particleOffsets[i * 2] = Math.random() * Math.PI * 2     // angle
      this.particleOffsets[i * 2 + 1] = 0.3 + Math.random() * 0.7  // speed multiplier
    }
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group()
    const color = BIOME_RING_COLORS[this.biome] ?? 0xaaffcc

    // Glowing ring on ground
    const ringGeo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 32)
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const ringMesh = new THREE.Mesh(ringGeo, this.ringMaterial)
    ringMesh.rotation.x = -Math.PI / 2
    ringMesh.position.y = 0.15 // Slight offset above ground
    group.add(ringMesh)

    // Particles (instanced small quads) — hidden until activated
    const particleGeo = new THREE.PlaneGeometry(0.3, 0.3)
    const particleMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT)
    this.particleMesh.visible = false
    this.particleMesh.frustumCulled = false
    group.add(this.particleMesh)

    return group
  }

  update(dt: number, playerDistance: number, elapsedTime: number): void {
    if (!this.activated) {
      // Faint pulsing glow (sine wave at 0.3 Hz)
      const pulse = Math.sin(elapsedTime * 0.3 * Math.PI * 2)
      this.ringMaterial.opacity = 0.15 + pulse * 0.1 // oscillates 0.05 – 0.25
    } else {
      // Bright steady glow
      this.ringMaterial.opacity = 0.6

      // Rising particles
      if (this.particleMesh) {
        this.particleMesh.visible = true
        const midRadius = (RING_INNER + RING_OUTER) * 0.5

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const angle = this.particleOffsets[i * 2]
          const speedMul = this.particleOffsets[i * 2 + 1]

          // Cycle position: rises over ~4 seconds then resets
          const cycleTime = 4.0 / speedMul
          const t = ((elapsedTime * speedMul) % cycleTime) / cycleTime

          const x = Math.cos(angle) * midRadius
          const z = Math.sin(angle) * midRadius
          const y = t * 8 // rise up to 8 units

          this.dummy.position.set(x, y + 0.3, z)
          this.dummy.scale.setScalar(1.0 - t * 0.7) // shrink as they rise
          this.dummy.updateMatrix()
          this.particleMesh.setMatrixAt(i, this.dummy.matrix)
        }
        this.particleMesh.instanceMatrix.needsUpdate = true
      }
    }

    // Fade out ring when very far away
    if (playerDistance > 200) {
      this.mesh.visible = false
    } else {
      this.mesh.visible = true
    }

    // Update harmonic tone proximity bonus
    if (this.harmonicTone && this.activated) {
      // Consider "in same biome" if within ~100 units
      this.harmonicTone.update(playerDistance < 100)
    }
  }

  activate(): void {
    if (this.activated) return
    this.activated = true

    // Bright flash effect — briefly max opacity then settle
    this.ringMaterial.opacity = 1.0
    setTimeout(() => {
      if (this.activated) this.ringMaterial.opacity = 0.6
    }, 300)

    // Start the harmonic tone
    this.harmonicTone?.start()
  }

  dispose(): void {
    this.harmonicTone?.dispose()
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
  }
}
