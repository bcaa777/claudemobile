import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const tundraBiome: BiomeConfig = {
  type: BiomeType.Tundra,
  name: 'Frozen Barrens',
  fogColor: new THREE.Color(0x706860),
  fogNear: 25,
  fogFar: 140,
  skyColor: new THREE.Color(0x605850),
  skyConfig: {
    zenithDay: new THREE.Color(0x4a4438),
    zenithNight: new THREE.Color(0x0a0a08),
    horizonDay: new THREE.Color(0x706050),
    horizonNight: new THREE.Color(0x121008),
    cloudColor: new THREE.Color(0x606050),
    cloudDensity: 0.2,
    hazeStrength: 0.5,
  },
  ambientDayColor: new THREE.Color(0x807060),
  ambientNightColor: new THREE.Color(0x080c14),
  sunColor: new THREE.Color(0xc0b0a0),
  palette: [
    [0.42, 0.40, 0.35],  // dark gray-brown
    [0.52, 0.48, 0.40],  // medium brown
    [0.38, 0.40, 0.32],  // muted olive
    [0.62, 0.58, 0.50],  // light tan
    [0.30, 0.32, 0.25],  // dark olive
    [0.30, 0.25, 0.20],  // dead brown (keep)
    [0.50, 0.48, 0.42],  // mid gray-brown
  ],
  groundColors: [
    [0.45, 0.42, 0.36],
    [0.55, 0.50, 0.42],
    [0.38, 0.36, 0.30],
    [0.62, 0.58, 0.50],
    [0.32, 0.30, 0.25],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 1, minScale: 2, maxScale: 4,   isBillboard: true },
    { category: 'rock',      weight: 6, minScale: 1, maxScale: 3,   isBillboard: false },
    { category: 'structure', weight: 0.5, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 8, minScale: 0.5, maxScale: 1, isBillboard: true },
    { category: 'bush',      weight: 4, minScale: 0.5, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 14,
  heightFrequency: 0.020,
  mountainScale: 1.4,
  terraceStrength: 0.5,
  terraceStep: 5,
  waterColor: new THREE.Color(0x607060),
  hasPointLights: false,
  particleType: 'snow',
  particleColor: new THREE.Color(0xc0b8a8),
  particleCount: 50,
}
