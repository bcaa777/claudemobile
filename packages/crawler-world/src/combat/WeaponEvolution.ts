import type { MetaState } from '../state/MetaState'

export interface EvolutionPath {
  baseWeapon: string       // weapon ID at level 5
  metaRequirement: string  // meta upgrade stat name
  metaLevel: number        // minimum level required
  evolvedWeapon: string    // new weapon ID
}

export interface FusionRecipe {
  weapon1: string   // first weapon (max level)
  weapon2: string   // second weapon (max level)
  result: string    // fused weapon ID
}

export const EVOLUTIONS: EvolutionPath[] = [
  { baseWeapon: 'bolt_caster', metaRequirement: 'speed', metaLevel: 1, evolvedWeapon: 'railgun' },
  { baseWeapon: 'tri_shot', metaRequirement: 'damage', metaLevel: 1, evolvedWeapon: 'spread_cannon' },
  { baseWeapon: 'lightning_arc', metaRequirement: 'wisdom', metaLevel: 1, evolvedWeapon: 'storm_caller' },
  { baseWeapon: 'blade_orbit', metaRequirement: 'speed', metaLevel: 2, evolvedWeapon: 'death_spiral' },
  { baseWeapon: 'turret', metaRequirement: 'damage', metaLevel: 2, evolvedWeapon: 'fortress' },
  { baseWeapon: 'seeker_swarm', metaRequirement: 'speed', metaLevel: 1, evolvedWeapon: 'swarm_queen' },
  { baseWeapon: 'void_mine', metaRequirement: 'damage', metaLevel: 2, evolvedWeapon: 'mega_mine' },
  { baseWeapon: 'sonic_boom', metaRequirement: 'wisdom', metaLevel: 1, evolvedWeapon: 'sky_beam' },
  { baseWeapon: 'flak_cannon', metaRequirement: 'damage', metaLevel: 1, evolvedWeapon: 'flak_storm' },
  { baseWeapon: 'homing_missile', metaRequirement: 'speed', metaLevel: 2, evolvedWeapon: 'hellfire_missile' },
  { baseWeapon: 'chain_lightning', metaRequirement: 'wisdom', metaLevel: 2, evolvedWeapon: 'tesla_coil' },
  { baseWeapon: 'gravity_well', metaRequirement: 'wisdom', metaLevel: 3, evolvedWeapon: 'singularity' },
  { baseWeapon: 'drone_buddy', metaRequirement: 'speed', metaLevel: 2, evolvedWeapon: 'drone_swarm' },
]

export const FUSIONS: FusionRecipe[] = [
  { weapon1: 'railgun', weapon2: 'death_spiral', result: 'singularity_cannon' },
  { weapon1: 'storm_caller', weapon2: 'spread_cannon', result: 'thunder_rain' },
  { weapon1: 'fortress', weapon2: 'vortex_pull', result: 'gravity_fortress' },
  { weapon1: 'swarm_queen', weapon2: 'tesla_coil', result: 'thunder_rain' },
  { weapon1: 'hellfire_missile', weapon2: 'mega_mine', result: 'singularity_cannon' },
]

export const EVOLUTION_MAX_LEVEL = 5

/**
 * Returns the evolution path available for a weapon, if all requirements are met.
 * Weapon must be at EVOLUTION_MAX_LEVEL and the meta stat must be >= required level.
 */
export function getAvailableEvolution(
  weaponId: string,
  weaponLevel: number,
  metaState: MetaState,
): EvolutionPath | null {
  if (weaponLevel < EVOLUTION_MAX_LEVEL) return null

  const path = EVOLUTIONS.find((e) => e.baseWeapon === weaponId)
  if (!path) return null

  const metaLevel = metaState.upgrades[path.metaRequirement as keyof typeof metaState.upgrades] ?? 0
  if (metaLevel < path.metaLevel) return null

  return path
}

/**
 * Returns the first available fusion recipe where both weapons are owned
 * and both are at EVOLUTION_MAX_LEVEL.
 */
export function getAvailableFusion(
  weapons: string[],
  weaponLevels: Record<string, number>,
): FusionRecipe | null {
  for (const recipe of FUSIONS) {
    const has1 = weapons.includes(recipe.weapon1)
    const has2 = weapons.includes(recipe.weapon2)
    if (!has1 || !has2) continue

    const lvl1 = weaponLevels[recipe.weapon1] ?? 1
    const lvl2 = weaponLevels[recipe.weapon2] ?? 1
    if (lvl1 >= EVOLUTION_MAX_LEVEL && lvl2 >= EVOLUTION_MAX_LEVEL) {
      return recipe
    }
  }
  return null
}
