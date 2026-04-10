import * as THREE from 'three'

export enum BiomeType {
  Forest = 0,
  Desert = 1,
  Swamp = 2,
  Snow = 3,
  Volcanic = 4,
  Crystal = 5,
  Jungle = 6,
  Mesa = 7,
  CoralReef = 8,
  Heaven = 9,
  Hell = 10,
}

export type SpriteCategory = 'tree' | 'bush' | 'rock' | 'structure' | 'grass'

export interface SpriteTypeConfig {
  category: SpriteCategory
  weight: number      // relative spawn probability
  minScale: number
  maxScale: number
  isBillboard: boolean  // true = Y-axis billboard, false = ground decal
}

export interface SkyConfig {
  zenithDay: THREE.Color
  zenithNight: THREE.Color
  horizonDay: THREE.Color
  horizonNight: THREE.Color
  cloudColor: THREE.Color
  cloudDensity: number       // 0 = clear, 1 = overcast
  hazeStrength: number       // 0 = sharp horizon, 1 = thick haze
}

export interface BiomeConfig {
  type: BiomeType
  name: string
  fogColor: THREE.Color
  fogNear: number
  fogFar: number
  skyColor: THREE.Color       // background/clear color
  skyConfig: SkyConfig
  ambientDayColor: THREE.Color
  ambientNightColor: THREE.Color
  sunColor: THREE.Color
  palette: [number, number, number][]  // [[r,g,b] 0..1, ...]
  groundColors: [number, number, number][]  // vertex color palette for terrain
  spriteTypes: SpriteTypeConfig[]
  heightScale: number           // terrain amplitude (hills / rolling terrain)
  heightFrequency: number       // noise frequency
  mountainScale: number         // mountains = heightScale * mountainScale
  terraceStrength: number       // 0 = smooth, 1 = fully stepped cliffs
  terraceStep: number           // height of each terrace step (overrides global)
  waterColor: THREE.Color       // water / river surface colour in this biome
  hasPointLights: boolean
  particleType: 'snow' | 'ash' | 'fireflies' | 'embers' | null
  particleColor: THREE.Color
  particleCount: number
  visualIdentity: VisualIdentity
}

export type AtmosphereParticleType = 'dust' | 'snow' | 'embers' | 'spores' | 'fireflies' | 'motes' | 'sand' | 'rain' | 'ash' | 'spray' | 'smoke' | 'none'

export interface VisualIdentity {
  colorGrade: {
    tint: [number, number, number]
    contrast: number
    saturation: number
  }
  fog: {
    nearDistance: number
    farDistance: number
    color: [number, number, number]
    density: number
  }
  ambientLight: {
    color: [number, number, number]
    intensity: number
  }
  atmosphere: {
    particleType: AtmosphereParticleType
    particleCount: number
    particleColor: [number, number, number]
    particleSize: number
    particleSpeed: number
  }
  godRayIntensity: number
  heatDistortion: number
  groundFogDensity: number
}
