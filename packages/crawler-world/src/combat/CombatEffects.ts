import * as THREE from 'three'

// ─── Floating damage numbers ──────────────────────────────────────────────────

interface DamageLabel {
  el: HTMLElement
  worldPos: THREE.Vector3
  timer: number
  duration: number
  active: boolean
}

const LABEL_POOL_SIZE = 20
const LABEL_DURATION = 1.0
const LABEL_RISE = 40 // pixels

// ─── Death particles ──────────────────────────────────────────────────────────

interface DeathParticle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  timer: number
  duration: number
}

const PARTICLE_DURATION = 1.0

// ─── Screen shake ─────────────────────────────────────────────────────────────

interface ShakeState {
  timer: number
  duration: number
  amplitude: number
  originalPos: THREE.Vector3
}

const _scratchVec = new THREE.Vector3()
const _particleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2)

export class CombatEffects {
  // Damage labels
  private labelPool: DamageLabel[] = []

  // Particles
  private particles: DeathParticle[] = []
  private scene: THREE.Scene | null = null

  // Shake
  private shake: ShakeState | null = null

  // Vignette
  private vignetteEl: HTMLElement | null = null
  private vignetteVisible = false

  constructor() {
    this.initLabelPool()
    this.initVignette()
  }

  private initLabelPool(): void {
    for (let i = 0; i < LABEL_POOL_SIZE; i++) {
      const el = document.createElement('div')
      el.style.cssText = `
        position: fixed;
        z-index: 200;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        color: #ffdd44;
        text-shadow: 0 0 6px #ff8800, 1px 1px 2px #000;
        pointer-events: none;
        user-select: none;
        display: none;
      `
      document.body.appendChild(el)
      this.labelPool.push({
        el,
        worldPos: new THREE.Vector3(),
        timer: 0,
        duration: LABEL_DURATION,
        active: false,
      })
    }
  }

  private initVignette(): void {
    this.vignetteEl = document.createElement('div')
    this.vignetteEl.style.cssText = `
      position: fixed;
      z-index: 150;
      inset: 0;
      pointer-events: none;
      display: none;
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        rgba(180, 0, 0, 0.55) 100%
      );
    `
    document.body.appendChild(this.vignetteEl)
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene
  }

  // ── Public API ────────────────────────────────────────────────────────────

  showDamageNumber(worldPos: THREE.Vector3, amount: number): void {
    const label = this.labelPool.find((l) => !l.active)
    if (!label) return
    label.active = true
    label.timer = LABEL_DURATION
    label.duration = LABEL_DURATION
    label.worldPos.copy(worldPos)
    label.el.textContent = `-${Math.round(amount)}`
    label.el.style.display = 'block'
  }

  screenShake(camera: THREE.Camera, duration: number, amplitude: number): void {
    if (this.shake) {
      // Reset if already shaking
      camera.position.copy(this.shake.originalPos)
    }
    this.shake = {
      timer: duration,
      duration,
      amplitude,
      originalPos: camera.position.clone(),
    }
  }

  deathParticles(scene: THREE.Scene, position: THREE.Vector3, color: THREE.Color): void {
    const count = 6 + Math.floor(Math.random() * 5)
    const mat = new THREE.MeshBasicMaterial({ color })
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(_particleGeo, mat.clone())
      mesh.position.copy(position)
      scene.add(mesh)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 6,
      )
      this.particles.push({ mesh, velocity: vel, timer: PARTICLE_DURATION, duration: PARTICLE_DURATION })
    }
  }

  setLowHealthVignette(visible: boolean): void {
    if (visible === this.vignetteVisible) return
    this.vignetteVisible = visible
    if (this.vignetteEl) {
      this.vignetteEl.style.display = visible ? 'block' : 'none'
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(delta: number, camera: THREE.Camera): void {
    this.updateLabels(delta, camera)
    this.updateParticles(delta)
    this.updateShake(delta, camera)
  }

  private updateLabels(delta: number, camera: THREE.Camera): void {
    const w = window.innerWidth
    const h = window.innerHeight
    for (const label of this.labelPool) {
      if (!label.active) continue
      label.timer -= delta
      if (label.timer <= 0) {
        label.active = false
        label.el.style.display = 'none'
        continue
      }

      // Project 3D → screen
      _scratchVec.copy(label.worldPos)
      _scratchVec.project(camera as THREE.PerspectiveCamera)

      if (_scratchVec.z > 1) {
        label.el.style.display = 'none'
        continue
      }

      const progress = 1 - label.timer / label.duration
      const sx = (_scratchVec.x * 0.5 + 0.5) * w
      const sy = (-_scratchVec.y * 0.5 + 0.5) * h - progress * LABEL_RISE
      const opacity = label.timer / label.duration

      label.el.style.display = 'block'
      label.el.style.left = `${sx}px`
      label.el.style.top = `${sy}px`
      label.el.style.opacity = `${opacity}`
      label.el.style.transform = `translate(-50%, -50%) scale(${0.8 + progress * 0.5})`
    }
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.timer -= delta

      if (p.timer <= 0) {
        if (this.scene) this.scene.remove(p.mesh)
        p.mesh.geometry.dispose()
        ;(p.mesh.material as THREE.Material).dispose()
        this.particles.splice(i, 1)
        continue
      }

      p.mesh.position.addScaledVector(p.velocity, delta)
      p.velocity.y -= 9.8 * delta // gravity

      const opacity = p.timer / p.duration
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      if (!mat.transparent) mat.transparent = true
      mat.opacity = opacity
    }
  }

  private updateShake(delta: number, camera: THREE.Camera): void {
    if (!this.shake) return

    this.shake.timer -= delta

    if (this.shake.timer <= 0) {
      camera.position.copy(this.shake.originalPos)
      this.shake = null
      return
    }

    const decay = this.shake.timer / this.shake.duration
    const amp = this.shake.amplitude * decay
    const base = this.shake.originalPos
    camera.position.set(
      base.x + (Math.random() - 0.5) * amp,
      base.y + (Math.random() - 0.5) * amp * 0.5,
      base.z + (Math.random() - 0.5) * amp,
    )
  }

  dispose(): void {
    for (const label of this.labelPool) {
      label.el.parentElement?.removeChild(label.el)
    }
    this.labelPool.length = 0

    for (const p of this.particles) {
      if (this.scene) this.scene.remove(p.mesh)
      p.mesh.geometry.dispose()
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.particles.length = 0

    this.vignetteEl?.parentElement?.removeChild(this.vignetteEl)
    this.vignetteEl = null
    this.vignetteVisible = false
    this.shake = null
  }
}
