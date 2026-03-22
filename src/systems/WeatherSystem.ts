import * as THREE from 'three'
import { BiomeType } from '../biomes/types'

export enum WeatherType {
  Clear = 0,
  Rain,
  HeavyRain,
  Snow,
  Blizzard,
  Sandstorm,
  AshFall,
  Fog,
}

const WEATHER_NAMES: Record<WeatherType, string> = {
  [WeatherType.Clear]: '',
  [WeatherType.Rain]: 'Rain',
  [WeatherType.HeavyRain]: 'Storm',
  [WeatherType.Snow]: 'Snow',
  [WeatherType.Blizzard]: 'Blizzard',
  [WeatherType.Sandstorm]: 'Sandstorm',
  [WeatherType.AshFall]: 'Ash Fall',
  [WeatherType.Fog]: 'Fog',
}

type WeatherEntry = [WeatherType, number]

const BIOME_WEATHER: Partial<Record<BiomeType, WeatherEntry[]>> = {
  [BiomeType.Forest]:    [[WeatherType.Clear,5],[WeatherType.Rain,3],[WeatherType.HeavyRain,1],[WeatherType.Fog,1]],
  [BiomeType.Desert]:    [[WeatherType.Clear,6],[WeatherType.Sandstorm,2],[WeatherType.Rain,1]],
  [BiomeType.Swamp]:     [[WeatherType.Clear,2],[WeatherType.Rain,3],[WeatherType.Fog,4]],
  [BiomeType.Snow]:      [[WeatherType.Clear,4],[WeatherType.Snow,3],[WeatherType.Blizzard,1]],
  [BiomeType.Volcanic]:  [[WeatherType.Clear,3],[WeatherType.AshFall,5]],
  [BiomeType.Crystal]:   [[WeatherType.Clear,5],[WeatherType.Fog,3]],
  [BiomeType.Jungle]:    [[WeatherType.Clear,2],[WeatherType.Rain,4],[WeatherType.HeavyRain,3]],
  [BiomeType.Mesa]:      [[WeatherType.Clear,5],[WeatherType.Sandstorm,2],[WeatherType.Fog,1]],
  [BiomeType.CoralReef]: [[WeatherType.Clear,4],[WeatherType.Rain,2]],
  [BiomeType.Heaven]:    [[WeatherType.Clear,10],[WeatherType.Fog,2],[WeatherType.Rain,2]],
  [BiomeType.Hell]:      [[WeatherType.AshFall,10]],
}

const DEFAULT_WEATHER: WeatherEntry[] = [[WeatherType.Clear, 8], [WeatherType.Rain, 2]]

function pickWeather(table: WeatherEntry[]): WeatherType {
  let total = 0
  for (const [, w] of table) total += w
  let r = Math.random() * total
  for (const [type, w] of table) {
    r -= w
    if (r <= 0) return type
  }
  return table[0][0]
}

// Weather particle config
interface ParticleConfig {
  count: number
  color: THREE.Color
  size: number
  velocityY: number
  velocityXZ: number
  spread: number
  opacity: number
}

const PARTICLE_CONFIGS: Partial<Record<WeatherType, ParticleConfig>> = {
  [WeatherType.Rain]:      { count: 200, color: new THREE.Color(0.7,0.8,1.0), size: 0.08, velocityY: -30, velocityXZ: 1, spread: 30, opacity: 0.4 },
  [WeatherType.HeavyRain]: { count: 300, color: new THREE.Color(0.6,0.7,0.9), size: 0.1, velocityY: -35, velocityXZ: 3, spread: 30, opacity: 0.5 },
  [WeatherType.Snow]:      { count: 100, color: new THREE.Color(1,1,1), size: 0.2, velocityY: -3, velocityXZ: 1.5, spread: 30, opacity: 0.7 },
  [WeatherType.Blizzard]:  { count: 200, color: new THREE.Color(0.9,0.9,1.0), size: 0.2, velocityY: -5, velocityXZ: 8, spread: 25, opacity: 0.6 },
  [WeatherType.Sandstorm]: { count: 150, color: new THREE.Color(0.85,0.75,0.55), size: 0.15, velocityY: -1, velocityXZ: 12, spread: 25, opacity: 0.5 },
  [WeatherType.AshFall]:   { count: 80, color: new THREE.Color(0.3,0.3,0.3), size: 0.15, velocityY: -2, velocityXZ: 1, spread: 30, opacity: 0.5 },
}

// Fog override distances per weather
// Fog far targets — these are blended toward smoothly, never slammed
const FOG_OVERRIDES: Partial<Record<WeatherType, number>> = {
  [WeatherType.Blizzard]: 60,
  [WeatherType.Sandstorm]: 55,
  [WeatherType.Fog]: 50,
  [WeatherType.HeavyRain]: 70,
}

// Fog color tints per weather type (RGB 0-1). Blended with biome fog color.
const FOG_COLORS: Partial<Record<WeatherType, THREE.Color>> = {
  [WeatherType.Blizzard]:  new THREE.Color(0.88, 0.92, 1.0),   // icy blue-white
  [WeatherType.Sandstorm]: new THREE.Color(0.82, 0.72, 0.48),  // dusty amber
  [WeatherType.Fog]:       new THREE.Color(0.75, 0.80, 0.82),  // cool grey
  [WeatherType.HeavyRain]: new THREE.Color(0.55, 0.60, 0.70),  // stormy blue-grey
  [WeatherType.Rain]:      new THREE.Color(0.60, 0.65, 0.75),  // light rain grey
  [WeatherType.AshFall]:   new THREE.Color(0.30, 0.28, 0.26),  // dark ash
  [WeatherType.Snow]:      new THREE.Color(0.92, 0.94, 1.0),   // soft white
}

const MAX_PARTICLES = 300

export class WeatherSystem {
  private scene: THREE.Scene
  currentWeather = WeatherType.Clear
  private targetWeather = WeatherType.Clear
  private blendProgress = 1.0
  private weatherTimer = 60 + Math.random() * 60
  private currentBiome: BiomeType = BiomeType.Forest

  // Particles
  private particlePoints: THREE.Points | null = null
  private positions: Float32Array
  private velocities: Float32Array
  private phases: Float32Array
  private particleGeo: THREE.BufferGeometry
  private particleMat: THREE.PointsMaterial

  // Lightning
  private lightningTimer = 0
  private lightningFlash = 0

  // Fog
  fogFarOverride = -1  // -1 means no override
  private weatherFogIntensity = 0  // 0–1, how strongly weather fog applies

  constructor(scene: THREE.Scene) {
    this.scene = scene

    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.velocities = new Float32Array(MAX_PARTICLES * 3)
    this.phases = new Float32Array(MAX_PARTICLES)

    this.particleGeo = new THREE.BufferGeometry()
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    this.particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })

    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat)
    this.particlePoints.frustumCulled = false
    this.scene.add(this.particlePoints)

    // Init particle positions
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.phases[i] = Math.random() * Math.PI * 2
    }
  }

  update(delta: number, biome: BiomeType, playerPos: THREE.Vector3) {
    // Track biome changes — start a transition but don't slam instantly
    if (biome !== this.currentBiome) {
      this.currentBiome = biome
      // Re-roll weather for new biome after a short delay
      this.weatherTimer = Math.min(this.weatherTimer, 5)
    }

    // Weather change timer
    this.weatherTimer -= delta
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 60 + Math.random() * 60
      const table = BIOME_WEATHER[biome] ?? DEFAULT_WEATHER
      const next = pickWeather(table)
      if (next !== this.currentWeather) {
        this.targetWeather = next
        this.blendProgress = 0
      }
    }

    // Transition
    if (this.blendProgress < 1) {
      this.blendProgress = Math.min(1, this.blendProgress + delta / 10)
      if (this.blendProgress >= 1) {
        this.currentWeather = this.targetWeather
      }
    }

    // Determine effective weather (use target once > 50% blended)
    const effectiveWeather = this.blendProgress > 0.5 ? this.targetWeather : this.currentWeather
    const intensity = this.blendProgress > 0.5
      ? (this.blendProgress - 0.5) * 2
      : 1 - this.blendProgress * 2

    // Update fog override
    const fogOverride = FOG_OVERRIDES[effectiveWeather]
    this.fogFarOverride = fogOverride !== undefined ? fogOverride : -1
    this.weatherFogIntensity = fogOverride !== undefined ? intensity : 0

    // Update particles
    this.updateParticles(delta, effectiveWeather, intensity, playerPos)

    // Lightning (HeavyRain only)
    this.updateLightning(delta, effectiveWeather)
  }

  private updateParticles(delta: number, weather: WeatherType, intensity: number, playerPos: THREE.Vector3) {
    const config = PARTICLE_CONFIGS[weather]
    const activeCount = config ? Math.floor(config.count * Math.min(1, intensity)) : 0

    if (activeCount === 0) {
      if (this.particlePoints) this.particlePoints.visible = false
      return
    }

    if (this.particlePoints) this.particlePoints.visible = true

    // Update material
    this.particleMat.color.copy(config!.color)
    this.particleMat.size = config!.size
    this.particleMat.opacity = config!.opacity * Math.min(1, intensity)

    const spread = config!.spread
    const velY = config!.velocityY
    const velXZ = config!.velocityXZ

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i >= activeCount) {
        // Hide inactive particles far away
        this.positions[i * 3 + 1] = -1000
        continue
      }

      let x = this.positions[i * 3]
      let y = this.positions[i * 3 + 1]
      let z = this.positions[i * 3 + 2]

      // Init particles that are too far or uninitialized
      const dx = x - playerPos.x
      const dz = z - playerPos.z
      if (y < -999 || dx * dx + dz * dz > spread * spread * 4) {
        x = playerPos.x + (Math.random() - 0.5) * spread * 2
        y = playerPos.y + Math.random() * spread
        z = playerPos.z + (Math.random() - 0.5) * spread * 2
        this.velocities[i * 3] = (Math.random() - 0.5) * velXZ
        this.velocities[i * 3 + 1] = velY + (Math.random() - 0.5) * Math.abs(velY) * 0.2
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * velXZ
      }

      // Move particles
      x += this.velocities[i * 3] * delta
      y += this.velocities[i * 3 + 1] * delta
      z += this.velocities[i * 3 + 2] * delta

      // Add wobble
      const phase = this.phases[i]
      x += Math.sin(y * 0.5 + phase) * delta * 0.5
      z += Math.cos(y * 0.3 + phase) * delta * 0.5

      // Wrap particles that fall below or drift too far
      if (y < playerPos.y - 10) {
        y = playerPos.y + spread * 0.8 + Math.random() * 5
        x = playerPos.x + (Math.random() - 0.5) * spread * 2
        z = playerPos.z + (Math.random() - 0.5) * spread * 2
      }

      this.positions[i * 3] = x
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = z
    }

    const attr = this.particleGeo.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
    this.particleGeo.setDrawRange(0, activeCount)
  }

  private updateLightning(delta: number, weather: WeatherType) {
    // Decay flash
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - delta * 10)
    }

    if (weather !== WeatherType.HeavyRain) {
      this.lightningTimer = 5 + Math.random() * 10
      return
    }

    this.lightningTimer -= delta
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 5 + Math.random() * 10
      this.lightningFlash = 1.0
    }
  }

  getLightningFlash(): number {
    return this.lightningFlash
  }

  getCurrentWeatherName(): string {
    const effective = this.blendProgress >= 1 ? this.currentWeather : this.targetWeather
    return WEATHER_NAMES[effective] || ''
  }

  getSpeedMultiplier(): number {
    const w = this.blendProgress >= 1 ? this.currentWeather : this.targetWeather
    if (w === WeatherType.Blizzard) return 0.8
    return 1.0
  }

  getSandstormPush(): number {
    const w = this.blendProgress >= 1 ? this.currentWeather : this.targetWeather
    if (w === WeatherType.Sandstorm) return 2.0
    return 0
  }

  /**
   * Returns weather fog composition parameters for blending with biome fog.
   * intensity = 0 means no weather fog override active.
   * When intensity > 0, caller should:
   *   - use min(biomeFar, farOverride) as the fog far
   *   - blend biome fog color toward weatherColor by intensity * colorBlend
   */
  getFogCompositeParams(): { farOverride: number; color: THREE.Color; intensity: number } {
    const w = this.blendProgress >= 1 ? this.currentWeather : this.targetWeather
    const color = FOG_COLORS[w] ?? new THREE.Color(0.75, 0.80, 0.82)
    return {
      farOverride: this.fogFarOverride,
      color,
      intensity: this.weatherFogIntensity,
    }
  }
}
