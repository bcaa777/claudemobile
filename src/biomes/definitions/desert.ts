import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Savanna and Oasis biomes
export const desertBiome: BiomeConfig = {
  type: BiomeType.Desert,
  name: 'Dry Wastes',
  fogColor: new THREE.Color(0x3d2a10),
  fogNear: 15,
  fogFar: 90,
  skyColor: new THREE.Color(0x1a0e05),
  skyConfig: {
    zenithDay: new THREE.Color(0x6a5020),
    zenithNight: new THREE.Color(0x0a0808),
    horizonDay: new THREE.Color(0xc09050),
    horizonNight: new THREE.Color(0x1a0a04),
    cloudColor: new THREE.Color(0xb08040),
    cloudDensity: 0.05,
    hazeStrength: 0.6,
  },
  ambientDayColor: new THREE.Color(0x4a3010),
  ambientNightColor: new THREE.Color(0x100a02),
  sunColor: new THREE.Color(0xffbb44),
  palette: [
    [0.65, 0.45, 0.20],
    [0.55, 0.38, 0.14],
    [0.72, 0.52, 0.25],
    [0.45, 0.30, 0.10],
    [0.80, 0.60, 0.30],
    [0.38, 0.22, 0.08],
    [0.70, 0.55, 0.15],  // savanna golden grass
    [0.35, 0.55, 0.25],  // oasis green vegetation
    [0.85, 0.78, 0.55],  // oasis sandy highlight
  ],
  groundColors: [
    [0.60, 0.42, 0.18],
    [0.55, 0.38, 0.14],
    [0.68, 0.50, 0.22],
    [0.45, 0.32, 0.12],
    [0.72, 0.55, 0.25],
    [0.72, 0.56, 0.18],  // savanna dry earth
    [0.40, 0.55, 0.28],  // oasis green patch
  ],
  spriteTypes: [
    { category: 'tree',      weight: 3, minScale: 2, maxScale: 7,  isBillboard: true },  // cactus + savanna acacia + oasis palms
    { category: 'rock',      weight: 5, minScale: 1, maxScale: 3.5, isBillboard: false },
    { category: 'structure', weight: 1.5, minScale: 3, maxScale: 6,  isBillboard: true },  // obelisk, minaret
    { category: 'grass',     weight: 6, minScale: 0.5, maxScale: 1.8, isBillboard: true },  // savanna tall grass
    { category: 'bush',      weight: 4, minScale: 0.8, maxScale: 2, isBillboard: true },  // oasis shrubs
  ],
  heightScale: 10,
  heightFrequency: 0.014,    // slightly broader for savanna rolling plains
  mountainScale: 2.0,
  terraceStrength: 0.50,     // softened slightly for savanna flatness
  terraceStep: 4,
  waterColor: new THREE.Color(0x44aacc),  // oasis clear water
  hasPointLights: false,
  particleType: 'ash',
  particleColor: new THREE.Color(0xd4a050),
  particleCount: 20,         // slightly more for savanna dust
  visualIdentity: {
    colorGrade: {
      tint: [1.1, 0.95, 0.8],
      contrast: 1.1,
      saturation: 0.9,
    },
    fog: {
      nearDistance: 15,
      farDistance: 90,
      color: [0.85, 0.7, 0.45],
      density: 0.3,
    },
    ambientLight: {
      color: [0.29, 0.19, 0.06],
      intensity: 1.2,
    },
    atmosphere: {
      particleType: 'sand',
      particleCount: 150,
      particleColor: [0.83, 0.63, 0.31],
      particleSize: 0.3,
      particleSpeed: 0.8,
    },
    godRayIntensity: 0.6,
    heatDistortion: 0.6,
    groundFogDensity: 0.05,
  },
}
