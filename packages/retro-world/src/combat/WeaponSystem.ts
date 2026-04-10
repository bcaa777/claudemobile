import { WorldState } from '../systems/WorldState'

export type WeaponType = 'sword' | 'magic'

export interface AttackInfo {
  type: WeaponType
  range: number
  damage: number
}

interface AttunementTier {
  xpCost: number
  damage: number
  cooldown: number
}

export class WeaponSystem {
  private currentWeapon: WeaponType = 'sword'
  private cooldownTimer = 0
  private worldState: WorldState

  // Sword stats
  private readonly SWORD_RANGE = 3.5
  private readonly SWORD_DAMAGE = 15
  private readonly SWORD_COOLDOWN = 0.35

  // Resonance Bolt (magic) stats — base values, scaled by attunement tier
  private readonly MAGIC_RANGE = 50

  // Attunement tiers for magic upgrades
  private static TIERS: AttunementTier[] = [
    { xpCost: 0, damage: 15, cooldown: 0.6 },
    { xpCost: 50, damage: 20, cooldown: 0.55 },
    { xpCost: 150, damage: 28, cooldown: 0.48 },
    { xpCost: 350, damage: 38, cooldown: 0.40 },
    { xpCost: 700, damage: 50, cooldown: 0.32 },
  ]

  constructor(worldState: WorldState) {
    this.worldState = worldState
  }

  update(dt: number): void {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt)
  }

  canAttack(): boolean {
    return this.cooldownTimer <= 0
  }

  attack(): AttackInfo | null {
    if (!this.canAttack()) return null

    if (this.currentWeapon === 'magic' && this.worldState.hasGun) {
      const tier = WeaponSystem.TIERS[this.worldState.gunTier] || WeaponSystem.TIERS[0]
      this.cooldownTimer = tier.cooldown
      return { type: 'magic', range: this.MAGIC_RANGE, damage: tier.damage }
    }

    this.cooldownTimer = this.SWORD_COOLDOWN
    return { type: 'sword', range: this.SWORD_RANGE, damage: this.SWORD_DAMAGE }
  }

  swapWeapon(): void {
    if (this.worldState.hasGun) {
      this.currentWeapon = this.currentWeapon === 'sword' ? 'magic' : 'sword'
    }
  }

  getCurrentWeapon(): WeaponType {
    return this.currentWeapon
  }

  getCooldownProgress(): number {
    return this.cooldownTimer
  }

  /** Check if player can upgrade and what it costs */
  getUpgradeInfo(): { canUpgrade: boolean; cost: number; nextTier: number } | null {
    const nextTier = this.worldState.gunTier + 1
    if (nextTier >= WeaponSystem.TIERS.length) return null

    const tier = WeaponSystem.TIERS[nextTier]
    return {
      canUpgrade: this.worldState.playerXP >= tier.xpCost,
      cost: tier.xpCost,
      nextTier,
    }
  }

  /** Perform upgrade — returns true if successful */
  upgrade(): boolean {
    const info = this.getUpgradeInfo()
    if (!info || !info.canUpgrade) return false

    this.worldState.playerXP -= info.cost
    this.worldState.gunTier = info.nextTier
    return true
  }
}
