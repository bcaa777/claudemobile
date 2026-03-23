import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { CreatureManager } from '../creatures/CreatureManager'
import { WorldState } from '../systems/WorldState'
import { ENEMY_SPAWN_TABLE, HollowType } from './EnemyTypes'
import { CHUNK_SIZE } from '../world/TerrainGenerator'
import { World } from '../world/World'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'

const MAX_ENEMIES = 15

export class EnemySpawner {
  private nightSpawnTimer = 0
  private nightSpawnInterval = 60 // seconds

  /**
   * Chunk-based spawning — called when a new chunk loads.
   * Checks ENEMY_SPAWN_TABLE for the biome, and if random < density * (1 - biomeStability),
   * spawns 1 enemy of a random type from the table.
   */
  spawnForChunk(
    chunkX: number,
    chunkZ: number,
    biome: BiomeType,
    worldState: WorldState,
    creatureManager: CreatureManager,
    world: World
  ): void {
    if (this.getEnemyCount(creatureManager) >= MAX_ENEMIES) return

    const entry = ENEMY_SPAWN_TABLE[biome]
    if (!entry) return

    const stability = worldState.biomeStability.get(biome) ?? 1.0
    const rng = new SeededRandom(chunkSeed(chunkX, chunkZ, 9999))
    const roll = rng.next()

    if (roll >= entry.density * (1 - stability)) return

    // Pick a random enemy type from the table
    const typeIdx = Math.floor(rng.next() * entry.types.length)
    const enemyType = entry.types[typeIdx]

    // Position at random point within chunk, at terrain height
    const wx = chunkX * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
    const wz = chunkZ * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
    const h = world.getHeightAt(wx, wz)
    if (h === null) return

    const pos = new THREE.Vector3(wx, h + 1, wz)
    creatureManager.spawnEnemy(enemyType, pos)
  }

  /**
   * Night-spawn check — called every frame.
   * Every 60 seconds at night, 25% + (1 - globalHarmony) * 30% chance to spawn 1-2 Shamblers
   * 30-40 units behind the player (opposite camera direction).
   */
  updateNightSpawns(
    dt: number,
    worldState: WorldState,
    playerPos: THREE.Vector3,
    playerDirection: THREE.Vector3,
    creatureManager: CreatureManager,
    world: World
  ): void {
    if (this.getEnemyCount(creatureManager) >= MAX_ENEMIES) return

    // Only at night: timeOfDay > 0.8 or < 0.2
    const t = worldState.timeOfDay
    if (t <= 0.8 && t >= 0.2) {
      this.nightSpawnTimer = 0
      return
    }

    this.nightSpawnTimer += dt
    if (this.nightSpawnTimer < this.nightSpawnInterval) return
    this.nightSpawnTimer = 0

    // Chance: 25% + (1 - globalHarmony) * 30%
    const chance = 0.25 + (1 - worldState.globalHarmony) * 0.3
    if (Math.random() >= chance) return

    // Spawn 1-2 shamblers behind the player
    const count = 1 + (Math.random() < 0.5 ? 1 : 0)
    for (let i = 0; i < count; i++) {
      if (this.getEnemyCount(creatureManager) >= MAX_ENEMIES) break

      const dist = 30 + Math.random() * 10 // 30-40 units
      const lateral = (Math.random() - 0.5) * 10 // slight lateral offset

      // Behind the player = opposite of camera direction
      const behindX = playerPos.x - playerDirection.x * dist + playerDirection.z * lateral
      const behindZ = playerPos.z - playerDirection.z * dist - playerDirection.x * lateral
      const h = world.getHeightAt(behindX, behindZ)
      if (h === null) continue

      const pos = new THREE.Vector3(behindX, h + 1, behindZ)
      creatureManager.spawnEnemy('shambler' as HollowType, pos)
    }
  }

  /** Count current enemies */
  getEnemyCount(creatureManager: CreatureManager): number {
    let count = 0
    for (const c of creatureManager.creatures.values()) {
      if (c.isEnemy) count++
    }
    return count
  }
}
