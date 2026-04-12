import * as THREE from 'three'
import type { EnemyManager } from '../enemies/EnemyFactory'
import type { BossSystem } from '../enemies/BossSystem'

interface Projectile {
  active: boolean
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  damage: number
  distanceTraveled: number
  maxRange: number
  bouncesLeft: number
}

export interface DamageEvent {
  enemyIndex: number
  damage: number
}

const POOL_SIZE = 300
const HIT_RADIUS = 1.5

export interface BossDamageEvent {
  damage: number
}

export class ProjectileSystem {
  private pool: Projectile[] = []
  pendingDamage: DamageEvent[] = []
  pendingBossDamage: BossDamageEvent[] = []
  private impactParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; timer: number }[] = []
  private impactGeo = new THREE.SphereGeometry(0.08, 4, 4)

  /** Terrain sampler — set via setTerrainSampler() for ricochet terrain checks */
  private sampleHeight: ((x: number, z: number) => number) | null = null

  constructor(private scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.15, 6, 6)
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffee44,
        emissive: 0xffee44,
        emissiveIntensity: 2.0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      scene.add(mesh)
      this.pool.push({
        active: false,
        mesh,
        velocity: new THREE.Vector3(),
        damage: 0,
        distanceTraveled: 0,
        maxRange: 0,
        bouncesLeft: 0,
      })
    }
  }

  setTerrainSampler(fn: (x: number, z: number) => number): void {
    this.sampleHeight = fn
  }

  spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    maxRange: number,
    bounceCount = 0,
    color = 0xffee44,
  ): void {
    const proj = this.pool.find((p) => !p.active)
    if (!proj) return

    proj.active = true
    proj.mesh.position.copy(origin)
    proj.mesh.visible = true
    const mat = proj.mesh.material as THREE.MeshStandardMaterial
    mat.color.setHex(color)
    mat.emissive.setHex(color)
    proj.velocity.copy(direction).normalize().multiplyScalar(speed)
    proj.damage = damage
    proj.distanceTraveled = 0
    proj.maxRange = maxRange
    proj.bouncesLeft = bounceCount
  }

  update(delta: number, enemyManager: EnemyManager, bossSystem?: BossSystem | null): void {
    this.pendingDamage.length = 0
    this.pendingBossDamage.length = 0

    for (const proj of this.pool) {
      if (!proj.active) continue

      const step = proj.velocity.clone().multiplyScalar(delta)
      proj.mesh.position.add(step)
      proj.distanceTraveled += step.length()

      if (proj.distanceTraveled >= proj.maxRange) {
        this.deactivate(proj)
        continue
      }

      // ---- Snap projectile to terrain surface (non-bouncing) ----
      if (this.sampleHeight && proj.bouncesLeft <= 0) {
        const terrainY = this.sampleHeight(proj.mesh.position.x, proj.mesh.position.z)
        proj.mesh.position.y = terrainY + 1.2 // float slightly above ground
        proj.velocity.y = 0 // keep horizontal
      }

      // ---- Terrain ricochet ----
      if (this.sampleHeight && proj.bouncesLeft > 0) {
        const terrainY = this.sampleHeight(proj.mesh.position.x, proj.mesh.position.z)
        if (proj.mesh.position.y < terrainY + 0.1) {
          // Reflect the Y component of velocity (bounce off ground)
          proj.mesh.position.y = terrainY + 0.15
          proj.velocity.y = Math.abs(proj.velocity.y) * 0.7 + 3  // add slight upward kick
          // Flatten velocity slightly so it keeps traveling
          proj.velocity.x *= 0.95
          proj.velocity.z *= 0.95
          proj.bouncesLeft--
        }
      }

      // Collision check against enemies
      let hit = false
      for (let i = 0; i < enemyManager.enemies.length; i++) {
        const enemy = enemyManager.enemies[i]
        const dx = proj.mesh.position.x - enemy.mesh.position.x
        const dy = proj.mesh.position.y - enemy.mesh.position.y
        const dz = proj.mesh.position.z - enemy.mesh.position.z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq < HIT_RADIUS * HIT_RADIUS) {
          this.pendingDamage.push({ enemyIndex: i, damage: proj.damage })
          this.spawnImpact(proj.mesh.position.clone(), (proj.mesh.material as THREE.MeshStandardMaterial).color.getHex())
          this.deactivate(proj)
          hit = true
          break
        }
      }

      if (hit) continue

      // Boss hit check
      if (bossSystem && bossSystem.active) {
        const bossPos = bossSystem.getPosition()
        if (bossPos) {
          const bx = proj.mesh.position.x - bossPos.x
          const by = proj.mesh.position.y - bossPos.y
          const bz = proj.mesh.position.z - bossPos.z
          const bDistSq = bx * bx + by * by + bz * bz
          const BOSS_HIT_RADIUS = 3.5
          if (bDistSq < BOSS_HIT_RADIUS * BOSS_HIT_RADIUS) {
            this.pendingBossDamage.push({ damage: proj.damage })
            this.deactivate(proj)
          }
        }
      }
    }

    // Update impact particles
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const sp = this.impactParticles[i]
      sp.timer -= delta
      sp.mesh.position.addScaledVector(sp.vel, delta)
      sp.vel.y -= 15 * delta // gravity
      const m = sp.mesh.material as THREE.MeshBasicMaterial
      if (!m.transparent) m.transparent = true
      m.opacity = Math.max(0, sp.timer / 0.3)
      if (sp.timer <= 0) {
        this.scene.remove(sp.mesh)
        m.dispose()
        this.impactParticles.splice(i, 1)
      }
    }
  }

  private spawnImpact(pos: THREE.Vector3, color: number): void {
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true })
      const mesh = new THREE.Mesh(this.impactGeo, mat)
      mesh.position.copy(pos)
      this.scene.add(mesh)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 8,
      )
      this.impactParticles.push({ mesh, vel, timer: 0.3 })
    }
  }

  private deactivate(proj: Projectile): void {
    proj.active = false
    proj.mesh.visible = false
  }

  dispose(): void {
    for (const proj of this.pool) {
      this.scene.remove(proj.mesh)
      proj.mesh.geometry.dispose()
      ;(proj.mesh.material as THREE.Material).dispose()
    }
    this.pool.length = 0
  }
}
