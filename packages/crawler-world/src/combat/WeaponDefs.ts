export interface WeaponDef {
  id: string
  name: string
  category: 'projectile' | 'area' | 'orbital' | 'chain' | 'deployable' | 'gravity'
  damage: number
  cooldown: number         // seconds between shots
  range: number
  projectileSpeed: number
  projectileCount: number
  spreadAngle: number      // radians
  autoTarget: boolean      // false = follows camera aim, true = auto-targets nearest enemy
  // projectile extras
  bounceCount?: number
  // area extras
  aoeRadius?: number
  aoeDuration?: number
  // orbital extras
  orbitRadius?: number
  orbitSpeed?: number      // radians/sec
  orbitCount?: number
  shieldReduction?: number // 0-1 damage reduction for shield_ring
  // chain extras
  chainCount?: number
  chainRange?: number
  // deployable extras
  deployDuration?: number  // seconds the deployable lives
  // gravity extras
  pullDuration?: number
  pullStrength?: number
}

export const WEAPON_DEFS: Record<string, WeaponDef> = {
  bolt_caster: {
    id: 'bolt_caster', name: 'Bolt Caster', category: 'projectile',
    damage: 15, cooldown: 0.4, range: 50, projectileSpeed: 40,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
  },
  tri_shot: {
    id: 'tri_shot', name: 'Tri-Shot', category: 'projectile',
    damage: 10, cooldown: 0.6, range: 40, projectileSpeed: 35,
    projectileCount: 3, spreadAngle: 0.26, autoTarget: true,
  },
  ricochet: {
    id: 'ricochet', name: 'Ricochet', category: 'projectile',
    damage: 18, cooldown: 0.5, range: 60, projectileSpeed: 38,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    bounceCount: 2,
  },
  shockwave: {
    id: 'shockwave', name: 'Shockwave', category: 'area',
    damage: 25, cooldown: 2.0, range: 12, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 12, aoeDuration: 0.8,
  },
  ground_slam: {
    id: 'ground_slam', name: 'Ground Slam', category: 'area',
    damage: 60, cooldown: 5.0, range: 8, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 8, aoeDuration: 0.3,
  },
  blade_orbit: {
    id: 'blade_orbit', name: 'Blade Orbit', category: 'orbital',
    damage: 12, cooldown: 0.25, range: 4, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    orbitRadius: 3.5, orbitSpeed: 2.5, orbitCount: 3,
  },
  shield_ring: {
    id: 'shield_ring', name: 'Shield Ring', category: 'orbital',
    damage: 8, cooldown: 0.5, range: 5, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    orbitRadius: 4.5, orbitSpeed: 1.2, orbitCount: 1,
    shieldReduction: 0.4,
  },
  lightning_arc: {
    id: 'lightning_arc', name: 'Lightning Arc', category: 'chain',
    damage: 20, cooldown: 1.0, range: 18, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 2, chainRange: 8,
  },
  turret: {
    id: 'turret', name: 'Turret', category: 'deployable',
    damage: 12, cooldown: 8.0, range: 20, projectileSpeed: 35,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    deployDuration: 15,
  },
  vortex_pull: {
    id: 'vortex_pull', name: 'Vortex Pull', category: 'gravity',
    damage: 5, cooldown: 4.0, range: 14, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 3, pullStrength: 8,
  },

  // ── New base weapons ──────────────────────────────────────────────────────
  seeker_swarm: {
    id: 'seeker_swarm', name: 'Seeker Swarm', category: 'projectile',
    damage: 8, cooldown: 0.3, range: 45, projectileSpeed: 25,
    projectileCount: 2, spreadAngle: 0.5, autoTarget: true,
  },
  void_mine: {
    id: 'void_mine', name: 'Void Mine', category: 'deployable',
    damage: 80, cooldown: 3.0, range: 6, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 6, deployDuration: 10,
  },
  sonic_boom: {
    id: 'sonic_boom', name: 'Sonic Boom', category: 'area',
    damage: 35, cooldown: 1.5, range: 15, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 15, aoeDuration: 0.5,
  },
  flak_cannon: {
    id: 'flak_cannon', name: 'Flak Cannon', category: 'projectile',
    damage: 6, cooldown: 0.8, range: 30, projectileSpeed: 30,
    projectileCount: 8, spreadAngle: 0.6, autoTarget: true,
  },
  homing_missile: {
    id: 'homing_missile', name: 'Homing Missile', category: 'projectile',
    damage: 40, cooldown: 2.0, range: 60, projectileSpeed: 20,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', category: 'chain',
    damage: 22, cooldown: 1.0, range: 30, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 4, chainRange: 12,
  },
  gravity_well: {
    id: 'gravity_well', name: 'Gravity Well', category: 'gravity',
    damage: 5, cooldown: 8.0, range: 20, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 4, pullStrength: 8,
  },
  drone_buddy: {
    id: 'drone_buddy', name: 'Drone Buddy', category: 'orbital',
    damage: 12, cooldown: 0.5, range: 25, projectileSpeed: 30,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    orbitRadius: 4, orbitSpeed: 2.0, orbitCount: 1,
  },

  // ---- Evolved weapons (require level 5 base + meta upgrade) ----
  railgun: {
    id: 'railgun', name: 'Railgun', category: 'projectile',
    damage: 60, cooldown: 1.2, range: 80, projectileSpeed: 80,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    bounceCount: 0,
  },
  spread_cannon: {
    id: 'spread_cannon', name: 'Spread Cannon', category: 'projectile',
    damage: 14, cooldown: 0.35, range: 40, projectileSpeed: 38,
    projectileCount: 5, spreadAngle: 0.52, autoTarget: true,
  },
  storm_caller: {
    id: 'storm_caller', name: 'Storm Caller', category: 'chain',
    damage: 22, cooldown: 0.7, range: 22, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 4, chainRange: 10,
  },
  death_spiral: {
    id: 'death_spiral', name: 'Death Spiral', category: 'orbital',
    damage: 20, cooldown: 0.2, range: 6, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    orbitRadius: 5.5, orbitSpeed: 3.5, orbitCount: 5,
  },
  fortress: {
    id: 'fortress', name: 'Fortress', category: 'deployable',
    damage: 18, cooldown: 6.0, range: 25, projectileSpeed: 38,
    projectileCount: 3, spreadAngle: 0.2, autoTarget: true,
    deployDuration: 20,
  },

  // New evolved weapons
  swarm_queen: {
    id: 'swarm_queen', name: 'Swarm Queen', category: 'projectile',
    damage: 12, cooldown: 0.15, range: 40, projectileSpeed: 30,
    projectileCount: 3, spreadAngle: 0.7, autoTarget: true,
  },
  mega_mine: {
    id: 'mega_mine', name: 'Mega Mine', category: 'deployable',
    damage: 150, cooldown: 2.5, range: 10, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 10, deployDuration: 12,
  },
  sky_beam: {
    id: 'sky_beam', name: 'Sky Beam', category: 'area',
    damage: 100, cooldown: 4.0, range: 12, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 12, aoeDuration: 1.5,
  },
  flak_storm: {
    id: 'flak_storm', name: 'Flak Storm', category: 'projectile',
    damage: 10, cooldown: 0.5, range: 35, projectileSpeed: 35,
    projectileCount: 12, spreadAngle: 0.8, autoTarget: true,
  },
  hellfire_missile: {
    id: 'hellfire_missile', name: 'Hellfire Missile', category: 'projectile',
    damage: 70, cooldown: 1.5, range: 70, projectileSpeed: 25,
    projectileCount: 2, spreadAngle: 0.1, autoTarget: true,
  },
  tesla_coil: {
    id: 'tesla_coil', name: 'Tesla Coil', category: 'chain',
    damage: 35, cooldown: 0.8, range: 35, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 8, chainRange: 15,
  },
  singularity: {
    id: 'singularity', name: 'Singularity', category: 'gravity',
    damage: 15, cooldown: 12.0, range: 25, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 6, pullStrength: 15,
  },
  drone_swarm: {
    id: 'drone_swarm', name: 'Drone Swarm', category: 'orbital',
    damage: 18, cooldown: 0.35, range: 30, projectileSpeed: 35,
    projectileCount: 2, spreadAngle: 0.3, autoTarget: true,
    orbitRadius: 5, orbitSpeed: 2.5, orbitCount: 3,
  },

  // ---- Fusion weapons (require two evolved weapons at max level) ----
  singularity_cannon: {
    id: 'singularity_cannon', name: 'Singularity Cannon', category: 'projectile',
    damage: 120, cooldown: 2.0, range: 90, projectileSpeed: 100,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
  },
  thunder_rain: {
    id: 'thunder_rain', name: 'Thunder Rain', category: 'chain',
    damage: 35, cooldown: 0.4, range: 30, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 6, chainRange: 12,
  },
  gravity_fortress: {
    id: 'gravity_fortress', name: 'Gravity Fortress', category: 'gravity',
    damage: 40, cooldown: 3.0, range: 22, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 5, pullStrength: 14,
  },
}
