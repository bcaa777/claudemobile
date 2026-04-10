export const GAME_CONFIG = {
  // Player
  playerSpeed: 10,
  playerSprintSpeed: 16,
  playerHealth: 100,
  playerHeight: 1.8,

  // Combat balance — manageable start, steady growth
  waveInterval: 120,
  wavesPerExpedition: 6,
  enemiesPerWaveBase: 12,     // start manageable
  enemiesPerWaveScale: 1.4,   // grow steadily

  // Progression — slightly faster for fun
  xpPerKillBase: 10,
  xpToLevelBase: 40,          // level up faster early
  xpLevelScale: 1.12,         // slower scaling
  goldDropRate: 0.25,          // more gold for shop engagement

  // Performance
  maxEnemies: 200,
  projectilePoolSize: 500,
  spatialGridCellSize: 5,

  // Boss
  bossBaseHp: 400,
  bossHpPerDifficulty: 80,
  bossDamage: 20,

  // Companion
  companionXpShare: 0.5,      // 50% of player XP
}
