import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Bog and Mushroom biomes
export const swampBiome: BiomeConfig = {
  type: BiomeType.Swamp,
  name: 'Murk Hollows',
  fogColor: new THREE.Color(0x1a2e10),
  fogNear: 8,              // denser fog from bog
  fogFar: 60,
  skyColor: new THREE.Color(0x0b1a08),
  skyConfig: {
    zenithDay: new THREE.Color(0x0a1a08),
    zenithNight: new THREE.Color(0x040804),
    horizonDay: new THREE.Color(0x2a4010),
    horizonNight: new THREE.Color(0x060a04),
    cloudColor: new THREE.Color(0x1a3008),
    cloudDensity: 0.6,     // heavier clouds from bog
    hazeStrength: 0.8,
  },
  ambientDayColor: new THREE.Color(0x1a2a10),
  ambientNightColor: new THREE.Color(0x040806),
  sunColor: new THREE.Color(0x6a8a4a),
  palette: [
    [0.06, 0.14, 0.04],
    [0.10, 0.20, 0.06],
    [0.14, 0.26, 0.08],
    [0.08, 0.16, 0.10],
    [0.18, 0.28, 0.06],
    [0.24, 0.18, 0.08],   // murky brown
    [0.12, 0.22, 0.04],
    [0.40, 0.10, 0.55],   // mushroom purple cap
    [0.55, 0.15, 0.70],   // mushroom bright cap
    [0.20, 0.25, 0.12],   // bog dark green
  ],
  groundColors: [
    [0.10, 0.22, 0.06],
    [0.14, 0.28, 0.08],
    [0.08, 0.18, 0.04],
    [0.20, 0.30, 0.10],
    [0.06, 0.14, 0.08],
    [0.22, 0.25, 0.14],   // bog mossy ground
    [0.35, 0.12, 0.48],   // mushroom mycelium purple
  ],
  spriteTypes: [
    { category: 'tree',      weight: 6, minScale: 3, maxScale: 7,   isBillboard: true },  // swamp trees + giant mushrooms
    { category: 'bush',      weight: 7, minScale: 1, maxScale: 3,   isBillboard: true },  // bog shrubs + mushroom clusters
    { category: 'rock',      weight: 2, minScale: 0.5, maxScale: 2, isBillboard: false },
    { category: 'structure', weight: 0.6, minScale: 2, maxScale: 4, isBillboard: true },  // bog shrine, mycelium cathedral
    { category: 'grass',     weight: 10, minScale: 0.5, maxScale: 1.6, isBillboard: true },  // spore grass + bog reeds
  ],
  heightScale: 12,           // raised: mushroom biome had taller formations (16)
  heightFrequency: 0.022,
  mountainScale: 1.5,        // mushroom mounds
  terraceStrength: 0.1,      // slight terracing from mushroom shelves
  terraceStep: 4,
  waterColor: new THREE.Color(0x1a3010),
  hasPointLights: true,
  particleType: 'fireflies',
  particleColor: new THREE.Color(0xaaff44),
  particleCount: 50,         // more fireflies + spore particles
  visualIdentity: {
    colorGrade: {
      tint: [0.85, 0.95, 0.75],
      contrast: 0.9,
      saturation: 0.7,
    },
    fog: {
      nearDistance: 8,
      farDistance: 60,
      color: [0.35, 0.45, 0.25],
      density: 0.7,
    },
    ambientLight: {
      color: [0.1, 0.17, 0.06],
      intensity: 0.6,
    },
    atmosphere: {
      particleType: 'fireflies',
      particleCount: 120,
      particleColor: [0.67, 1.0, 0.27],
      particleSize: 0.5,
      particleSpeed: 0.15,
    },
    godRayIntensity: 0.2,
    heatDistortion: 0,
    groundFogDensity: 0.8,
  },
}
