import * as THREE from 'three'

// ── Particle pool ─────────────────────────────────────────────────────────────
const POOL_SIZE = 30

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  life: number
  maxLife: number
  active: boolean
  fadeOut: boolean       // fade opacity over life
  shrink: boolean        // shrink scale over life
  startScale: number
}

// ── Active effect tracking ────────────────────────────────────────────────────
interface BoltEffect {
  mesh: THREE.Mesh
  life: number
  maxLife: number
}

interface XPPopup {
  div: HTMLDivElement
  life: number
  maxLife: number
}

interface CameraShake {
  intensity: number
  life: number
}

/**
 * Visual and audio effects for combat.
 * Manages a pool of particle meshes and temporary effect objects.
 */
export class CombatEffects {
  private scene: THREE.Scene
  private pool: Particle[] = []
  private bolts: BoltEffect[] = []
  private popups: XPPopup[] = []
  private shakeOffset = new THREE.Vector3()
  private shakes: CameraShake[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene

    // Initialize particle pool
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05)
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      scene.add(mesh)
      this.pool.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0,
        active: false,
        fadeOut: true,
        shrink: false,
        startScale: 1,
      })
    }
  }

  /**
   * Called when player melees — golden energy arc at fist position.
   */
  createMeleeSwing(position: THREE.Vector3, direction: THREE.Vector3): void {
    // Small arc: 3 particles in a fan shape
    for (let i = 0; i < 3; i++) {
      const p = this.getParticle()
      if (!p) break
      const angle = (i - 1) * 0.4
      const vel = new THREE.Vector3(
        direction.x * 4 + Math.sin(angle) * 2,
        direction.y * 2 + 1,
        direction.z * 4 + Math.cos(angle) * 2
      )
      this.activateParticle(p, position, vel, 0.15, 0xffcc44, 1.5)
    }
  }

  /**
   * Called when player fires magic bolt — line from player to hit point.
   */
  createMagicBolt(from: THREE.Vector3, to: THREE.Vector3, tier: number): void {
    const dir = new THREE.Vector3().subVectors(to, from)
    const dist = dir.length()
    dir.normalize()

    // Thin stretched box as beam
    const thickness = tier >= 2 ? 0.04 : 0.02
    const geo = new THREE.BoxGeometry(thickness, thickness, dist)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff66cc,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)

    // Position at midpoint, orient toward target
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    mesh.position.copy(mid)
    mesh.lookAt(to)

    this.scene.add(mesh)
    this.bolts.push({ mesh, life: 0, maxLife: 0.15 })

    // Tier 2+: particle trail along the bolt path
    if (tier >= 2) {
      const steps = Math.min(6, Math.floor(dist / 2))
      for (let i = 0; i < steps; i++) {
        const p = this.getParticle()
        if (!p) break
        const t = (i + 1) / (steps + 1)
        const pos = new THREE.Vector3().lerpVectors(from, to, t)
        const spreadVel = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2 + 1,
          (Math.random() - 0.5) * 2
        )
        this.activateParticle(p, pos, spreadVel, 0.25, 0xffaaee, 1.0)
      }
    }
  }

  /**
   * Called when an enemy is hit — cube particles fly outward.
   */
  createHitEffect(position: THREE.Vector3): void {
    const count = 4 + Math.floor(Math.random() * 3) // 4-6
    for (let i = 0; i < count; i++) {
      const p = this.getParticle()
      if (!p) break
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 6
      )
      this.activateParticle(p, position, vel, 0.3, 0xff88cc, 1.2)
    }
  }

  /**
   * Called when an enemy dies — particles drift upward and fade.
   */
  createDeathEffect(position: THREE.Vector3, bodyColor: number): void {
    const count = 8
    for (let i = 0; i < count; i++) {
      const p = this.getParticle()
      if (!p) break
      const angle = (i / count) * Math.PI * 2
      const vel = new THREE.Vector3(
        Math.sin(angle) * 1.5,
        2 + Math.random() * 2,
        Math.cos(angle) * 1.5
      )
      const color = i % 2 === 0 ? bodyColor : 0xffffff
      this.activateParticle(p, position, vel, 1.0, color, 1.5, true)
    }
  }

  /**
   * Called when player is hit by enemy — triggers camera shake.
   */
  createPlayerHitEffect(): void {
    this.shakes.push({ intensity: 0.15, life: 0.2 })
  }

  /**
   * XP popup — HTML element that drifts upward and fades.
   */
  createXPPopup(position: THREE.Vector3, amount: number, camera: THREE.Camera): void {
    // Project 3D position to screen
    const projected = position.clone().project(camera)
    const hw = window.innerWidth * 0.5
    const hh = window.innerHeight * 0.5
    const screenX = projected.x * hw + hw
    const screenY = -projected.y * hh + hh

    // Don't show if behind camera
    if (projected.z > 1) return

    const div = document.createElement('div')
    div.textContent = `+${amount} XP`
    div.style.cssText = `
      position: fixed;
      left: ${screenX}px;
      top: ${screenY}px;
      color: #ffcc44;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      pointer-events: none;
      z-index: 1000;
      text-shadow: 0 0 4px #ff8800, 0 0 8px #ff8800;
      transition: transform 1.5s ease-out, opacity 1.5s ease-out;
      transform: translateY(0px);
      opacity: 1;
    `
    document.body.appendChild(div)

    // Trigger CSS transition on next frame
    requestAnimationFrame(() => {
      div.style.transform = 'translateY(-60px)'
      div.style.opacity = '0'
    })

    this.popups.push({ div, life: 0, maxLife: 1.5 })
  }

  /**
   * Returns the current camera shake offset. Engine applies this to the camera.
   */
  getShakeOffset(): THREE.Vector3 {
    return this.shakeOffset
  }

  /**
   * Tick all active effects, remove finished ones.
   */
  update(dt: number): void {
    // Update particles
    for (const p of this.pool) {
      if (!p.active) continue
      p.life += dt
      if (p.life >= p.maxLife) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      const t = p.life / p.maxLife
      // Move
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt
      // Gravity
      p.velocity.y -= 4 * dt
      // Fade
      if (p.fadeOut) {
        const mat = p.mesh.material as THREE.MeshBasicMaterial
        mat.opacity = 1 - t
      }
      // Shrink
      if (p.shrink) {
        const s = p.startScale * (1 - t)
        p.mesh.scale.setScalar(Math.max(0.01, s))
      }
    }

    // Update bolt effects
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]
      b.life += dt
      if (b.life >= b.maxLife) {
        this.scene.remove(b.mesh)
        b.mesh.geometry.dispose()
        ;(b.mesh.material as THREE.Material).dispose()
        this.bolts.splice(i, 1)
        continue
      }
      const t = b.life / b.maxLife
      const mat = b.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 1 - t
    }

    // Update XP popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const popup = this.popups[i]
      popup.life += dt
      if (popup.life >= popup.maxLife) {
        popup.div.remove()
        this.popups.splice(i, 1)
      }
    }

    // Update camera shakes
    this.shakeOffset.set(0, 0, 0)
    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i]
      s.life -= dt
      if (s.life <= 0) {
        this.shakes.splice(i, 1)
        continue
      }
      const decay = s.life / 0.2 // original life is 0.2
      this.shakeOffset.x += (Math.random() - 0.5) * s.intensity * decay
      this.shakeOffset.y += (Math.random() - 0.5) * s.intensity * decay
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────
  private getParticle(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p
    }
    return null
  }

  private activateParticle(
    p: Particle,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    life: number,
    color: number,
    scale: number,
    shrink = false
  ): void {
    p.active = true
    p.mesh.visible = true
    p.mesh.position.copy(pos)
    p.mesh.scale.setScalar(scale)
    p.velocity.copy(vel)
    p.life = 0
    p.maxLife = life
    p.fadeOut = true
    p.shrink = shrink
    p.startScale = scale
    const mat = p.mesh.material as THREE.MeshBasicMaterial
    mat.color.setHex(color)
    mat.opacity = 1
  }
}
