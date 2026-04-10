import { GAME_CONFIG } from '../config'

export class GameState {
  xp = 0
  level = 1
  maxXp = GAME_CONFIG.xpToLevelBase
  gold = 0
  health: number
  maxHealth: number
  weapons: string[] = ['bolt_caster']
  weaponLevels: Record<string, number> = { bolt_caster: 1 }
  wave = 0

  // Stat bonuses from level-ups
  damageBonus = 0
  speedBonus = 0
  pickupRange = 5

  constructor() {
    this.health = GAME_CONFIG.playerHealth
    this.maxHealth = GAME_CONFIG.playerHealth
  }

  addXp(amount: number): boolean {
    this.xp += amount
    if (this.xp >= this.maxXp) {
      this.xp -= this.maxXp
      this.level++
      this.maxXp = Math.floor(this.maxXp * GAME_CONFIG.xpLevelScale)
      return true // level up!
    }
    return false
  }

  addGold(amount: number): void {
    this.gold += amount
  }

  reset(): void {
    this.xp = 0
    this.level = 1
    this.maxXp = GAME_CONFIG.xpToLevelBase
    this.gold = 0
    this.health = this.maxHealth
    this.wave = 0
    this.weapons = ['bolt_caster']
    this.weaponLevels = { bolt_caster: 1 }
    this.damageBonus = 0
    this.speedBonus = 0
    this.pickupRange = 5
  }
}
