import * as THREE from 'three'
import type { WeaponDef } from './WeaponDefs'
import type { ProjectileSystem } from './ProjectileSystem'
import type { EnemyManager } from '../enemies/EnemyFactory'
import type { DamageSystem } from './DamageSystem'
import type { EventBus } from '@engine/core'

interface ActiveWeapon {
  def: WeaponDef
  cooldownRemaining: number
}

// ---- area effect ----

interface AreaEffect {
  mesh: THREE.Mesh
  radius: number
  maxRadius: number
  damage: number
  duration: number
  elapsed: number
  hitEnemies: Set<number>  // enemy array-indices already damaged this pulse
}

// ---- deployable turret ----

interface Turret {
  mesh: THREE.Mesh
  position: THREE.Vector3
  fireTimer: number
  timeLeft: number
  damage: number
  range: number
  projectileSpeed: number
}

// ---- gravity vortex ----

interface GravityVortex {
  position: THREE.Vector3
  mesh: THREE.Mesh
  duration: number
  elapsed: number
  pullStrength: number
  damage: number
  damageTimer: number
}

export class WeaponSystem {
  private weapons: ActiveWeapon[] = []
  private scene: THREE.Scene | null = null
  private _playerFacingDir: THREE.Vector3 | null = null
  private sampleHeight: ((x: number, z: number) => number) | null = null

  // Active special effects
  private areaEffects: AreaEffect[] = []
  private turrets: Turret[] = []
  private gravityVortices: GravityVortex[] = []

  addWeapon(def: WeaponDef): void {
    this.weapons.push({ def, cooldownRemaining: 0 })
  }

  removeWeapon(id: string): void {
    const idx = this.weapons.findIndex((w) => w.def.id === id)
    if (idx !== -1) this.weapons.splice(idx, 1)
  }

  /** Provide scene + terrain sampler so non-projectile weapons can create meshes */
  init(scene: THREE.Scene, sampleHeight: (x: number, z: number) => number): void {
    this.scene = scene
    this.sampleHeight = sampleHeight
  }

  update(
    delta: number,
    playerPosition: THREE.Vector3,
    camera: THREE.Camera,
    enemyManager: EnemyManager,
    projectileSystem: ProjectileSystem,
    damageSystem?: DamageSystem,
    eventBus?: EventBus,
    playerFacingDir?: THREE.Vector3,
  ): void {
    this._playerFacingDir = playerFacingDir ?? null
    // ---- tick weapon cooldowns ----
    for (const weapon of this.weapons) {
      weapon.cooldownRemaining -= delta
      if (weapon.cooldownRemaining > 0) continue

      const def = weapon.def

      switch (def.category) {
        case 'projectile':
          this.handleProjectile(def, weapon, playerPosition, camera, enemyManager, projectileSystem)
          break
        case 'area':
          if (damageSystem && eventBus) {
            this.handleArea(def, weapon, playerPosition, enemyManager, damageSystem, eventBus)
          }
          break
        case 'chain':
          if (damageSystem && eventBus) {
            this.handleChain(def, weapon, playerPosition, enemyManager, damageSystem, eventBus)
          }
          break
        case 'deployable':
          this.handleDeployable(def, weapon, playerPosition)
          break
        case 'gravity':
          this.handleGravity(def, weapon, playerPosition)
          break
        // orbital is managed entirely by OrbitalSystem
        case 'orbital':
          break
      }
    }

    // ---- tick area effects ----
    this.updateAreaEffects(delta, enemyManager, damageSystem, eventBus)

    // ---- tick turrets ----
    this.updateTurrets(delta, enemyManager, projectileSystem)

    // ---- tick gravity vortices ----
    this.updateGravityVortices(delta, enemyManager, damageSystem, eventBus)
  }

  // ------------------------------------------------------------------ //
  //  Projectile (with spread)
  // ------------------------------------------------------------------ //
  private handleProjectile(
    def: WeaponDef,
    weapon: ActiveWeapon,
    playerPosition: THREE.Vector3,
    _camera: THREE.Camera,
    enemyManager: EnemyManager,
    projectileSystem: ProjectileSystem,
  ): void {
    // All weapons auto-target nearest enemy
    const target = findNearestEnemy(playerPosition, enemyManager, def.range)
    if (!target) return

    const dir = target.clone().sub(playerPosition)
    dir.y = 0
    dir.normalize()

    this.fire(def, playerPosition, dir, projectileSystem)
    weapon.cooldownRemaining = def.cooldown
  }

  private fire(
    def: WeaponDef,
    origin: THREE.Vector3,
    baseDir: THREE.Vector3,
    projectileSystem: ProjectileSystem,
  ): void {
    for (let i = 0; i < def.projectileCount; i++) {
      let dir = baseDir.clone()
      if (def.projectileCount > 1 && def.spreadAngle > 0) {
        const total = def.spreadAngle
        const step = total / (def.projectileCount - 1)
        const offset = -total / 2 + step * i
        dir = rotateAroundY(baseDir, offset)
      }
      projectileSystem.spawn(origin.clone(), dir, def.projectileSpeed, def.damage, def.range, def.bounceCount)
    }
  }

  // ------------------------------------------------------------------ //
  //  Area (shockwave / ground_slam)
  // ------------------------------------------------------------------ //
  private handleArea(
    def: WeaponDef,
    weapon: ActiveWeapon,
    playerPosition: THREE.Vector3,
    enemyManager: EnemyManager,
    _damageSystem: DamageSystem,
    _eventBus: EventBus,
  ): void {
    const nearbyEnemy = findNearestEnemy(playerPosition, enemyManager, def.range)
    if (!nearbyEnemy) return

    weapon.cooldownRemaining = def.cooldown

    if (!this.scene) return
    const maxR = def.aoeRadius ?? def.range
    const duration = def.aoeDuration ?? 0.5

    const geo = new THREE.RingGeometry(0.1, 0.3, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: def.id === 'ground_slam' ? 0xff6600 : 0x44aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2  // lay flat on ground
    const y = this.sampleHeight ? this.sampleHeight(playerPosition.x, playerPosition.z) + 0.1 : playerPosition.y
    mesh.position.set(playerPosition.x, y, playerPosition.z)
    this.scene.add(mesh)

    this.areaEffects.push({
      mesh,
      radius: 0.1,
      maxRadius: maxR,
      damage: def.damage,
      duration,
      elapsed: 0,
      hitEnemies: new Set(),
    })
  }

  private updateAreaEffects(
    delta: number,
    enemyManager: EnemyManager,
    damageSystem?: DamageSystem,
    eventBus?: EventBus,
  ): void {
    for (let idx = this.areaEffects.length - 1; idx >= 0; idx--) {
      const fx = this.areaEffects[idx]
      fx.elapsed += delta
      const t = fx.elapsed / fx.duration

      fx.radius = fx.maxRadius * Math.min(t, 1)
      // Scale the ring mesh to match current radius
      const s = fx.radius / 0.3
      fx.mesh.scale.setScalar(s)

      // Fade out
      const mat = fx.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1 - t * 0.8)

      // Damage check
      if (damageSystem && eventBus) {
        for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
          if (fx.hitEnemies.has(i)) continue
          const enemy = enemyManager.enemies[i]
          const dx = enemy.mesh.position.x - fx.mesh.position.x
          const dz = enemy.mesh.position.z - fx.mesh.position.z
          const distSq = dx * dx + dz * dz
          if (distSq < fx.radius * fx.radius) {
            fx.hitEnemies.add(i)
            damageSystem.applyDamage(enemyManager, i, fx.damage, eventBus)
          }
        }
      }

      if (fx.elapsed >= fx.duration) {
        this.scene?.remove(fx.mesh)
        fx.mesh.geometry.dispose()
        ;(fx.mesh.material as THREE.Material).dispose()
        this.areaEffects.splice(idx, 1)
      }
    }
  }

  // ------------------------------------------------------------------ //
  //  Chain lightning
  // ------------------------------------------------------------------ //
  private handleChain(
    def: WeaponDef,
    weapon: ActiveWeapon,
    playerPosition: THREE.Vector3,
    enemyManager: EnemyManager,
    damageSystem: DamageSystem,
    eventBus: EventBus,
  ): void {
    const firstTarget = findNearestEnemy(playerPosition, enemyManager, def.range)
    if (!firstTarget) return

    weapon.cooldownRemaining = def.cooldown

    // Find the actual enemy index for the first target
    const firstIdx = findNearestEnemyIndex(playerPosition, enemyManager, def.range)
    if (firstIdx === -1) return

    const hitIndices: number[] = [firstIdx]
    damageSystem.applyDamage(enemyManager, firstIdx, def.damage, eventBus)

    // Chain to nearby enemies
    const chainCount = def.chainCount ?? 2
    const chainRange = def.chainRange ?? 8

    let lastPos = enemyManager.enemies[firstIdx]?.mesh.position ?? firstTarget

    for (let c = 0; c < chainCount; c++) {
      if (!lastPos) break
      const nextIdx = findNearestEnemyIndexExcluding(lastPos, enemyManager, chainRange, hitIndices)
      if (nextIdx === -1) break

      const chainDamage = def.damage * Math.pow(0.75, c + 1)  // falloff per bounce
      damageSystem.applyDamage(enemyManager, nextIdx, chainDamage, eventBus)
      hitIndices.push(nextIdx)
      lastPos = enemyManager.enemies[nextIdx]?.mesh.position ?? lastPos
    }
  }

  // ------------------------------------------------------------------ //
  //  Deployable turret
  // ------------------------------------------------------------------ //
  private handleDeployable(
    def: WeaponDef,
    weapon: ActiveWeapon,
    playerPosition: THREE.Vector3,
  ): void {
    weapon.cooldownRemaining = def.cooldown

    if (!this.scene) return
    const y = this.sampleHeight ? this.sampleHeight(playerPosition.x, playerPosition.z) : playerPosition.y

    const geo = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa })
    const mesh = new THREE.Mesh(geo, mat)

    // Place 2 units in front of player
    const offset = new THREE.Vector3(0, 0, -2)
    offset.applyQuaternion(new THREE.Quaternion())  // will just be ahead on Z axis
    const px = playerPosition.x + (Math.random() - 0.5) * 2
    const pz = playerPosition.z + (Math.random() - 0.5) * 2
    mesh.position.set(px, y + 0.6, pz)
    this.scene.add(mesh)

    this.turrets.push({
      mesh,
      position: new THREE.Vector3(px, y, pz),
      fireTimer: 0.5,
      timeLeft: def.deployDuration ?? 15,
      damage: def.damage,
      range: def.range,
      projectileSpeed: def.projectileSpeed,
    })
  }

  private updateTurrets(
    delta: number,
    enemyManager: EnemyManager,
    projectileSystem: ProjectileSystem,
  ): void {
    for (let idx = this.turrets.length - 1; idx >= 0; idx--) {
      const turret = this.turrets[idx]
      turret.timeLeft -= delta
      turret.fireTimer -= delta

      if (turret.fireTimer <= 0) {
        turret.fireTimer = 0.8  // turret fires every 0.8s

        const target = findNearestEnemy(turret.position, enemyManager, turret.range)
        if (target) {
          const dir = target.clone().sub(turret.mesh.position)
          dir.y = 0
          dir.normalize()
          projectileSystem.spawn(
            turret.mesh.position.clone(),
            dir,
            turret.projectileSpeed,
            turret.damage,
            turret.range,
          )
        }
      }

      if (turret.timeLeft <= 0) {
        this.scene?.remove(turret.mesh)
        turret.mesh.geometry.dispose()
        ;(turret.mesh.material as THREE.Material).dispose()
        this.turrets.splice(idx, 1)
      }
    }
  }

  // ------------------------------------------------------------------ //
  //  Gravity vortex
  // ------------------------------------------------------------------ //
  private handleGravity(
    def: WeaponDef,
    weapon: ActiveWeapon,
    playerPosition: THREE.Vector3,
  ): void {
    const duration = def.pullDuration ?? 3
    const pullStrength = def.pullStrength ?? 8

    weapon.cooldownRemaining = def.cooldown

    if (!this.scene) return

    const nearestPos = weapon.def.autoTarget
      ? null   // will be placed at player position if no target vicinity needed
      : null

    const vortexPos = nearestPos ?? playerPosition.clone()
    const y = this.sampleHeight ? this.sampleHeight(vortexPos.x, vortexPos.z) + 0.3 : vortexPos.y

    const geo = new THREE.TorusGeometry(1.5, 0.2, 8, 24)
    const mat = new THREE.MeshBasicMaterial({ color: 0x9933ff, transparent: true, opacity: 0.7 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(vortexPos.x, y, vortexPos.z)
    this.scene.add(mesh)

    this.gravityVortices.push({
      position: new THREE.Vector3(vortexPos.x, y, vortexPos.z),
      mesh,
      duration,
      elapsed: 0,
      pullStrength,
      damage: def.damage,
      damageTimer: 0,
    })
  }

  private updateGravityVortices(
    delta: number,
    enemyManager: EnemyManager,
    damageSystem?: DamageSystem,
    eventBus?: EventBus,
  ): void {
    for (let idx = this.gravityVortices.length - 1; idx >= 0; idx--) {
      const vortex = this.gravityVortices[idx]
      vortex.elapsed += delta
      vortex.damageTimer -= delta

      // Rotate the visual
      vortex.mesh.rotation.z += delta * 2

      // Pull enemies toward vortex
      for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
        const enemy = enemyManager.enemies[i]
        const dx = vortex.position.x - enemy.mesh.position.x
        const dz = vortex.position.z - enemy.mesh.position.z
        const distSq = dx * dx + dz * dz
        const pullRange = 14

        if (distSq < pullRange * pullRange && distSq > 0.01) {
          const dist = Math.sqrt(distSq)
          const factor = (vortex.pullStrength * delta) / dist
          enemy.mesh.position.x += dx * factor
          enemy.mesh.position.z += dz * factor
        }
      }

      // Damage tick on enemies inside the vortex center
      if (vortex.damageTimer <= 0 && damageSystem && eventBus) {
        vortex.damageTimer = 0.5
        for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
          const enemy = enemyManager.enemies[i]
          const dx = vortex.position.x - enemy.mesh.position.x
          const dz = vortex.position.z - enemy.mesh.position.z
          if (dx * dx + dz * dz < 2 * 2) {
            damageSystem.applyDamage(enemyManager, i, vortex.damage, eventBus)
          }
        }
      }

      if (vortex.elapsed >= vortex.duration) {
        this.scene?.remove(vortex.mesh)
        vortex.mesh.geometry.dispose()
        ;(vortex.mesh.material as THREE.Material).dispose()
        this.gravityVortices.splice(idx, 1)
      }
    }
  }

  dispose(): void {
    for (const fx of this.areaEffects) {
      this.scene?.remove(fx.mesh)
      fx.mesh.geometry.dispose()
      ;(fx.mesh.material as THREE.Material).dispose()
    }
    this.areaEffects.length = 0

    for (const t of this.turrets) {
      this.scene?.remove(t.mesh)
      t.mesh.geometry.dispose()
      ;(t.mesh.material as THREE.Material).dispose()
    }
    this.turrets.length = 0

    for (const v of this.gravityVortices) {
      this.scene?.remove(v.mesh)
      v.mesh.geometry.dispose()
      ;(v.mesh.material as THREE.Material).dispose()
    }
    this.gravityVortices.length = 0
  }
}

// ---- helpers ----

function getCameraDirection(camera: THREE.Camera): THREE.Vector3 {
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)

  // For top-down/overhead cameras, the camera looks straight down so
  // world direction is mostly (0,-1,0).  Project onto XZ and use that;
  // if the horizontal component is too small, fall back to the camera's
  // local -Z projected onto XZ (the direction the camera "faces" ignoring pitch).
  if (Math.abs(dir.y) > 0.9) {
    // Extract forward from the camera's rotation ignoring pitch
    dir.set(0, 0, -1).applyQuaternion(camera.quaternion)
  }
  dir.y = 0
  dir.normalize()
  return dir
}

function findNearestEnemy(
  from: THREE.Vector3,
  enemyManager: EnemyManager,
  range: number,
): THREE.Vector3 | null {
  let bestDist = range * range
  let bestPos: THREE.Vector3 | null = null

  for (const enemy of enemyManager.enemies) {
    const dx = enemy.mesh.position.x - from.x
    const dz = enemy.mesh.position.z - from.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDist) {
      bestDist = distSq
      bestPos = enemy.mesh.position.clone()
    }
  }

  return bestPos
}

function findNearestEnemyIndex(
  from: THREE.Vector3,
  enemyManager: EnemyManager,
  range: number,
): number {
  let bestDist = range * range
  let bestIdx = -1

  for (let i = 0; i < enemyManager.enemies.length; i++) {
    const enemy = enemyManager.enemies[i]
    const dx = enemy.mesh.position.x - from.x
    const dz = enemy.mesh.position.z - from.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDist) {
      bestDist = distSq
      bestIdx = i
    }
  }

  return bestIdx
}

function findNearestEnemyIndexExcluding(
  from: THREE.Vector3,
  enemyManager: EnemyManager,
  range: number,
  exclude: number[],
): number {
  let bestDist = range * range
  let bestIdx = -1

  for (let i = 0; i < enemyManager.enemies.length; i++) {
    if (exclude.includes(i)) continue
    const enemy = enemyManager.enemies[i]
    const dx = enemy.mesh.position.x - from.x
    const dz = enemy.mesh.position.z - from.z
    const distSq = dx * dx + dz * dz
    if (distSq < bestDist) {
      bestDist = distSq
      bestIdx = i
    }
  }

  return bestIdx
}

function rotateAroundY(dir: THREE.Vector3, angle: number): THREE.Vector3 {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return new THREE.Vector3(
    dir.x * cos - dir.z * sin,
    dir.y,
    dir.x * sin + dir.z * cos,
  ).normalize()
}
