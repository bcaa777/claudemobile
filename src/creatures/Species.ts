import { BiomeType } from '../biomes/types'

export type SpeciesId = 'deer' | 'rabbit' | 'bird' | 'dragon' | 'fish' | 'wolf' | 'croc'

export interface SpeciesDef {
  id: SpeciesId
  mobility: 'ground' | 'air' | 'water'
  role: 'herbivore' | 'predator'
  bodyColor: number
  headColor: number
  legColor: number
  bodyW: number
  bodyH: number
  bodyD: number
  maxSpeed: number
  fleeSpeed: number
  maxHunger: number
  maxThirst: number
  maxEnergy: number
  maxAge: number
  sightRange: number
  attackRange: number
  attackDamage: number
  preferredBiomes: BiomeType[]
  spawnWeight: number
  adultScale: number
  babyScale: number
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  rabbit: {
    id: 'rabbit',
    mobility: 'ground',
    role: 'herbivore',
    bodyColor: 0xc8a878,
    headColor: 0xd4b488,
    legColor: 0xb89868,
    bodyW: 0.4, bodyH: 0.3, bodyD: 0.6,
    maxSpeed: 6,
    fleeSpeed: 10,
    maxHunger: 180,
    maxThirst: 120,
    maxEnergy: 100,
    maxAge: 300,
    sightRange: 6,
    attackRange: 0,
    attackDamage: 0,
    preferredBiomes: [BiomeType.Forest, BiomeType.Savanna, BiomeType.Tundra],
    spawnWeight: 3,
    adultScale: 0.7,
    babyScale: 0.35,
  },

  deer: {
    id: 'deer',
    mobility: 'ground',
    role: 'herbivore',
    bodyColor: 0x8b6914,
    headColor: 0x9a7820,
    legColor: 0x7a5a10,
    bodyW: 0.7, bodyH: 0.6, bodyD: 1.2,
    maxSpeed: 5,
    fleeSpeed: 10,
    maxHunger: 240,
    maxThirst: 180,
    maxEnergy: 100,
    maxAge: 600,
    sightRange: 10,
    attackRange: 0,
    attackDamage: 0,
    preferredBiomes: [BiomeType.Forest, BiomeType.Savanna, BiomeType.Swamp],
    spawnWeight: 2,
    adultScale: 1.0,
    babyScale: 0.5,
  },

  bird: {
    id: 'bird',
    mobility: 'air',
    role: 'herbivore',
    bodyColor: 0x4488cc,
    headColor: 0x3366aa,
    legColor: 0x996600,
    bodyW: 0.3, bodyH: 0.25, bodyD: 0.5,
    maxSpeed: 8,
    fleeSpeed: 14,
    maxHunger: 120,
    maxThirst: 90,
    maxEnergy: 100,
    maxAge: 240,
    sightRange: 14,
    attackRange: 0,
    attackDamage: 0,
    preferredBiomes: [
      BiomeType.Forest, BiomeType.Desert, BiomeType.Volcanic, BiomeType.Snow,
      BiomeType.Swamp, BiomeType.Tundra, BiomeType.Mushroom, BiomeType.AshWastes,
      BiomeType.Crystal, BiomeType.Savanna,
    ],
    spawnWeight: 3,
    adultScale: 0.8,
    babyScale: 0.4,
  },

  dragon: {
    id: 'dragon',
    mobility: 'air',
    role: 'predator',
    bodyColor: 0x882200,
    headColor: 0x661100,
    legColor: 0x441100,
    bodyW: 1.2, bodyH: 0.8, bodyD: 2.4,
    maxSpeed: 7,
    fleeSpeed: 7,
    maxHunger: 300,
    maxThirst: 300,
    maxEnergy: 100,
    maxAge: 1200,
    sightRange: 35,
    attackRange: 4,
    attackDamage: 20,
    preferredBiomes: [BiomeType.Volcanic, BiomeType.AshWastes, BiomeType.Crystal],
    spawnWeight: 1,
    adultScale: 1.4,
    babyScale: 0.6,
  },

  fish: {
    id: 'fish',
    mobility: 'water',
    role: 'herbivore',
    bodyColor: 0x22aacc,
    headColor: 0x1188aa,
    legColor: 0x115566,
    bodyW: 0.35, bodyH: 0.2, bodyD: 0.7,
    maxSpeed: 4,
    fleeSpeed: 7,
    maxHunger: 180,
    maxThirst: 0,
    maxEnergy: 100,
    maxAge: 360,
    sightRange: 6,
    attackRange: 0,
    attackDamage: 0,
    preferredBiomes: [BiomeType.Swamp, BiomeType.Forest, BiomeType.Savanna, BiomeType.Tundra, BiomeType.Snow],
    spawnWeight: 2,
    adultScale: 1.0,
    babyScale: 0.5,
  },

  wolf: {
    id: 'wolf',
    mobility: 'ground',
    role: 'predator',
    bodyColor: 0x556677,
    headColor: 0x445566,
    legColor: 0x334455,
    bodyW: 0.65, bodyH: 0.55, bodyD: 1.1,
    maxSpeed: 6,
    fleeSpeed: 6,
    maxHunger: 360,
    maxThirst: 240,
    maxEnergy: 100,
    maxAge: 720,
    sightRange: 18,
    attackRange: 2,
    attackDamage: 15,
    preferredBiomes: [BiomeType.Forest, BiomeType.Tundra],
    spawnWeight: 1,
    adultScale: 1.0,
    babyScale: 0.5,
  },

  croc: {
    id: 'croc',
    mobility: 'water',
    role: 'predator',
    bodyColor: 0x3a5c28,
    headColor: 0x2e4a1e,
    legColor: 0x4a6e35,
    bodyW: 0.9,
    bodyH: 0.28,
    bodyD: 2.2,
    maxSpeed: 3,
    fleeSpeed: 5,
    maxHunger: 180,
    maxThirst: 0,
    maxEnergy: 100,
    maxAge: 300,
    sightRange: 18,
    attackRange: 2.5,
    attackDamage: 18,
    preferredBiomes: [BiomeType.Swamp, BiomeType.Forest],
    spawnWeight: 1,
    adultScale: 1.1,
    babyScale: 0.55,
  },
}

export const ALL_SPECIES: SpeciesId[] = ['deer', 'rabbit', 'bird', 'dragon', 'fish', 'wolf', 'croc']
