export { BiomeType } from './types'
export type { BiomeConfig, SpriteCategory, SpriteTypeConfig, SkyConfig, AtmosphereParticleType, VisualIdentity } from './types'
export {
  generateHeightmap,
  sampleWorldHeight,
  sampleHeight,
  riverMask,
  continentalOffset,
  CHUNK_SIZE,
  CHUNK_SEGMENTS,
  WATER_LEVEL,
  HEAVEN_ALTITUDE,
  HELL_DEPTH,
  HELL_PIT_RADIUS,
  DEFAULT_TERRAIN_CONFIG,
} from './TerrainGenerator'
export type {
  HeightmapResult,
  TerrainConfig,
  BiomeProvider,
  BiomeBlend,
  MegaMountain,
} from './TerrainGenerator'
export { makeNoise2D, fbm } from './Noise'
export type { Noise2DFn } from './Noise'
export { BiomeMap } from './BiomeMap'
export type { BiomeMapConfig } from './BiomeMap'
