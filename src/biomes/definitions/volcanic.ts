import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Ash Wastes biome
export const volcanicBiome: BiomeConfig = {
  type: BiomeType.Volcanic,
  name: 'Ember Fields',
  fogColor: new THREE.Color(0x4a1500),
  fogNear: 20,
  fogFar: 100,
  skyColor: new THREE.Color(0x1a0800),
  skyConfig: {
    zenithDay: new THREE.Color(0x1a0600),
    zenithNight: new THREE.Color(0x080200),
    horizonDay: new THREE.Color(0x6a2000),
    horizonNight: new THREE.Color(0x1a0400),
    cloudColor: new THREE.Color(0x4a1000),
    cloudDensity: 0.12,     // slight ash haze from Ash Wastes
    hazeStrength: 0.7,
  },
  ambientDayColor: new THREE.Color(0x3a1008),
  ambientNightColor: new THREE.Color(0x1a0500),
  sunColor: new THREE.Color(0xff4400),
  palette: [
    [0.12, 0.04, 0.02],
    [0.20, 0.06, 0.02],
    [0.30, 0.08, 0.02],
    [0.80, 0.25, 0.02],   // lava orange
    [0.95, 0.55, 0.02],   // lava bright
    [0.08, 0.03, 0.03],
    [0.15, 0.05, 0.02],
    [0.25, 0.25, 0.25],   // ash wastes gray
    [0.55, 0.50, 0.45],   // pale ash highlight
  ],
  groundColors: [
    [0.30, 0.10, 0.05],
    [0.38, 0.14, 0.05],
    [0.22, 0.08, 0.05],
    [0.45, 0.16, 0.05],
    [0.85, 0.30, 0.03],   // lava crack
    [0.20, 0.20, 0.20],   // ash wastes dark ground
    [0.30, 0.28, 0.26],   // ash wastes light ground
  ],
  spriteTypes: [
    { category: 'rock',      weight: 6, minScale: 1.5, maxScale: 4,  isBillboard: false },
    { category: 'structure', weight: 2, minScale: 2,   maxScale: 6,  isBillboard: true },  // ash colosseum
    { category: 'tree',      weight: 3, minScale: 2,   maxScale: 9,  isBillboard: true },  // dead trees + ash wastes tall husks
    { category: 'bush',      weight: 3, minScale: 0.5, maxScale: 1.5, isBillboard: true },
    { category: 'grass',     weight: 3, minScale: 0.5, maxScale: 1, isBillboard: true },
  ],
  heightScale: 24,
  heightFrequency: 0.022,   // blended with ash wastes frequency
  mountainScale: 3.8,
  terraceStrength: 0.35,     // ash wastes had stronger terracing (0.6)
  terraceStep: 6,
  waterColor: new THREE.Color(0xcc2200),
  hasPointLights: true,
  particleType: 'ash',       // ash wastes dominant particle — wider ash coverage
  particleColor: new THREE.Color(0xa0a090),  // ash wastes pale ash color
  particleCount: 60,         // increased for wider ash particle coverage
  visualIdentity: {
    colorGrade: {
      tint: [1.1, 0.85, 0.7],
      contrast: 1.2,
      saturation: 1.0,
    },
    fog: {
      nearDistance: 20,
      farDistance: 100,
      color: [0.29, 0.08, 0.0],
      density: 0.5,
    },
    ambientLight: {
      color: [0.23, 0.06, 0.03],
      intensity: 0.7,
    },
    atmosphere: {
      particleType: 'embers',
      particleCount: 180,
      particleColor: [1.0, 0.4, 0.1],
      particleSize: 0.12,
      particleSpeed: 0.6,
    },
    godRayIntensity: 0.3,
    heatDistortion: 0.8,
    groundFogDensity: 0.1,
  },
}
