import { BiomeType } from '../biomes/types'
import type { SpeciesId } from './Species'

export type BodyPlan = 'quadruped' | 'insectoid' | 'avian' | 'aquatic' | 'serpentine'

export interface CreatureDNA {
  bodyPlan: BodyPlan
  bodyLength: number
  bodyWidth: number
  bodyHeight: number
  headSize: number
  neckLength: number
  legCount: number
  legLength: number
  legThickness: number
  hasWings: number
  wingSpan: number
  hasTail: number
  tailLength: number
  hasHorns: number
  hornSize: number
  hasClaws: number
  clawSize: number
  hasMandibles: number
  hasFins: number
  finSize: number
  hasAntennae: number
  bodyColor: [number, number, number]
  accentColor: [number, number, number]
  eyeSize: number
  eyeCount: number
  speed: number
  aggression: number
  size: number
}

export interface DerivedStats {
  mobility: 'ground' | 'air' | 'water'
  role: 'herbivore' | 'predator'
  maxSpeed: number
  fleeSpeed: number
  attackDamage: number
  attackRange: number
  sightRange: number
  adultScale: number
  babyScale: number
  maxHunger: number
  maxThirst: number
  maxAge: number
  maxEnergy: number
  bodyW: number
  bodyH: number
  bodyD: number
  bodyColor: number
  headColor: number
  legColor: number
}

export function quantizeLegCount(gene: number): number {
  if (gene < 0.1) return 0
  if (gene < 0.3) return 2
  if (gene < 0.6) return 4
  if (gene < 0.8) return 6
  return 8
}

export function quantizeEyeCount(gene: number): number {
  if (gene < 0.3) return 2
  if (gene < 0.6) return 4
  if (gene < 0.8) return 6
  return 8
}

function rgbToHex(r: number, g: number, b: number): number {
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255))
}

function shiftColor(r: number, g: number, b: number, amount: number): number {
  return rgbToHex(
    Math.max(0, Math.min(1, r + amount)),
    Math.max(0, Math.min(1, g + amount)),
    Math.max(0, Math.min(1, b + amount)),
  )
}

export function dnaToStats(dna: CreatureDNA): DerivedStats {
  const mobility: 'ground' | 'air' | 'water' =
    dna.bodyPlan === 'aquatic' ? 'water' :
    dna.bodyPlan === 'avian' ? 'air' : 'ground'

  const role: 'herbivore' | 'predator' = dna.aggression > 0.5 ? 'predator' : 'herbivore'
  const maxSpeed = 2 + dna.speed * 10
  const adultScale = 0.4 + dna.size * 2.6

  const [br, bg, bb] = dna.bodyColor
  const [ar, ag, ab] = dna.accentColor

  return {
    mobility,
    role,
    maxSpeed,
    fleeSpeed: maxSpeed * 1.8,
    attackDamage: role === 'predator' ? dna.aggression * 20 : 0,
    attackRange: role === 'predator' ? 1.5 + dna.aggression : 0,
    sightRange: 5 + dna.aggression * 15,
    adultScale,
    babyScale: adultScale * 0.4,
    maxHunger: 120 + dna.size * 360,
    maxThirst: mobility === 'water' ? 0 : 90 + dna.size * 270,
    maxAge: 300 + dna.size * 600,
    maxEnergy: 100,
    bodyW: 0.2 + dna.bodyWidth * 1.5,
    bodyH: 0.2 + dna.bodyHeight * 1.5,
    bodyD: 0.2 + dna.bodyLength * 1.5,
    bodyColor: rgbToHex(br, bg, bb),
    headColor: rgbToHex(ar, ag, ab),
    legColor: shiftColor(br, bg, bb, -0.1),
  }
}

export function dnaToSpeciesId(dna: CreatureDNA): SpeciesId {
  const isPredator = dna.aggression > 0.5
  const isLarge = dna.size > 0.7

  switch (dna.bodyPlan) {
    case 'quadruped':
      if (isLarge && isPredator) return 'bear'
      if (isLarge) return 'deer'
      if (isPredator) return 'wolf'
      if (dna.size < 0.25) return 'rabbit'
      return 'fox'
    case 'insectoid':
      if (isPredator) return 'scorpion'
      if (dna.size < 0.3) return 'toad'
      return 'crab'
    case 'avian':
      if (isLarge) return 'eagle'
      if (isPredator) return 'bat'
      return 'bird'
    case 'aquatic':
      if (isPredator) return 'croc'
      return 'fish'
    case 'serpentine':
      if (isLarge) return 'dragon'
      return 'croc'
    default:
      return 'rabbit'
  }
}
