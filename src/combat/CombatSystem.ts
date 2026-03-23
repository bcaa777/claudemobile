import * as THREE from 'three'
import { WeaponSystem, AttackInfo } from './WeaponSystem'
import { ENEMY_DEFS } from './EnemyTypes'
import { CreatureManager } from '../creatures/CreatureManager'
import { WorldState } from '../systems/WorldState'
import { InputManager } from '../engine/InputManager'
import { ProjectileManager } from './ProjectileManager'
import { CombatEffects } from './CombatEffects'
import { MagicPickup } from './MagicPickup'
import { PlayerState } from '../player/PlayerState'
import { WeaponHUD } from './WeaponHUD'

const _tmpDir = new THREE.Vector3()
const _tmpFwd = new THREE.Vector3()

/** Maximum angle (radians) between camera forward and direction-to-creature for a hit */
const HIT_CONE_ANGLE = 15 * (Math.PI / 180) // 15 degrees

export class CombatSystem {
  private weaponSystem: WeaponSystem
  private camera: THREE.Camera
  private creatureManager: CreatureManager
  private worldState: WorldState
  private projectileManager: ProjectileManager
  private combatEffects: CombatEffects
  private magicPickup: MagicPickup | null = null
  private playerState: PlayerState
  private weaponHUD: WeaponHUD

  // Camera effects
  private punchBob = 0 // camera forward offset during melee
  private recoilPitch = 0 // camera pitch offset during magic cast

  // Pickup message
  private pickupMessageShown = false

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    creatureManager: CreatureManager,
    worldState: WorldState,
    playerState: PlayerState
  ) {
    this.weaponSystem = new WeaponSystem(worldState)
    this.camera = camera
    this.creatureManager = creatureManager
    this.worldState = worldState
    this.playerState = playerState
    this.projectileManager = new ProjectileManager(scene)
    this.combatEffects = new CombatEffects(scene)
    this.weaponHUD = new WeaponHUD()
  }

  /** Place the magic pickup near the castle gate */
  placeMagicPickup(castlePos: THREE.Vector3, scene: THREE.Scene): void {
    const pickupPos = new THREE.Vector3(
      castlePos.x + 8,
      castlePos.y + 1.5,
      castlePos.z + 48
    )
    this.magicPickup = new MagicPickup(pickupPos, scene)
  }

  update(
    dt: number,
    input: InputManager,
    playerPos: THREE.Vector3,
    elapsedTime: number
  ): void {
    this.weaponSystem.update(dt)

    // Decay camera effects
    this.punchBob *= Math.max(0, 1 - dt * 10)
    this.recoilPitch *= Math.max(0, 1 - dt * 8)

    // Upgrade menu toggle
    if (input.consumeUpgradeMenu()) {
      if (this.weaponHUD.isUpgradePanelOpen()) {
        this.weaponHUD.hideUpgradePanel()
      } else if (this.worldState.hasGun) {
        this.weaponHUD.showUpgradePanel(this.worldState, this.weaponSystem)
      }
    }

    // Don't process combat input while upgrade panel is open
    if (this.weaponHUD.isUpgradePanelOpen()) {
      this.weaponHUD.update(this.worldState, this.weaponSystem, dt)
      this.combatEffects.update(dt)
      return
    }

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

    // --- Spitter projectile spawning ---
    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.isEnemy) continue
      if (creature.state === 'dead') continue

      const r = creature as unknown as Record<string, unknown>
      if (r._pendingProjectile) {
        r._pendingProjectile = false
        const def = creature.enemyType ? ENEMY_DEFS[creature.enemyType] : null
        const damage = def ? def.damage : 10
        this.projectileManager.spawn(creature.position, playerPos, damage)
      }

      // Melee damage from enemies (_dealDamage flag from EnemyAI)
      if (r._dealDamage) {
        r._dealDamage = false
        const def = creature.enemyType ? ENEMY_DEFS[creature.enemyType] : null
        const damage = def ? def.damage : 8
        this.playerState.takeDamage(damage, elapsedTime)
        this.combatEffects.createPlayerHitEffect()
      }

      // Shockwave from Warden
      if (r._shockwave) {
        r._shockwave = false
        const dist = creature.position.distanceTo(playerPos)
        if (dist <= 8) {
          const shockDmg = 15
          this.playerState.takeDamage(shockDmg, elapsedTime)
          this.combatEffects.createPlayerHitEffect()
        }
      }
    }

    // --- Projectile updates ---
    const projectileDamage = this.projectileManager.update(dt, playerPos)
    if (projectileDamage > 0) {
      this.playerState.takeDamage(projectileDamage, elapsedTime)
      this.combatEffects.createPlayerHitEffect()
    }

    // --- Magic pickup ---
    if (this.magicPickup && !this.magicPickup.isCollected()) {
      // Only consume interact when near the pickup (within 3 units)
      const nearPickup = playerPos.distanceTo(this.magicPickup.getPosition()) < 3
      const interactPressed = nearPickup ? input.consumeInteract() : false
      const collected = this.magicPickup.update(
        dt, playerPos, this.worldState, elapsedTime, interactPressed
      )
      if (collected && !this.pickupMessageShown) {
        this.pickupMessageShown = true
        // Show activation message via worldState
        this.worldState.activationMessage = 'Resonance Shard acquired. The Hollow will know your touch.'
        this.worldState.activationMessageTimer = 4
      }
    }

    // --- Combat effects ---
    this.combatEffects.update(dt)

    // --- Weapon HUD ---
    this.weaponHUD.update(this.worldState, this.weaponSystem, dt)

    // Camera shake from combat effects
    const shake = this.combatEffects.getShakeOffset()
    if (shake.lengthSq() > 0) {
      playerPos.x += shake.x
      playerPos.y += shake.y
    }
  }

  private performAttack(attack: AttackInfo, playerPos: THREE.Vector3): void {
    // Get camera forward direction
    this.camera.getWorldDirection(_tmpFwd)

    if (attack.type === 'fist') {
      this.punchBob = 0.08
      this.combatEffects.createMeleeSwing(playerPos, _tmpFwd)
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

        // Hit effect
        this.combatEffects.createHitEffect(creature.position)

        // Magic bolt visual
        if (attack.type === 'magic') {
          this.combatEffects.createMagicBolt(
            playerPos, creature.position, this.worldState.gunTier
          )
        }

        // If creature died from this hit, award XP
        if (healthBefore > 0 && creature.health <= 0 && creature.enemyType) {
          const def = ENEMY_DEFS[creature.enemyType]
          if (def) {
            this.worldState.playerXP += def.xp
            this.worldState.totalKills++
            this.combatEffects.createDeathEffect(creature.position, def.bodyColor)
            this.combatEffects.createXPPopup(creature.position, def.xp, this.camera)
          }
        }
      }
    } else if (attack.type === 'magic') {
      // Fire bolt into empty space (visual only, 30 units forward)
      const target = playerPos.clone().addScaledVector(_tmpFwd, 30)
      this.combatEffects.createMagicBolt(playerPos, target, this.worldState.gunTier)
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

  /** Access the weapon HUD */
  getWeaponHUD(): WeaponHUD {
    return this.weaponHUD
  }

  /** Access combat effects for camera shake */
  getCombatEffects(): CombatEffects {
    return this.combatEffects
  }

  /** Get the magic pickup position, or null if already collected or not placed */
  getMagicPickupPosition(): THREE.Vector3 | null {
    if (this.magicPickup && !this.magicPickup.isCollected()) {
      return this.magicPickup.getPosition()
    }
    return null
  }
}
