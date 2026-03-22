import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Badlands biome
export const mesaBiome: BiomeConfig = {
  type: BiomeType.Mesa,
  name: 'Mesa',
  fogColor: new THREE.Color(0xc8a080),
  fogNear: 35,              // badlands-style distant haze
  fogFar: 240,
  skyColor: new THREE.Color(0xd0a878),
  skyConfig: {
    zenithDay: new THREE.Color(0x6688aa),
    zenithNight: new THREE.Color(0x0a0810),
    horizonDay: new THREE.Color(0xe8c098),
    horizonNight: new THREE.Color(0x100a08),
    cloudColor: new THREE.Color(0xddbb99),
    cloudDensity: 0.22,
    hazeStrength: 0.40,
  },
  ambientDayColor: new THREE.Color(0xd8c0a0),
  ambientNightColor: new THREE.Color(0x0a0806),
  sunColor: new THREE.Color(0xffdd88),
  palette: [
    [0.78, 0.42, 0.22],
    [0.85, 0.50, 0.28],
    [0.70, 0.38, 0.18],
    [0.90, 0.55, 0.30],
    [0.65, 0.35, 0.15],
    [0.82, 0.48, 0.25],
    [0.75, 0.40, 0.20],
    [0.58, 0.30, 0.18],   // badlands eroded dark
    [0.50, 0.28, 0.15],   // badlands deep shadow
  ],
  groundColors: [
    [0.78, 0.42, 0.22],
    [0.85, 0.50, 0.28],
    [0.70, 0.38, 0.18],
    [0.90, 0.55, 0.30],
    [0.65, 0.35, 0.15],
    [0.58, 0.30, 0.18],   // badlands eroded rock
    [0.50, 0.28, 0.15],   // badlands deep
  ],
  spriteTypes: [
    { category: 'tree',      weight: 0.8, minScale: 1.5, maxScale: 4, isBillboard: true },  // sparse + badlands stunted
    { category: 'bush',      weight: 2, minScale: 0.5, maxScale: 1.5, isBillboard: true },
    { category: 'grass',     weight: 2, minScale: 0.3, maxScale: 0.8, isBillboard: true },
    { category: 'rock',      weight: 6, minScale: 2, maxScale: 6,   isBillboard: false },  // monolith formations
    { category: 'structure', weight: 0.3, minScale: 2, maxScale: 4, isBillboard: true },   // monolith structure
  ],
  heightScale: 22,
  heightFrequency: 0.022,   // higher freq from badlands (0.035) for eroded terrain
  mountainScale: 2.0,
  terraceStrength: 0.70,     // blended: mesa 0.80 + badlands 0.30 eroded look
  terraceStep: 5,
  waterColor: new THREE.Color(0x887755),
  hasPointLights: false,
  particleType: 'ash',       // badlands dust particles
  particleColor: new THREE.Color(0xccaa88),
  particleCount: 20,         // badlands dust
  visualIdentity: {
    colorGrade: {
      tint: [1.1, 0.9, 0.75],
      contrast: 1.1,
      saturation: 0.95,
    },
    fog: {
      nearDistance: 35,
      farDistance: 240,
      color: [0.78, 0.63, 0.5],
      density: 0.25,
    },
    ambientLight: {
      color: [0.85, 0.75, 0.63],
      intensity: 1.1,
    },
    atmosphere: {
      particleType: 'dust',
      particleCount: 120,
      particleColor: [0.8, 0.67, 0.53],
      particleSize: 0.07,
      particleSpeed: 0.5,
    },
    godRayIntensity: 0.7,
    heatDistortion: 0.2,
    groundFogDensity: 0.05,
  },
}
