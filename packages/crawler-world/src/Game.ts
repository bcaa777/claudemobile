import * as THREE from 'three'
import type { IWorld } from 'bitecs'
import { Renderer, InputManager, EventBus, createGameWorld } from '@engine/core'
import { BiomeType } from '@engine/core'
import { PlayerController } from './player/PlayerController'
import { ChunkManager, BiomeWeather, applyBiomeFog, getBiomeColorGrade } from './expedition/BiomeSetup'
import { EnemyManager } from './enemies/EnemyFactory'
import { WaveSystem } from './enemies/WaveSystem'
import { updateEnemyAI } from './enemies/EnemyAI'
import { WeaponSystem } from './combat/WeaponSystem'
import { ProjectileSystem } from './combat/ProjectileSystem'
import { DamageSystem } from './combat/DamageSystem'
import { OrbitalSystem } from './combat/OrbitalSystem'
import { WEAPON_DEFS } from './combat/WeaponDefs'
import { GameState } from './state/GameState'
import { MetaState } from './state/MetaState'
import { loadMetaState } from './state/SaveManager'
import { PickupSystem } from './pickups/PickupSystem'
import { HUD } from './hud/HUD'
import { LevelUpScreen } from './hud/LevelUpScreen'
import { generateLevelUpOptions, applyLevelUpOption } from './combat/WeaponProgression'
import { HubScene } from './hub/HubScene'
import { ExpeditionManager } from './expedition/ExpeditionManager'
import { BossSystem } from './enemies/BossSystem'
import { CompanionSystem } from './companion/CompanionSystem'
import { CorruptionSystem } from './expedition/CorruptionSystem'
import { GameAudio } from './audio/GameAudio'
import { CombatEffects } from './combat/CombatEffects'
import { Minimap } from './hud/Minimap'
import { DayNightSystem } from './expedition/DayNightSystem'

export class Game {
  private renderer: Renderer
  private input: InputManager
  private eventBus: EventBus
  private player: PlayerController
  private chunkManager: ChunkManager
  private world: IWorld
  private enemyManager: EnemyManager
  private waveSystem: WaveSystem
  private weaponSystem: WeaponSystem
  private projectileSystem: ProjectileSystem
  private damageSystem: DamageSystem
  private gameState: GameState
  private metaState: MetaState
  private pickupSystem: PickupSystem
  private hud: HUD
  private hubScene: HubScene
  private expeditionManager: ExpeditionManager
  private bossSystem: BossSystem
  private companionSystem: CompanionSystem
  private orbitalSystem: OrbitalSystem
  private corruptionSystem: CorruptionSystem
  private gameAudio: GameAudio
  private combatEffects: CombatEffects
  private minimap: Minimap | null = null
  private biomeWeather: BiomeWeather | null = null
  private dayNight = new DayNightSystem()
  private lastTime = 0
  private paused = false
  private levelUpScreen: LevelUpScreen | null = null
  private prevHealth = 0

  constructor(container: HTMLElement) {
    // Engine systems
    this.renderer = new Renderer(container)
    this.input = new InputManager()
    this.eventBus = new EventBus()
    this.world = createGameWorld()

    // Persistent meta state
    this.metaState = loadMetaState()

    // Terrain chunk manager
    this.chunkManager = new ChunkManager(this.renderer.scene)

    // Player
    this.player = new PlayerController(
      this.renderer.camera,
      this.input,
      (x, z) => this.chunkManager.sampleHeight(x, z),
      this.renderer.scene,
    )

    // Enemy systems
    this.enemyManager = new EnemyManager(this.renderer.scene)
    this.waveSystem = new WaveSystem()

    // Combat systems
    this.weaponSystem = new WeaponSystem()
    this.weaponSystem.addWeapon(WEAPON_DEFS.bolt_caster)
    this.weaponSystem.init(
      this.renderer.scene,
      (x, z) => this.chunkManager.sampleHeight(x, z),
    )

    this.projectileSystem = new ProjectileSystem(this.renderer.scene)
    this.projectileSystem.setTerrainSampler((x, z) => this.chunkManager.sampleHeight(x, z))
    this.damageSystem = new DamageSystem()

    // Orbital system
    this.orbitalSystem = new OrbitalSystem(this.renderer.scene)

    // Progression systems
    this.gameState = new GameState()
    this.pickupSystem = new PickupSystem(this.renderer.scene, this.eventBus)
    this.hud = new HUD()

    // Boss system
    this.bossSystem = new BossSystem()

    // Companion system
    this.companionSystem = new CompanionSystem()

    // Corruption system
    this.corruptionSystem = new CorruptionSystem()

    // Audio
    this.gameAudio = new GameAudio()

    // Combat effects
    this.combatEffects = new CombatEffects()

    // Hub
    this.hubScene = new HubScene(this.renderer, container)

    // Expedition manager
    this.expeditionManager = new ExpeditionManager(
      this.renderer,
      container,
      this.hubScene,
      this.metaState,
      this.world,
      this.player,
      this.chunkManager,
      this.enemyManager,
      this.waveSystem,
      this.weaponSystem,
      this.projectileSystem,
      this.damageSystem,
      this.gameState,
      this.pickupSystem,
      this.hud,
    )

    // Wire up return-to-hub callback
    this.expeditionManager.onReturnToHub = () => this.activateHub()

    // Listen for enemy deaths — share XP with companion + kill SFX + VFX
    this.eventBus.on('enemyDied', (data: { position: THREE.Vector3; archetype: string; eid: number; color?: THREE.Color }) => {
      console.log(`[Game] Enemy died: ${data.archetype} at (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`)
      this.expeditionManager.recordEnemyKill()
      if (this.companionSystem.active) {
        this.companionSystem.addXp(10)
      }
      this.gameAudio.playKillSound()
      if (data.archetype === 'tank') {
        this.combatEffects.freezeFrame(0.06)
      }
      this.combatEffects.deathParticles(
        this.renderer.scene,
        data.position,
        data.color ?? new THREE.Color(1, 0.3, 0),
      )
    })

    // Listen for boss death
    this.eventBus.on('bossDied', (data: { goldDrop: number }) => {
      console.log('[Game] Boss died — expedition victory!')
      this.gameState.gold += data.goldDrop
      this.expeditionManager.endExpedition(true, this.gameState.gold)
    })

    // Boss melee damage to player
    this.eventBus.on('bossDamagePlayer', (data: { amount: number }) => {
      this.gameState.health = Math.max(0, this.gameState.health - data.amount)
      console.log(`[Game] Boss hit player for ${data.amount} — HP: ${this.gameState.health}`)
      this.gameAudio.playPlayerHitSound()
      this.combatEffects.screenShake(this.renderer.camera, 0.3, 0.5)
    })

    // Pickup collected
    this.eventBus.on('pickupCollected', () => {
      this.gameAudio.playPickupSound()
    })

    // Start at hub
    this.activateHub()

    // Start loop
    requestAnimationFrame((t) => this.loop(t))
  }

  private activateHub(): void {
    this.hud.destroy()
    this.pickupSystem.clear()
    this.chunkManager.dispose()
    this.bossSystem.dispose()
    this.companionSystem.dispose()
    this.orbitalSystem.dispose()

    // Stop expedition music when returning to hub
    this.gameAudio.stopBiomeMusic()
    this.gameAudio.init()
    this.gameAudio.startHubMusic()

    // Reset post-processing
    this.renderer.colorGradePass.setBiomeColorGrade([1, 1, 1], 1, 1)
    this.renderer.crtPass.uniforms['scanlineIntensity'].value = 0.05
    this.renderer.damagePass.setStrength(0, 0)

    // Destroy minimap and combat effects DOM elements
    this.minimap?.destroy()
    this.minimap = null
    this.biomeWeather?.dispose()
    this.biomeWeather = null
    this.combatEffects.dispose()
    this.combatEffects = new CombatEffects()

    this.hubScene.activate(
      this.metaState,
      (biome: BiomeType) => {
        this.startCombat(biome)
      },
      (undergroundId: number) => {
        this.startUndergroundCombat(undergroundId)
      },
    )
  }

  private startUndergroundCombat(undergroundId: number): void {
    this._initCombatSystems()
    this.waveSystem.mutationMultiplier = this.corruptionSystem.getMutationMultiplier()
    // For wave system biome, use Forest as fallback (underground enemies set via undergroundId)
    this.waveSystem.currentBiome = BiomeType.Forest
    this.waveSystem.currentUndergroundId = undergroundId

    this.gameAudio.stopHubMusic()
    this.gameAudio.init()
    this.gameAudio.startBiomeMusic(BiomeType.Volcanic) // dark music for underground

    this.expeditionManager.startUndergroundExpedition(undergroundId)

    const companionId = this.hubScene.selectedCompanionId
    if (companionId) {
      const playerPos = this.player.getPosition()
      this.companionSystem.spawn(this.renderer.scene, companionId, playerPos)
      this.companionSystem.applyPassive(this.gameState)
    }
  }

  private _initCombatSystems(): void {
    this.weaponSystem = new WeaponSystem()
    this.weaponSystem.addWeapon(WEAPON_DEFS.bolt_caster)
    this.weaponSystem.init(
      this.renderer.scene,
      (x, z) => this.chunkManager.sampleHeight(x, z),
    )
    this.orbitalSystem = new OrbitalSystem(this.renderer.scene)
    this.hud = new HUD()
    this.minimap = new Minimap()
    this.combatEffects.setScene(this.renderer.scene)

    const ambient = new THREE.AmbientLight(0xaaccff, 0.5)
    this.renderer.scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2)
    sun.position.set(50, 100, 50)
    this.renderer.scene.add(sun)

    // Set a mid-morning sky background immediately so there's no black frame
    // before the DayNightSystem's first update runs
    this.renderer.scene.background = new THREE.Color(0x4488cc)
    this.renderer.scene.fog = new THREE.FogExp2(0x4488cc, 0.01)

    // Wire day/night system — drives sun position, intensity, sky colour, and god rays
    this.dayNight = new DayNightSystem()
    this.dayNight.init(
      sun,
      ambient,
      this.renderer.godRayPass,
      this.renderer.camera,
      this.renderer.scene,
    )

    // Enable subtle CRT scanlines for retro feel
    this.renderer.crtPass.uniforms['scanlineIntensity'].value = 0.12

    this.corruptionSystem.check(this.metaState.cleansedBiomes.length)
    const overlay = this.corruptionSystem.getCorruptionOverlay()
    if (overlay) {
      this.renderer.scene.fog = new THREE.FogExp2(overlay.fogColor, overlay.fogDensity)
      this.renderer.colorGradePass.setBiomeColorGrade(
        [overlay.tintR, overlay.tintG, overlay.tintB],
        1.1,
        0.85,
      )
    }
  }

  private startCombat(biomeType: BiomeType): void {
    this._initCombatSystems()

    // Pass mutation multiplier and biome to wave system
    this.waveSystem.mutationMultiplier = this.corruptionSystem.getMutationMultiplier()
    this.waveSystem.currentBiome = biomeType
    this.waveSystem.currentUndergroundId = null

    // Apply biome-specific fog and sky (skip if corruption already set fog)
    if (!this.corruptionSystem.getCorruptionOverlay()) {
      applyBiomeFog(this.renderer.scene, biomeType)
    }

    // Apply biome color grading to post-processing
    const grade = getBiomeColorGrade(biomeType)
    this.renderer.colorGradePass.setBiomeColorGrade(grade.tint, grade.contrast, grade.saturation)

    // Activate weather particles for this biome
    this.biomeWeather?.dispose()
    this.biomeWeather = new BiomeWeather(this.renderer.scene)
    this.biomeWeather.activate(biomeType)

    // Init audio on first expedition (requires user gesture — pointer lock click)
    this.gameAudio.stopHubMusic()
    this.gameAudio.init()
    this.gameAudio.startBiomeMusic(biomeType)

    this.expeditionManager.startExpedition(biomeType)

    // Spawn companion and apply passive if one was selected
    const companionId = this.hubScene.selectedCompanionId
    if (companionId) {
      const playerPos = this.player.getPosition()
      this.companionSystem.spawn(this.renderer.scene, companionId, playerPos)
      this.companionSystem.applyPassive(this.gameState)
    }
  }

  private showLevelUpScreen(): void {
    this.paused = true
    const options = generateLevelUpOptions(this.gameState, this.metaState, 3)

    const doSelect = (opt: ReturnType<typeof generateLevelUpOptions>[number]) => {
      applyLevelUpOption(this.gameState, opt)

      if (opt.type === 'weapon_unlock' && opt.weaponId) {
        const def = WEAPON_DEFS[opt.weaponId]
        if (def) {
          if (def.category === 'orbital') {
            this.orbitalSystem.addOrbital(def)
          } else {
            this.weaponSystem.addWeapon(def)
          }
        }
      } else if (opt.type === 'evolution' && opt.weaponId) {
        // Remove the base weapon and add the evolved weapon
        const baseDef = WEAPON_DEFS[opt.weaponId]
        if (baseDef?.category === 'orbital') {
          this.orbitalSystem.removeOrbital(opt.weaponId)
        } else {
          this.weaponSystem.removeWeapon(opt.weaponId)
        }
        const evolvedId = this.gameState.weapons[this.gameState.weapons.length - 1]
        const evolvedDef = WEAPON_DEFS[evolvedId]
        if (evolvedDef) {
          if (evolvedDef.category === 'orbital') {
            this.orbitalSystem.addOrbital(evolvedDef)
          } else {
            this.weaponSystem.addWeapon(evolvedDef)
          }
        }
      } else if (opt.type === 'fusion' && opt.weaponId && opt.weaponId2) {
        // Remove both source weapons and add the fused weapon
        for (const id of [opt.weaponId, opt.weaponId2]) {
          const def = WEAPON_DEFS[id]
          if (def?.category === 'orbital') {
            this.orbitalSystem.removeOrbital(id)
          } else {
            this.weaponSystem.removeWeapon(id)
          }
        }
        const fusedId = this.gameState.weapons[this.gameState.weapons.length - 1]
        const fusedDef = WEAPON_DEFS[fusedId]
        if (fusedDef) {
          if (fusedDef.category === 'orbital') {
            this.orbitalSystem.addOrbital(fusedDef)
          } else {
            this.weaponSystem.addWeapon(fusedDef)
          }
        }
      }

      this.levelUpScreen = null
      this.paused = false
    }

    const doReroll = () => {
      if (this.gameState.gold < 10) return
      this.gameState.gold -= 10
      const newOptions = generateLevelUpOptions(this.gameState, this.metaState, 3)
      if (this.levelUpScreen) {
        this.levelUpScreen.refresh(newOptions, this.gameState.gold)
      }
    }

    this.levelUpScreen = new LevelUpScreen(options, this.gameState.gold, doSelect, doReroll)
  }

  private loop(timestamp: number): void {
    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.05)
    this.lastTime = timestamp

    // Handle mute toggle (M key)
    if (this.input.consumeMuteToggle()) {
      this.gameAudio.toggleMute()
    }

    if (this.expeditionManager.isInHub()) {
      // Hub phase: just update label positions
      this.hubScene.updateLabels()
      this.hubScene.updateTorchFlicker(delta)
    } else if (this.expeditionManager.isInCombat() && !this.paused) {
      // Freeze frame — skip simulation but still render
      if (this.combatEffects.isFrozen()) {
        this.combatEffects.update(delta, this.renderer.camera)
        this.renderer.render(delta)
        requestAnimationFrame((t) => this.loop(t))
        return
      }

      this.player.update(delta)

      const pos = this.player.getPosition()
      this.chunkManager.update(pos.x, pos.z, timestamp / 1000)

      // Update weather particles
      this.biomeWeather?.update(delta, pos.x, pos.y, pos.z)

      this.gameState.wave = this.waveSystem.currentWave

      this.waveSystem.update(
        delta,
        this.world,
        this.enemyManager,
        pos.x,
        pos.z,
        (x, z) => this.chunkManager.sampleHeight(x, z),
      )

      // Spawn boss after all waves complete
      if (this.waveSystem.isBossTime && !this.bossSystem.active) {
        // Underground boss takes priority over surface biome boss
        const bossId = this.expeditionManager.currentUndergroundId
          ?? this.expeditionManager.currentBiome
          ?? BiomeType.Forest
        this.bossSystem.spawn(
          this.world,
          this.renderer.scene,
          pos,
          bossId,
        )
        this.gameAudio.playBossMusic()
      }

      // Update boss
      if (this.bossSystem.active) {
        this.bossSystem.update(
          delta,
          this.world,
          this.enemyManager,
          pos,
          (x, z) => this.chunkManager.sampleHeight(x, z),
          this.eventBus,
        )
      }

      updateEnemyAI(
        this.enemyManager,
        pos.x,
        pos.y,
        pos.z,
        delta,
        (x, z) => this.chunkManager.sampleHeight(x, z),
      )

      // Update companion
      if (this.companionSystem.active) {
        this.companionSystem.update(
          delta,
          pos,
          this.enemyManager,
          this.damageSystem,
          this.eventBus,
          (x, z) => this.chunkManager.sampleHeight(x, z),
        )
      }

      this.weaponSystem.update(
        delta,
        pos,
        this.renderer.camera,
        this.enemyManager,
        this.projectileSystem,
        this.damageSystem,
        this.eventBus,
      )

      // Update orbital weapons
      this.orbitalSystem.update(
        delta,
        pos,
        this.enemyManager,
        this.damageSystem,
        this.eventBus,
        (x, z) => this.chunkManager.sampleHeight(x, z),
      )

      this.projectileSystem.update(delta, this.enemyManager, this.bossSystem)

      const hits = this.projectileSystem.pendingDamage
      for (let i = hits.length - 1; i >= 0; i--) {
        const hit = hits[i]
        const enemy = this.enemyManager.enemies[hit.enemyIndex]
        if (enemy) {
          this.combatEffects.showDamageNumber(
            enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            hit.damage,
          )
        }
        const killed = this.damageSystem.applyDamage(
          this.enemyManager,
          hit.enemyIndex,
          hit.damage,
          this.eventBus,
        )
        if (!killed) {
          this.gameAudio.playHitSound()
          const enemy = this.enemyManager.enemies[hit.enemyIndex]
          if (enemy) this.combatEffects.hitFlash(enemy.mesh)
        }
      }

      // Boss projectile hits
      const bossHits = this.projectileSystem.pendingBossDamage
      for (let i = bossHits.length - 1; i >= 0; i--) {
        this.damageSystem.applyBossDamage(this.bossSystem, bossHits[i].damage)
      }

      this.damageSystem.update(delta)
      this.enemyManager.updateDeathAnimations(delta)

      const healthBefore = this.gameState.health
      const healthWrapper = { current: this.gameState.health }
      this.damageSystem.checkPlayerDamage(
        this.enemyManager.enemies,
        pos,
        healthWrapper,
        delta,
      )
      this.gameState.health = healthWrapper.current
      if (healthWrapper.current < healthBefore) {
        this.gameAudio.playPlayerHitSound()
        this.combatEffects.screenShake(this.renderer.camera, 0.2, 0.3)
        this.renderer.damagePass.setStrength(0.6, 0)
      }

      if (this.gameState.health <= 0) {
        this.gameState.health = 0
        console.log('[Game] Player DEAD')
        this.expeditionManager.endExpedition(false, this.gameState.gold)
      }

      const leveledUp = this.pickupSystem.update(delta, pos, this.gameState)
      if (leveledUp) {
        console.log(`[Game] Level up! Now level ${this.gameState.level}`)
        this.gameAudio.playLevelUpSound()
        this.showLevelUpScreen()
      }

      this.hud.update(this.gameState, this.waveSystem)

      // Update combat effects (floating numbers, particles, shake)
      this.combatEffects.update(delta, this.renderer.camera)

      // Low health vignette
      const lowHealth = this.gameState.health / this.gameState.maxHealth < 0.30
      this.combatEffects.setLowHealthVignette(lowHealth)

      // Update minimap
      if (this.minimap) {
        this.minimap.update(pos, this.enemyManager, this.companionSystem, this.bossSystem)
      }

      // Scale combat intensity by nearby enemy count
      this.gameAudio.setCombatIntensity(this.enemyManager.enemies.length / 50)

      // Decay damage flash
      const currentStrength = this.renderer.damagePass.uniforms['strength'].value as number
      if (currentStrength > 0) {
        this.renderer.damagePass.setStrength(Math.max(0, currentStrength - delta * 3), 0)
      }
    }

    // Day/night cycle — always ticking (hub + combat)
    this.dayNight.update(delta)

    this.renderer.render(delta)

    requestAnimationFrame((t) => this.loop(t))
  }
}
