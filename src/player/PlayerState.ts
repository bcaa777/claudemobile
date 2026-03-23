export class PlayerState {
  health = 100
  maxHealthBonus: number = 0
  damageFlashStrength = 0
  speedMultiplier = 1.0
  lastDamageTime = -Infinity
  isDead = false

  private deathCallback: (() => void) | null = null
  private respawnTimer = 0

  /** Dynamic max health: base 100 + XP bonus (capped at +100, i.e. max 200) */
  get maxHealth(): number {
    return this.getMaxHealth()
  }

  getMaxHealth(): number {
    return 100 + this.maxHealthBonus
  }

  onDeath(cb: () => void) {
    this.deathCallback = cb
  }

  takeDamage(amount: number, time: number) {
    if (this.isDead) return
    this.health = Math.max(0, this.health - amount)
    this.damageFlashStrength = Math.min(1, this.damageFlashStrength + amount / 20)
    this.lastDamageTime = time
    if (this.health <= 0) {
      this.isDead = true
      this.respawnTimer = 2.0
    }
  }

  heal(amount: number) {
    if (this.isDead) return
    this.health = Math.min(this.getMaxHealth(), this.health + amount)
  }

  /** Update max HP bonus from XP. Call once per frame with current playerXP. */
  updateMaxHealthFromXP(playerXP: number): void {
    // Every 100 XP grants +10 max HP, capped at +100 (total max 200)
    const bonus = Math.min(100, Math.floor(playerXP / 100) * 10)
    if (bonus > this.maxHealthBonus) {
      // Health scales up proportionally when max increases
      const prevMax = this.getMaxHealth()
      this.maxHealthBonus = bonus
      const newMax = this.getMaxHealth()
      this.health = Math.min(newMax, this.health + (newMax - prevMax))
    } else {
      this.maxHealthBonus = bonus
    }
  }

  update(delta: number, time: number) {
    // Decay damage flash
    this.damageFlashStrength = Math.max(0, this.damageFlashStrength - delta / 0.3)

    // Passive regen: +2/s when not taking damage for 5s
    if (!this.isDead && time - this.lastDamageTime > 5 && this.health < this.getMaxHealth()) {
      this.heal(2 * delta)
    }

    // Death respawn countdown
    if (this.isDead) {
      this.respawnTimer -= delta
      if (this.respawnTimer <= 0) {
        this.health = this.getMaxHealth()
        this.isDead = false
        this.damageFlashStrength = 0
        this.deathCallback?.()
      }
    }

    // Reset speed multiplier each frame (hazards re-apply)
    this.speedMultiplier = 1.0
  }
}
