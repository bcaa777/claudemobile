import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const crystalBiome: BiomeConfig = {
  type: BiomeType.Crystal,
  name: 'Crystal Hollows',
  fogColor: new THREE.Color(0x102840),
  fogNear: 22,
  fogFar: 130,
  skyColor: new THREE.Color(0x081828),
  ambientDayColor: new THREE.Color(0x103050),
  ambientNightColor: new THREE.Color(0x040c18),
  sunColor: new THREE.Color(0x60b0e0),
  palette: [
    [0.20, 0.55, 0.80],
    [0.30, 0.70, 0.90],
    [0.40, 0.80, 0.95],
    [0.60, 0.90, 1.00],
    [0.10, 0.35, 0.60],
    [0.80, 0.95, 1.00], // bright highlight
    [0.15, 0.45, 0.70],
  ],
  groundColors: [
    [0.18, 0.45, 0.70],
    [0.25, 0.55, 0.80],
    [0.12, 0.35, 0.60],
    [0.35, 0.65, 0.85],
    [0.08, 0.28, 0.50],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 5, minScale: 4, maxScale: 10,  isBillboard: true },
    { category: 'rock',      weight: 3, minScale: 1, maxScale: 3,   isBillboard: false },
    { category: 'structure', weight: 0.4, minScale: 3, maxScale: 7, isBillboard: true },
    { category: 'grass',     weight: 2, minScale: 0.6, maxScale: 1.2, isBillboard: true },
    { category: 'bush',      weight: 2, minScale: 1, maxScale: 2,   isBillboard: true },
  ],
  heightScale: 20,
  heightFrequency: 0.020,
  mountainScale: 2.8,
  terraceStrength: 0.55,
  terraceStep: 5,
  waterColor: new THREE.Color(0x204060),
  hasPointLights: true,
  particleType: null,
  particleColor: new THREE.Color(0x80d0ff),
  particleCount: 0,
}
