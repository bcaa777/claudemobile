import * as THREE from 'three'
import { Creature } from '../creatures/Creature'
import { SPECIES, SpeciesId } from '../creatures/Species'

const BOND_DIST = 6
const BOND_TIME = 8
const FOLLOW_DIST = 4
const TELEPORT_DIST_SQ = 900 // 30^2
const COMPANION_NAMES = [
  'Ash','Bramble','Clover','Dusk','Echo','Fern','Gale','Hazel',
  'Ivy','Jasper','Kit','Luna','Moss','Nyx','Oak','Pebble',
  'Quinn','Reed','Sage','Thorn','Uma','Vale','Wren','Zephyr',
]

type CompanionBonus = 'speed' | 'crystal_trail' | 'predator_warning' | 'lore_glow' | 'jump' | 'regen'

const SPECIES_BONUS: Partial<Record<SpeciesId, CompanionBonus>> = {
  rabbit: 'speed',
  deer: 'crystal_trail',
  bird: 'predator_warning',
  parrot: 'predator_warning',
  fox: 'lore_glow',
  goat: 'jump',
}

export class CompanionSystem {
  companionId: string | null = null
  companionName = ''
  companionSpecies: SpeciesId | null = null
  activeBonus: CompanionBonus | null = null

  private bondProgress = 0
  private bondTarget: string | null = null
  private hudEl: HTMLElement | null
  private bondBarEl: HTMLElement | null
  private warningEl: HTMLElement | null
  private lossTimer = 0
  private collarMesh: THREE.Mesh | null = null

  constructor() {
    this.hudEl = document.getElementById('companion-hud')
    this.bondBarEl = document.getElementById('bond-progress')
    this.warningEl = document.getElementById('predator-warning')
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    playerSpeed: number,
    isCrouching: boolean,
    creatures: Map<string, Creature>,
    playerForward: THREE.Vector3,
  ) {
    // Loss message fade
    if (this.lossTimer > 0) {
      this.lossTimer -= delta
      if (this.lossTimer <= 0 && this.hudEl) {
        this.hudEl.textContent = ''
        this.hudEl.style.display = 'none'
      }
    }

    // If we have a companion, manage it
    if (this.companionId) {
      const companion = creatures.get(this.companionId)
      if (!companion || companion.state === 'dead') {
        this.onCompanionDeath()
        return
      }

      // Following behavior
      const targetPos = new THREE.Vector3(
        playerPos.x - playerForward.x * FOLLOW_DIST,
        playerPos.y,
        playerPos.z - playerForward.z * FOLLOW_DIST,
      )

      const dx = targetPos.x - companion.position.x
      const dz = targetPos.z - companion.position.z
      const distSq = dx * dx + dz * dz

      // Teleport if too far
      if (distSq > TELEPORT_DIST_SQ) {
        companion.position.copy(targetPos)
      } else if (distSq > 4) {
        const len = Math.sqrt(distSq)
        const speed = Math.min(SPECIES[companion.species].maxSpeed, len * 2)
        companion.velocity.set((dx / len) * speed, 0, (dz / len) * speed)
        companion.heading = Math.atan2(dx, dz)
      } else {
        companion.velocity.set(0, 0, 0)
      }

      // Predator warning bonus
      if (this.activeBonus === 'predator_warning' && this.warningEl) {
        let nearPredator = false
        for (const c of creatures.values()) {
          if (c.state === 'dead') continue
          const sp = SPECIES[c.species]
          if (sp.role !== 'predator') continue
          const pdx = c.position.x - playerPos.x
          const pdz = c.position.z - playerPos.z
          if (pdx * pdx + pdz * pdz < 900) { // 30^2
            nearPredator = true
            break
          }
        }
        this.warningEl.style.display = nearPredator ? 'block' : 'none'
      }

      this.updateHud()
      return
    }

    // Bonding attempt — crouching + near herbivore + slow movement
    if (this.warningEl) this.warningEl.style.display = 'none'

    if (isCrouching && playerSpeed < 1) {
      // Find nearest herbivore within bond distance
      let nearestHerb: Creature | null = null
      let nearestDist = BOND_DIST * BOND_DIST

      for (const c of creatures.values()) {
        if (c.state === 'dead' || c.state === 'flee') continue
        const sp = SPECIES[c.species]
        if (sp.role !== 'herbivore' || sp.isGiant) continue

        const cdx = c.position.x - playerPos.x
        const cdz = c.position.z - playerPos.z
        const cDistSq = cdx * cdx + cdz * cdz
        if (cDistSq < nearestDist) {
          nearestDist = cDistSq
          nearestHerb = c
        }
      }

      if (nearestHerb) {
        if (this.bondTarget === nearestHerb.id) {
          this.bondProgress += delta
          this.showBondProgress()

          if (this.bondProgress >= BOND_TIME) {
            this.bondWith(nearestHerb)
          }
        } else {
          this.bondTarget = nearestHerb.id
          this.bondProgress = 0
        }
      } else {
        this.resetBond()
      }
    } else {
      this.resetBond()
    }
  }

  private bondWith(creature: Creature) {
    this.companionId = creature.id
    this.companionSpecies = creature.species
    this.companionName = COMPANION_NAMES[Math.floor(Math.random() * COMPANION_NAMES.length)]
    creature.state = 'idle'
    creature.velocity.set(0, 0, 0)

    // Set bonus
    this.activeBonus = SPECIES_BONUS[creature.species] || 'regen'

    // Mark as companion
    ;(creature as any).isCompanion = true

    this.resetBond()
    this.updateHud()
  }

  private onCompanionDeath() {
    this.companionId = null
    this.companionSpecies = null
    this.activeBonus = null

    if (this.hudEl) {
      this.hudEl.textContent = 'Your companion has fallen...'
      this.hudEl.style.display = 'block'
      this.hudEl.style.color = 'rgba(220, 80, 80, 0.9)'
    }
    this.lossTimer = 4
    if (this.warningEl) this.warningEl.style.display = 'none'
  }

  getSpeedMultiplier(): number {
    return this.activeBonus === 'speed' ? 1.15 : 1
  }

  getJumpMultiplier(): number {
    return this.activeBonus === 'jump' ? 1.2 : 1
  }

  getRegenBonus(): number {
    return this.activeBonus === 'regen' ? 1 : 0
  }

  hasLoreGlow(): boolean {
    return this.activeBonus === 'lore_glow'
  }

  private resetBond() {
    this.bondTarget = null
    this.bondProgress = 0
    if (this.bondBarEl) {
      this.bondBarEl.style.display = 'none'
    }
  }

  private showBondProgress() {
    if (this.bondBarEl) {
      this.bondBarEl.style.display = 'block'
      const pct = Math.min(100, (this.bondProgress / BOND_TIME) * 100)
      this.bondBarEl.innerHTML = `<div style="width:${pct}%;height:100%;background:#e8c060;border-radius:2px;transition:width 0.1s"></div>`
      this.bondBarEl.title = `Bonding... ${Math.floor(this.bondProgress)}/${BOND_TIME}s`
    }
  }

  private updateHud() {
    if (!this.hudEl || this.lossTimer > 0) return
    if (this.companionId && this.companionName) {
      this.hudEl.style.display = 'block'
      this.hudEl.style.color = 'rgba(232, 192, 96, 0.8)'
      const bonusText = this.activeBonus === 'speed' ? '+15% Speed' :
        this.activeBonus === 'crystal_trail' ? 'Crystal Finder' :
        this.activeBonus === 'predator_warning' ? 'Danger Sense' :
        this.activeBonus === 'lore_glow' ? 'Lore Finder' :
        this.activeBonus === 'jump' ? '+20% Jump' :
        '+1 HP/s Regen'
      this.hudEl.textContent = `♦ ${this.companionName} the ${this.companionSpecies} — ${bonusText}`
    } else {
      this.hudEl.style.display = 'none'
    }
  }
}
