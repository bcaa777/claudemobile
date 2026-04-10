import type { IWorld } from 'bitecs'
import { BiomeType } from '@engine/core'
import type { Renderer } from '@engine/core'
import type { MetaState } from '../state/MetaState'
import { saveMetaState } from '../state/SaveManager'
import type { HubScene } from '../hub/HubScene'
import type { PlayerController } from '../player/PlayerController'
import type { ChunkManager } from './BiomeSetup'
import { setupUndergroundScene } from './BiomeSetup'
import type { EnemyManager } from '../enemies/EnemyFactory'
import type { WaveSystem } from '../enemies/WaveSystem'
import type { WeaponSystem } from '../combat/WeaponSystem'
import type { ProjectileSystem } from '../combat/ProjectileSystem'
import type { DamageSystem } from '../combat/DamageSystem'
import type { GameState } from '../state/GameState'
import type { PickupSystem } from '../pickups/PickupSystem'
import type { HUD } from '../hud/HUD'
import { ResultsScreen } from '../hud/ResultsScreen'
import { GAME_CONFIG } from '../config'
import {
  isUndergroundId,
  getUndergroundConfig,
  type UndergroundBiomeId,
} from './UndergroundBiomes'
import { RestorationSystem } from './RestorationSystem'

export type GamePhase = 'hub' | 'loading' | 'combat' | 'results'

export class ExpeditionManager {
  phase: GamePhase = 'hub'
  currentBiome: BiomeType | null = null

  /** Non-null during an underground expedition. */
  currentUndergroundId: UndergroundBiomeId | null = null

  // Run stats tracked during combat
  private startTime = 0
  enemiesKilled = 0
  private xpAtStart = 0
  private levelAtStart = 1
  private resultsScreen: ResultsScreen | null = null

  /** Cleanup function returned by setupUndergroundScene — called on expedition end. */
  private undergroundCleanup: (() => void) | null = null

  private restorationSystem = new RestorationSystem()

  constructor(
    private renderer: Renderer,
    private container: HTMLElement,
    private hubScene: HubScene,
    private metaState: MetaState,
    private world: IWorld,
    private player: PlayerController,
    private chunkManager: ChunkManager,
    private enemyManager: EnemyManager,
    private waveSystem: WaveSystem,
    private weaponSystem: WeaponSystem,
    private projectileSystem: ProjectileSystem,
    private damageSystem: DamageSystem,
    private gameState: GameState,
    private pickupSystem: PickupSystem,
    private hud: HUD,
  ) {}

  startExpedition(biomeType: BiomeType): void {
    this.phase = 'loading'
    this.currentBiome = biomeType

    // Deactivate hub
    this.hubScene.deactivate()

    // Reset run state
    this.gameState.reset()

    // Apply meta upgrades to run stats
    this.gameState.damageBonus = this.metaState.upgrades.damage * 5
    this.gameState.speedBonus = this.metaState.upgrades.speed * 1
    this.gameState.pickupRange = 5 + this.metaState.upgrades.magnet * 1.5
    if (this.metaState.upgrades.health > 0) {
      const bonus = this.metaState.upgrades.health * 20
      this.gameState.maxHealth += bonus
      this.gameState.health = this.gameState.maxHealth
    }

    // Reset tracking stats
    this.startTime = performance.now()
    this.enemiesKilled = 0
    this.xpAtStart = 0
    this.levelAtStart = 1

    // Reset wave system
    this.waveSystem.reset()

    // Clear enemies
    this.enemyManager.dispose()

    // Wire retreat callback
    this.hud.onRetreat = () => this.endExpedition(false, this.gameState.gold)

    // Request pointer lock for combat
    this.container.requestPointerLock()

    this.phase = 'combat'
    console.log(`[ExpeditionManager] Expedition started: ${BiomeType[biomeType]}`)
  }

  /**
   * Start an underground expedition.  Accepts a numeric UndergroundBiomeId
   * (100, 101, 102) rather than a BiomeType.
   */
  startUndergroundExpedition(undergroundId: number): void {
    if (!isUndergroundId(undergroundId)) return
    const config = getUndergroundConfig(undergroundId)
    if (!config) return

    // Store current underground id so WaveSystem / BossSystem can use it
    this.currentUndergroundId = undergroundId

    // Apply underground terrain config override to ChunkManager
    this.chunkManager.undergroundConfig = config

    // Start regular expedition flow using the underlying BiomeType for terrain gen
    this.startExpedition(config.biomeType)

    // Override biome name in logs
    console.log(`[ExpeditionManager] Underground expedition started: ${config.name}`)

    // Set up underground scene atmosphere
    this.undergroundCleanup = setupUndergroundScene(this.renderer.scene, config)
  }

  /** Call when an enemy dies during this run — tracks kill count. */
  recordEnemyKill(): void {
    this.enemiesKilled++
  }

  endExpedition(victory: boolean, goldEarned: number): void {
    if (this.phase !== 'combat') return
    this.phase = 'results'

    // Exit pointer lock
    document.exitPointerLock()

    // Tear down underground scene extras
    if (this.undergroundCleanup) {
      this.undergroundCleanup()
      this.undergroundCleanup = null
    }
    this.chunkManager.undergroundConfig = null

    // Transfer gold to meta
    this.metaState.gold += goldEarned
    if (victory) {
      if (this.currentUndergroundId !== null) {
        // Mark underground biome as cleansed
        this.restorationSystem.cleansedUnderground(this.metaState, this.currentUndergroundId)
        const restored = this.restorationSystem.checkRestoration(this.metaState)
        if (restored) {
          this.restorationSystem.showRestorationBanner()
          this.restorationSystem.playRestorationEffect(this.renderer.scene as any)
        }
      } else if (this.currentBiome !== null) {
        if (!this.metaState.cleansedBiomes.includes(this.currentBiome)) {
          this.metaState.cleansedBiomes.push(this.currentBiome)
        }
      }
    }
    saveMetaState(this.metaState)

    const durationSec = (performance.now() - this.startTime) / 1000
    const biomeName = this.currentUndergroundId !== null
      ? (getUndergroundConfig(this.currentUndergroundId)?.name ?? 'Underground')
      : this.currentBiome !== null ? BiomeType[this.currentBiome] : 'Unknown'

    // XP earned is approximated from level progress
    const xpEarned = this.enemiesKilled * GAME_CONFIG.xpPerKillBase

    this.resultsScreen = new ResultsScreen(
      {
        victory,
        biomeName,
        duration: durationSec,
        wavesCompleted: this.waveSystem.currentWave,
        totalWaves: GAME_CONFIG.wavesPerExpedition,
        enemiesKilled: this.enemiesKilled,
        goldEarned,
        xpEarned,
        levelReached: this.gameState.level,
      },
      () => this.returnToHub(),
    )
  }

  private returnToHub(): void {
    this.resultsScreen = null

    // Clear combat scene objects
    this.enemyManager.dispose()

    this.phase = 'hub'
    this.currentBiome = null
    this.currentUndergroundId = null

    // Reactivate hub - caller (Game) will re-register the onBiomeSelected callback
    // by calling activateHub()
    if (this.onReturnToHub) this.onReturnToHub()
  }

  onReturnToHub: (() => void) | null = null

  isInCombat(): boolean {
    return this.phase === 'combat'
  }

  isInHub(): boolean {
    return this.phase === 'hub'
  }
}
