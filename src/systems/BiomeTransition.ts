import * as THREE from 'three'
import { BiomeMap } from '../world/BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType } from '../biomes/types'
import { ColorGradePass } from '../postprocessing/ColorGradePass'

const TRANSITION_SPEED = 1.5  // blend units per second

export class BiomeTransition {
  private biomeMap: BiomeMap
  private scene: THREE.Scene
  private colorGrade: ColorGradePass

  private currentBiome: BiomeType = BiomeType.Forest
  private targetBiome: BiomeType = BiomeType.Forest
  private blendProgress = 1.0

  private currentFogColor = new THREE.Color()
  private currentFogNear = 15
  private currentFogFar = 80

  constructor(biomeMap: BiomeMap, scene: THREE.Scene, colorGrade: ColorGradePass) {
    this.biomeMap = biomeMap
    this.scene = scene
    this.colorGrade = colorGrade

    // Init scene fog
    const initBiome = getBiome(BiomeType.Forest)
    this.scene.fog = new THREE.Fog(initBiome.fogColor, initBiome.fogNear, initBiome.fogFar)
    this.scene.background = initBiome.skyColor.clone()
    this.currentFogColor.copy(initBiome.fogColor)
    this.currentFogNear = initBiome.fogNear
    this.currentFogFar = initBiome.fogFar
  }

  update(playerPos: THREE.Vector3, delta: number) {
    const biome = this.biomeMap.getBiomeAt(playerPos.x, playerPos.z)

    if (biome !== this.targetBiome) {
      this.targetBiome = biome
      this.blendProgress = 0
    }

    if (this.blendProgress < 1) {
      this.blendProgress = Math.min(1, this.blendProgress + delta * TRANSITION_SPEED)
      this.applyBlend(this.blendProgress)
    }
  }

  private applyBlend(t: number) {
    const from = getBiome(this.currentBiome)
    const to   = getBiome(this.targetBiome)

    const fogColor = new THREE.Color().lerpColors(from.fogColor, to.fogColor, t)
    const fogNear  = from.fogNear  + (to.fogNear  - from.fogNear)  * t
    const fogFar   = from.fogFar   + (to.fogFar   - from.fogFar)   * t
    const skyColor = new THREE.Color().lerpColors(from.skyColor, to.skyColor, t)

    const fog = this.scene.fog as THREE.Fog
    if (fog) {
      fog.color.copy(fogColor)
      fog.near = fogNear
      fog.far  = fogFar
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(skyColor)
    }

    // Update ColorGrade uniform with current biome tint
    this.colorGrade.setBiomeTint(fogColor, t)

    if (t >= 1) {
      this.currentBiome = this.targetBiome
    }
  }

  getCurrentBiomeName(): string {
    return getBiome(this.currentBiome).name
  }
}
