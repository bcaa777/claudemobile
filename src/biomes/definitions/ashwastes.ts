import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const ashWastesBiome: BiomeConfig = {
  type: BiomeType.AshWastes,
  name: 'Ash Wastes',
  fogColor: new THREE.Color(0x404040),
  fogNear: 20,
  fogFar: 110,
  skyColor: new THREE.Color(0x1c1c1c),
  ambientDayColor: new THREE.Color(0x383838),
  ambientNightColor: new THREE.Color(0x080808),
  sunColor: new THREE.Color(0x808070),
  palette: [
    [0.15, 0.15, 0.15],
    [0.25, 0.25, 0.25],
    [0.35, 0.35, 0.35],
    [0.45, 0.45, 0.45],
    [0.08, 0.08, 0.08],
    [0.55, 0.50, 0.45], // pale ash highlight
    [0.20, 0.18, 0.16], // dark base
  ],
  groundColors: [
    [0.20, 0.20, 0.20],
    [0.30, 0.28, 0.26],
    [0.15, 0.15, 0.15],
    [0.40, 0.38, 0.35],
    [0.10, 0.10, 0.10],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 3, minScale: 4, maxScale: 9,   isBillboard: true },
    { category: 'rock',      weight: 4, minScale: 1, maxScale: 3,   isBillboard: false },
    { category: 'structure', weight: 0.5, minScale: 3, maxScale: 6, isBillboard: true },
    { category: 'grass',     weight: 1, minScale: 0.5, maxScale: 1, isBillboard: true },
    { category: 'bush',      weight: 1, minScale: 0.5, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 22,
  heightFrequency: 0.018,
  mountainScale: 3.2,
  terraceStrength: 0.6,
  terraceStep: 6,
  waterColor: new THREE.Color(0x303028),
  hasPointLights: false,
  particleType: 'ash',
  particleColor: new THREE.Color(0xa0a090),
  particleCount: 60,
}
