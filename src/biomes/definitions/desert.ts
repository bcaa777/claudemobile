import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const desertBiome: BiomeConfig = {
  type: BiomeType.Desert,
  name: 'Dry Wastes',
  fogColor: new THREE.Color(0x3d2a10),
  fogNear: 15,
  fogFar: 90,
  skyColor: new THREE.Color(0x1a0e05),
  ambientDayColor: new THREE.Color(0x4a3010),
  ambientNightColor: new THREE.Color(0x100a02),
  sunColor: new THREE.Color(0xffbb44),
  palette: [
    [0.65, 0.45, 0.20],
    [0.55, 0.38, 0.14],
    [0.72, 0.52, 0.25],
    [0.45, 0.30, 0.10],
    [0.80, 0.60, 0.30],
    [0.38, 0.22, 0.08],
  ],
  groundColors: [
    [0.60, 0.42, 0.18],
    [0.55, 0.38, 0.14],
    [0.68, 0.50, 0.22],
    [0.45, 0.32, 0.12],
    [0.72, 0.55, 0.25],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 1, minScale: 2, maxScale: 4,  isBillboard: true },  // cactus
    { category: 'rock',      weight: 5, minScale: 1, maxScale: 3.5, isBillboard: false },
    { category: 'structure', weight: 1, minScale: 3, maxScale: 6,  isBillboard: true },
    { category: 'grass',     weight: 2, minScale: 0.5, maxScale: 1, isBillboard: true },
    { category: 'bush',      weight: 1, minScale: 0.8, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 6,
  heightFrequency: 0.015,
  hasPointLights: false,
  particleType: 'ash',
  particleColor: new THREE.Color(0xd4a050),
  particleCount: 15,
}
