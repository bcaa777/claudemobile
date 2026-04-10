import { MetaState } from './MetaState'

const SAVE_KEY = 'crawler-world-save'

export function saveMetaState(state: MetaState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    gold: state.gold,
    upgrades: state.upgrades,
    cleansedBiomes: state.cleansedBiomes,
    cleansedUnderground: state.cleansedUnderground,
    worldRestored: state.worldRestored,
    prestigeLevel: state.prestigeLevel,
    startingWeapon: state.startingWeapon,
    weaponLevels: state.weaponLevels,
    companionUpgrades: state.companionUpgrades,
    resistances: state.resistances,
    encounterLog: state.encounterLog,
  }))
}

export function loadMetaState(): MetaState {
  const state = new MetaState()
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')
    if (data.gold) state.gold = data.gold
    if (data.upgrades) Object.assign(state.upgrades, data.upgrades)
    if (data.cleansedBiomes) state.cleansedBiomes = data.cleansedBiomes
    if (data.cleansedUnderground) state.cleansedUnderground = data.cleansedUnderground
    if (data.worldRestored) state.worldRestored = data.worldRestored
    if (data.prestigeLevel) state.prestigeLevel = data.prestigeLevel
    if (data.startingWeapon) state.startingWeapon = data.startingWeapon
    if (data.weaponLevels) state.weaponLevels = data.weaponLevels
    if (data.companionUpgrades) state.companionUpgrades = data.companionUpgrades
    if (data.resistances) state.resistances = data.resistances
    if (data.encounterLog) state.encounterLog = data.encounterLog
  } catch {}
  return state
}
