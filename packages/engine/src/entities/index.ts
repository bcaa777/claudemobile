export { createGameWorld, type GameWorld } from './World'
export { createEntity, createEnemy, createPlayer, createProjectile } from './EntityFactory'
export {
  Position, Velocity, Rotation,
  Health, Renderable, AIState, DNAComponent, WeaponComponent,
  IsPlayer, IsEnemy, IsCompanion, IsProjectile, IsPickup,
} from './components'
export { SpatialGrid } from './SpatialGrid'
export type { BodyPlan, CreatureDNA, DerivedStats } from './DNA'
export { quantizeLegCount, quantizeEyeCount } from './DNA'
export { breedDNA, mutateDNA } from './DNABreeding'
export {
  DNA_PRESETS, BIOME_DNA_TABLE, getPresetDNA,
  PRESET_ELK, PRESET_WOLF, PRESET_BEAR, PRESET_FOX, PRESET_RABBIT, PRESET_MAMMOTH,
  PRESET_BEETLE, PRESET_SPIDER, PRESET_MANTIS, PRESET_ANT, PRESET_CENTIPEDE,
  PRESET_EAGLE, PRESET_SONGBIRD, PRESET_PARROT, PRESET_BAT,
  PRESET_SHARK, PRESET_GOLDFISH, PRESET_EEL,
  PRESET_SNAKE, PRESET_WYRM,
} from './DNAPresets'
export type { RarityTier } from './DNAVariant'
export { getVariantId, calculateRarityScore, getRarityTier, getRarityColor } from './DNAVariant'
