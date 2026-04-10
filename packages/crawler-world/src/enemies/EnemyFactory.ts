import * as THREE from 'three'
import { addEntity, addComponent } from 'bitecs'
import type { IWorld } from 'bitecs'
import { Position, Velocity, Health, AIState, IsEnemy } from '@engine/core'
import type { CreatureDNA } from '@engine/core'
import { createEnemyDNA } from './EnemyDNA'
import type { EnemyArchetype } from './EnemyDNA'
import { BiomeType } from '@engine/core'
import { buildEnemyMesh, disposeMeshGroup } from './EnemyMeshBuilder'

export interface ActiveEnemy {
  eid: number
  mesh: THREE.Group
  archetype: EnemyArchetype
  damage: number
}

const ARCHETYPE_INDEX: Record<EnemyArchetype, number> = {
  rusher: 0,
  shooter: 1,
  flyer: 2,
  tank: 3,
}

// TODO(perf): Replace individual enemy meshes with InstancedMesh for standard enemies
// (non-boss archetypes). Each archetype would use ONE InstancedMesh with maxCount=200,
// and each enemy would hold an instance index. Per-frame, update instance matrices from
// Position components. Use per-instance color attribute for team/biome tinting.
// This reduces draw calls from ~200 to ~4 (one per archetype), a major GPU win.
// Boss enemies can remain as regular meshes since there is only ever one active.

export class EnemyManager {
  readonly enemies: ActiveEnemy[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawn(
    world: IWorld,
    pos: { x: number; y: number; z: number },
    archetype: EnemyArchetype,
    waveNumber: number,
    mutationMultiplier = 1.0,
    biome?: BiomeType,
    undergroundId?: number,
  ): void {
    const dna: CreatureDNA = createEnemyDNA(archetype, waveNumber, mutationMultiplier, biome, undergroundId)
    const eid = addEntity(world)

    addComponent(world, Position, eid)
    Position.x[eid] = pos.x
    Position.y[eid] = pos.y
    Position.z[eid] = pos.z

    addComponent(world, IsEnemy, eid)

    addComponent(world, Health, eid)
    const baseHP =
      archetype === 'tank' ? 80 : archetype === 'rusher' ? 30 : 20
    const hp = baseHP + waveNumber * 5
    Health.current[eid] = hp
    Health.max[eid] = hp

    addComponent(world, AIState, eid)
    AIState.behavior[eid] = ARCHETYPE_INDEX[archetype]

    addComponent(world, Velocity, eid)
    Velocity.x[eid] = 0
    Velocity.y[eid] = 0
    Velocity.z[eid] = 0

    // Build procedural mesh from DNA
    const scale = dna.size * (archetype === 'tank' ? 1.5 : 1.0)
    const group = buildEnemyMesh(dna, archetype)
    // Override group's base scale with the archetype size multiplier on top of dna.size
    group.scale.setScalar(scale)
    group.position.set(pos.x, pos.y + scale * 0.75, pos.z)
    this.scene.add(group)

    const damage =
      (archetype === 'tank' ? 20 : archetype === 'rusher' ? 10 : 5) + waveNumber
    this.enemies.push({ eid, mesh: group, archetype, damage })
  }

  remove(index: number): void {
    const enemy = this.enemies[index]
    this.scene.remove(enemy.mesh)
    disposeMeshGroup(enemy.mesh)
    this.enemies.splice(index, 1)
  }

  dispose(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh)
      disposeMeshGroup(e.mesh)
    }
    this.enemies.length = 0
  }
}
