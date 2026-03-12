import * as THREE from 'three'
import { BiomeMap } from '../world/BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType, SkyConfig } from '../biomes/types'
import { ColorGradePass } from '../postprocessing/ColorGradePass'
import { SkyDome } from '../sky/SkyDome'

const TRANSITION_SPEED = 1.5  // blend units per second

// Reusable temp colors to avoid per-frame allocations
const _zenith  = new THREE.Color()
const _horizon = new THREE.Color()
const _cloud   = new THREE.Color()
const _tmpA    = new THREE.Color()
const _tmpB    = new THREE.Color()

function lerpSkyColor(out: THREE.Color, dayCol: THREE.Color, nightCol: THREE.Color, dayFactor: number): THREE.Color {
  return out.lerpColors(nightCol, dayCol, dayFactor)
}

export class BiomeTransition {
  private biomeMap: BiomeMap
  private scene: THREE.Scene
  private colorGrade: ColorGradePass
  private skyDome: SkyDome

  private currentBiome: BiomeType = BiomeType.Forest
  private targetBiome: BiomeType = BiomeType.Forest
  private blendProgress = 1.0

  private currentFogColor = new THREE.Color()
  private currentFogNear = 15
  private currentFogFar = 80

  private dayFactor = 1.0

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

    // Init sky with forest config
    this.applySkyConfig(initBiome.skyConfig, initBiome.skyConfig, 0)
  }

  setDayFactor(dayFactor: number) {
    this.dayFactor = dayFactor
  }

  update(playerPos: THREE.Vector3, delta: number) {
    const biome = this.biomeMap.getBiomeAt(playerPos.x, playerPos.z)

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

    const fog = this.scene.fog as THREE.Fog
    if (fog) {
      fog.color.copy(fogColor)
      fog.near = fogNear
      fog.far  = fogFar
    }

    // Update ColorGrade uniform with current biome tint
    this.colorGrade.setBiomeTint(fogColor, t)

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

  getCurrentBiomeName(): string {
    return getBiome(this.currentBiome).name
  }
}
