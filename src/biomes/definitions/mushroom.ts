import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const mushroomBiome: BiomeConfig = {
  type: BiomeType.Mushroom,
  name: 'Spore Fields',
  fogColor: new THREE.Color(0x301848),
  fogNear: 18,
  fogFar: 100,
  skyColor: new THREE.Color(0x1a0c2a),
  skyConfig: {
    zenithDay: new THREE.Color(0x2a1040),
    zenithNight: new THREE.Color(0x0a0410),
    horizonDay: new THREE.Color(0x5a2060),
    horizonNight: new THREE.Color(0x100818),
    cloudColor: new THREE.Color(0x4a1850),
    cloudDensity: 0.3,
    hazeStrength: 0.5,
  },
  ambientDayColor: new THREE.Color(0x2a1040),
  ambientNightColor: new THREE.Color(0x080410),
  sunColor: new THREE.Color(0x9060c0),
  palette: [
    [0.40, 0.10, 0.55],
    [0.55, 0.15, 0.70],
    [0.70, 0.20, 0.80],
    [0.85, 0.30, 0.90],
    [0.20, 0.08, 0.35],
    [0.95, 0.80, 0.20], // bright cap spots
    [0.30, 0.60, 0.80], // blue-grey stem
  ],
  groundColors: [
    [0.35, 0.12, 0.48],
    [0.45, 0.15, 0.60],
    [0.28, 0.08, 0.38],
    [0.55, 0.18, 0.68],
    [0.20, 0.06, 0.30],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 7, minScale: 3, maxScale: 7,   isBillboard: true },
    { category: 'bush',      weight: 5, minScale: 1, maxScale: 2.5, isBillboard: true },
    { category: 'rock',      weight: 2, minScale: 1, maxScale: 2,   isBillboard: false },
    { category: 'structure', weight: 0.6, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'grass',     weight: 6, minScale: 0.8, maxScale: 1.5, isBillboard: true },
  ],
  heightScale: 16,
  heightFrequency: 0.024,
  mountainScale: 1.8,
  terraceStrength: 0.2,
  terraceStep: 5,
  waterColor: new THREE.Color(0x4020a0),
  hasPointLights: true,
  particleType: 'fireflies',
  particleColor: new THREE.Color(0xff80ff),
  particleCount: 40,
}
