import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const forestBiome: BiomeConfig = {
  type: BiomeType.Forest,
  name: 'Dark Forest',
  fogColor: new THREE.Color(0x1a3a1a),
  fogNear: 20,
  fogFar: 120,
  skyColor: new THREE.Color(0x0d1e0d),
  ambientDayColor: new THREE.Color(0x1a3320),
  ambientNightColor: new THREE.Color(0x050808),
  sunColor: new THREE.Color(0x8fb88f),
  palette: [
    [0.04, 0.10, 0.04],
    [0.07, 0.17, 0.07],
    [0.10, 0.24, 0.10],
    [0.05, 0.13, 0.08],
    [0.12, 0.20, 0.08],
    [0.18, 0.28, 0.08],
    [0.22, 0.14, 0.06], // trunk brown
  ],
  groundColors: [
    [0.18, 0.36, 0.18],
    [0.24, 0.45, 0.15],
    [0.12, 0.27, 0.09],
    [0.30, 0.54, 0.24],
    [0.15, 0.30, 0.12],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 5, minScale: 3, maxScale: 7,  isBillboard: true },
    { category: 'bush',      weight: 4, minScale: 1, maxScale: 2,  isBillboard: true },
    { category: 'rock',      weight: 2, minScale: 1, maxScale: 2.5, isBillboard: false },
    { category: 'structure', weight: 0.3, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 6, minScale: 0.8, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 24,
  heightFrequency: 0.022,
  mountainScale: 3.0,
  terraceStrength: 0.30,
  terraceStep: 5,
  waterColor: new THREE.Color(0x1a3d6a),
  hasPointLights: false,
  particleType: 'fireflies',
  particleColor: new THREE.Color(0x88ff44),
  particleCount: 30,
}
