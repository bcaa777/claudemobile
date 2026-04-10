import * as THREE from 'three'
import { COMPANION_DEFS } from './CompanionDefs'
import type { CompanionDef } from './CompanionDefs'
import type { ActiveEnemy, EnemyManager } from '../enemies/EnemyFactory'
import type { DamageSystem } from '../combat/DamageSystem'
import type { EventBus } from '@engine/core'
import type { GameState } from '../state/GameState'

const FOLLOW_DIST = 4       // start following if farther than this
const TELEPORT_DIST = 30    // teleport to player if farther than this
const XP_PER_LEVEL = 50

interface CompanionProjectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  targetIndex: number
  damage: number
  lifetime: number
}

// ── Species-specific mesh builders ────────────────────────────────────────────

function buildCompanionMesh(species: string, color: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color })
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 })

  switch (species) {
    case 'wolf': {
      // Elongated body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat)
      body.scale.set(1.6, 0.9, 1.0)
      body.position.y = 0.45
      group.add(body)
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), mat)
      head.position.set(0, 0.7, 0.38)
      group.add(head)
      // Snout
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 5), mat)
      snout.rotation.x = Math.PI / 2
      snout.position.set(0, 0.62, 0.58)
      group.add(snout)
      // Ears
      const earGeo = new THREE.ConeGeometry(0.07, 0.18, 4)
      const earL = new THREE.Mesh(earGeo, mat)
      earL.position.set(-0.12, 0.9, 0.3)
      const earR = new THREE.Mesh(earGeo, mat)
      earR.position.set(0.12, 0.9, 0.3)
      group.add(earL, earR)
      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.38, 5)
      const positions: [number, number, number][] = [
        [-0.22, 0.19, 0.22], [0.22, 0.19, 0.22],
        [-0.22, 0.19, -0.22], [0.22, 0.19, -0.22],
      ]
      for (const p of positions) {
        const leg = new THREE.Mesh(legGeo, darkMat)
        leg.position.set(...p)
        group.add(leg)
      }
      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.35, 5), mat)
      tail.rotation.x = -0.7
      tail.position.set(0, 0.6, -0.5)
      group.add(tail)
      break
    }

    case 'deer': {
      // Taller body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat)
      body.scale.set(1.3, 1.1, 1.0)
      body.position.y = 0.55
      group.add(body)
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), mat)
      head.position.set(0, 0.9, 0.32)
      group.add(head)
      // 4 longer legs
      const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.52, 5)
      const positions: [number, number, number][] = [
        [-0.2, 0.26, 0.2], [0.2, 0.26, 0.2],
        [-0.2, 0.26, -0.2], [0.2, 0.26, -0.2],
      ]
      for (const p of positions) {
        const leg = new THREE.Mesh(legGeo, darkMat)
        leg.position.set(...p)
        group.add(leg)
      }
      // Antlers (cones)
      const antlerGeo = new THREE.ConeGeometry(0.035, 0.3, 4)
      const antlerMat = new THREE.MeshLambertMaterial({ color: 0x8b5e3c })
      for (const side of [-1, 1]) {
        const a = new THREE.Mesh(antlerGeo, antlerMat)
        a.position.set(side * 0.12, 1.15, 0.28)
        a.rotation.z = side * 0.3
        group.add(a)
        const ab = new THREE.Mesh(antlerGeo, antlerMat)
        ab.scale.set(0.7, 0.7, 0.7)
        ab.position.set(side * 0.2, 1.2, 0.22)
        ab.rotation.z = side * 0.7
        group.add(ab)
      }
      break
    }

    case 'bird': {
      // Small round body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), mat)
      body.position.y = 0.55
      group.add(body)
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 5), mat)
      head.position.set(0, 0.82, 0.2)
      group.add(head)
      // Beak
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), new THREE.MeshLambertMaterial({ color: 0xffcc00 }))
      beak.rotation.x = Math.PI / 2
      beak.position.set(0, 0.8, 0.37)
      group.add(beak)
      // Wings (planes)
      const wingGeo = new THREE.PlaneGeometry(0.55, 0.22)
      const wingMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      const wingL = new THREE.Mesh(wingGeo, wingMat)
      wingL.position.set(-0.32, 0.58, 0)
      wingL.rotation.z = 0.35
      wingL.userData.isWing = true
      const wingR = new THREE.Mesh(wingGeo, wingMat)
      wingR.position.set(0.32, 0.58, 0)
      wingR.rotation.z = -0.35
      wingR.userData.isWing = true
      group.add(wingL, wingR)
      // Tail feathers
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), mat)
      tail.rotation.x = -0.6
      tail.position.set(0, 0.55, -0.3)
      group.add(tail)
      break
    }

    case 'fox': {
      // Smaller wolf-like body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat)
      body.scale.set(1.4, 0.85, 0.95)
      body.position.y = 0.38
      group.add(body)
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), mat)
      head.position.set(0, 0.6, 0.32)
      group.add(head)
      // Snout (longer/pointed)
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), mat)
      snout.rotation.x = Math.PI / 2
      snout.position.set(0, 0.55, 0.52)
      group.add(snout)
      // Big ears
      const earGeo = new THREE.ConeGeometry(0.08, 0.25, 4)
      const earL = new THREE.Mesh(earGeo, mat)
      earL.position.set(-0.13, 0.82, 0.26)
      const earR = new THREE.Mesh(earGeo, mat)
      earR.position.set(0.13, 0.82, 0.26)
      group.add(earL, earR)
      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.32, 5)
      const positions: [number, number, number][] = [
        [-0.18, 0.16, 0.18], [0.18, 0.16, 0.18],
        [-0.18, 0.16, -0.18], [0.18, 0.16, -0.18],
      ]
      for (const p of positions) {
        const leg = new THREE.Mesh(legGeo, darkMat)
        leg.position.set(...p)
        group.add(leg)
      }
      // Bushy tail (cone)
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6), mat)
      tail.rotation.x = -0.8
      tail.position.set(0, 0.52, -0.45)
      group.add(tail)
      break
    }

    default: {
      // Fallback sphere
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), mat)
      mesh.position.y = 0.5
      group.add(mesh)
      break
    }
  }

  return group
}

// ── CompanionSystem ────────────────────────────────────────────────────────────

export class CompanionSystem {
  private scene: THREE.Scene | null = null
  private group: THREE.Group | null = null
  private def: CompanionDef | null = null

  // Combat state
  private attackCooldown = 0
  private dashTarget: THREE.Vector3 | null = null
  private dashReturn: THREE.Vector3 | null = null
  private dashPhase: 'idle' | 'approach' | 'return' = 'idle'

  // Projectiles (for dive/ranged attacks)
  private projectiles: CompanionProjectile[] = []
  private projGeo = new THREE.SphereGeometry(0.15, 6, 6)

  // Animation
  private animTime = 0

  // Leveling
  xp = 0
  level = 1
  private xpToNext = XP_PER_LEVEL

  // Scaled stats
  private currentDamage = 0
  private currentHealth = 0
  private maxHealth = 0

  get active(): boolean {
    return this.group !== null
  }

  getPosition(): THREE.Vector3 | null {
    return this.group ? this.group.position : null
  }

  // Internal helper: the position object used for movement
  private get pos(): THREE.Vector3 | null {
    return this.group ? this.group.position : null
  }

  spawn(scene: THREE.Scene, companionId: string, playerPos: THREE.Vector3): void {
    const def = COMPANION_DEFS[companionId]
    if (!def) {
      console.warn(`[CompanionSystem] Unknown companion id: ${companionId}`)
      return
    }

    this.dispose()
    this.scene = scene
    this.def = def

    // Reset per-expedition state
    this.xp = 0
    this.level = 1
    this.xpToNext = XP_PER_LEVEL
    this.attackCooldown = 0
    this.dashPhase = 'idle'
    this.dashTarget = null
    this.dashReturn = null
    this.animTime = 0

    this.currentDamage = def.attackDamage
    this.maxHealth = def.baseHealth
    this.currentHealth = this.maxHealth

    this.group = buildCompanionMesh(companionId, def.color)
    this.group.position.set(playerPos.x + 2, playerPos.y, playerPos.z + 2)
    scene.add(this.group)

    console.log(`[CompanionSystem] Spawned ${def.name}`)
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    enemyManager: EnemyManager,
    damageSystem: DamageSystem,
    eventBus: EventBus,
    sampleHeight: (x: number, z: number) => number,
  ): void {
    if (!this.group || !this.def) return

    this.animTime += delta
    const pos = this.group.position

    // ── Terrain snap ──────────────────────────────────────────────────────
    const groundY = sampleHeight(pos.x, pos.z)
    pos.y = groundY + 0.5

    // ── Wing flap animation (bird) ────────────────────────────────────────
    if (this.def.id === 'bird') {
      const flapAngle = Math.sin(this.animTime * 8) * 0.5
      this.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.userData.isWing) {
          const side = obj.position.x < 0 ? 1 : -1
          obj.rotation.z = side * (0.35 + flapAngle)
        }
      })
    }

    // ── Follow player ─────────────────────────────────────────────────────
    const dx = playerPos.x - pos.x
    const dz = playerPos.z - pos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > TELEPORT_DIST) {
      pos.set(playerPos.x + 2, playerPos.y, playerPos.z + 2)
    } else if (dist > FOLLOW_DIST && this.dashPhase === 'idle') {
      const speed = this.def.baseSpeed * delta
      const ratio = Math.min(speed / dist, 1)
      pos.x += dx * ratio
      pos.z += dz * ratio
    }

    // Face direction of travel
    if (dist > 0.1) {
      this.group.rotation.y = Math.atan2(dx, dz)
    }

    // ── Attack ────────────────────────────────────────────────────────────
    this.attackCooldown = Math.max(0, this.attackCooldown - delta)

    if (this.dashPhase === 'approach' && this.dashTarget) {
      // Dash toward enemy
      const tdx = this.dashTarget.x - pos.x
      const tdz = this.dashTarget.z - pos.z
      const tdist = Math.sqrt(tdx * tdx + tdz * tdz)
      if (tdist < 0.5) {
        // Hit — find the enemy at that position and deal damage
        this.meleeHitNearTarget(this.dashTarget, enemyManager, damageSystem, eventBus)
        this.dashPhase = 'return'
      } else {
        const speed = (this.def.baseSpeed * 2.5) * delta
        const ratio = Math.min(speed / tdist, 1)
        pos.x += tdx * ratio
        pos.z += tdz * ratio
      }
    } else if (this.dashPhase === 'return' && this.dashReturn) {
      // Return to pre-dash position near player
      const rdx = playerPos.x - pos.x
      const rdz = playerPos.z - pos.z
      const rdist = Math.sqrt(rdx * rdx + rdz * rdz)
      if (rdist < FOLLOW_DIST || rdist < 0.5) {
        this.dashPhase = 'idle'
        this.dashReturn = null
        this.dashTarget = null
      } else {
        const speed = this.def.baseSpeed * 1.5 * delta
        const ratio = Math.min(speed / rdist, 1)
        pos.x += rdx * ratio
        pos.z += rdz * ratio
      }
    } else if (this.dashPhase === 'idle' && this.attackCooldown <= 0) {
      // Find nearest enemy in range
      const target = this.findNearestEnemy(pos, enemyManager)
      if (target !== null) {
        this.attackCooldown = this.def.attackCooldown
        const enemy = enemyManager.enemies[target]
        if (this.def.attackType === 'melee') {
          this.dashPhase = 'approach'
          this.dashTarget = enemy.mesh.position.clone()
          this.dashReturn = pos.clone()
        } else {
          // Dive / ranged: spawn projectile
          this.spawnProjectile(pos, enemy.mesh.position, target)
        }
      }
    }

    // ── Update projectiles ────────────────────────────────────────────────
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i]
      proj.lifetime -= delta
      proj.mesh.position.addScaledVector(proj.velocity, delta)

      const enemy = enemyManager.enemies[proj.targetIndex]
      if (enemy) {
        const pdx = proj.mesh.position.x - enemy.mesh.position.x
        const pdz = proj.mesh.position.z - enemy.mesh.position.z
        if (pdx * pdx + pdz * pdz < 1.0) {
          // Hit
          const died = damageSystem.applyDamage(enemyManager, proj.targetIndex, proj.damage, eventBus)
          if (died) this.addXp(10)
          this.removeProjectile(i)
          continue
        }
      }

      if (proj.lifetime <= 0) {
        this.removeProjectile(i)
      }
    }
  }

  private findNearestEnemy(pos: THREE.Vector3, enemyManager: EnemyManager): number | null {
    if (!this.def) return null
    const rangeSq = this.def.attackRange * this.def.attackRange
    let bestDist = Infinity
    let bestIdx: number | null = null

    for (let i = 0; i < enemyManager.enemies.length; i++) {
      const e = enemyManager.enemies[i]
      const dx = e.mesh.position.x - pos.x
      const dz = e.mesh.position.z - pos.z
      const d = dx * dx + dz * dz
      if (d < rangeSq && d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  }

  private meleeHitNearTarget(
    target: THREE.Vector3,
    enemyManager: EnemyManager,
    damageSystem: DamageSystem,
    eventBus: EventBus,
  ): void {
    // Find enemy closest to the dash target position
    let bestDist = Infinity
    let bestIdx = -1
    for (let i = 0; i < enemyManager.enemies.length; i++) {
      const e = enemyManager.enemies[i]
      const dx = e.mesh.position.x - target.x
      const dz = e.mesh.position.z - target.z
      const d = dx * dx + dz * dz
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0 && bestDist < 4) {
      const died = damageSystem.applyDamage(enemyManager, bestIdx, this.currentDamage, eventBus)
      if (died) this.addXp(10)
    }
  }

  private spawnProjectile(from: THREE.Vector3, to: THREE.Vector3, targetIndex: number): void {
    if (!this.def || !this.scene) return
    const mat = new THREE.MeshBasicMaterial({ color: this.def.color })
    const mesh = new THREE.Mesh(this.projGeo, mat)
    mesh.position.copy(from)
    mesh.position.y += 0.5

    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize()
    const velocity = dir.multiplyScalar(18)

    this.scene.add(mesh)
    this.projectiles.push({ mesh, velocity, targetIndex, damage: this.currentDamage, lifetime: 3 })
  }

  private removeProjectile(index: number): void {
    const proj = this.projectiles[index]
    this.scene?.remove(proj.mesh)
    ;(proj.mesh.material as THREE.Material).dispose()
    this.projectiles.splice(index, 1)
  }

  addXp(amount: number): void {
    this.xp += amount
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = Math.floor(XP_PER_LEVEL * Math.pow(1.2, this.level - 1))
      this.currentDamage = Math.round(this.currentDamage * 1.15)
      this.maxHealth = Math.round(this.maxHealth * 1.1)
      this.currentHealth = this.maxHealth
      console.log(`[CompanionSystem] ${this.def?.name} leveled up to ${this.level}! dmg=${this.currentDamage} hp=${this.maxHealth}`)
    }
  }

  applyPassive(gameState: GameState): void {
    if (!this.def) return
    const { type, value } = this.def.passive
    switch (type) {
      case 'damage_mult':
        gameState.damageBonus += Math.round((value - 1) * 100)
        break
      case 'damage_reduction':
        // Store as a flag game systems can read
        ;(gameState as any).damageReduction = ((gameState as any).damageReduction ?? 0) + value
        break
      case 'pickup_range':
        gameState.pickupRange += value
        break
      case 'reveal_enemies':
        ;(gameState as any).revealEnemies = true
        break
    }
    console.log(`[CompanionSystem] Applied passive ${type}=${value} from ${this.def.name}`)
  }

  dispose(): void {
    if (!this.scene) return

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i)
    }

    if (this.group) {
      this.scene.remove(this.group)
      this.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
          else obj.material.dispose()
        }
      })
      this.group = null
    }

    this.projGeo.dispose()
    this.projGeo = new THREE.SphereGeometry(0.15, 6, 6)
    this.def = null
    this.scene = null
    this.dashPhase = 'idle'
    this.dashTarget = null
    this.dashReturn = null
  }
}
