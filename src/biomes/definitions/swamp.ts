import * as THREE from 'three'
import { BiomeConfig, BiomeType } from '../types'

export const swampBiome: BiomeConfig = {
  type: BiomeType.Swamp,
  name: 'Murk Hollows',
  fogColor: new THREE.Color(0x1a2e10),
  fogNear: 10,
  fogFar: 60,
  skyColor: new THREE.Color(0x0b1a08),
  ambientDayColor: new THREE.Color(0x1a2a10),
  ambientNightColor: new THREE.Color(0x040806),
  sunColor: new THREE.Color(0x6a8a4a),
  palette: [
    [0.06, 0.14, 0.04],
    [0.10, 0.20, 0.06],
    [0.14, 0.26, 0.08],
    [0.08, 0.16, 0.10],
    [0.18, 0.28, 0.06],
    [0.24, 0.18, 0.08], // murky brown
    [0.12, 0.22, 0.04],
  ],
  groundColors: [
    [0.10, 0.22, 0.06],
    [0.14, 0.28, 0.08],
    [0.08, 0.18, 0.04],
    [0.20, 0.30, 0.10],
    [0.06, 0.14, 0.08],
  ],
  spriteTypes: [
    { category: 'tree',      weight: 3, minScale: 3, maxScale: 6,   isBillboard: true },
    { category: 'bush',      weight: 5, minScale: 1, maxScale: 2,   isBillboard: true },
    { category: 'rock',      weight: 1, minScale: 1, maxScale: 2,   isBillboard: false },
    { category: 'structure', weight: 0.2, minScale: 2, maxScale: 3, isBillboard: true },
    { category: 'grass',     weight: 8, minScale: 0.8, maxScale: 1.6, isBillboard: true },
  ],
  heightScale: 8,
  heightFrequency: 0.025,
  mountainScale: 1.2,
  terraceStrength: 0.0,
  terraceStep: 4,
  waterColor: new THREE.Color(0x1a3010),
  hasPointLights: true,
  particleType: 'fireflies',
  particleColor: new THREE.Color(0xaaff44),
  particleCount: 45,
}
