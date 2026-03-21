export class PlayerState {
  health = 100
  maxHealth = 100
  damageFlashStrength = 0
  speedMultiplier = 1.0
  lastDamageTime = -Infinity
  isDead = false

  private deathCallback: (() => void) | null = null
  private respawnTimer = 0

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
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  update(delta: number, time: number) {
    // Decay damage flash
    this.damageFlashStrength = Math.max(0, this.damageFlashStrength - delta / 0.3)

    // Passive regen: +2/s when not taking damage for 5s
    if (!this.isDead && time - this.lastDamageTime > 5 && this.health < this.maxHealth) {
      this.heal(2 * delta)
    }

    // Death respawn countdown
    if (this.isDead) {
      this.respawnTimer -= delta
      if (this.respawnTimer <= 0) {
        this.health = this.maxHealth
        this.isDead = false
        this.damageFlashStrength = 0
        this.deathCallback?.()
      }
    }

    // Reset speed multiplier each frame (hazards re-apply)
    this.speedMultiplier = 1.0
  }
}
