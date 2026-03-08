import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const volcanicBiome: BiomeConfig = {
  type: BiomeType.Volcanic,
  name: 'Ember Fields',
  fogColor: new THREE.Color(0x4a1500),
  fogNear: 20,
  fogFar: 100,
  skyColor: new THREE.Color(0x1a0800),
  ambientDayColor: new THREE.Color(0x3a1008),
  ambientNightColor: new THREE.Color(0x1a0500),
  sunColor: new THREE.Color(0xff4400),
  palette: [
    [0.12, 0.04, 0.02],
    [0.20, 0.06, 0.02],
    [0.30, 0.08, 0.02],
    [0.80, 0.25, 0.02],  // lava orange
    [0.95, 0.55, 0.02],  // lava bright
    [0.08, 0.03, 0.03],
    [0.15, 0.05, 0.02],
  ],
  groundColors: [
    [0.30, 0.10, 0.05],
    [0.38, 0.14, 0.05],
    [0.22, 0.08, 0.05],
    [0.45, 0.16, 0.05],
    [0.85, 0.30, 0.03],  // lava crack
  ],
  spriteTypes: [
    { category: 'rock',      weight: 6, minScale: 1.5, maxScale: 4,  isBillboard: false },
    { category: 'structure', weight: 2, minScale: 2,   maxScale: 5,  isBillboard: true },
    { category: 'tree',      weight: 1, minScale: 2,   maxScale: 4,  isBillboard: true },  // dead tree
    { category: 'bush',      weight: 1, minScale: 0.8, maxScale: 1.5, isBillboard: true }, // ash bush
  ],
  heightScale: 24,
  heightFrequency: 0.026,
  mountainScale: 3.8,
  terraceStrength: 0.18,
  terraceStep: 6,
  waterColor: new THREE.Color(0xcc2200),
  hasPointLights: true,
  particleType: 'embers',
  particleColor: new THREE.Color(0xff4400),
  particleCount: 50,
}
