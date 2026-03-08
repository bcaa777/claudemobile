import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const tundraBiome: BiomeConfig = {
  type: BiomeType.Tundra,
  name: 'Frozen Barrens',
  fogColor: new THREE.Color(0x8898a8),
  fogNear: 25,
  fogFar: 140,
  skyColor: new THREE.Color(0x5a6a78),
  ambientDayColor: new THREE.Color(0x7080a0),
  ambientNightColor: new THREE.Color(0x080c14),
  sunColor: new THREE.Color(0xc0d0e0),
  palette: [
    [0.65, 0.70, 0.75],
    [0.75, 0.80, 0.85],
    [0.50, 0.55, 0.65],
    [0.85, 0.88, 0.92],
    [0.40, 0.45, 0.55],
    [0.30, 0.25, 0.20], // dead brown
    [0.60, 0.65, 0.70],
  ],
  groundColors: [
    [0.68, 0.72, 0.78],
    [0.78, 0.82, 0.88],
    [0.55, 0.60, 0.68],
    [0.85, 0.88, 0.92],
    [0.45, 0.50, 0.58],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 1, minScale: 2, maxScale: 4,   isBillboard: true },
    { category: 'rock',      weight: 4, minScale: 1, maxScale: 3,   isBillboard: false },
    { category: 'structure', weight: 0.2, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 3, minScale: 0.5, maxScale: 1, isBillboard: true },
    { category: 'bush',      weight: 2, minScale: 0.5, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 14,
  heightFrequency: 0.020,
  mountainScale: 1.4,
  terraceStrength: 0.5,
  terraceStep: 5,
  waterColor: new THREE.Color(0x6080a0),
  hasPointLights: false,
  particleType: 'snow',
  particleColor: new THREE.Color(0xdce8f8),
  particleCount: 50,
}
