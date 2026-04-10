export interface CompanionDef {
  id: string
  name: string
  role: string
  color: number
  attackType: 'melee' | 'ranged' | 'dive'
  attackDamage: number
  attackCooldown: number  // seconds
  attackRange: number
  passiveDesc: string
  passive: { type: string; value: number }
  baseHealth: number
  baseSpeed: number
}

export const COMPANION_DEFS: Record<string, CompanionDef> = {
  wolf: {
    id: 'wolf', name: 'Wolf', role: 'Aggressive Melee', color: 0x666666,
    attackType: 'melee', attackDamage: 12, attackCooldown: 1.0, attackRange: 3,
    passiveDesc: '+10% damage in melee range', passive: { type: 'damage_mult', value: 1.1 },
    baseHealth: 80, baseSpeed: 10,
  },
  deer: {
    id: 'deer', name: 'Deer', role: 'Defensive Buffer', color: 0x8B6914,
    attackType: 'melee', attackDamage: 8, attackCooldown: 1.5, attackRange: 4,
    passiveDesc: 'Damage reduction aura', passive: { type: 'damage_reduction', value: 0.15 },
    baseHealth: 100, baseSpeed: 8,
  },
  bird: {
    id: 'bird', name: 'Bird', role: 'Ranged Harasser', color: 0x4488FF,
    attackType: 'dive', attackDamage: 10, attackCooldown: 0.8, attackRange: 20,
    passiveDesc: 'Reveals enemy positions', passive: { type: 'reveal_enemies', value: 1 },
    baseHealth: 40, baseSpeed: 14,
  },
  fox: {
    id: 'fox', name: 'Fox', role: 'Utility', color: 0xFF6600,
    attackType: 'melee', attackDamage: 6, attackCooldown: 0.6, attackRange: 3,
    passiveDesc: '+3 pickup range', passive: { type: 'pickup_range', value: 3 },
    baseHealth: 50, baseSpeed: 12,
  },
}
