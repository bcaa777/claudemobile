import * as THREE from 'three'
import { Renderer } from './Renderer'
import { InputManager } from './InputManager'
import { World } from '../world/World'
import { FirstPersonController } from '../player/FirstPersonController'
import { CollisionSystem } from '../player/CollisionSystem'
import { PlayerState } from '../player/PlayerState'
import { DayNightCycle } from '../lighting/DayNightCycle'
import { BiomeTransition } from '../systems/BiomeTransition'
import { WeatherSystem } from '../systems/WeatherSystem'
import { HazardSystem } from '../systems/HazardSystem'
import { SkyDome } from '../sky/SkyDome'
import { BiomeMap } from '../world/BiomeMap'
import { CreatureManager } from '../creatures/CreatureManager'
import { Castle } from '../castle/Castle'
import { CastleBreeze } from '../castle/CastleBreeze'
import { LandmarkManager } from '../landmarks/LandmarkManager'
import { DebugMap } from '../debug/DebugMap'
import { DebugPanel } from '../debug/DebugPanel'
import { PerfOverlay } from '../debug/PerfOverlay'
import { WORLD_CONFIG } from '../config'
import { WATER_LEVEL, CHUNK_SIZE, sampleWorldHeight, riverMask } from '../world/TerrainGenerator'
import { GrandStaircase } from '../landmarks/GrandStaircase'
import { InfernalStaircase } from '../landmarks/InfernalStaircase'
import { BiomeType } from '../biomes/types'
import { NPCManager } from '../npcs/NPCManager'
import { JournalSystem } from '../journal/JournalSystem'
import { JournalOverlay } from '../journal/JournalOverlay'
import { LoreStoneManager } from '../journal/LoreStone'
import { AudioSystem } from '../audio/AudioSystem'
import { CampfireSystem } from '../systems/CampfireSystem'
import { CompanionSystem } from '../player/CompanionSystem'
import { RuneSystem } from '../challenges/RuneSystem'
import { WeatherType } from '../systems/WeatherSystem'
import { GrappleSystem } from '../player/GrappleSystem'
import { AtmosphereParticles } from '../systems/AtmosphereParticles'
import { GroundFog } from '../systems/GroundFog'
import { WorldState } from '../systems/WorldState'
import { RitualSystem } from '../systems/RitualSystem'
import { NarrativeProgression } from '../lore/NarrativeProgression'
import { RoadNetwork } from '../traversal/RoadNetwork'
import { ZiplineRide } from '../traversal/ZiplineRide'
import { VineSwing } from '../traversal/VineSwing'
import { HUD } from '../ui/HUD'
import { OnboardingSystem } from '../systems/OnboardingSystem'

export class Engine {
  private renderer: Renderer
  private input: InputManager
  private world: World
  private controller: FirstPersonController
  private collision: CollisionSystem
  private playerState: PlayerState
  private dayNight: DayNightCycle
  private biomeTransition: BiomeTransition
  private weatherSystem: WeatherSystem
  private hazardSystem: HazardSystem
  private skyDome: SkyDome
  private biomeMap: BiomeMap
  private creatureManager: CreatureManager
  private castle: Castle
  private castleBreeze: CastleBreeze
  private landmarkManager: LandmarkManager
  private grandStaircase: GrandStaircase
  private infernalStaircase: InfernalStaircase
  private npcManager: NPCManager
  private debugMap: DebugMap
  private debugPanel: DebugPanel
  private perfOverlay: PerfOverlay
  private flashlight: THREE.SpotLight
  private monumentObjects: { pos: THREE.Vector3; objects: THREE.Object3D[] }[] = []

  // New engagement systems
  private journalSystem: JournalSystem
  private journalOverlay: JournalOverlay
  private loreStones: LoreStoneManager
  private audioSystem: AudioSystem
  private campfireSystem: CampfireSystem
  private companionSystem: CompanionSystem
  private runeSystem: RuneSystem
  private grapple: GrappleSystem
  private atmosphereParticles: AtmosphereParticles
  private groundFog: GroundFog
  private grappleCountThisFrame = 0
  private roadNetwork: RoadNetwork
  private ziplineRide: ZiplineRide
  private vineSwing: VineSwing
  private worldState: WorldState
  private ritualSystem: RitualSystem
  private narrativeProgression: NarrativeProgression
  private narrativeTimer = 0
  private hud: HUD
  private onboarding: OnboardingSystem
  private npcDialogueSeen = false

  private lastTime = 0
  private running = false
  private underwaterStrength = 0
  private elapsedTime = 0

  // Reusable Vector3s to avoid per-frame allocations
  private _fwd = new THREE.Vector3()
  private _lookDir = new THREE.Vector3()
  private _sunDir = new THREE.Vector3()
  private _sunCol = new THREE.Color()
  private _sunWorld = new THREE.Vector3()

  private biomeHud: HTMLElement | null
  private timeHud: HTMLElement | null
  private crystalHud: HTMLElement | null
  private modeHud: HTMLElement | null
  private weatherHud: HTMLElement | null
  private healthBar: HTMLElement | null
  private healthBarContainer: HTMLElement | null
  private artefactHud: HTMLElement | null
  private crystalsCollected = 0

  // Castle position for respawn
  private castlePos = new THREE.Vector3()

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container)
    this.input = new InputManager()

    this.biomeMap = new BiomeMap(WORLD_CONFIG.seed)
    this.world = new World(this.renderer.scene, this.biomeMap)
    this.creatureManager = new CreatureManager(WORLD_CONFIG.seed, this.renderer.scene)
    this.world.setCreatureManager(this.creatureManager)
    this.controller = new FirstPersonController(this.renderer.camera, this.input)
    this.collision = new CollisionSystem(this.world)
    this.playerState = new PlayerState()
    this.dayNight = new DayNightCycle(this.renderer.scene)
    this.skyDome = new SkyDome(this.renderer.scene)
    this.biomeTransition = new BiomeTransition(
      this.biomeMap,
      this.renderer.scene,
      this.renderer.colorGradePass,
      this.skyDome
    )
    this.weatherSystem = new WeatherSystem(this.renderer.scene)
    this.hazardSystem = new HazardSystem()

    let cc0 = this.renderer.scene.children.length
    this.castle = new Castle(WORLD_CONFIG.seed, this.renderer.scene)
    this.world.setCastleWalkables(this.castle.walkables)
    this.castleBreeze = new CastleBreeze(this.castle.position, this.renderer.scene)
    this.castlePos.copy(this.castle.position)
    {
      const added: THREE.Object3D[] = []
      for (let i = cc0; i < this.renderer.scene.children.length; i++) added.push(this.renderer.scene.children[i])
      this.monumentObjects.push({ pos: this.castle.position, objects: added })
    }

    // Player respawn at castle on death
    this.playerState.onDeath(() => {
      this.renderer.camera.position.set(this.castlePos.x, this.castlePos.y + 5, this.castlePos.z)
      this.controller.verticalVelocity = 0
      this.controller.isGrounded = false
    })

    // Grand Staircase — base at closest Forest seed
    const stairSeed = this.biomeMap.getClosestSeedOf(BiomeType.Forest, 700)
    const stairTerrainY = sampleWorldHeight(stairSeed.x, stairSeed.z, this.biomeMap)
    const stairPos = new THREE.Vector3(stairSeed.x, stairTerrainY, stairSeed.z)
    cc0 = this.renderer.scene.children.length
    this.grandStaircase = new GrandStaircase(stairPos, this.renderer.scene, WORLD_CONFIG.seed)
    this.world.addMonumentWalkables(this.grandStaircase.walkables)
    {
      const added: THREE.Object3D[] = []
      for (let i = cc0; i < this.renderer.scene.children.length; i++) added.push(this.renderer.scene.children[i])
      this.monumentObjects.push({ pos: stairPos, objects: added })
    }

    // Heaven circle centered 150 units from staircase base
    this.biomeMap.setHeavenCenter(stairSeed.x + 150, stairSeed.z)

    // Infernal Staircase — at closest Volcanic seed
    const hellSeed = this.biomeMap.getClosestSeedOf(BiomeType.Volcanic, 700)
    const hellTerrainY = sampleWorldHeight(hellSeed.x, hellSeed.z, this.biomeMap)
    const hellStairPos = new THREE.Vector3(hellSeed.x, hellTerrainY, hellSeed.z)
    cc0 = this.renderer.scene.children.length
    this.infernalStaircase = new InfernalStaircase(hellStairPos, this.renderer.scene, WORLD_CONFIG.seed)
    this.world.addMonumentWalkables(this.infernalStaircase.walkables)
    {
      const added: THREE.Object3D[] = []
      for (let i = cc0; i < this.renderer.scene.children.length; i++) added.push(this.renderer.scene.children[i])
      this.monumentObjects.push({ pos: hellStairPos, objects: added })
    }
    // Hell circle 150 units from staircase
    this.biomeMap.setHellCenter(hellSeed.x + 150, hellSeed.z)

    this.landmarkManager = new LandmarkManager(this.biomeMap, this.renderer.scene, WORLD_CONFIG.seed)
    this.world.addMonumentWalkables(this.landmarkManager.allWalkables)

    // Road network — landmark-to-landmark paths, indexed by chunk
    this.roadNetwork = new RoadNetwork(this.landmarkManager.positions, this.biomeMap, WORLD_CONFIG.seed)
    this.world.setRoadNetwork(this.roadNetwork)
    console.log(`[Traversal] RoadNetwork: ${this.roadNetwork.edges.length} edges, ${this.roadNetwork.edges.reduce((s, e) => s + e.waypoints.length, 0)} waypoints`)

    this.npcManager = new NPCManager(this.biomeMap, this.renderer.scene, this.landmarkManager.positions)

    // --- Engagement systems ---
    this.journalSystem = new JournalSystem()
    this.journalOverlay = new JournalOverlay(this.journalSystem.state)
    this.loreStones = new LoreStoneManager(this.renderer.scene, this.biomeMap)
    this.audioSystem = new AudioSystem()
    this.campfireSystem = new CampfireSystem(this.renderer.scene, (pos) => {
      this.renderer.camera.position.copy(pos)
      this.controller.verticalVelocity = 0
    })
    this.companionSystem = new CompanionSystem()
    this.grapple = new GrappleSystem(this.renderer.scene)
    this.atmosphereParticles = new AtmosphereParticles(this.renderer.scene)
    this.groundFog = new GroundFog(this.renderer.scene)
    this.ziplineRide = new ZiplineRide(this.renderer.scene)
    this.vineSwing = new VineSwing(this.renderer.scene)
    this.runeSystem = new RuneSystem(this.renderer.scene, this.biomeMap, this.landmarkManager.positions)

    // --- WorldState: central shared state ---
    this.worldState = new WorldState()
    this.worldState.loadFromStorage()

    // Register landmark positions as resonance sites
    for (const [biome, pos] of this.landmarkManager.positions) {
      this.worldState.registerResonanceSite(biome, pos)
    }

    // Ritual system
    this.ritualSystem = new RitualSystem()

    // Narrative progression — glue between observations and story
    this.narrativeProgression = new NarrativeProgression()

    // Wire WorldState into systems that need it
    this.weatherSystem.setWorldState(this.worldState)
    this.biomeTransition.setWorldState(this.worldState)

    // Wire data into the journal overlay
    this.journalOverlay.setData({
      journalSystem: this.journalSystem,
      worldState: this.worldState,
      narrative: this.narrativeProgression,
      seeds: this.biomeMap.getSeeds(),
      audioCtx: this.audioSystem.getContext(),
      masterGain: this.audioSystem.getMasterGain(),
    })

    this.debugMap = new DebugMap(this.castle.position, this.landmarkManager.positions, stairPos, hellStairPos)
    this.debugMap.setRoadEdges(this.roadNetwork.edges)

    // Flashlight — SpotLight attached to camera, auto-enables at night
    this.flashlight = new THREE.SpotLight(0xffe8cc, 0, 40, Math.PI / 5, 0.3, 1.5)
    this.renderer.scene.add(this.flashlight)
    this.renderer.scene.add(this.flashlight.target)

    this.perfOverlay = new PerfOverlay(this.renderer.renderer)

    // Minimal HUD overlay (compass, companion indicator, health, prompts)
    this.hud = new HUD()

    // Onboarding system — subtle environmental guidance for first 30 minutes
    this.onboarding = new OnboardingSystem(this.castle.position)

    this.debugPanel = new DebugPanel(
      this.dayNight,
      this.flashlight,
      this.renderer.colorGradePass,
      this.renderer.crtPass,
      this.renderer.retroPass,
      this.perfOverlay,
      this.renderer.godRayPass,
      this.renderer.heatDistortionPass,
      this.atmosphereParticles,
      this.groundFog,
      this.audioSystem,
      this.worldState,
      this.ritualSystem,
      this.narrativeProgression,
      this.onboarding,
    )

    this.biomeHud = document.getElementById('biome-hud')
    this.timeHud = document.getElementById('time-hud')
    this.crystalHud = document.getElementById('crystal-hud')
    this.modeHud = document.getElementById('mode-hud')
    this.weatherHud = document.getElementById('weather-hud')
    this.healthBar = document.getElementById('health-bar')
    this.healthBarContainer = document.getElementById('health-bar-container')
    this.artefactHud = document.getElementById('artefact-hud')

    this.setupStartScreen()
  }

  private setupStartScreen() {
    const overlay = document.getElementById('overlay')
    if (!overlay) return

    overlay.addEventListener('click', () => {
      this.renderer.renderer.domElement.requestPointerLock()
      overlay.classList.add('hidden')
      setTimeout(() => overlay.remove(), 600)
      this.audioSystem.init()
      // Create resonance site visuals now that audio is available
      this.landmarkManager.createResonanceSites(
        this.renderer.scene,
        this.worldState.activatedSites,
        this.audioSystem.getContext(),
        this.audioSystem.getMasterGain(),
      )
      // Wire resonance site visuals into ritual system for activation calls
      this.ritualSystem.setResonanceSites(this.landmarkManager.resonanceSites)
      if (!this.running) this.start()
    })

    // Re-acquire pointer lock only when clicking the game canvas (not debug panel)
    document.addEventListener('click', (e) => {
      if (document.pointerLockElement === null && this.running &&
          e.target === this.renderer.renderer.domElement) {
        this.renderer.renderer.domElement.requestPointerLock()
      }
    })
  }

  start() {
    this.running = true
    requestAnimationFrame((t) => this.loop(t))
  }

  private loop(time: number) {
    if (!this.running) return
    const delta = Math.min((time - this.lastTime) / 1000, 0.05)
    this.lastTime = time
    this.elapsedTime += delta

    // WorldState: recalculate derived state at start of frame
    this.worldState.update()

    // Hell shrinkage — each activated site reduces Hell radius by 15 (min 135)
    this.biomeMap.setHellRadius(300 - this.worldState.activatedSites.size * 15)

    // Ritual cinematic lock — disable input during 3-second activation moment
    this.controller.inputLocked = this.worldState.ritualCinematicActive

    this.controller.update(delta)
    this.collision.update(this.renderer.camera, this.controller, delta)
    this.world.update(this.renderer.camera.position)
    this.dayNight.update(delta)

    // Write time of day to WorldState
    this.worldState.timeOfDay = this.dayNight.getTime()
    this.worldState.isDawn = this.worldState.timeOfDay >= 0.23 && this.worldState.timeOfDay <= 0.27
    this.worldState.isDusk = this.worldState.timeOfDay >= 0.73 && this.worldState.timeOfDay <= 0.77

    // Update sky dome with sun position and day/night factor
    const t = this.dayNight.getTime()
    const sunAngle = t * Math.PI * 2
    const dayFactor = Math.max(0, Math.min(1, Math.sin(sunAngle) * 2.0 + 0.5))
    this.dayNight.getSunDirection(this._sunDir)
    this.dayNight.getSunColor(this._sunCol)
    this.skyDome.update(this.renderer.camera, t, this._sunDir, this._sunCol, delta)
    this.biomeTransition.setDayFactor(dayFactor)
    this.biomeTransition.update(this.renderer.camera.position, delta)

    const camPos = this.renderer.camera.position
    const currentBiome = this.biomeTransition.getCurrentBiome()

    // Write player position and biome to WorldState
    this.worldState.playerPosition.copy(camPos)
    this.worldState.playerBiome = currentBiome

    // Weather system — particles + weather state (before fog so fog can read weather)
    this.weatherSystem.update(delta, currentBiome, camPos)

    // Write weather state to WorldState
    this.worldState.currentWeather = this.weatherSystem.getCurrentWeatherName() || 'clear'
    this.worldState.weatherSeverity = this.weatherSystem.getFogCompositeParams().intensity

    // Compose weather fog with biome fog.
    // BiomeTransition sets scene.fog each frame; we then layer weather on top.
    // Rules: use the closer/denser of the two far distances; blend fog color.
    const fog = this.renderer.scene.fog as THREE.Fog | null
    if (fog) {
      const weatherFog = this.weatherSystem.getFogCompositeParams()
      if (weatherFog.intensity > 0 && weatherFog.farOverride > 0) {
        // Use the closer distance (denser fog wins)
        const targetFar = Math.min(fog.far, weatherFog.farOverride)
        // Smoothly approach the target (never slam)
        fog.far += (targetFar - fog.far) * Math.min(1, delta * 0.5)

        // Blend weather fog color into biome fog color proportional to intensity
        // Cap color blend at 0.5 so biome color always has visible influence
        const colorBlend = weatherFog.intensity * 0.5
        fog.color.lerp(weatherFog.color, colorBlend * Math.min(1, delta * 2))
      }
    }

    // Ground fog — low-lying biome-specific fog layer (after weather fog composition)
    this.groundFog.update(
      delta, camPos,
      this.biomeTransition.getCurrentVisual(),
      t,
    )

    // Atmosphere particles — ambient per-biome particles (after biome transition + weather, before rendering)
    this.atmosphereParticles.update(
      delta, camPos, this.renderer.camera,
      this.biomeTransition.getCurrentVisual()
    )

    // Weather speed effects (blizzard slows movement)
    this.controller.speedMultiplier = this.weatherSystem.getSpeedMultiplier()

    // Sandstorm push — gentle
    const sandPush = this.weatherSystem.getSandstormPush()
    if (sandPush > 0) {
      camPos.x += sandPush * delta * 0.3
    }

    // Hazard system
    const terrainH = this.world.getHeightAt(camPos.x, camPos.z)
    this.hazardSystem.update(
      delta, camPos.x, camPos.y, camPos.z,
      currentBiome, dayFactor, this.playerState, this.elapsedTime,
      terrainH, this.worldState
    )

    // Apply ice friction
    const iceFriction = this.hazardSystem.getIceFriction(currentBiome)
    if (iceFriction < 1) {
      this.controller.frictionMultiplier = iceFriction
    }

    // Apply hazard speed multiplier
    this.controller.speedMultiplier *= this.playerState.speedMultiplier

    // Water current push — if in water near a river
    if (camPos.y < WATER_LEVEL + 0.5) {
      const rm = riverMask(camPos.x, camPos.z)
      if (rm < 0.5) {
        const rmX = riverMask(camPos.x + 1, camPos.z)
        const rmZ = riverMask(camPos.x, camPos.z + 1)
        const gx = rmX - rm
        const gz = rmZ - rm
        const len = Math.sqrt(gx * gx + gz * gz) + 0.001
        const pushStr = 2.0 * (1 - rm * 2)
        camPos.x += (-gz / len) * pushStr * delta
        camPos.z += (gx / len) * pushStr * delta
      }
      // Slow player in water
      this.controller.speedMultiplier *= 0.6
    }

    // Player state update (regen, death, etc.)
    this.playerState.update(delta, this.elapsedTime)

    // NPC system — update before creatures, lock movement during dialogue
    this.npcManager.update(delta, camPos, this.elapsedTime, this.input, this.worldState.timeOfDay, this.worldState, this.companionSystem.companionSpecies, this.loreStones.collectedCount)
    if (this.npcManager.isDialogueActive()) {
      this.controller.speedMultiplier = 0
    }

    // NPC first-meeting moment: warm chime + floating name label (2 seconds)
    if (this.npcManager.pendingFirstMeetingName) {
      this.audioSystem.chime?.playNPCChime()
      this.showFloatingText(this.npcManager.pendingFirstMeetingName, 2000, 'npc')
    }
    this.debugMap.setNPCMarkers(this.npcManager.getMapMarkers())

    // Feed live data to journal overlay (campfire + NPC positions)
    {
      const cfPositions = this.campfireSystem.positions.map(p => ({ x: p.x, z: p.z }))
      const npcMks = this.npcManager.getMapMarkers().map(m => ({
        x: m.pos.x,
        z: m.pos.z,
        type: 'npc' as const,
        label: m.label,
      }))
      this.journalOverlay.updateLiveData(cfPositions, npcMks)
    }

    // Update campfire positions for creature awareness
    this.creatureManager.campfirePositions = this.campfireSystem.positions

    // Pass WorldState to creature manager for weather response
    this.creatureManager.worldState = this.worldState

    this.creatureManager.update(delta, camPos, this.world, this.dayNight.getTime())

    // --- Engagement system updates ---

    // Input consumption for new systems
    if (this.input.consumeMuteToggle()) {
      this.audioSystem.toggleMute()
    }

    // Campfire placement
    if (this.input.consumeCampfire()) {
      const biomeName = this.biomeTransition.getCurrentBiomeName()
      if (this.campfireSystem.placeCampfire(camPos, biomeName, this.controller.isGrounded)) {
        this.audioSystem.chime?.playCampfire()
      }
    }

    // Fast travel
    if (this.input.consumeFastTravel()) {
      if (this.campfireSystem.isFastTravelActive()) {
        this.campfireSystem.closeFastTravel()
      } else {
        this.campfireSystem.openFastTravel(camPos)
      }
    }

    // Campfire healing
    const campfireHeal = this.campfireSystem.update(delta, camPos)
    if (campfireHeal > 0) this.playerState.heal(campfireHeal)

    // Lock movement during fast travel / journal
    if (this.campfireSystem.isFastTravelActive() || this.journalOverlay.isOpen()) {
      this.controller.speedMultiplier = 0
    }

    // Zipline/Vine ride updates
    if (this.ziplineRide.isRiding) {
      const newPos = this.ziplineRide.update(delta, camPos, this.input.consumeGrapple())
      if (newPos) {
        camPos.copy(newPos)
        this.controller.verticalVelocity = 0
      }
    } else if (this.vineSwing.isSwinging) {
      const lateral = (this.input.isDown('KeyA') ? -1 : 0) + (this.input.isDown('KeyD') ? 1 : 0)
      const result = this.vineSwing.update(delta, camPos, lateral, this.input.consumeGrapple())
      if (result) {
        camPos.copy(result.pos)
        this.controller.verticalVelocity = 0
        if (result.velocity.lengthSq() > 0) {
          // Launched from vine — apply momentum
          this.controller.verticalVelocity = result.velocity.y
        }
      }
    } else {
      // Grapple system — check for zipline/vine anchors first
      if (this.input.consumeGrapple()) {
        if (this.grapple.isGrappling) {
          this.grapple.release()
        } else {
          // Try to find a nearby traversal anchor (zipline or vine)
          let anchorFound = false
          const raycaster = new THREE.Raycaster()
          raycaster.far = 8
          raycaster.setFromCamera(new THREE.Vector2(0, 0), this.renderer.camera)

          for (const anchor of this.world.traversalAnchors) {
            const anchorWorldPos = anchor.startPos
            const dist = camPos.distanceTo(anchorWorldPos)
            if (dist > 10) continue

            if (anchor.type === 'zipline' && anchor.cablePoints) {
              this.ziplineRide.start(anchor.cablePoints)
              anchorFound = true
              break
            } else if (anchor.type === 'vine' && anchor.vineTop && anchor.ropeLength) {
              this.vineSwing.start(anchor.vineTop, anchor.ropeLength)
              anchorFound = true
              break
            }
          }

          if (!anchorFound) {
            if (this.grapple.tryFire(this.renderer.camera, this.renderer.scene)) {
              this.grappleCountThisFrame++
            }
          }
        }
      }
      const grappleVel = this.grapple.update(delta, camPos, this.controller['velocity'] as THREE.Vector3 || new THREE.Vector3())
      if (grappleVel) {
        // Grapple overrides gravity
        this.controller.verticalVelocity = 0
      }
    }

    // Companion system
    this._fwd.set(0, 0, -1).applyQuaternion(this.renderer.camera.quaternion)
    const playerSpeed = this.controller['velocity']
      ? (this.controller['velocity'] as THREE.Vector3).length()
      : 0
    this.companionSystem.update(
      delta, camPos, playerSpeed,
      this.input.crouchHeld,
      this.creatureManager.creatures,
      this._fwd,
      this.worldState,
      this.loreStones.getAllStones(),
      this.landmarkManager.allCrystals,
    )

    // Apply companion bonuses
    this.controller.speedMultiplier *= this.companionSystem.getSpeedMultiplier()
    if (this.companionSystem.getRegenBonus() > 0) {
      this.playerState.heal(this.companionSystem.getRegenBonus() * delta)
    }

    // Lore stones — manage chunks
    const playerCX = Math.floor(camPos.x / CHUNK_SIZE)
    const playerCZ = Math.floor(camPos.z / CHUNK_SIZE)
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.loreStones.ensureChunk(playerCX + dx, playerCZ + dz)
      }
    }
    this.loreStones.foxBonusActive = this.companionSystem.hasLoreGlow()
    const lorePickup = this.loreStones.update(camPos, this.worldState.timeOfDay)
    if (lorePickup) {
      this.journalSystem.discoverLore(lorePickup.loreIndex)
      // Biome-keyed root frequency: biome index × 40 Hz above A3 (220 Hz)
      const biomeRootHz = 220 + (currentBiome as number) * 40
      this.audioSystem.chime?.playLoreChime(biomeRootHz)
      // Floating lore text — brief 3-second overlay at screen centre
      this.showFloatingText(lorePickup.text, 3000, 'lore')
    }

    // Ritual system — observation tracking and activation detection
    // Update lore count per biome in ritualObservations from collected lore stones
    this.updateRitualLoreCounts()
    this.ritualSystem.update(delta, this.worldState, this.creatureManager.creatures, camPos)

    // Narrative progression — update every 2 seconds to avoid overhead
    this.narrativeTimer += delta
    if (this.narrativeTimer >= 2.0) {
      this.narrativeTimer = 0
      this.narrativeProgression.updateFromWorldState(this.worldState)
      this.journalSystem.consumeNarrativeUpdates(this.narrativeProgression)
    }

    // Journal system
    const weatherType = this.weatherSystem.currentWeather as WeatherType
    this.journalSystem.update(
      delta, camPos, currentBiome, weatherType,
      this.creatureManager.creatures,
      this.landmarkManager.positions,
    )

    // Rune system
    const runeCtx = {
      playerPos: camPos,
      biome: currentBiome,
      weather: weatherType,
      dayTime: t,
      isFlying: this.controller.isFlying,
      isGrounded: this.controller.isGrounded,
      creatures: this.creatureManager.creatures,
      landmarkPositions: this.landmarkManager.positions,
      grappleCount: this.grappleCountThisFrame,
      isCrouching: this.input.crouchHeld,
    }
    this.grappleCountThisFrame = 0
    // Only pass interact to rune system if NPC dialogue isn't active
    const runeInteract = !this.npcManager.isDialogueActive() && this.input.consumeInteract()
    const runeComplete = this.runeSystem.update(delta, runeCtx, runeInteract)
    if (runeComplete) {
      this.audioSystem.chime?.playRuneComplete()
      this.journalSystem.discoverRune(currentBiome)
    }

    // Audio system
    this.audioSystem.update(
      delta, currentBiome, weatherType,
      camPos.y, playerSpeed,
      this.controller.isGrounded,
      camPos, this.creatureManager.creatures,
      this.renderer.camera,
      this.controller.verticalVelocity,
      this.landmarkManager.positions,
      this.runeSystem.getMapMarkers().map(m => m.pos),
      this.worldState,
    )

    // Debug panel live displays (only updates when panel is open)
    this.debugPanel.refreshLiveDisplays()

    // Debug map markers
    this.debugMap.setCampfireMarkers(this.campfireSystem.getMapMarkers())
    this.debugMap.setRuneMarkers(this.runeSystem.getMapMarkers())

    // Knockback from predator attacks — also damage player
    const knockback = this.creatureManager.pendingKnockback
    if (knockback > 0) {
      this.creatureManager.pendingKnockback = 0
      this.renderer.camera.getWorldDirection(this._fwd)
      camPos.x -= this._fwd.x * 2 * knockback
      camPos.z -= this._fwd.z * 2 * knockback
      this.playerState.takeDamage(5 * knockback, this.elapsedTime)
    }

    // Explodable structures + camera shake
    this.world.tickExplodables(camPos, delta)
    const rumble = this.world.getRumbleStrength(camPos)
    if (rumble > 0) {
      camPos.x += (Math.random() - 0.5) * rumble * 0.06
      camPos.z += (Math.random() - 0.5) * rumble * 0.06
    }

    // Underwater effect
    const targetStrength = camPos.y < WATER_LEVEL ? 1.0 : 0.0
    this.underwaterStrength += (targetStrength - this.underwaterStrength) * Math.min(1, delta * 8)
    this.renderer.underwaterPass.update(delta, this.underwaterStrength)

    // Damage pass
    const deathFade = this.playerState.isDead ? 1.0 : 0
    this.renderer.damagePass.setStrength(this.playerState.damageFlashStrength, deathFade)

    // Onboarding system — subtle environmental guidance
    if (this.npcManager.isDialogueActive()) this.npcDialogueSeen = true
    this.onboarding.update(
      delta, camPos, this.worldState,
      this.weatherSystem.currentWeather as WeatherType,
      this.companionSystem.companionId !== null,
      this.loreStones.collectedCount,
      this.npcDialogueSeen,
    )
    // Apply onboarding time multiplier to day/night cycle
    this.dayNight.timeMultiplier = this.onboarding.flags.timeMultiplier

    // Minimal HUD update (compass, companion, health, interaction, activation message)
    {
      // Camera yaw — extract from camera quaternion
      const camDir = this._fwd.set(0, 0, -1).applyQuaternion(this.renderer.camera.quaternion)
      const cameraYaw = Math.atan2(camDir.x, camDir.z)

      // Check if near an interactable (NPC handles its own prompt; we skip if dialogue active)
      const nearInteractable = false // NPC system manages #interact-prompt directly

      this.hud.update({
        playerHealth: this.playerState.health,
        maxHealth: this.playerState.maxHealth,
        cameraYaw,
        companionData: {
          bonded: this.companionSystem.companionId !== null,
          species: this.companionSystem.companionSpecies,
          mood: this.companionSystem.mood,
          name: this.companionSystem.companionName,
        },
        nearInteractable,
        playerPos: camPos,
        resonanceSites: this.worldState.resonanceSites,
        activationMessage: this.worldState.activationMessage,
        time: this.elapsedTime,
        showCompass: this.onboarding.flags.showCompass,
        journalHintTimer: this.onboarding.flags.journalHintTimer,
        compassPullBoost: this.onboarding.flags.compassPullBoost,
      })
    }

    // Update HUD
    if (this.biomeHud) {
      this.biomeHud.textContent = this.biomeTransition.getCurrentBiomeName()
    }
    if (this.timeHud) {
      this.timeHud.textContent = this.dayNight.getTimeString()
    }
    if (this.modeHud) {
      this.modeHud.textContent = this.controller.isFlying ? '~ FLYING ~' : ''
    }
    if (this.weatherHud) {
      this.weatherHud.textContent = this.weatherSystem.getCurrentWeatherName()
    }

    // Health bar
    if (this.healthBar && this.healthBarContainer) {
      const hp = this.playerState.health
      this.healthBar.style.width = `${hp}%`
      if (hp < 100) {
        this.healthBarContainer.classList.add('visible')
      } else {
        this.healthBarContainer.classList.remove('visible')
      }
      if (hp < 30) {
        this.healthBar.classList.add('low')
      } else {
        this.healthBar.classList.remove('low')
      }
    }

    // Flashlight — auto-enables at night (18:00–07:00), points where camera looks
    const isNight = t > 18 / 24 || t < 7 / 24
    const targetIntensity = isNight ? 4.0 : 0.0
    this.flashlight.intensity += (targetIntensity - this.flashlight.intensity) * Math.min(1, delta * 2)
    this.flashlight.position.copy(camPos)
    this._lookDir.set(0, 0, -1).applyQuaternion(this.renderer.camera.quaternion)
    this.flashlight.target.position.copy(camPos).addScaledVector(this._lookDir, 20)
    this.flashlight.target.updateMatrixWorld()

    // Crystal pickup detection
    const totalCrystals = this.landmarkManager.allCrystals.length
    for (const crystal of this.landmarkManager.allCrystals) {
      if (crystal.tryCollect(camPos)) {
        this.crystalsCollected++
        if (this.crystalHud) {
          this.crystalHud.textContent = `◆ ${this.crystalsCollected} / ${totalCrystals}`
          this.crystalHud.classList.add('flash')
          setTimeout(() => this.crystalHud?.classList.remove('flash'), 400)
        }
      }
    }

    this.castle.update(delta, this.lastTime / 1000)
    this.grandStaircase.update(delta, this.lastTime / 1000)
    this.infernalStaircase.update(delta, this.lastTime / 1000)

    // Distance-cull monuments to match terrain loading radius
    const mCullDist = WORLD_CONFIG.viewRadius * CHUNK_SIZE
    const mCullDistSq = mCullDist * mCullDist
    for (const entry of this.monumentObjects) {
      const dx = entry.pos.x - camPos.x
      const dz = entry.pos.z - camPos.z
      const vis = dx * dx + dz * dz < mCullDistSq
      for (const obj of entry.objects) obj.visible = vis
    }
    this.landmarkManager.update(delta, this.lastTime / 1000, camPos)
    this.castleBreeze.update(delta, camPos)
    this.debugMap.update(camPos, this.controller.heading)

    // God ray pass — project sun to screen space, fade at night
    {
      const grOverride = this.renderer.godRayPass.intensityOverride
      const godRayBiomeIntensity = this.biomeTransition.getCurrentVisual().godRayIntensity
      // Thin times (dawn/dusk): god rays intensify by 50%
      const thinTimeMult = (this.worldState.isDawn || this.worldState.isDusk) ? 1.5 : 1.0
      const godRayIntensity = grOverride >= 0 ? grOverride : godRayBiomeIntensity * thinTimeMult * dayFactor
      this.renderer.godRayPass.setIntensity(godRayIntensity)
      if (godRayIntensity > 0.001) {
        // Place sun far away along sun direction, project to NDC then to 0–1 UV
        this.dayNight.getSunDirection(this._sunDir)
        this._sunWorld.copy(this.renderer.camera.position).addScaledVector(this._sunDir, 1000)
        this._sunWorld.project(this.renderer.camera)
        // NDC is -1..1; convert to 0..1 UV (Y is flipped between NDC and UV)
        const sx = (this._sunWorld.x + 1) * 0.5
        const sy = (-this._sunWorld.y + 1) * 0.5
        this.renderer.godRayPass.setSunPosition(sx, sy)
      }
    }

    // Heat distortion pass — shimmer in Desert and Volcanic biomes, no effect at night
    {
      const hdOverride = this.renderer.heatDistortionPass.intensityOverride
      const heatIntensity = hdOverride >= 0 ? hdOverride : this.biomeTransition.getCurrentVisual().heatDistortion * dayFactor
      this.renderer.heatDistortionPass.setIntensity(heatIntensity)
      this.renderer.heatDistortionPass.setTime(this.elapsedTime)
    }

    this.renderer.render(delta)
    this.perfOverlay.update(this.renderer.renderer)
    requestAnimationFrame((t) => this.loop(t))
  }

  /**
   * Count collected lore stones per biome and write into worldState.ritualObservations.
   * Uses biomeMap to determine which biome each stone belongs to.
   */
  private updateRitualLoreCounts(): void {
    // Reset counts
    for (const obs of this.worldState.ritualObservations.values()) {
      obs.loreCount = 0
    }

    // Count collected stones by biome
    for (const stone of this.loreStones.getAllStones()) {
      if (!stone.collected) continue
      const biome = this.biomeMap.getBiomeAt(stone.position.x, stone.position.z)
      let obs = this.worldState.ritualObservations.get(biome)
      if (!obs) {
        obs = { creatureBehavior: false, weatherReveal: false, loreCount: 0 }
        this.worldState.ritualObservations.set(biome, obs)
      }
      obs.loreCount++
    }
  }

  /**
   * Show a brief floating text overlay at screen centre.
   * @param text     The text to display.
   * @param duration Milliseconds before fade-out begins.
   * @param variant  'lore' (italic, stone-blue) or 'npc' (bold, warm-gold).
   */
  private showFloatingText(text: string, duration: number, variant: 'lore' | 'npc') {
    const div = document.createElement('div')
    div.textContent = text

    const isLore = variant === 'lore'
    Object.assign(div.style, {
      position: 'fixed',
      left: '50%',
      top: isLore ? '40%' : '35%',
      transform: 'translateX(-50%)',
      padding: '8px 18px',
      borderRadius: '6px',
      background: isLore ? 'rgba(20,30,60,0.72)' : 'rgba(40,25,5,0.72)',
      color: isLore ? '#aaccff' : '#ffe8a0',
      fontFamily: 'Georgia, serif',
      fontSize: isLore ? '15px' : '17px',
      fontStyle: isLore ? 'italic' : 'normal',
      fontWeight: isLore ? 'normal' : 'bold',
      letterSpacing: '0.03em',
      textAlign: 'center',
      maxWidth: '460px',
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '0',
      transition: 'opacity 0.4s ease',
    })

    document.body.appendChild(div)

    // Fade in
    requestAnimationFrame(() => {
      div.style.opacity = '1'
    })

    // Fade out and remove
    setTimeout(() => {
      div.style.transition = 'opacity 0.6s ease'
      div.style.opacity = '0'
      setTimeout(() => div.remove(), 650)
    }, duration)
  }
}
