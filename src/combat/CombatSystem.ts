import * as THREE from 'three'
import { WeaponSystem, AttackInfo } from './WeaponSystem'
import { ENEMY_DEFS } from './EnemyTypes'
import { CreatureManager } from '../creatures/CreatureManager'
import { WorldState } from '../systems/WorldState'
import { InputManager } from '../engine/InputManager'

const _tmpDir = new THREE.Vector3()
const _tmpFwd = new THREE.Vector3()

/** Maximum angle (radians) between camera forward and direction-to-creature for a hit */
const HIT_CONE_ANGLE = 15 * (Math.PI / 180) // 15 degrees

export class CombatSystem {
  private weaponSystem: WeaponSystem
  private camera: THREE.Camera
  private creatureManager: CreatureManager
  private worldState: WorldState

  // Camera effects
  private punchBob = 0 // camera forward offset during melee
  private recoilPitch = 0 // camera pitch offset during magic cast

  constructor(
    camera: THREE.Camera,
    creatureManager: CreatureManager,
    worldState: WorldState
  ) {
    this.weaponSystem = new WeaponSystem(worldState)
    this.camera = camera
    this.creatureManager = creatureManager
    this.worldState = worldState
  }

  update(dt: number, input: InputManager, playerPos: THREE.Vector3): void {
    this.weaponSystem.update(dt)

    // Decay camera effects
    this.punchBob *= Math.max(0, 1 - dt * 10)
    this.recoilPitch *= Math.max(0, 1 - dt * 8)

    // Attack input
    if (input.consumeAttack()) {
      const attack = this.weaponSystem.attack()
      if (attack) {
        this.performAttack(attack, playerPos)
      }
    }

    // Swap weapon
    if (input.consumeSwapWeapon()) {
      this.weaponSystem.swapWeapon()
    }
  }

  private performAttack(attack: AttackInfo, playerPos: THREE.Vector3): void {
    // Get camera forward direction
    this.camera.getWorldDirection(_tmpFwd)

    if (attack.type === 'fist') {
      this.punchBob = 0.08
    } else {
      this.recoilPitch = 0.02
    }

    // Find the closest enemy creature within range and within hit cone
    let closestId: string | null = null
    let closestDist = Infinity

    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.isEnemy) continue
      if (creature.state === 'dead') continue

      // Direction from player to creature
      _tmpDir.subVectors(creature.position, playerPos)
      const dist = _tmpDir.length()

      if (dist > attack.range) continue
      if (dist < 0.01) continue // avoid zero-length vector

      // Normalize direction
      _tmpDir.divideScalar(dist)

      // Angle between camera forward and direction to creature
      const dot = _tmpFwd.dot(_tmpDir)
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)))

      if (angle > HIT_CONE_ANGLE) continue

      if (dist < closestDist) {
        closestDist = dist
        closestId = creature.id
      }
    }

    // Apply damage to the closest hit creature
    if (closestId) {
      const creature = this.creatureManager.creatures.get(closestId)
      if (creature) {
        const healthBefore = creature.health
        this.creatureManager.damageCreature(closestId, attack.damage)

        // If creature died from this hit, award XP
        if (healthBefore > 0 && creature.health <= 0 && creature.enemyType) {
          const def = ENEMY_DEFS[creature.enemyType]
          if (def) {
            this.worldState.playerXP += def.xp
            this.worldState.totalKills++
          }
        }
      }
    }
  }

  /** Camera forward offset from melee punch */
  getPunchBob(): number {
    return this.punchBob
  }

  /** Camera pitch offset from magic recoil */
  getRecoilPitch(): number {
    return this.recoilPitch
  }

  /** Access the weapon system for HUD / upgrade UI */
  getWeapon(): WeaponSystem {
    return this.weaponSystem
  }
}
