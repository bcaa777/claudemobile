import { WEAPON_DEFS } from './WeaponDefs'
import { getAvailableEvolution, getAvailableFusion, EVOLUTIONS, FUSIONS, EVOLUTION_MAX_LEVEL } from './WeaponEvolution'
import type { GameState } from '../state/GameState'
import type { MetaState } from '../state/MetaState'

export interface LevelUpOption {
  type: 'weapon_unlock' | 'weapon_levelup' | 'stat_boost' | 'evolution' | 'fusion'
  weaponId?: string
  weaponId2?: string    // second weapon consumed in fusion
  stat?: string
  label: string
  description: string
}

export function generateLevelUpOptions(state: GameState, metaState: MetaState, count = 3): LevelUpOption[] {
  const priority: LevelUpOption[] = []
  const pool: LevelUpOption[] = []

  // --- Check evolutions (prioritized) ---
  for (const id of state.weapons) {
    const lvl = state.weaponLevels[id] ?? 1
    const path = getAvailableEvolution(id, lvl, metaState)
    if (path) {
      const baseDef = WEAPON_DEFS[id]
      const evolvedDef = WEAPON_DEFS[path.evolvedWeapon]
      priority.push({
        type: 'evolution',
        weaponId: id,
        label: evolvedDef ? evolvedDef.name : path.evolvedWeapon,
        description: `Evolve ${baseDef?.name ?? id} into ${evolvedDef?.name ?? path.evolvedWeapon}`,
      })
    }
  }

  // --- Check fusions (prioritized) ---
  const fusion = getAvailableFusion(state.weapons, state.weaponLevels)
  if (fusion) {
    const def1 = WEAPON_DEFS[fusion.weapon1]
    const def2 = WEAPON_DEFS[fusion.weapon2]
    const resultDef = WEAPON_DEFS[fusion.result]
    priority.push({
      type: 'fusion',
      weaponId: fusion.weapon1,
      weaponId2: fusion.weapon2,
      label: resultDef ? resultDef.name : fusion.result,
      description: `Fuse ${def1?.name ?? fusion.weapon1} + ${def2?.name ?? fusion.weapon2}`,
    })
  }

  // --- If we already have enough priority options, return them (capped at count) ---
  if (priority.length >= count) {
    return priority.slice(0, count)
  }

  // --- Weapons not yet owned (exclude evolved/fused weapons from normal pool) ---
  const evolvedIds = new Set(EVOLUTIONS.map((e) => e.evolvedWeapon))
  const fusionResultIds = new Set(FUSIONS.map((f) => f.result))

  for (const [id, def] of Object.entries(WEAPON_DEFS)) {
    if (state.weapons.includes(id)) continue
    if (evolvedIds.has(id) || fusionResultIds.has(id)) continue
    pool.push({
      type: 'weapon_unlock',
      weaponId: id,
      label: def.name,
      description: `Unlock ${def.name}`,
    })
  }

  // --- Level up owned weapons (skip those at max level eligible for evolution) ---
  for (const id of state.weapons) {
    const def = WEAPON_DEFS[id]
    if (!def) continue
    const lvl = state.weaponLevels[id] ?? 1
    // Don't offer levelup for a weapon already queued for evolution in priority
    if (lvl >= EVOLUTION_MAX_LEVEL && priority.some((o) => o.weaponId === id)) continue
    pool.push({
      type: 'weapon_levelup',
      weaponId: id,
      label: `${def.name} Lv${lvl + 1}`,
      description: '+damage, +rate',
    })
  }

  // --- Stat boosts ---
  pool.push({ type: 'stat_boost', stat: 'damage', label: '+5 Damage', description: 'All weapons deal +5 damage' })
  pool.push({ type: 'stat_boost', stat: 'speed', label: '+10% Speed', description: 'Move 10% faster' })
  pool.push({ type: 'stat_boost', stat: 'health', label: '+20 Max HP', description: 'Increase max health' })
  pool.push({ type: 'stat_boost', stat: 'pickup', label: '+2 Pickup Range', description: 'Collect orbs from further' })

  const remaining = count - priority.length
  const picked = shuffle(pool).slice(0, remaining)
  return [...priority, ...picked]
}

export function applyLevelUpOption(state: GameState, option: LevelUpOption): void {
  if (option.type === 'weapon_unlock' && option.weaponId) {
    state.weapons.push(option.weaponId)
    state.weaponLevels[option.weaponId] = 1
  } else if (option.type === 'weapon_levelup' && option.weaponId) {
    state.weaponLevels[option.weaponId] = (state.weaponLevels[option.weaponId] ?? 1) + 1
  } else if (option.type === 'evolution' && option.weaponId) {
    const path = EVOLUTIONS.find((e) => e.baseWeapon === option.weaponId)
    if (path) {
      // Remove the base weapon
      state.weapons = state.weapons.filter((id) => id !== option.weaponId)
      delete state.weaponLevels[option.weaponId!]
      // Add the evolved weapon at level 1
      state.weapons.push(path.evolvedWeapon)
      state.weaponLevels[path.evolvedWeapon] = 1
    }
  } else if (option.type === 'fusion' && option.weaponId && option.weaponId2) {
    const recipe = FUSIONS.find(
      (f) => f.weapon1 === option.weaponId && f.weapon2 === option.weaponId2,
    )
    if (recipe) {
      // Remove both source weapons
      state.weapons = state.weapons.filter(
        (id) => id !== option.weaponId && id !== option.weaponId2,
      )
      delete state.weaponLevels[option.weaponId]
      delete state.weaponLevels[option.weaponId2]
      // Add fused weapon at level 1
      state.weapons.push(recipe.result)
      state.weaponLevels[recipe.result] = 1
    }
  } else if (option.type === 'stat_boost') {
    if (option.stat === 'damage') state.damageBonus += 5
    if (option.stat === 'speed') state.speedBonus += 0.1
    if (option.stat === 'health') {
      state.maxHealth += 20
      state.health += 20
    }
    if (option.stat === 'pickup') state.pickupRange += 2
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
