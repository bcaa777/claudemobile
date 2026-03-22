import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Alpine, Cliffs, Tundra, and Taiga biomes
export const snowBiome: BiomeConfig = {
  type: BiomeType.Snow,
  name: 'Frozen Wastes',
  fogColor: new THREE.Color(0x8090a8),
  fogNear: 10,
  fogFar: 70,
  skyColor: new THREE.Color(0x1a2030),
  skyConfig: {
    zenithDay: new THREE.Color(0x4a5a70),
    zenithNight: new THREE.Color(0x080a14),
    horizonDay: new THREE.Color(0x8a98b0),
    horizonNight: new THREE.Color(0x101828),
    cloudColor: new THREE.Color(0xa0a8b8),
    cloudDensity: 0.7,
    hazeStrength: 0.3,
  },
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
    [0.20, 0.35, 0.28],  // taiga conifer green
    [0.42, 0.40, 0.35],  // tundra gray-brown
    [0.55, 0.58, 0.65],  // cliff stone gray
  ],
  groundColors: [
    [0.78, 0.84, 0.90],
    [0.70, 0.78, 0.88],
    [0.60, 0.68, 0.80],
    [0.85, 0.90, 0.95],
    [0.50, 0.60, 0.72],
    [0.45, 0.42, 0.36],  // tundra permafrost brown
    [0.55, 0.58, 0.65],  // cliff stone
  ],
  spriteTypes: [
    { category: 'tree',      weight: 6, minScale: 3, maxScale: 10,  isBillboard: true },  // snow pine + taiga conifers
    { category: 'rock',      weight: 5, minScale: 1.5, maxScale: 6, isBillboard: false },  // expanded for cliffs + alpine boulders
    { category: 'structure', weight: 0.8, minScale: 2, maxScale: 4, isBillboard: true },  // monastery, cliff fortress, longhouse
    { category: 'bush',      weight: 3, minScale: 0.5, maxScale: 2, isBillboard: true },
    { category: 'grass',     weight: 5, minScale: 0.4, maxScale: 1.2, isBillboard: true },  // tundra scrub + alpine meadow
  ],
  heightScale: 32,           // widened: tundra 14 -> alpine 40, blended
  heightFrequency: 0.015,    // lower freq for alpine grandeur
  mountainScale: 4.0,        // alpine peak height
  terraceStrength: 0.55,     // cliff-like terraces from Cliffs biome
  terraceStep: 5,
  waterColor: new THREE.Color(0x90c0ee),
  hasPointLights: false,
  particleType: 'snow',
  particleColor: new THREE.Color(0xddeeff),
  particleCount: 60,
}
