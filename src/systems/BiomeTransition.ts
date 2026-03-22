import * as THREE from 'three'
import { BiomeMap } from '../world/BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType, SkyConfig, VisualIdentity, AtmosphereParticleType } from '../biomes/types'
import { ColorGradePass } from '../postprocessing/ColorGradePass'
import { SkyDome } from '../sky/SkyDome'
import { RENDER_CONFIG } from '../config'
import { WorldState } from './WorldState'

const TRANSITION_SPEED = 0.2  // blend units per second — 5 second full transition (1/5)

// Reusable temp colors to avoid per-frame allocations
const _zenith  = new THREE.Color()
const _horizon = new THREE.Color()
const _cloud   = new THREE.Color()
const _tmpA    = new THREE.Color()
const _tmpB    = new THREE.Color()

function lerpSkyColor(out: THREE.Color, dayCol: THREE.Color, nightCol: THREE.Color, dayFactor: number): THREE.Color {
  return out.lerpColors(nightCol, dayCol, dayFactor)
}

function lerpTuple3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Interpolated visual identity — all values smoothly blended between biomes */
export interface InterpolatedVisual {
  colorGrade: {
    tint: [number, number, number]
    contrast: number
    saturation: number
  }
  fog: {
    nearDistance: number
    farDistance: number
    color: [number, number, number]
    density: number
  }
  ambientLight: {
    color: [number, number, number]
    intensity: number
  }
  atmosphere: {
    particleType: AtmosphereParticleType
    particleCount: number
    particleColor: [number, number, number]
    particleSize: number
    particleSpeed: number
  }
  godRayIntensity: number
  heatDistortion: number
  groundFogDensity: number
}

function interpolateVisual(from: VisualIdentity, to: VisualIdentity, t: number): InterpolatedVisual {
  return {
    colorGrade: {
      tint: lerpTuple3(from.colorGrade.tint, to.colorGrade.tint, t),
      contrast: lerpNum(from.colorGrade.contrast, to.colorGrade.contrast, t),
      saturation: lerpNum(from.colorGrade.saturation, to.colorGrade.saturation, t),
    },
    fog: {
      nearDistance: lerpNum(from.fog.nearDistance, to.fog.nearDistance, t),
      farDistance: lerpNum(from.fog.farDistance, to.fog.farDistance, t),
      color: lerpTuple3(from.fog.color, to.fog.color, t),
      density: lerpNum(from.fog.density, to.fog.density, t),
    },
    ambientLight: {
      color: lerpTuple3(from.ambientLight.color, to.ambientLight.color, t),
      intensity: lerpNum(from.ambientLight.intensity, to.ambientLight.intensity, t),
    },
    atmosphere: {
      // Use target particle type once we're past halfway
      particleType: t < 0.5 ? from.atmosphere.particleType : to.atmosphere.particleType,
      particleCount: lerpNum(from.atmosphere.particleCount, to.atmosphere.particleCount, t),
      particleColor: lerpTuple3(from.atmosphere.particleColor, to.atmosphere.particleColor, t),
      particleSize: lerpNum(from.atmosphere.particleSize, to.atmosphere.particleSize, t),
      particleSpeed: lerpNum(from.atmosphere.particleSpeed, to.atmosphere.particleSpeed, t),
    },
    godRayIntensity: lerpNum(from.godRayIntensity, to.godRayIntensity, t),
    heatDistortion: lerpNum(from.heatDistortion, to.heatDistortion, t),
    groundFogDensity: lerpNum(from.groundFogDensity, to.groundFogDensity, t),
  }
}

export class BiomeTransition {
  private biomeMap: BiomeMap
  private scene: THREE.Scene
  private colorGrade: ColorGradePass
  private skyDome: SkyDome
  private worldState: WorldState | null = null

  private currentBiome: BiomeType = BiomeType.Forest
  private targetBiome: BiomeType = BiomeType.Forest
  private blendProgress = 1.0

  private currentFogColor = new THREE.Color()
  private currentFogNear = 15
  private currentFogFar = 80

  private dayFactor = 1.0

  private currentVisual: InterpolatedVisual

  constructor(biomeMap: BiomeMap, scene: THREE.Scene, colorGrade: ColorGradePass, skyDome: SkyDome) {
    this.biomeMap = biomeMap
    this.scene = scene
    this.colorGrade = colorGrade
    this.skyDome = skyDome

    // Init scene fog
    const initBiome = getBiome(BiomeType.Forest)
    this.scene.fog = new THREE.Fog(initBiome.fogColor, initBiome.fogNear, initBiome.fogFar)
    this.scene.background = new THREE.Color(0x000000)
    this.currentFogColor.copy(initBiome.fogColor)
    this.currentFogNear = initBiome.fogNear
    this.currentFogFar = initBiome.fogFar

    // Init visual identity from forest
    this.currentVisual = interpolateVisual(initBiome.visualIdentity, initBiome.visualIdentity, 0)

    // Init sky with forest config
    this.applySkyConfig(initBiome.skyConfig, initBiome.skyConfig, 0)
  }

  setDayFactor(dayFactor: number) {
    this.dayFactor = dayFactor
  }

  setWorldState(worldState: WorldState) {
    this.worldState = worldState
  }

  update(playerPos: THREE.Vector3, delta: number) {
    let biome = this.biomeMap.getBiomeAt(playerPos.x, playerPos.z)

    // Don't switch to Heaven atmosphere while still climbing stairs at low altitude
    if (biome === BiomeType.Heaven && playerPos.y < 80) {
      biome = this.currentBiome
    }
    // Don't switch to Hell atmosphere while still above ground
    if (biome === BiomeType.Hell && playerPos.y > -10) {
      biome = this.currentBiome
    }

    if (biome !== this.targetBiome) {
      this.targetBiome = biome
      this.blendProgress = 0
    }

    if (this.blendProgress < 1) {
      this.blendProgress = Math.min(1, this.blendProgress + delta * TRANSITION_SPEED)
    }

    // Always apply blend (day factor changes continuously)
    this.applyBlend(this.blendProgress)
  }

  private applyBlend(t: number) {
    const from = getBiome(this.currentBiome)
    const to   = getBiome(this.targetBiome)

    const fogColor = new THREE.Color().lerpColors(from.fogColor, to.fogColor, t)
    const fogNear  = from.fogNear  + (to.fogNear  - from.fogNear)  * t
    const fogFar   = from.fogFar   + (to.fogFar   - from.fogFar)   * t

    // Lighten fog during daytime — blend toward a bright desaturated version
    const df = this.dayFactor
    if (df > 0) {
      // Create a lighter fog target based on the biome fog but much brighter
      _tmpA.copy(fogColor)
      const lum = _tmpA.r * 0.3 + _tmpA.g * 0.5 + _tmpA.b * 0.2
      _tmpB.setRGB(
        Math.min(1, _tmpA.r + 0.35 + lum * 0.3),
        Math.min(1, _tmpA.g + 0.38 + lum * 0.3),
        Math.min(1, _tmpA.b + 0.42 + lum * 0.3),
      )
      fogColor.lerp(_tmpB, df * 0.7)
    }

    const fog = this.scene.fog as THREE.Fog
    if (fog) {
      fog.color.copy(fogColor)
      const rs = RENDER_CONFIG.renderScale
      fog.near = (fogNear + df * 10) * rs  // scale fog with render distance
      fog.far  = (fogFar + df * 30) * rs
    }

    // Update ColorGrade uniform with current biome tint
    this.colorGrade.setBiomeTint(fogColor, t)

    // Interpolate visual identity parameters
    this.currentVisual = interpolateVisual(from.visualIdentity, to.visualIdentity, t)

    // Apply per-biome color grading to the shader
    this.colorGrade.setBiomeColorGrade(
      this.currentVisual.colorGrade.tint,
      this.currentVisual.colorGrade.contrast,
      this.currentVisual.colorGrade.saturation,
    )

    // Blend sky configs
    this.applySkyConfig(from.skyConfig, to.skyConfig, t)

    if (t >= 1) {
      this.currentBiome = this.targetBiome
    }
  }

  private applySkyConfig(from: SkyConfig, to: SkyConfig, t: number) {
    const df = this.dayFactor

    // Zenith: lerp day/night per biome, then lerp between biomes
    lerpSkyColor(_tmpA, from.zenithDay, from.zenithNight, df)
    lerpSkyColor(_tmpB, to.zenithDay, to.zenithNight, df)
    _zenith.lerpColors(_tmpA, _tmpB, t)

    // Horizon
    lerpSkyColor(_tmpA, from.horizonDay, from.horizonNight, df)
    lerpSkyColor(_tmpB, to.horizonDay, to.horizonNight, df)
    _horizon.lerpColors(_tmpA, _tmpB, t)

    // Cloud color
    _cloud.lerpColors(from.cloudColor, to.cloudColor, t)

    const cloudDensity = from.cloudDensity + (to.cloudDensity - from.cloudDensity) * t
    const haze = from.hazeStrength + (to.hazeStrength - from.hazeStrength) * t

    this.skyDome.setColors(_zenith, _horizon, _cloud, cloudDensity, haze)
  }

  /** Returns the current smoothly-interpolated visual identity parameters.
   *  If the current biome is activated, applies subtle visual improvements. */
  getCurrentVisual(): InterpolatedVisual {
    if (!this.worldState || !this.worldState.activatedSites.has(this.currentBiome)) {
      return this.currentVisual
    }

    // Activated biome visual improvements
    const v = this.currentVisual
    // Global sky brightness bonus from all activations (max +10% at 11/11)
    const skyBonus = this.worldState.activatedSites.size / 11 * 0.1

    return {
      colorGrade: {
        tint: v.colorGrade.tint,
        contrast: v.colorGrade.contrast,
        // Color saturation +15%
        saturation: v.colorGrade.saturation * 1.15,
      },
      fog: {
        nearDistance: v.fog.nearDistance,
        // Fog far distance +20%
        farDistance: v.fog.farDistance * 1.2,
        color: v.fog.color,
        density: v.fog.density,
      },
      ambientLight: {
        color: v.ambientLight.color,
        // Ambient light +10%, plus global sky brightness bonus
        intensity: v.ambientLight.intensity * (1.1 + skyBonus),
      },
      atmosphere: {
        particleType: v.atmosphere.particleType,
        particleCount: v.atmosphere.particleCount,
        particleColor: v.atmosphere.particleColor,
        particleSize: v.atmosphere.particleSize,
        // Particle speed -30% (calmer, more serene atmosphere)
        particleSpeed: v.atmosphere.particleSpeed * 0.7,
      },
      godRayIntensity: v.godRayIntensity,
      heatDistortion: v.heatDistortion,
      groundFogDensity: v.groundFogDensity,
    }
  }

  getCurrentBiome(): BiomeType {
    return this.currentBiome
  }

  getCurrentBiomeName(): string {
    return getBiome(this.currentBiome).name
  }

  getCurrentFogFar(): number {
    return this.currentFogFar
  }
}
