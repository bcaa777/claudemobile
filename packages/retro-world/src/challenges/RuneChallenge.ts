import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { WeatherType } from '../systems/WeatherSystem'
import { Creature } from '../creatures/Creature'
import { SPECIES } from '../creatures/Species'

export interface ChallengeContext {
  playerPos: THREE.Vector3
  biome: BiomeType
  weather: WeatherType
  dayTime: number
  isFlying: boolean
  isGrounded: boolean
  creatures: Map<string, Creature>
  landmarkPositions: Map<BiomeType, THREE.Vector3>
  grappleCount: number
  isCrouching: boolean
}

export interface RuneChallengeDefinition {
  biome: BiomeType
  description: string
  checkComplete: (ctx: ChallengeContext, progress: ChallengeProgress) => boolean
  getProgressText: (progress: ChallengeProgress) => string
}

export interface ChallengeProgress {
  timer: number
  count: number
  uniqueSpecies: Set<string>
  active: boolean
}

export function createDefaultProgress(): ChallengeProgress {
  return { timer: 0, count: 0, uniqueSpecies: new Set(), active: false }
}

function nearLandmark(ctx: ChallengeContext, biome: BiomeType, dist = 30): boolean {
  const lmPos = ctx.landmarkPositions.get(biome)
  if (!lmPos) return false
  const dx = ctx.playerPos.x - lmPos.x
  const dz = ctx.playerPos.z - lmPos.z
  return dx * dx + dz * dz < dist * dist
}

function countSpeciesNear(ctx: ChallengeContext, species: string, range: number): number {
  let count = 0
  for (const c of ctx.creatures.values()) {
    if (c.state === 'dead') continue
    if (c.species !== species) continue
    const dx = c.position.x - ctx.playerPos.x
    const dz = c.position.z - ctx.playerPos.z
    if (dx * dx + dz * dz < range * range) count++
  }
  return count
}

export const RUNE_CHALLENGES: RuneChallengeDefinition[] = [
  {
    biome: BiomeType.Forest,
    description: 'Approach 3 deer without startling them',
    checkComplete: (ctx, p) => {
      if (ctx.biome !== BiomeType.Forest) return false
      const nearDeer = countSpeciesNear(ctx, 'deer', 4)
      if (nearDeer > 0 && ctx.isCrouching) p.count = Math.max(p.count, nearDeer)
      return p.count >= 3
    },
    getProgressText: (p) => `Deer approached: ${Math.min(3, p.count)}/3`,
  },
  {
    biome: BiomeType.Desert,
    description: 'Survive a complete sandstorm',
    checkComplete: (ctx, p) => {
      if (ctx.biome !== BiomeType.Desert) { p.timer = 0; return false }
      if (ctx.weather === WeatherType.Sandstorm) p.timer += 1/60
      else p.timer = Math.max(0, p.timer - 0.5/60)
      return p.timer >= 30
    },
    getProgressText: (p) => `Sandstorm endured: ${Math.floor(p.timer)}s/30s`,
  },
  {
    biome: BiomeType.Volcanic,
    description: 'Stand atop the Obsidian Citadel',
    checkComplete: (ctx) => {
      const lm = ctx.landmarkPositions.get(BiomeType.Volcanic)
      if (!lm) return false
      const dx = ctx.playerPos.x - lm.x
      const dz = ctx.playerPos.z - lm.z
      return dx * dx + dz * dz < 900 && ctx.playerPos.y > lm.y + 20
    },
    getProgressText: () => 'Reach the summit',
  },
  {
    biome: BiomeType.Snow,
    description: 'Visit Ice Palace during a blizzard',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.Snow) && ctx.weather === WeatherType.Blizzard,
    getProgressText: () => 'At landmark + Blizzard weather',
  },
  {
    biome: BiomeType.Swamp,
    description: 'Survive 60s in toxic water',
    checkComplete: (ctx, p) => {
      if (ctx.biome !== BiomeType.Swamp) return false
      if (ctx.playerPos.y < 0.5) p.timer += 1/60
      return p.timer >= 60
    },
    getProgressText: (p) => `Toxic endurance: ${Math.floor(p.timer)}s/60s`,
  },
  {
    biome: BiomeType.Crystal,
    description: 'Collect all Crystal biome crystals',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.Crystal, 10),
    getProgressText: () => 'Explore the Crystal Cathedral',
  },
  {
    biome: BiomeType.Heaven,
    description: 'Reach the Cloud Temple',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.Heaven),
    getProgressText: () => 'Find the Cloud Temple',
  },
  {
    biome: BiomeType.Hell,
    description: 'Survive 30s in Hell',
    checkComplete: (ctx, p) => {
      if (ctx.biome !== BiomeType.Hell) { p.timer = 0; return false }
      p.timer += 1/60
      return p.timer >= 30
    },
    getProgressText: (p) => `Hell survival: ${Math.floor(p.timer)}s/30s`,
  },
  {
    biome: BiomeType.Jungle,
    description: 'Find Jungle Pyramid in a storm',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.Jungle) && ctx.weather === WeatherType.HeavyRain,
    getProgressText: () => 'At Pyramid + storm',
  },
  {
    biome: BiomeType.Mesa,
    description: 'Reach Mesa Citadel without flying',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.Mesa) && !ctx.isFlying,
    getProgressText: () => 'Walk to the Mesa Citadel',
  },
  {
    biome: BiomeType.CoralReef,
    description: 'Swim through Coral Palace',
    checkComplete: (ctx) => nearLandmark(ctx, BiomeType.CoralReef) && ctx.playerPos.y < 0,
    getProgressText: () => 'Dive to the Coral Palace',
  },
]
