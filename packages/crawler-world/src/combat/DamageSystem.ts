import * as THREE from 'three'
import { Health } from '@engine/core'
import type { EventBus } from '@engine/core'
import type { EnemyManager, ActiveEnemy } from '../enemies/EnemyFactory'
import type { BossSystem } from '../enemies/BossSystem'

const FLASH_DURATION = 0.1   // seconds
const PLAYER_INVINCIBILITY = 0.5  // seconds between player damage ticks

interface FlashEntry {
  enemy: ActiveEnemy
  timer: number
  originalEmissive: THREE.Color
}

export class DamageSystem {
  private flashing: FlashEntry[] = []
  private playerInvincibilityTimer = 0

  /** Apply damage to a single enemy. Returns true if enemy died. */
  applyDamage(
    enemyManager: EnemyManager,
    enemyIndex: number,
    amount: number,
    eventBus: EventBus,
  ): boolean {
    const enemy = enemyManager.enemies[enemyIndex]
    if (!enemy?.mesh?.parent) return false

    const eid = enemy.eid
    Health.current[eid] = Math.max(0, Health.current[eid] - amount)

    // Flash red — all material access is guarded since the mesh may be
    // partially disposed if multiple damage sources hit the same frame.
    let bodyColor = new THREE.Color(1, 0, 0)
    try {
      const bodyMesh = enemy.mesh.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)
      const mat = bodyMesh?.material as THREE.MeshLambertMaterial | undefined
      if (mat?.emissive) {
        const originalEmissive = mat.emissive.clone()
        bodyColor = mat.color?.clone() ?? bodyColor
        mat.emissive.setHex(0xff0000)
        this.flashing.push({ enemy, timer: FLASH_DURATION, originalEmissive })
      }
    } catch {
      // mesh disposed mid-frame — skip flash
    }

    if (Health.current[eid] <= 0) {

      // Remove flash entry for this enemy before disposal
      const flashIdx = this.flashing.findIndex(f => f.enemy === enemy)
      if (flashIdx !== -1) this.flashing.splice(flashIdx, 1)

      // Emit death event before removing
      eventBus.emit('enemyDied', {
        position: enemy.mesh.position.clone(),
        archetype: enemy.archetype,
        eid,
        color: bodyColor,
      })

      enemyManager.remove(enemyIndex)
      return true
    }

    return false
  }

  /** Apply damage to the boss if present. */
  applyBossDamage(bossSystem: BossSystem | null, amount: number): void {
    if (bossSystem && bossSystem.active) {
      bossSystem.takeDamage(amount)
    }
  }

  /** Check whether any enemy is close enough to deal damage to the player. */
  checkPlayerDamage(
    enemies: EnemyManager['enemies'],
    playerPos: THREE.Vector3,
    playerHealth: { current: number },
    delta: number,
  ): void {
    if (this.playerInvincibilityTimer > 0) {
      this.playerInvincibilityTimer -= delta
      return
    }

    for (const enemy of enemies) {
      const dx = enemy.mesh.position.x - playerPos.x
      const dz = enemy.mesh.position.z - playerPos.z
      const distSq = dx * dx + dz * dz
      if (distSq < 1.5 * 1.5) {
        playerHealth.current -= enemy.damage
        this.playerInvincibilityTimer = PLAYER_INVINCIBILITY
        console.log(`[DamageSystem] Player hit by ${enemy.archetype} for ${enemy.damage} — HP: ${playerHealth.current}`)
        break
      }
    }
  }

  /** Must be called each frame to tick flash timers. */
  update(delta: number): void {
    for (let i = this.flashing.length - 1; i >= 0; i--) {
      const entry = this.flashing[i]
      entry.timer -= delta
      if (entry.timer <= 0) {
        // Guard: enemy mesh may have been removed/disposed already
        try {
          if (entry.enemy?.mesh?.parent) {
            const bodyMesh = entry.enemy.mesh.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)
            const mat = bodyMesh?.material as THREE.MeshLambertMaterial | undefined
            if (mat?.emissive) {
              mat.emissive.copy(entry.originalEmissive)
            }
          }
        } catch {
          // Enemy was disposed — skip restore
        }
        this.flashing.splice(i, 1)
      }
    }
  }
}
