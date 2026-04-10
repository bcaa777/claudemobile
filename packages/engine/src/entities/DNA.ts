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
  isGiant: boolean
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
