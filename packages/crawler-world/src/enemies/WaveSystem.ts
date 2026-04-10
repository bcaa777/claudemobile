import type { IWorld } from 'bitecs'
import { BiomeType } from '@engine/core'
import type { EnemyManager } from './EnemyFactory'
import type { EnemyArchetype } from './EnemyDNA'
import { BIOME_ENEMY_TEMPLATES, UNDERGROUND_ENEMY_TEMPLATES } from './EnemyDNA'
import { GAME_CONFIG } from '../config'

const FALLBACK_ARCHETYPES: EnemyArchetype[] = ['rusher', 'shooter', 'flyer', 'tank']

export class WaveSystem {
  currentWave = 0
  waveTimer = 0
  waveActive = false
  betweenWaveDelay = 5 // seconds between waves
  private allWavesComplete = false

  get isBossTime(): boolean {
    return this.allWavesComplete
  }

  mutationMultiplier = 1.0
  /** Current biome – set by Game before starting an expedition. */
  currentBiome: BiomeType | null = null
  /** Set when running an underground expedition (id 100/101/102). */
  currentUndergroundId: number | null = null

  update(
    delta: number,
    world: IWorld,
    enemyMgr: EnemyManager,
    playerX: number,
    playerZ: number,
    sampleHeight: (x: number, z: number) => number,
  ): void {
    // Once all waves are done, stop spawning new waves
    if (this.allWavesComplete) return

    if (!this.waveActive) {
      this.waveTimer += delta
      if (this.waveTimer >= this.betweenWaveDelay) {
        this.startWave(world, enemyMgr, playerX, playerZ, sampleHeight)
      }
      return
    }

    // Wave ends when all enemies are dead
    if (enemyMgr.enemies.length === 0) {
      this.waveActive = false
      this.waveTimer = 0

      if (this.currentWave >= GAME_CONFIG.wavesPerExpedition) {
        this.allWavesComplete = true
        console.log('[WaveSystem] All waves complete — boss time!')
      }
    }
  }

  reset(): void {
    this.currentWave = 0
    this.waveActive = false
    this.waveTimer = 0
    this.allWavesComplete = false
    this.currentUndergroundId = null
  }

  private startWave(
    world: IWorld,
    enemyMgr: EnemyManager,
    playerX: number,
    playerZ: number,
    sampleHeight: (x: number, z: number) => number,
  ): void {
    this.currentWave++
    this.waveActive = true

    const count = Math.min(
      Math.floor(
        GAME_CONFIG.enemiesPerWaveBase *
          Math.pow(GAME_CONFIG.enemiesPerWaveScale, this.currentWave - 1),
      ),
      GAME_CONFIG.maxEnemies,
    )

    // Derive archetype pool from underground or surface templates
    const biome = this.currentBiome
    const ugId = this.currentUndergroundId
    let archetypes: EnemyArchetype[]
    if (ugId !== null && UNDERGROUND_ENEMY_TEMPLATES[ugId]?.length > 0) {
      archetypes = UNDERGROUND_ENEMY_TEMPLATES[ugId].map(t => t.archetype)
    } else if (biome !== null && BIOME_ENEMY_TEMPLATES[biome]?.length > 0) {
      archetypes = BIOME_ENEMY_TEMPLATES[biome].map(t => t.archetype)
    } else {
      archetypes = FALLBACK_ARCHETYPES
    }

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const dist = 30 + Math.random() * 20
      const x = playerX + Math.cos(angle) * dist
      const z = playerZ + Math.sin(angle) * dist
      const y = sampleHeight(x, z)
      const archetype = archetypes[Math.floor(Math.random() * archetypes.length)]
      enemyMgr.spawn(
        world,
        { x, y, z },
        archetype,
        this.currentWave,
        this.mutationMultiplier,
        biome ?? undefined,
        ugId ?? undefined,
      )
    }

    const locationLabel = ugId !== null ? `underground(${ugId})`
      : biome !== null ? BiomeType[biome] : 'generic'
    console.log(
      `[WaveSystem] Wave ${this.currentWave} started — ${count} enemies (${locationLabel})`,
    )
  }
}
