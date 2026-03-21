import { BiomeType } from '../biomes/types'
import { PlayerState } from '../player/PlayerState'
import { WATER_LEVEL } from '../world/TerrainGenerator'

export class HazardSystem {
  private damageCooldown = 0

  update(
    delta: number,
    playerX: number, playerY: number, playerZ: number,
    biome: BiomeType,
    dayFactor: number,
    playerState: PlayerState,
    time: number,
    terrainHeight: number | null,
  ) {
    this.damageCooldown = Math.max(0, this.damageCooldown - delta)

    const canDamage = this.damageCooldown <= 0

    // Lava pools — Volcanic/Hell biomes, player near lava surface
    if ((biome === BiomeType.Volcanic || biome === BiomeType.Hell) && playerY < WATER_LEVEL + 0.5) {
      if (canDamage) {
        playerState.takeDamage(8 * delta * 2, time) // 8 dmg/s applied via delta
        this.damageCooldown = 0.1
      }
    }

    // Quicksand — Desert/Bog, low altitude near terrain
    if ((biome === BiomeType.Desert || biome === BiomeType.Bog) && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight // approximate feet position
      if (aboveTerrain < 1.0 && terrainHeight < WATER_LEVEL + 2) {
        playerState.speedMultiplier *= 0.3
      }
    }

    // Ice patches — Snow/Alpine/Tundra (friction handled in controller via return value)
    // (Friction is handled by checking getIceFriction() in the controller)

    // Toxic gas — Swamp/Bog, low areas
    if ((biome === BiomeType.Swamp || biome === BiomeType.Bog) && playerY < WATER_LEVEL + 3.5) {
      if (canDamage) {
        playerState.takeDamage(3 * delta * 2, time)
        this.damageCooldown = 0.1
      }
    }

    // Thorny vines — Jungle
    if (biome === BiomeType.Jungle && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight
      if (aboveTerrain < 2.0) {
        if (canDamage) {
          playerState.takeDamage(2 * delta * 2, time)
          this.damageCooldown = 0.1
        }
        playerState.speedMultiplier *= 0.6
      }
    }

    // Scorching heat — Badlands/Mesa, daytime only
    if ((biome === BiomeType.Badlands || biome === BiomeType.Mesa) && dayFactor > 0.5) {
      if (canDamage) {
        playerState.takeDamage(1 * delta * 2, time)
        this.damageCooldown = 0.1
      }
    }

    // Crystal shards — Crystal biome, minor contact damage
    if (biome === BiomeType.Crystal && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight
      if (aboveTerrain < 1.5) {
        if (canDamage) {
          playerState.takeDamage(0.5 * delta * 2, time)
          this.damageCooldown = 0.3
        }
      }
    }
  }

  getIceFriction(biome: BiomeType): number {
    if (biome === BiomeType.Snow || biome === BiomeType.Alpine || biome === BiomeType.Tundra) {
      return 0.15
    }
    return 1.0
  }
}
