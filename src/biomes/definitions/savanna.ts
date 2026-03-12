import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const savannaBiome: BiomeConfig = {
  type: BiomeType.Savanna,
  name: 'Dry Savanna',
  fogColor: new THREE.Color(0x8a7040),
  fogNear: 30,
  fogFar: 160,
  skyColor: new THREE.Color(0x5a4820),
  skyConfig: {
    zenithDay: new THREE.Color(0x5a4020),
    zenithNight: new THREE.Color(0x0a0804),
    horizonDay: new THREE.Color(0xa08040),
    horizonNight: new THREE.Color(0x1a1008),
    cloudColor: new THREE.Color(0x908050),
    cloudDensity: 0.1,
    hazeStrength: 0.5,
  },
  ambientDayColor: new THREE.Color(0x806030),
  ambientNightColor: new THREE.Color(0x100c04),
  sunColor: new THREE.Color(0xf0c060),
  palette: [
    [0.70, 0.55, 0.15],
    [0.80, 0.65, 0.20],
    [0.90, 0.75, 0.25],
    [0.60, 0.45, 0.12],
    [0.50, 0.38, 0.10],
    [0.30, 0.22, 0.08], // dark trunk
    [0.85, 0.70, 0.30], // golden highlight
  ],
  groundColors: [
    [0.72, 0.56, 0.18],
    [0.80, 0.64, 0.22],
    [0.62, 0.48, 0.14],
    [0.88, 0.72, 0.28],
    [0.55, 0.42, 0.12],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 3, minScale: 3, maxScale: 7,   isBillboard: true },
    { category: 'rock',      weight: 4, minScale: 1, maxScale: 2.5, isBillboard: false },
    { category: 'bush',      weight: 5, minScale: 0.8, maxScale: 2, isBillboard: true },
    { category: 'structure', weight: 0.5, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 10, minScale: 0.8, maxScale: 1.8, isBillboard: true },
  ],
  heightScale: 7,
  heightFrequency: 0.018,
  mountainScale: 1.3,
  terraceStrength: 0.1,
  terraceStep: 4,
  waterColor: new THREE.Color(0x4a6030),
  hasPointLights: false,
  particleType: 'ash',
  particleColor: new THREE.Color(0xd0b060),
  particleCount: 20,
}
