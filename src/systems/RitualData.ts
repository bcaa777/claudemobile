import { BiomeType } from '../biomes/types'

export interface RitualRequirement {
  biome: BiomeType
  observations: {
    creatureBehaviorNearSite: boolean  // witnessed attuned creature at site
    weatherReveal: boolean              // witnessed weather-site interaction
    loreFragmentsFound: number          // minimum lore stones in this biome (3)
  }
  activation: {
    timeOfDay?: 'dawn' | 'dusk' | 'night' | 'midnight' | 'any'
    weather?: string        // required weather or undefined for any
    creaturePresent?: string // attuned species must be near site
    creatureState?: string   // creature must be in this state
    playerAction: string     // 'stand_center', 'walk_path', 'interact', 'climb'
    playerRadius: number     // how close to site center
    requiredActivatedCount?: number // minimum other sites activated before this one
  }
}

export const RITUAL_REQUIREMENTS: RitualRequirement[] = [
  {
    biome: BiomeType.Forest,
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'dusk',
      weather: 'clear',
      creaturePresent: 'deer',
      creatureState: 'reverence',
      playerAction: 'stand_center',
      playerRadius: 3,
    },
  },
  {
    biome: BiomeType.Desert,
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'dawn',
      weather: 'clear',
      creaturePresent: 'camel',
      playerAction: 'stand_center',
      playerRadius: 5,
    },
  },
  {
    biome: BiomeType.Swamp,
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'night',
      weather: 'fog',
      creaturePresent: 'toad',
      playerAction: 'stand_center',
      playerRadius: 3,
    },
  },
  {
    biome: BiomeType.Snow,
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'midnight',
      weather: 'clear',
      creaturePresent: 'mammoth',
      playerAction: 'stand_center',
      playerRadius: 5,
    },
  },
  {
    biome: BiomeType.Volcanic,
    observations: { creatureBehaviorNearSite: false, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      weather: 'calm',
      playerAction: 'stand_center',
      playerRadius: 3,
    },
  },
  {
    biome: BiomeType.Crystal,
    observations: { creatureBehaviorNearSite: true, weatherReveal: false, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      playerAction: 'interact',
      playerRadius: 3,
    },
  },
  {
    biome: BiomeType.Jungle,
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      weather: 'rain',
      creaturePresent: 'bird',
      playerAction: 'stand_center',
      playerRadius: 5,
    },
  },
  {
    biome: BiomeType.Mesa,
    observations: { creatureBehaviorNearSite: true, weatherReveal: false, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'dusk',
      creaturePresent: 'goat',
      playerAction: 'stand_center',
      playerRadius: 5,
    },
  },
  {
    biome: BiomeType.CoralReef,
    observations: { creatureBehaviorNearSite: false, weatherReveal: false, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      playerAction: 'stand_center',
      playerRadius: 5,
    },
  },
  {
    biome: BiomeType.Heaven,
    observations: { creatureBehaviorNearSite: false, weatherReveal: false, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      playerAction: 'stand_center',
      playerRadius: 3,
    },
  },
  {
    biome: BiomeType.Hell,
    observations: { creatureBehaviorNearSite: false, weatherReveal: false, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'any',
      playerAction: 'stand_center',
      playerRadius: 3,
      requiredActivatedCount: 8,
    },
  },
]

/** Index ritual requirements by biome for O(1) lookup */
export const RITUAL_BY_BIOME: Map<BiomeType, RitualRequirement> = new Map(
  RITUAL_REQUIREMENTS.map(r => [r.biome, r])
)
