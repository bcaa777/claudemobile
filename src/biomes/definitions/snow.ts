import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const snowBiome: BiomeConfig = {
  type: BiomeType.Snow,
  name: 'Frozen Wastes',
  fogColor: new THREE.Color(0x8090a8),
  fogNear: 10,
  fogFar: 70,
  skyColor: new THREE.Color(0x1a2030),
  ambientDayColor: new THREE.Color(0x304055),
  ambientNightColor: new THREE.Color(0x0a0d15),
  sunColor: new THREE.Color(0xaabbcc),
  palette: [
    [0.80, 0.85, 0.90],
    [0.65, 0.72, 0.82],
    [0.50, 0.58, 0.70],
    [0.30, 0.38, 0.55],
    [0.92, 0.95, 1.00],
    [0.20, 0.30, 0.45],
  ],
  groundColors: [
    [0.78, 0.84, 0.90],
    [0.70, 0.78, 0.88],
    [0.60, 0.68, 0.80],
    [0.85, 0.90, 0.95],
    [0.50, 0.60, 0.72],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 4, minScale: 3, maxScale: 6,   isBillboard: true },  // snow pine
    { category: 'rock',      weight: 3, minScale: 1, maxScale: 3,   isBillboard: false },
    { category: 'structure', weight: 0.5, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 2, minScale: 0.6, maxScale: 1.2, isBillboard: true },
  ],
  heightScale: 22,
  heightFrequency: 0.019,
  mountainScale: 3.2,
  terraceStrength: 0.45,
  terraceStep: 5,
  waterColor: new THREE.Color(0x90c0ee),
  hasPointLights: false,
  particleType: 'snow',
  particleColor: new THREE.Color(0xddeeff),
  particleCount: 60,
}
