import { BiomeType } from '@engine/core'
import type { UndergroundBiomeId } from '../expedition/UndergroundBiomes'

export class MetaState {
  gold = 0
  upgrades = { damage: 0, health: 0, speed: 0, greed: 0, wisdom: 0, magnet: 0, armor: 0 }
  cleansedBiomes: BiomeType[] = []

  /** Underground biome ids that have been cleansed (100, 101, 102). */
  cleansedUnderground: UndergroundBiomeId[] = []

  /** Set to true once ALL surface + underground biomes are cleansed. */
  worldRestored: boolean = false

  /** Number of completed prestige cycles. Each adds ×1.5 enemy HP. */
  prestigeLevel: number = 0

  /** ID of the weapon to start expeditions with (empty = default bolt_caster) */
  startingWeapon: string = ''

  /** Per-weapon level tracking for reforge UI */
  weaponLevels: Record<string, number> = {}

  /** Permanent companion stat upgrades: { [companionId]: { damage: stacks, health: stacks } } */
  companionUpgrades: Record<string, { damage: number; health: number }> = {}

  /** Damage resistance stacks per enemy archetype (each stack = +5%) */
  resistances: Record<string, number> = {}

  /** Enemy archetypes encountered across all expeditions */
  encounterLog: string[] = []

  getUpgradeCost(stat: string): number {
    const level = this.upgrades[stat as keyof typeof this.upgrades] || 0
    return 40 + level * 25  // more accessible early
  }

  buyUpgrade(stat: string): boolean {
    const cost = this.getUpgradeCost(stat)
    if (this.gold < cost) return false
    this.gold -= cost
    ;(this.upgrades as any)[stat]++
    return true
  }

  logEncounter(archetype: string): void {
    if (!this.encounterLog.includes(archetype)) {
      this.encounterLog.push(archetype)
    }
  }
}
