import { Position } from '@engine/core'
import type { EnemyManager } from './EnemyFactory'
import { animateEnemy } from './EnemyMeshBuilder'

let _aiTime = 0

export function updateEnemyAI(
  enemyManager: EnemyManager,
  playerX: number,
  _playerY: number,
  playerZ: number,
  delta: number,
  sampleHeight: (x: number, z: number) => number,
): void {
  _aiTime += delta
  for (const enemy of enemyManager.enemies) {
    const eid = enemy.eid
    const ex = Position.x[eid]
    const ez = Position.z[eid]

    // Direction to player
    const dx = playerX - ex
    const dz = playerZ - ez
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 0.1) continue

    const nx = dx / dist
    const nz = dz / dist

    // Speed based on archetype
    const speed =
      enemy.archetype === 'tank' ? 3 :
      enemy.archetype === 'flyer' ? 8 :
      enemy.archetype === 'rusher' ? 6 : 4

    Position.x[eid] += nx * speed * delta
    Position.z[eid] += nz * speed * delta

    // Terrain snap (flyers hover above)
    const groundY = sampleHeight(Position.x[eid], Position.z[eid])
    Position.y[eid] =
      enemy.archetype === 'flyer' ? groundY + 5 : groundY + 0.75

    // Sync mesh
    enemy.mesh.position.set(Position.x[eid], Position.y[eid], Position.z[eid])

    // Idle bob animation
    animateEnemy(enemy.mesh, _aiTime + eid * 0.7)
  }
}
