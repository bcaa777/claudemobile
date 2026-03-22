import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

// Enriched with features from Floating Islands biome
export const heavenBiome: BiomeConfig = {
  type: BiomeType.Heaven,
  name: 'Heaven',
  fogColor: new THREE.Color(0xd0e8ff),
  fogNear: 50,
  fogFar: 280,              // floating islands had greater view distance
  skyColor: new THREE.Color(0xc0ddff),
  skyConfig: {
    zenithDay: new THREE.Color(0x4488dd),
    zenithNight: new THREE.Color(0x0a1530),
    horizonDay: new THREE.Color(0xfff8e0),
    horizonNight: new THREE.Color(0x101828),
    cloudColor: new THREE.Color(0xffffff),
    cloudDensity: 0.90,     // floating islands had dense clouds (0.90)
    hazeStrength: 0.45,     // slightly more haze for floating depth
  },
  ambientDayColor: new THREE.Color(0xeee8dd),
  ambientNightColor: new THREE.Color(0x0a0c14),
  sunColor: new THREE.Color(0xffe080),
  palette: [
    [0.95, 0.95, 0.98],
    [0.92, 0.88, 0.70],
    [0.90, 0.92, 0.96],
    [0.98, 0.96, 0.88],
    [0.85, 0.80, 0.60],
    [1.00, 1.00, 0.95],
    [0.88, 0.85, 0.75],
    [0.70, 0.80, 0.55],   // floating islands mossy green
    [0.60, 0.72, 0.48],   // floating islands deeper green
  ],
  groundColors: [
    [0.95, 0.95, 0.98],
    [0.92, 0.88, 0.70],
    [0.90, 0.92, 0.96],
    [0.98, 0.96, 0.88],
    [0.88, 0.85, 0.75],
    [0.70, 0.80, 0.55],   // floating islands green patch
    [0.85, 0.88, 0.92],   // floating islands sky-stone
  ],
  spriteTypes: [
    { category: 'tree',      weight: 5, minScale: 4, maxScale: 8,   isBillboard: true },
    { category: 'bush',      weight: 4, minScale: 1, maxScale: 3,   isBillboard: true },
    { category: 'grass',     weight: 6, minScale: 0.5, maxScale: 1.2, isBillboard: true },
    { category: 'rock',      weight: 3, minScale: 1.5, maxScale: 3, isBillboard: false },  // floating rock platforms
    { category: 'structure', weight: 0.5, minScale: 2, maxScale: 5, isBillboard: true },   // sky temple
  ],
  heightScale: 30,           // dramatically increased for floating island terrain drama (was 8, islands had 50)
  heightFrequency: 0.009,    // broad rolling from floating islands
  mountainScale: 3.5,        // floating islands had 6.0, blended for dramatic elevation
  terraceStrength: 0.08,     // slight floating island shelf terracing
  terraceStep: 5,
  waterColor: new THREE.Color(0x88ddff),
  hasPointLights: false,
  particleType: 'snow',
  particleColor: new THREE.Color(0xffeedd),
  particleCount: 50,
}
