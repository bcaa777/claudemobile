import * as THREE from 'three'
import {
  generateHeightmap,
  sampleWorldHeight,
  CHUNK_SIZE,
  CHUNK_SEGMENTS,
  BiomeMap,
  BiomeType,
  BiomeConfig,
  WATER_LEVEL,
  BillboardBatch,
  SpriteAtlas,
} from '@engine/core'
import type { SpriteTypeConfig, VisualIdentity } from '@engine/core'
import type { UndergroundConfig } from './UndergroundBiomes'

// ─── Minimal biome configs for the crawler game ──────────────────────────────
// Only the fields used by generateHeightmap / sampleWorldHeight are needed.

function defaultVisualIdentity(): VisualIdentity {
  return {
    colorGrade: { tint: [1, 1, 1], contrast: 1, saturation: 1 },
    fog: { nearDistance: 60, farDistance: 300, color: [0.5, 0.5, 0.5], density: 0.3 },
    ambientLight: { color: [0.2, 0.2, 0.2], intensity: 0.8 },
    atmosphere: {
      particleType: 'none',
      particleCount: 0,
      particleColor: [1, 1, 1],
      particleSize: 0.2,
      particleSpeed: 0.1,
    },
    godRayIntensity: 0,
    heatDistortion: 0,
    groundFogDensity: 0,
  }
}

function makeBiomeConfig(
  type: BiomeType,
  heightScale: number,
  heightFrequency: number,
  mountainScale: number,
  terraceStrength: number,
  terraceStep: number,
  groundColors: [number, number, number][],
  visualOverride?: Partial<VisualIdentity>,
): BiomeConfig {
  const dummy = new THREE.Color(0x000000)
  const vi = defaultVisualIdentity()
  if (visualOverride) {
    Object.assign(vi, visualOverride)
    if (visualOverride.atmosphere) vi.atmosphere = { ...vi.atmosphere, ...visualOverride.atmosphere }
    if (visualOverride.fog) vi.fog = { ...vi.fog, ...visualOverride.fog }
    if (visualOverride.colorGrade) vi.colorGrade = { ...vi.colorGrade, ...visualOverride.colorGrade }
    if (visualOverride.ambientLight) vi.ambientLight = { ...vi.ambientLight, ...visualOverride.ambientLight }
  }
  return {
    type,
    name: BiomeType[type],
    fogColor: dummy,
    fogNear: 60,
    fogFar: 300,
    skyColor: dummy,
    skyConfig: {
      zenithDay: dummy,
      zenithNight: dummy,
      horizonDay: dummy,
      horizonNight: dummy,
      cloudColor: dummy,
      cloudDensity: 0,
      hazeStrength: 0,
    },
    ambientDayColor: dummy,
    ambientNightColor: dummy,
    sunColor: dummy,
    palette: groundColors,
    groundColors,
    spriteTypes: [],
    heightScale,
    heightFrequency,
    mountainScale,
    terraceStrength,
    terraceStep,
    waterColor: dummy,
    hasPointLights: false,
    particleType: null,
    particleColor: dummy,
    particleCount: 0,
    visualIdentity: vi,
  }
}

const BIOME_CONFIGS: Map<BiomeType, BiomeConfig> = new Map([
  [BiomeType.Forest,    makeBiomeConfig(BiomeType.Forest,   24, 0.022, 3.0, 0.30, 4.5,
    [[0.18,0.36,0.18],[0.24,0.45,0.15],[0.12,0.27,0.09],[0.30,0.54,0.24]],
    { godRayIntensity: 0.6, groundFogDensity: 0.3,
      atmosphere: { particleType: 'dust', particleCount: 60, particleColor: [0.8, 0.9, 0.5], particleSize: 0.12, particleSpeed: 0.3 },
      fog: { nearDistance: 40, farDistance: 250, color: [0.53, 0.67, 0.40], density: 0.3 } })],
  [BiomeType.Desert,    makeBiomeConfig(BiomeType.Desert,   14, 0.018, 1.5, 0.10, 6,
    [[0.76,0.65,0.27],[0.82,0.70,0.30],[0.68,0.58,0.22]],
    { heatDistortion: 0.3, godRayIntensity: 0.8,
      atmosphere: { particleType: 'sand', particleCount: 80, particleColor: [0.8, 0.7, 0.4], particleSize: 0.1, particleSpeed: 2.0 },
      fog: { nearDistance: 80, farDistance: 400, color: [0.8, 0.67, 0.47], density: 0.15 } })],
  [BiomeType.Swamp,     makeBiomeConfig(BiomeType.Swamp,    12, 0.015, 1.2, 0.15, 4,
    [[0.23,0.29,0.18],[0.28,0.35,0.20],[0.18,0.24,0.14]],
    { groundFogDensity: 0.5,
      atmosphere: { particleType: 'spores', particleCount: 50, particleColor: [0.5, 0.7, 0.3], particleSize: 0.15, particleSpeed: 0.2 },
      fog: { nearDistance: 20, farDistance: 150, color: [0.27, 0.33, 0.20], density: 0.5 } })],
  [BiomeType.Snow,      makeBiomeConfig(BiomeType.Snow,     30, 0.020, 4.0, 0.40, 7,
    [[0.85,0.86,0.91],[0.90,0.90,0.95],[0.78,0.80,0.86]],
    { groundFogDensity: 0.2,
      atmosphere: { particleType: 'snow', particleCount: 120, particleColor: [1, 1, 1], particleSize: 0.18, particleSpeed: 1.5 },
      fog: { nearDistance: 50, farDistance: 280, color: [0.8, 0.87, 0.93], density: 0.25 } })],
  [BiomeType.Volcanic,  makeBiomeConfig(BiomeType.Volcanic, 35, 0.025, 4.5, 0.50, 8,
    [[0.16,0.10,0.10],[0.22,0.12,0.10],[0.28,0.15,0.10]],
    { heatDistortion: 0.6, godRayIntensity: 0.4,
      atmosphere: { particleType: 'embers', particleCount: 70, particleColor: [1, 0.3, 0.05], particleSize: 0.2, particleSpeed: 1.0 },
      fog: { nearDistance: 30, farDistance: 200, color: [0.2, 0.07, 0.0], density: 0.4 } })],
  [BiomeType.Crystal,   makeBiomeConfig(BiomeType.Crystal,  28, 0.022, 3.5, 0.60, 6,
    [[0.33,0.47,0.67],[0.40,0.55,0.72],[0.28,0.42,0.62]],
    { godRayIntensity: 0.5,
      atmosphere: { particleType: 'motes', particleCount: 80, particleColor: [0.5, 0.3, 1], particleSize: 0.1, particleSpeed: 0.4 },
      fog: { nearDistance: 60, farDistance: 300, color: [0.13, 0.2, 0.33], density: 0.2 } })],
  [BiomeType.Jungle,    makeBiomeConfig(BiomeType.Jungle,   26, 0.024, 3.2, 0.25, 5,
    [[0.10,0.30,0.06],[0.14,0.36,0.08],[0.08,0.24,0.05]],
    { groundFogDensity: 0.4,
      atmosphere: { particleType: 'spores', particleCount: 60, particleColor: [0.3, 1, 0.3], particleSize: 0.12, particleSpeed: 0.25 },
      fog: { nearDistance: 25, farDistance: 180, color: [0.20, 0.33, 0.13], density: 0.4 } })],
  [BiomeType.Mesa,      makeBiomeConfig(BiomeType.Mesa,     22, 0.020, 2.5, 0.80, 9,
    [[0.72,0.45,0.20],[0.80,0.52,0.24],[0.64,0.38,0.16]],
    { heatDistortion: 0.2, godRayIntensity: 0.7,
      atmosphere: { particleType: 'dust', particleCount: 50, particleColor: [0.7, 0.5, 0.3], particleSize: 0.15, particleSpeed: 0.5 },
      fog: { nearDistance: 70, farDistance: 350, color: [0.67, 0.47, 0.27], density: 0.15 } })],
  [BiomeType.CoralReef, makeBiomeConfig(BiomeType.CoralReef,10, 0.014, 1.0, 0.05, 3,
    [[0.23,0.54,0.48],[0.28,0.60,0.52],[0.20,0.50,0.44]])],
  [BiomeType.Heaven,    makeBiomeConfig(BiomeType.Heaven,   18, 0.016, 2.0, 0.10, 4,
    [[0.90,0.92,0.98],[0.95,0.96,1.00],[0.85,0.88,0.95]])],
  [BiomeType.Hell,      makeBiomeConfig(BiomeType.Hell,     40, 0.028, 5.0, 0.20, 6,
    [[0.45,0.08,0.05],[0.55,0.10,0.05],[0.38,0.06,0.04]])],
])

function getBiomeConfig(type: BiomeType): BiomeConfig {
  return BIOME_CONFIGS.get(type) ?? BIOME_CONFIGS.get(BiomeType.Forest)!
}

export function getBiomeVisualIdentity(type: BiomeType): VisualIdentity {
  const config = getBiomeConfig(type)
  return config.visualIdentity
}

// ─── Per-biome water colors ───────────────────────────────────────────────────

const BIOME_WATER_COLOR: Partial<Record<BiomeType, number>> = {
  [BiomeType.Forest]:    0x2255aa,
  [BiomeType.Swamp]:     0x334422,
  [BiomeType.Volcanic]:  0xaa2200,
  [BiomeType.Crystal]:   0x4466cc,
  [BiomeType.CoralReef]: 0x22aaaa,
}

function getBiomeWaterColor(type: BiomeType): number {
  return BIOME_WATER_COLOR[type] ?? 0x2255aa
}

// ─── Animated water shader ────────────────────────────────────────────────────

const WATER_VERT = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 0.5 + uTime * 2.0) * 0.15 + cos(pos.z * 0.3 + uTime * 1.5) * 0.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const WATER_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float ripple = sin(vUv.x * 20.0 + uTime * 3.0) * 0.05 + sin(vUv.y * 15.0 + uTime * 2.0) * 0.05;
    vec3 col = uColor + ripple;
    gl_FragColor = vec4(col, uOpacity);
  }
`

function makeWaterMaterial(biomeType: BiomeType): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color(getBiomeWaterColor(biomeType)) },
      uOpacity: { value: 0.6 },
    },
    vertexShader:   WATER_VERT,
    fragmentShader: WATER_FRAG,
  })
}

// ─── Rock formation config per biome ─────────────────────────────────────────

interface RockSpec {
  color: number
  count: number
}

const BIOME_ROCKS: Partial<Record<BiomeType, RockSpec>> = {
  [BiomeType.Forest]:    { color: 0x7a7a6a, count: 3 },
  [BiomeType.Desert]:    { color: 0xb8a060, count: 2 },
  [BiomeType.Snow]:      { color: 0x9090a0, count: 3 },
  [BiomeType.Swamp]:     { color: 0x5a6050, count: 2 },
  [BiomeType.Volcanic]:  { color: 0x3a2a2a, count: 4 },
  [BiomeType.Crystal]:   { color: 0x6080c0, count: 3 },
  [BiomeType.Jungle]:    { color: 0x607040, count: 2 },
  [BiomeType.Mesa]:      { color: 0xa06030, count: 4 },
  [BiomeType.CoralReef]: { color: 0x708080, count: 2 },
  [BiomeType.Hell]:      { color: 0x4a1a10, count: 4 },
}

// ─── Biome fog / sky ──────────────────────────────────────────────────────────

interface FogSpec { color: number; density: number }

const BIOME_FOG: Partial<Record<BiomeType, FogSpec>> = {
  [BiomeType.Forest]:   { color: 0x88aa66, density: 0.008 },
  [BiomeType.Desert]:   { color: 0xccaa77, density: 0.005 },
  [BiomeType.Snow]:     { color: 0xccddee, density: 0.010 },
  [BiomeType.Volcanic]: { color: 0x331100, density: 0.015 },
  [BiomeType.Swamp]:    { color: 0x445533, density: 0.020 },
  [BiomeType.Crystal]:  { color: 0x223355, density: 0.008 },
  [BiomeType.Jungle]:   { color: 0x335522, density: 0.012 },
  [BiomeType.Mesa]:     { color: 0xaa7744, density: 0.006 },
}

/** Apply per-biome fog and background to the scene. */
export function applyBiomeFog(scene: THREE.Scene, biomeType: BiomeType): void {
  const spec = BIOME_FOG[biomeType]
  if (!spec) return
  scene.fog = new THREE.FogExp2(spec.color, spec.density)
  scene.background = new THREE.Color(spec.color)
}

// ─── Per-biome color grading for post-processing ────────────────────────────

interface ColorGradeSpec {
  tint: [number, number, number]
  contrast: number
  saturation: number
}

const BIOME_COLOR_GRADE: Partial<Record<BiomeType, ColorGradeSpec>> = {
  [BiomeType.Forest]:   { tint: [0.95, 1.05, 0.90], contrast: 1.05, saturation: 1.1 },
  [BiomeType.Desert]:   { tint: [1.10, 1.05, 0.85], contrast: 1.10, saturation: 0.9 },
  [BiomeType.Snow]:     { tint: [0.90, 0.95, 1.10], contrast: 1.00, saturation: 0.8 },
  [BiomeType.Volcanic]: { tint: [1.15, 0.85, 0.75], contrast: 1.15, saturation: 1.2 },
  [BiomeType.Swamp]:    { tint: [0.90, 1.00, 0.80], contrast: 0.95, saturation: 0.9 },
  [BiomeType.Crystal]:  { tint: [0.85, 0.90, 1.15], contrast: 1.05, saturation: 1.3 },
  [BiomeType.Jungle]:   { tint: [0.85, 1.10, 0.80], contrast: 1.05, saturation: 1.2 },
  [BiomeType.Mesa]:     { tint: [1.15, 0.95, 0.80], contrast: 1.10, saturation: 1.0 },
}

export function getBiomeColorGrade(type: BiomeType): ColorGradeSpec {
  return BIOME_COLOR_GRADE[type] ?? { tint: [1, 1, 1], contrast: 1, saturation: 1 }
}

// ─── Per-biome fixed time-of-day (0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk)
const BIOME_TIME: Partial<Record<BiomeType, number>> = {
  [BiomeType.Forest]:   0.45,  // bright late morning
  [BiomeType.Desert]:   0.50,  // harsh noon
  [BiomeType.Swamp]:    0.30,  // misty dawn
  [BiomeType.Snow]:     0.40,  // crisp morning
  [BiomeType.Volcanic]: 0.72,  // fiery dusk
  [BiomeType.Crystal]:  0.60,  // warm afternoon
  [BiomeType.Jungle]:   0.35,  // early morning
  [BiomeType.Mesa]:     0.65,  // golden hour
  [BiomeType.CoralReef]:0.45,  // mid-morning
  [BiomeType.Heaven]:   0.50,  // eternal noon
  [BiomeType.Hell]:     0.80,  // deep dusk
}

export function getBiomeTimeOfDay(type: BiomeType): number {
  return BIOME_TIME[type] ?? 0.45
}

// ─── Sprite configurations per biome (engine billboard system) ──────────────

const BIOME_SPRITE_TYPES: Partial<Record<BiomeType, SpriteTypeConfig[]>> = {
  [BiomeType.Forest]: [
    { category: 'tree', weight: 6, minScale: 3, maxScale: 7, isBillboard: true },
    { category: 'bush', weight: 6, minScale: 1, maxScale: 2, isBillboard: true },
    { category: 'rock', weight: 3, minScale: 1, maxScale: 2.5, isBillboard: false },
    { category: 'grass', weight: 4, minScale: 0.5, maxScale: 1.2, isBillboard: false },
  ],
  [BiomeType.Desert]: [
    { category: 'structure', weight: 2, minScale: 2, maxScale: 5, isBillboard: true },
    { category: 'bush', weight: 3, minScale: 0.5, maxScale: 1.5, isBillboard: true },
    { category: 'rock', weight: 5, minScale: 1, maxScale: 3, isBillboard: false },
  ],
  [BiomeType.Swamp]: [
    { category: 'tree', weight: 5, minScale: 2, maxScale: 5, isBillboard: true },
    { category: 'bush', weight: 4, minScale: 0.8, maxScale: 1.5, isBillboard: true },
    { category: 'grass', weight: 3, minScale: 0.3, maxScale: 0.8, isBillboard: false },
  ],
  [BiomeType.Snow]: [
    { category: 'tree', weight: 5, minScale: 3, maxScale: 6, isBillboard: true },
    { category: 'rock', weight: 4, minScale: 1, maxScale: 3, isBillboard: false },
    { category: 'bush', weight: 2, minScale: 0.5, maxScale: 1.5, isBillboard: true },
  ],
  [BiomeType.Volcanic]: [
    { category: 'tree', weight: 2, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'rock', weight: 6, minScale: 1.5, maxScale: 4, isBillboard: false },
    { category: 'structure', weight: 1, minScale: 2, maxScale: 4, isBillboard: true },
  ],
  [BiomeType.Crystal]: [
    { category: 'structure', weight: 5, minScale: 2, maxScale: 6, isBillboard: true },
    { category: 'rock', weight: 3, minScale: 1, maxScale: 3, isBillboard: false },
    { category: 'bush', weight: 2, minScale: 1, maxScale: 2, isBillboard: true },
  ],
  [BiomeType.Jungle]: [
    { category: 'tree', weight: 7, minScale: 4, maxScale: 8, isBillboard: true },
    { category: 'bush', weight: 5, minScale: 1, maxScale: 2.5, isBillboard: true },
    { category: 'grass', weight: 3, minScale: 0.5, maxScale: 1.0, isBillboard: false },
  ],
  [BiomeType.Mesa]: [
    { category: 'rock', weight: 6, minScale: 2, maxScale: 5, isBillboard: false },
    { category: 'structure', weight: 2, minScale: 2, maxScale: 4, isBillboard: true },
    { category: 'bush', weight: 3, minScale: 0.5, maxScale: 1.5, isBillboard: true },
  ],
  [BiomeType.CoralReef]: [
    { category: 'bush', weight: 5, minScale: 1, maxScale: 3, isBillboard: true },
    { category: 'structure', weight: 3, minScale: 1, maxScale: 3, isBillboard: true },
    { category: 'grass', weight: 4, minScale: 0.3, maxScale: 0.8, isBillboard: false },
  ],
}

// ─── Weather particles ────────────────────────────────────────────────────────

interface ParticleSpec {
  color: number
  count: number
  speed: number
  type: 'snow' | 'embers' | 'fireflies' | 'mist' | 'sand' | 'sparkles' | 'pollen'
}

const BIOME_PARTICLES: Partial<Record<BiomeType, ParticleSpec>> = {
  [BiomeType.Forest]:   { color: 0xaaff44, count: 30,  speed: 0.5, type: 'fireflies' },
  [BiomeType.Snow]:     { color: 0xffffff, count: 100, speed: 2.0, type: 'snow'      },
  [BiomeType.Volcanic]: { color: 0xff4400, count: 50,  speed: 1.5, type: 'embers'    },
  [BiomeType.Swamp]:    { color: 0x88aa44, count: 20,  speed: 0.3, type: 'mist'      },
  [BiomeType.Desert]:   { color: 0xccaa66, count: 40,  speed: 3.0, type: 'sand'      },
  [BiomeType.Crystal]:  { color: 0x8844ff, count: 40,  speed: 0.8, type: 'sparkles'  },
  [BiomeType.Jungle]:   { color: 0x44ff44, count: 30,  speed: 0.4, type: 'pollen'    },
}

const PARTICLE_SPREAD = 30   // half-width of particle field around player
const PARTICLE_HEIGHT = 12   // vertical range above player

export class BiomeWeather {
  private points: THREE.Points | null = null
  private positions: Float32Array | null = null
  private phases: Float32Array | null = null   // per-particle random phase for sine
  private spec: ParticleSpec | null = null
  private time = 0

  constructor(private scene: THREE.Scene) {}

  /** Spawn weather for a given biome.  Does nothing if biome has no particles. */
  activate(biomeType: BiomeType): void {
    this.dispose()
    const spec = BIOME_PARTICLES[biomeType]
    if (!spec) return
    this.spec = spec

    const count = spec.count
    this.positions = new Float32Array(count * 3)
    this.phases = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      this.positions[i * 3]     = (Math.random() - 0.5) * PARTICLE_SPREAD * 2
      this.positions[i * 3 + 1] = Math.random() * PARTICLE_HEIGHT
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD * 2
      this.phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const mat = new THREE.PointsMaterial({
      color: spec.color,
      size: spec.type === 'mist' ? 1.2 : spec.type === 'embers' ? 0.35 : 0.25,
      transparent: true,
      opacity: spec.type === 'mist' ? 0.35 : 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(geo, mat)
    this.scene.add(this.points)
  }

  /** Update each frame — move particles and re-center on player. */
  update(delta: number, playerX: number, playerY: number, playerZ: number): void {
    if (!this.points || !this.positions || !this.spec || !this.phases) return
    this.time += delta
    const { speed, type, count: _count } = this.spec
    const count = this.positions.length / 3

    for (let i = 0; i < count; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2
      const phase = this.phases[i]

      if (type === 'snow' || type === 'sand') {
        // Fall downward, reset to top when too low
        this.positions[iy] -= speed * delta
        // Slight horizontal drift
        this.positions[ix] += Math.sin(this.time * 0.5 + phase) * 0.02
        if (this.positions[iy] < playerY - 2) {
          this.positions[ix] = playerX + (Math.random() - 0.5) * PARTICLE_SPREAD * 2
          this.positions[iy] = playerY + PARTICLE_HEIGHT
          this.positions[iz] = playerZ + (Math.random() - 0.5) * PARTICLE_SPREAD * 2
        }
      } else if (type === 'embers') {
        // Rise upward, reset to bottom when too high
        this.positions[iy] += speed * delta
        this.positions[ix] += Math.sin(this.time + phase) * 0.03
        if (this.positions[iy] > playerY + PARTICLE_HEIGHT) {
          this.positions[ix] = playerX + (Math.random() - 0.5) * PARTICLE_SPREAD * 2
          this.positions[iy] = playerY - 2
          this.positions[iz] = playerZ + (Math.random() - 0.5) * PARTICLE_SPREAD * 2
        }
      } else if (type === 'fireflies' || type === 'sparkles' || type === 'pollen') {
        // Drift with sine wave in all three axes
        this.positions[ix] += Math.sin(this.time * speed + phase) * 0.015
        this.positions[iy] += Math.cos(this.time * speed * 0.7 + phase + 1.0) * 0.01
        this.positions[iz] += Math.sin(this.time * speed * 0.5 + phase + 2.0) * 0.015
        // Soft boundary — snap back toward player area when too far
        const relX = this.positions[ix] - playerX
        const relZ = this.positions[iz] - playerZ
        if (Math.abs(relX) > PARTICLE_SPREAD) this.positions[ix] = playerX + (Math.random() - 0.5) * PARTICLE_SPREAD
        if (Math.abs(relZ) > PARTICLE_SPREAD) this.positions[iz] = playerZ + (Math.random() - 0.5) * PARTICLE_SPREAD
      } else if (type === 'mist') {
        // Slow horizontal drift only
        this.positions[ix] += speed * delta * Math.cos(this.time * 0.3 + phase)
        this.positions[iz] += speed * delta * Math.sin(this.time * 0.2 + phase * 0.5)
        const relX = this.positions[ix] - playerX
        const relZ = this.positions[iz] - playerZ
        if (Math.abs(relX) > PARTICLE_SPREAD) this.positions[ix] = playerX + (Math.random() - 0.5) * PARTICLE_SPREAD
        if (Math.abs(relZ) > PARTICLE_SPREAD) this.positions[iz] = playerZ + (Math.random() - 0.5) * PARTICLE_SPREAD
      }
    }

    // Shift entire system to follow player (for falling/rising types, set absolute coords above)
    if (type === 'fireflies' || type === 'sparkles' || type === 'pollen' || type === 'mist') {
      this.points.position.set(playerX, playerY, playerZ)
      // Revert positions to local space by subtracting player offset once on activate
      // (simpler: just reposition the group, offsets are already relative after init)
    }

    const geo = this.points.geometry
    ;(geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    if (this.points) {
      this.scene.remove(this.points)
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points = null
    }
    this.positions = null
    this.phases = null
    this.spec = null
    this.time = 0
  }
}

// ─── ChunkManager ────────────────────────────────────────────────────────────

const VIEW_RADIUS = 2

interface ChunkObjects {
  terrain: THREE.Mesh
  batches: BillboardBatch[]
  water: THREE.Mesh | null
  rocks: THREE.Mesh[]
  fogPlane: THREE.Mesh | null
}

// ─── Underground scene helpers ────────────────────────────────────────────────

/**
 * Applies underground atmosphere (fog, ambient, point lights, ceiling) to a
 * THREE.Scene.  Returns a cleanup function that removes the ceiling mesh and
 * point lights when the expedition ends.
 */
export function setupUndergroundScene(
  scene: THREE.Scene,
  config: UndergroundConfig,
): () => void {
  // Fog
  scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity)

  // Ambient light
  const ambient = new THREE.AmbientLight(config.ambientColor, config.ambientIntensity)
  scene.add(ambient)

  // Ceiling mesh — large bumpy plane at Y = 60
  const ceilGeo = new THREE.PlaneGeometry(2000, 2000, 64, 64)
  // Displace vertices with layered sine noise for a bumpy cave ceiling
  const ceilPositions = ceilGeo.attributes['position'] as THREE.BufferAttribute
  for (let i = 0; i < ceilPositions.count; i++) {
    const px = ceilPositions.getX(i)
    const py = ceilPositions.getY(i) // plane Y = world Z before rotation
    const disp =
      Math.sin(px * 0.08) * Math.cos(py * 0.07) * 3.0 +
      Math.sin(px * 0.20 + 1.3) * Math.cos(py * 0.17 + 0.8) * 1.5 +
      Math.sin(px * 0.45 + 2.1) * Math.cos(py * 0.40 + 1.7) * 0.7
    ceilPositions.setZ(i, disp)
  }
  ceilGeo.computeVertexNormals()

  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x111111, side: THREE.BackSide })
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, 60, 0)
  scene.add(ceiling)

  // Stalactites hanging from the ceiling
  const stalactites: THREE.Mesh[] = []
  const stalGeo = new THREE.ConeGeometry(0.4, 3.5, 6)
  const stalMat = new THREE.MeshLambertMaterial({ color: 0x222222 })
  const stalRng = { v: (config.biomeType as unknown as number) * 7919 + 98765 }
  const stalRand = () => {
    stalRng.v = (stalRng.v * 1664525 + 1013904223) % 4294967296
    return stalRng.v / 4294967296
  }
  // Caverns get more stalactites; other underground biomes get fewer
  const stalCount = 8
  for (let i = 0; i < stalCount; i++) {
    const stal = new THREE.Mesh(stalGeo, stalMat)
    const sx = (stalRand() - 0.5) * 160
    const sz = (stalRand() - 0.5) * 160
    const hangLen = 1.5 + stalRand() * 2.5
    // Rotate so the cone points downward
    stal.rotation.z = Math.PI
    stal.position.set(sx, 60 - hangLen, sz)
    scene.add(stal)
    stalactites.push(stal)
  }

  // Scattered point lights
  const lights: THREE.PointLight[] = []
  const rng = { v: 12345 }
  const rand = () => { rng.v = (rng.v * 1664525 + 1013904223) % 4294967296; return rng.v / 4294967296 }

  for (const spec of config.pointLights) {
    for (let i = 0; i < spec.count; i++) {
      const light = new THREE.PointLight(spec.color, spec.intensity, 30)
      light.position.set(
        (rand() - 0.5) * 200,
        2 + rand() * 10,
        (rand() - 0.5) * 200,
      )
      scene.add(light)
      lights.push(light)
    }
  }

  return () => {
    scene.remove(ambient)
    scene.remove(ceiling)
    ceilGeo.dispose()
    ceilMat.dispose()
    for (const stal of stalactites) {
      scene.remove(stal)
    }
    stalGeo.dispose()
    stalMat.dispose()
    for (const l of lights) scene.remove(l)
  }
}

export class ChunkManager {
  private loadedChunks = new Map<string, ChunkObjects>()
  private biomeMap: BiomeMap
  private atlas = new SpriteAtlas()
  /** Active underground config overrides terrain colors during chunk generation. */
  undergroundConfig: UndergroundConfig | null = null

  constructor(private scene: THREE.Scene) {
    // Seed 42 gives a stable world each run
    this.biomeMap = new BiomeMap(42)
  }

  /** Call each frame with the player's world-space X and Z.
   *  Pass elapsedTime (seconds since start) to animate water shaders. */
  update(playerX: number, playerZ: number, elapsedTime?: number): void {
    const playerCX = Math.floor(playerX / CHUNK_SIZE)
    const playerCZ = Math.floor(playerZ / CHUNK_SIZE)

    // Determine which chunks should be visible
    const desired = new Set<string>()
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        const cx = playerCX + dx
        const cz = playerCZ + dz
        desired.add(`${cx},${cz}`)
      }
    }

    // Load new chunks
    for (const key of desired) {
      if (!this.loadedChunks.has(key)) {
        const [cx, cz] = key.split(',').map(Number)
        this.loadChunk(cx, cz, key)
      }
    }

    // Unload chunks that are out of range
    for (const [key, objects] of this.loadedChunks) {
      if (!desired.has(key)) {
        this.unloadChunk(key, objects)
      }
    }

    // Animate water uTime on all loaded chunks
    if (elapsedTime !== undefined) {
      for (const objects of this.loadedChunks.values()) {
        if (objects.water) {
          const mat = objects.water.material as THREE.ShaderMaterial
          if (mat.uniforms?.['uTime'] !== undefined) {
            mat.uniforms['uTime'].value = elapsedTime
          }
        }
      }
    }
  }

  private loadChunk(cx: number, cz: number, key: string): void {
    // When underground, override getBiomeConfig to use the underground terrain
    const configFn = this.undergroundConfig
      ? (type: BiomeType): BiomeConfig => {
          const base = getBiomeConfig(this.undergroundConfig!.biomeType)
          return {
            ...base,
            type,
            heightScale: this.undergroundConfig!.terrainOverrides.heightScale,
            groundColors: this.undergroundConfig!.terrainOverrides.groundColors,
            palette: this.undergroundConfig!.terrainOverrides.groundColors,
          }
        }
      : getBiomeConfig

    const result = generateHeightmap(cx, cz, this.biomeMap, configFn)

    // Tint vertex colors to match underground palette
    if (this.undergroundConfig) {
      const cols = this.undergroundConfig.terrainOverrides.groundColors
      const colors = result.colors
      const chosen = cols[Math.floor(Math.abs(cx * 3 + cz) % cols.length)]
      for (let i = 0; i < colors.length; i += 3) {
        colors[i]     = chosen[0] + (colors[i]     - 0.5) * 0.1
        colors[i + 1] = chosen[1] + (colors[i + 1] - 0.5) * 0.1
        colors[i + 2] = chosen[2] + (colors[i + 2] - 0.5) * 0.1
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(result.positions, 3))
    geo.setAttribute('normal',   new THREE.BufferAttribute(result.normals,   3))
    geo.setAttribute('color',    new THREE.BufferAttribute(result.colors,    3))
    geo.setIndex(new THREE.BufferAttribute(result.indices, 1))

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
    const terrain = new THREE.Mesh(geo, mat)

    // Position mesh at the chunk's world-space origin
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE
    terrain.position.set(originX, 0, originZ)
    this.scene.add(terrain)

    // Determine biome for this chunk
    const biomeType = this.biomeMap.getBiomeAt(cx * CHUNK_SIZE + CHUNK_SIZE / 2, cz * CHUNK_SIZE + CHUNK_SIZE / 2)

    // Seed a deterministic RNG per-chunk (shared across water/rocks/sprites)
    let chunkRng = Math.abs(Math.sin(cx * 127.1 + cz * 311.7)) * 43758.5
    const chunkRand = () => { chunkRng = (chunkRng * 1664525 + 1013904223) % 4294967296; return chunkRng / 4294967296 }

    // ── Animated water plane ─────────────────────────────────────────────────
    let water: THREE.Mesh | null = null
    const positions = result.positions
    let hasUnderwater = false
    for (let i = 1; i < positions.length; i += 3) {
      if (positions[i] < WATER_LEVEL) { hasUnderwater = true; break }
    }
    if (hasUnderwater) {
      const waterGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32)
      const waterMat = makeWaterMaterial(biomeType)
      water = new THREE.Mesh(waterGeo, waterMat)
      water.rotation.x = -Math.PI / 2
      water.position.set(originX + CHUNK_SIZE / 2, WATER_LEVEL, originZ + CHUNK_SIZE / 2)
      this.scene.add(water)
    }

    // ── Rock formations ──────────────────────────────────────────────────────
    const rocks: THREE.Mesh[] = []
    const rockSpec = BIOME_ROCKS[biomeType]
    if (rockSpec && !this.undergroundConfig) {
      for (let i = 0; i < rockSpec.count; i++) {
        const lx = chunkRand() * CHUNK_SIZE
        const lz = chunkRand() * CHUNK_SIZE
        const wx = originX + lx
        const wz = originZ + lz
        const wy = sampleWorldHeight(wx, wz, this.biomeMap, getBiomeConfig)
        if (wy <= WATER_LEVEL + 0.5) continue

        const useIco = chunkRand() > 0.5
        const baseSize = 1.5 + chunkRand() * 2.5
        const rockGeo = useIco
          ? new THREE.IcosahedronGeometry(baseSize * 0.6, 0)
          : new THREE.BoxGeometry(
              baseSize,
              baseSize * (0.5 + chunkRand() * 0.8),
              baseSize * (0.7 + chunkRand() * 0.6),
            )
        const rockMat = new THREE.MeshLambertMaterial({ color: rockSpec.color })
        const rock = new THREE.Mesh(rockGeo, rockMat)

        // Stretch one random axis for an irregular natural look
        const stretchAxis = Math.floor(chunkRand() * 3)
        if (stretchAxis === 0)      rock.scale.x *= 0.5 + chunkRand() * 1.2
        else if (stretchAxis === 1) rock.scale.y *= 0.4 + chunkRand() * 0.9
        else                        rock.scale.z *= 0.5 + chunkRand() * 1.2

        rock.rotation.y = chunkRand() * Math.PI * 2
        rock.position.set(wx, wy + (useIco ? baseSize * 0.3 : 0), wz)
        this.scene.add(rock)
        rocks.push(rock)
      }
    }

    // ── Instanced billboard vegetation (engine sprite system) ───────────────
    const batches: BillboardBatch[] = []
    const spriteTypes = BIOME_SPRITE_TYPES[biomeType]
    if (spriteTypes && !this.undergroundConfig) {
      // Get biome palette for texture generation
      const biomeConfig = getBiomeConfig(biomeType)
      const palette = biomeConfig.palette

      // Compute total weight for weighted random selection
      const totalWeight = spriteTypes.reduce((sum, st) => sum + st.weight, 0)

      // Group sprites by texture key for batching
      const groups = new Map<string, { tex: THREE.CanvasTexture; entries: { x: number; y: number; z: number; scale: number; seed: number }[]; billboard: boolean }>()

      const GRID_STEP = 2.0
      const SPAWN_DENSITY = 0.60
      const stepsX = Math.ceil(CHUNK_SIZE / GRID_STEP)
      const stepsZ = Math.ceil(CHUNK_SIZE / GRID_STEP)

      for (let gz = 0; gz < stepsZ; gz++) {
        for (let gx = 0; gx < stepsX; gx++) {
          if (chunkRand() > SPAWN_DENSITY) continue

          const lx = gx * GRID_STEP + chunkRand() * GRID_STEP
          const lz = gz * GRID_STEP + chunkRand() * GRID_STEP
          const wx = originX + lx
          const wz = originZ + lz
          const wy = sampleWorldHeight(wx, wz, this.biomeMap, getBiomeConfig)
          if (wy <= WATER_LEVEL + 0.3) continue

          // Weighted random sprite type selection
          let roll = chunkRand() * totalWeight
          let selectedType = spriteTypes[0]
          for (const st of spriteTypes) {
            roll -= st.weight
            if (roll <= 0) { selectedType = st; break }
          }

          const variant = Math.floor(chunkRand() * 4) // 4 variants
          const scale = selectedType.minScale + chunkRand() * (selectedType.maxScale - selectedType.minScale)
          const seed = wx * 127.1 + wz * 311.7

          const tex = this.atlas.getTexture(biomeType, selectedType.category, variant, palette)
          const key = `${biomeType}_${selectedType.category}_${variant}_${selectedType.isBillboard ? 'b' : 'd'}`

          if (!groups.has(key)) {
            groups.set(key, { tex, entries: [], billboard: selectedType.isBillboard })
          }
          groups.get(key)!.entries.push({ x: wx, y: wy, z: wz, scale, seed })
        }
      }

      // Create BillboardBatch per group
      for (const [, group] of groups) {
        if (group.entries.length === 0) continue
        const batch = new BillboardBatch(group.tex, group.entries, group.billboard)
        this.scene.add(batch.mesh)
        batches.push(batch)
      }
    }

    // ── Ground fog plane ────────────────────────────────────────────────────
    let fogPlane: THREE.Mesh | null = null
    if (!this.undergroundConfig) {
      const fogGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
      const fogMat = new THREE.MeshBasicMaterial({
        color: BIOME_FOG[biomeType]?.color ?? 0x888888,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      fogPlane = new THREE.Mesh(fogGeo, fogMat)
      fogPlane.rotation.x = -Math.PI / 2
      fogPlane.position.set(originX + CHUNK_SIZE / 2, WATER_LEVEL + 1.5, originZ + CHUNK_SIZE / 2)
      this.scene.add(fogPlane)
    }

    this.loadedChunks.set(key, { terrain, batches, water, rocks, fogPlane })
  }

  private unloadChunk(key: string, objects: ChunkObjects): void {
    this.scene.remove(objects.terrain)
    objects.terrain.geometry.dispose()
    ;(objects.terrain.material as THREE.Material).dispose()

    for (const batch of objects.batches) {
      this.scene.remove(batch.mesh)
      batch.dispose()
    }

    if (objects.water) {
      this.scene.remove(objects.water)
      objects.water.geometry.dispose()
      ;(objects.water.material as THREE.Material).dispose()
    }

    for (const rock of objects.rocks) {
      this.scene.remove(rock)
      rock.geometry.dispose()
      ;(rock.material as THREE.Material).dispose()
    }

    if (objects.fogPlane) {
      this.scene.remove(objects.fogPlane)
      objects.fogPlane.geometry.dispose()
      ;(objects.fogPlane.material as THREE.Material).dispose()
    }

    this.loadedChunks.delete(key)
  }

  /** Sample the terrain height at a world position. */
  sampleHeight(wx: number, wz: number): number {
    return sampleWorldHeight(wx, wz, this.biomeMap, getBiomeConfig)
  }

  dispose(): void {
    for (const [key, objects] of this.loadedChunks) {
      this.unloadChunk(key, objects)
    }
    this.atlas.dispose()
  }
}
