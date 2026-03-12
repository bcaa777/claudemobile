import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import type { BiomeMap } from '../world/BiomeMap'
import type { CastleWalkable } from '../castle/Castle'
import { WATER_LEVEL } from '../world/TerrainGenerator'
import { mergeStaticMeshes } from '../utils/mergeStaticMeshes'
import { DruidRingTemple } from './DruidRingTemple'
import { GreatPyramid } from './GreatPyramid'
import { ObsidianCitadel } from './ObsidianCitadel'
import { IcePalace } from './IcePalace'
import { SwampZiggurat } from './SwampZiggurat'
import { AncestorField } from './AncestorField'
import { MyceliumCathedral } from './MyceliumCathedral'
import { AshColosseum } from './AshColosseum'
import { CrystalCathedral } from './CrystalCathedral'
import { SavannaObelisk } from './SavannaObelisk'
import { LandmarkCrystal } from './LandmarkCrystal'

interface Updatable {
  update(delta: number, time: number): void
}

// Crystal color per biome
const CRYSTAL_COLORS: Partial<Record<BiomeType, number>> = {
  [BiomeType.Forest]:    0x44ff88,
  [BiomeType.Desert]:    0xffcc44,
  [BiomeType.Volcanic]:  0xff4422,
  [BiomeType.Snow]:      0x88ddff,
  [BiomeType.Swamp]:     0x88ff44,
  [BiomeType.Tundra]:    0xaabbff,
  [BiomeType.Mushroom]:  0xff88ff,
  [BiomeType.AshWastes]: 0xff6633,
  [BiomeType.Crystal]:   0x88aaff,
  [BiomeType.Savanna]:   0xffcc22,
}

// 3 crystal offsets per landmark (world-space offsets from landmark centre)
// Positions chosen to reward exploration: entrance, interior, elevated
const CRYSTAL_OFFSETS: THREE.Vector3[] = [
  new THREE.Vector3(14,  2,  16),   // south entrance, ground
  new THREE.Vector3(-14, 2, -12),   // inside, ground
  new THREE.Vector3(0,  28,   0),   // elevated centre (mid-height with 0.5 scale)
]

export class LandmarkManager {
  private landmarks: Updatable[] = []
  readonly allWalkables: CastleWalkable[] = []
  readonly positions = new Map<BiomeType, THREE.Vector3>()
  readonly allCrystals: LandmarkCrystal[] = []

  constructor(biomeMap: BiomeMap, scene: THREE.Scene, seed: number) {
    const spawn = (
      biomeType: BiomeType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Cls: new (pos: THREE.Vector3, scene: THREE.Scene, seed: number) => any,
      s: number
    ) => {
      const { x, z } = biomeMap.getClosestSeedOf(biomeType)
      const pos = new THREE.Vector3(x, WATER_LEVEL + 15, z)
      const childCount = scene.children.length
      const inst = new Cls(pos, scene, s)

      // Merge static meshes in any groups the landmark just added to the scene
      for (let i = childCount; i < scene.children.length; i++) {
        const child = scene.children[i]
        if (child instanceof THREE.Group) mergeStaticMeshes(child)
      }

      // Rescale walkables from landmark-local space to world-space (0.25 group scale)
      const cx = inst.position.x, cy = inst.position.y, cz = inst.position.z
      for (const w of inst.walkables as CastleWalkable[]) {
        this.allWalkables.push({
          minX: cx + (w.minX - cx) * 0.25,
          maxX: cx + (w.maxX - cx) * 0.25,
          minZ: cz + (w.minZ - cz) * 0.25,
          maxZ: cz + (w.maxZ - cz) * 0.25,
          y:    cy + (w.y    - cy) * 0.25,
        })
      }

      this.positions.set(biomeType, inst.position)
      this.landmarks.push(inst)

      // Spawn 3 crystals per landmark
      const color = CRYSTAL_COLORS[biomeType] ?? 0xaaffcc
      for (const offset of CRYSTAL_OFFSETS) {
        const cpos = new THREE.Vector3(cx + offset.x, cy + offset.y, cz + offset.z)
        this.allCrystals.push(new LandmarkCrystal(cpos, scene, color))
      }
    }

    spawn(BiomeType.Forest,    DruidRingTemple,   seed + 1001)
    spawn(BiomeType.Desert,    GreatPyramid,      seed + 1002)
    spawn(BiomeType.Volcanic,  ObsidianCitadel,   seed + 1003)
    spawn(BiomeType.Snow,      IcePalace,         seed + 1004)
    spawn(BiomeType.Swamp,     SwampZiggurat,     seed + 1005)
    spawn(BiomeType.Tundra,    AncestorField,     seed + 1006)
    spawn(BiomeType.Mushroom,  MyceliumCathedral, seed + 1007)
    spawn(BiomeType.AshWastes, AshColosseum,      seed + 1008)
    spawn(BiomeType.Crystal,   CrystalCathedral,  seed + 1009)
    spawn(BiomeType.Savanna,   SavannaObelisk,    seed + 1010)
  }

  update(delta: number, time: number) {
    for (const lm of this.landmarks) lm.update(delta, time)
    for (const cr of this.allCrystals) cr.update(delta, time)
  }
}
