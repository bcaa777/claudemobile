import * as THREE from 'three'
import { Creature } from '../creatures/Creature'
import { ENEMY_DEFS, HollowType } from './EnemyTypes'
import type { CreatureManager } from '../creatures/CreatureManager'

// Re-usable scratch vectors (avoid per-frame allocations)
const _toPlayer = new THREE.Vector3()
const _lateral = new THREE.Vector3()
const _flee = new THREE.Vector3()
const _wanderTarget = new THREE.Vector3()

// ── Enemy AI states (stored in creature.state field using CreatureState union) ───
// Shambler: idle -> chase -> attack
// Spitter:  idle -> chase -> attack   (chase = strafe; attack = ranged)
// Stalker:  idle -> chase -> attack   (chase = circling; attack = charging)
// Warden:   idle -> chase -> attack   (attack includes slam + shockwave)

// Extra per-enemy runtime data stored via expando on the Creature instance.
// TypeScript won't complain at runtime; we cast to `any` for these fields.
interface EnemyRuntime {
  _aiCooldown: number        // attack / ability cooldown timer
  _shockwaveCooldown: number // warden shockwave timer
  _circleAngle: number       // stalker orbit angle
  _chargeDir: THREE.Vector3 | null // stalker charge direction
  _wardenSummoned: boolean   // whether warden has summoned adds at 50% hp
  _pendingProjectile: boolean // spitter projectile flag
}

function rt(c: Creature): EnemyRuntime {
  const a = c as unknown as Record<string, unknown>
  if (a._aiCooldown === undefined) {
    a._aiCooldown = 0
    a._shockwaveCooldown = 0
    a._circleAngle = Math.random() * Math.PI * 2
    a._chargeDir = null
    a._wardenSummoned = false
    a._pendingProjectile = false
  }
  return a as unknown as EnemyRuntime
}

/**
 * Tick the AI state machine for an enemy creature.
 * Called from CreatureManager in place of the normal herbivore/predator state machine.
 */
export function tickEnemyAI(
  creature: Creature,
  dt: number,
  playerPos: THREE.Vector3,
  creatureManager: CreatureManager
): void {
  if (creature.state === 'dead') return
  if (!creature.enemyType) return

  creature.stateTimer += dt

  const def = ENEMY_DEFS[creature.enemyType]
  const r = rt(creature)
  r._aiCooldown = Math.max(0, r._aiCooldown - dt)

  _toPlayer.subVectors(playerPos, creature.position)
  _toPlayer.y = 0
  const distToPlayer = _toPlayer.length()

  switch (creature.enemyType) {
    case 'shambler':
      tickShambler(creature, dt, playerPos, distToPlayer, def, r)
      break
    case 'spitter':
      tickSpitter(creature, dt, playerPos, distToPlayer, def, r)
      break
    case 'stalker':
      tickStalker(creature, dt, playerPos, distToPlayer, def, r)
      break
    case 'warden':
      tickWarden(creature, dt, playerPos, distToPlayer, def, r, creatureManager)
      break
  }
}

// ─── Shambler AI ──────────────────────────────────────────────────────────────
function tickShambler(
  c: Creature, dt: number, playerPos: THREE.Vector3,
  dist: number, def: typeof ENEMY_DEFS['shambler'], r: EnemyRuntime
): void {
  switch (c.state) {
    case 'idle':
    case 'wander':
      // Wander randomly
      if (c.state === 'idle' && c.stateTimer > 2) {
        c.state = 'wander'
        c.stateTimer = 0
        randomWanderTarget(c)
      }
      if (c.state === 'wander') {
        steerToTarget(c, 1.5)
        if (c.stateTimer > 6) {
          c.state = 'idle'
          c.stateTimer = 0
          c.velocity.set(0, 0, 0)
        }
      }
      // Check aggro
      if (dist < def.aggroRange) {
        c.state = 'chase'
        c.stateTimer = 0
      }
      break

    case 'chase':
      setTargetToward(c, playerPos)
      steerToTarget(c, 2.5)
      if (dist <= def.attackRange) {
        c.state = 'attack'
        c.stateTimer = 0
        r._aiCooldown = 0
      }
      if (dist > def.aggroRange * 1.5) {
        c.state = 'idle'
        c.stateTimer = 0
        c.velocity.set(0, 0, 0)
      }
      break

    case 'attack':
      setTargetToward(c, playerPos)
      steerToTarget(c, 2.5)
      if (dist > def.attackRange * 1.5) {
        c.state = 'chase'
        c.stateTimer = 0
        break
      }
      if (dist > def.aggroRange * 1.5) {
        c.state = 'idle'
        c.stateTimer = 0
        c.velocity.set(0, 0, 0)
        break
      }
      // Deal damage every attackCooldown seconds
      if (r._aiCooldown <= 0 && dist <= def.attackRange) {
        r._aiCooldown = def.attackCooldown
        // Signal damage to player (CreatureManager reads pendingKnockback)
        // We reuse the existing knockback mechanism
        ;(c as unknown as Record<string, unknown>)._dealDamage = true
      }
      break

    default:
      // Reset unknown states
      c.state = 'idle'
      c.stateTimer = 0
      break
  }
}

// ─── Spitter AI ───────────────────────────────────────────────────────────────
function tickSpitter(
  c: Creature, dt: number, playerPos: THREE.Vector3,
  dist: number, def: typeof ENEMY_DEFS['spitter'], r: EnemyRuntime
): void {
  // Floating bob (visual handled in mesh, but keep y offset stable)

  switch (c.state) {
    case 'idle':
    case 'wander':
      c.velocity.set(0, 0, 0)
      if (dist < def.aggroRange) {
        c.state = 'chase' // strafe mode
        c.stateTimer = 0
      }
      break

    case 'chase': {
      // Strafe laterally relative to player
      if (dist < 4) {
        // Flee backward
        _flee.subVectors(c.position, playerPos)
        _flee.y = 0
        _flee.normalize().multiplyScalar(5)
        c.velocity.x = _flee.x
        c.velocity.z = _flee.z
      } else {
        // Lateral strafe
        _toPlayer.subVectors(playerPos, c.position)
        _toPlayer.y = 0
        _toPlayer.normalize()
        _lateral.set(-_toPlayer.z, 0, _toPlayer.x) // perpendicular
        const sway = Math.sin(c.stateTimer * 1.2)
        c.velocity.x = _lateral.x * 4 * sway
        c.velocity.z = _lateral.z * 4 * sway
        // Also maintain distance (stay ~12 units away)
        if (dist < 10) {
          _flee.subVectors(c.position, playerPos).normalize()
          c.velocity.x += _flee.x * 2
          c.velocity.z += _flee.z * 2
        } else if (dist > 18) {
          c.velocity.x += _toPlayer.x * 2
          c.velocity.z += _toPlayer.z * 2
        }
      }
      // Update heading
      c.heading = Math.atan2(
        playerPos.x - c.position.x,
        playerPos.z - c.position.z
      )
      // Fire projectile every attackCooldown
      if (r._aiCooldown <= 0 && dist < def.aggroRange) {
        r._aiCooldown = def.attackCooldown
        r._pendingProjectile = true
        c.state = 'attack'
        c.stateTimer = 0
      }
      if (dist > def.aggroRange * 1.5) {
        c.state = 'idle'
        c.stateTimer = 0
        c.velocity.set(0, 0, 0)
      }
      break
    }

    case 'attack':
      // Brief pause during "fire" animation, then back to strafe
      c.velocity.set(0, 0, 0)
      if (c.stateTimer > 0.3) {
        c.state = 'chase'
        c.stateTimer = 0
      }
      break

    default:
      c.state = 'idle'
      c.stateTimer = 0
      break
  }
}

// ─── Stalker AI ───────────────────────────────────────────────────────────────
function tickStalker(
  c: Creature, dt: number, playerPos: THREE.Vector3,
  dist: number, def: typeof ENEMY_DEFS['stalker'], r: EnemyRuntime
): void {
  switch (c.state) {
    case 'idle':
    case 'wander':
      c.velocity.set(0, 0, 0)
      if (dist < def.aggroRange) {
        c.state = 'chase' // circling mode
        c.stateTimer = 0
        r._circleAngle = Math.atan2(
          c.position.x - playerPos.x,
          c.position.z - playerPos.z
        )
      }
      break

    case 'chase': {
      // Circling at ~18 unit radius
      const orbitRadius = 18
      r._circleAngle += dt * 0.8 // orbit speed
      const targetX = playerPos.x + Math.sin(r._circleAngle) * orbitRadius
      const targetZ = playerPos.z + Math.cos(r._circleAngle) * orbitRadius
      const dx = targetX - c.position.x
      const dz = targetZ - c.position.z
      const len = Math.sqrt(dx * dx + dz * dz) || 1
      c.velocity.x = (dx / len) * 6
      c.velocity.z = (dz / len) * 6
      c.heading = Math.atan2(
        playerPos.x - c.position.x,
        playerPos.z - c.position.z
      )
      // After 2-3s circling, charge
      if (c.stateTimer > 2 + Math.random() && r._aiCooldown <= 0) {
        c.state = 'attack' // charging mode
        c.stateTimer = 0
        // Compute charge direction toward player
        _toPlayer.subVectors(playerPos, c.position)
        _toPlayer.y = 0
        _toPlayer.normalize()
        r._chargeDir = _toPlayer.clone()
      }
      if (dist > def.aggroRange * 2) {
        c.state = 'idle'
        c.stateTimer = 0
        c.velocity.set(0, 0, 0)
      }
      break
    }

    case 'attack': {
      // Dash straight at player at speed 10
      if (r._chargeDir) {
        c.velocity.x = r._chargeDir.x * def.speed
        c.velocity.z = r._chargeDir.z * def.speed
        c.heading = Math.atan2(r._chargeDir.x, r._chargeDir.z)
      }
      // Check hit: if close to player, deal damage
      if (dist <= def.attackRange && r._aiCooldown <= 0) {
        r._aiCooldown = def.attackCooldown
        ;(c as unknown as Record<string, unknown>)._dealDamage = true
      }
      // After 1s (charge complete), return to circling with cooldown
      if (c.stateTimer > 1.0) {
        c.state = 'chase' // back to circling
        c.stateTimer = 0
        r._aiCooldown = def.attackCooldown
        r._chargeDir = null
        c.velocity.set(0, 0, 0)
      }
      break
    }

    default:
      c.state = 'idle'
      c.stateTimer = 0
      break
  }
}

// ─── Warden AI ────────────────────────────────────────────────────────────────
function tickWarden(
  c: Creature, dt: number, playerPos: THREE.Vector3,
  dist: number, def: typeof ENEMY_DEFS['warden'], r: EnemyRuntime,
  creatureManager: CreatureManager
): void {
  r._shockwaveCooldown = Math.max(0, r._shockwaveCooldown - dt)

  switch (c.state) {
    case 'idle':
    case 'wander':
      if (c.state === 'idle' && c.stateTimer > 2) {
        c.state = 'wander'
        c.stateTimer = 0
        randomWanderTarget(c)
      }
      if (c.state === 'wander') {
        steerToTarget(c, def.speed * 0.5)
        if (c.stateTimer > 5) {
          c.state = 'idle'
          c.stateTimer = 0
          c.velocity.set(0, 0, 0)
        }
      }
      if (dist < def.aggroRange) {
        c.state = 'chase'
        c.stateTimer = 0
      }
      break

    case 'chase':
      setTargetToward(c, playerPos)
      steerToTarget(c, def.speed)
      c.heading = Math.atan2(
        playerPos.x - c.position.x,
        playerPos.z - c.position.z
      )
      if (dist <= def.attackRange) {
        c.state = 'attack'
        c.stateTimer = 0
        r._aiCooldown = 0
      }
      if (dist > def.aggroRange * 2) {
        c.state = 'idle'
        c.stateTimer = 0
        c.velocity.set(0, 0, 0)
      }
      break

    case 'attack':
      // Move toward player slowly while attacking
      setTargetToward(c, playerPos)
      steerToTarget(c, def.speed * 0.5)
      c.heading = Math.atan2(
        playerPos.x - c.position.x,
        playerPos.z - c.position.z
      )

      if (dist > def.attackRange * 2) {
        c.state = 'chase'
        c.stateTimer = 0
        break
      }

      // Slam attack every attackCooldown
      if (r._aiCooldown <= 0 && dist <= def.attackRange) {
        r._aiCooldown = def.attackCooldown
        ;(c as unknown as Record<string, unknown>)._dealDamage = true
      }

      // Shockwave every 8s — damage all in radius 5
      if (r._shockwaveCooldown <= 0 && dist <= 8) {
        r._shockwaveCooldown = 8
        ;(c as unknown as Record<string, unknown>)._shockwave = true
      }

      // At 50% HP, summon 2 shamblers (once)
      if (!r._wardenSummoned && c.health <= def.hp * 0.5) {
        r._wardenSummoned = true
        for (let i = 0; i < 2; i++) {
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            0,
            (Math.random() - 0.5) * 6
          )
          const spawnPos = c.position.clone().add(offset)
          creatureManager.spawnEnemy('shambler' as HollowType, spawnPos)
        }
      }
      break

    default:
      c.state = 'idle'
      c.stateTimer = 0
      break
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setTargetToward(c: Creature, target: THREE.Vector3): void {
  if (!c.targetPos) c.targetPos = new THREE.Vector3()
  c.targetPos.copy(target)
}

function steerToTarget(c: Creature, speed: number): void {
  if (!c.targetPos) return
  const dx = c.targetPos.x - c.position.x
  const dz = c.targetPos.z - c.position.z
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len < 0.1) {
    c.velocity.x = 0
    c.velocity.z = 0
    return
  }
  c.velocity.x = (dx / len) * speed
  c.velocity.z = (dz / len) * speed
  c.heading = Math.atan2(dx, dz)
}

function randomWanderTarget(c: Creature): void {
  const angle = Math.random() * Math.PI * 2
  const dist = 5 + Math.random() * 10
  if (!c.targetPos) c.targetPos = new THREE.Vector3()
  c.targetPos.set(
    c.position.x + Math.sin(angle) * dist,
    c.position.y,
    c.position.z + Math.cos(angle) * dist
  )
}
