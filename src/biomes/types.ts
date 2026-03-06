import * as THREE from 'three'

export enum BiomeType {
  Forest = 0,
  Desert = 1,
  Volcanic = 2,
  Snow = 3,
}

export type SpriteCategory = 'tree' | 'bush' | 'rock' | 'structure' | 'grass'

export interface SpriteTypeConfig {
  category: SpriteCategory
  weight: number      // relative spawn probability
  minScale: number
  maxScale: number
  isBillboard: boolean  // true = Y-axis billboard, false = ground decal
}

export interface BiomeConfig {
  type: BiomeType
  name: string
  fogColor: THREE.Color
  fogNear: number
  fogFar: number
  skyColor: THREE.Color       // background/clear color
  ambientDayColor: THREE.Color
  ambientNightColor: THREE.Color
  sunColor: THREE.Color
  palette: [number, number, number][]  // [[r,g,b] 0..1, ...]
  groundColors: [number, number, number][]  // vertex color palette for terrain
  spriteTypes: SpriteTypeConfig[]
  heightScale: number           // terrain amplitude
  heightFrequency: number       // noise frequency
  hasPointLights: boolean
  particleType: 'snow' | 'ash' | 'fireflies' | 'embers' | null
  particleColor: THREE.Color
  particleCount: number
}
