import * as THREE from 'three'
import { Renderer } from './Renderer'
import { InputManager } from './InputManager'
import { World } from '../world/World'
import { FirstPersonController } from '../player/FirstPersonController'
import { CollisionSystem } from '../player/CollisionSystem'
import { DayNightCycle } from '../lighting/DayNightCycle'
import { BiomeTransition } from '../systems/BiomeTransition'
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
import { WATER_LEVEL, CHUNK_SIZE, sampleWorldHeight } from '../world/TerrainGenerator'
import { GrandStaircase } from '../landmarks/GrandStaircase'
import { InfernalStaircase } from '../landmarks/InfernalStaircase'
import { BiomeType } from '../biomes/types'

export class Engine {
  private renderer: Renderer
  private input: InputManager
  private world: World
  private controller: FirstPersonController
  private collision: CollisionSystem
  private dayNight: DayNightCycle
  private biomeTransition: BiomeTransition
  private skyDome: SkyDome
  private biomeMap: BiomeMap
  private creatureManager: CreatureManager
  private castle: Castle
  private castleBreeze: CastleBreeze
  private landmarkManager: LandmarkManager
  private grandStaircase: GrandStaircase
  private infernalStaircase: InfernalStaircase
  private debugMap: DebugMap
  private debugPanel: DebugPanel
  private perfOverlay: PerfOverlay
  private flashlight: THREE.SpotLight
  private monumentObjects: { pos: THREE.Vector3; objects: THREE.Object3D[] }[] = []

  private lastTime = 0
  private running = false
  private underwaterStrength = 0

  // Reusable Vector3s to avoid per-frame allocations (Phase 5a)
  private _fwd = new THREE.Vector3()
  private _lookDir = new THREE.Vector3()
  private _sunDir = new THREE.Vector3()
  private _sunCol = new THREE.Color()

  private biomeHud: HTMLElement | null
  private timeHud: HTMLElement | null
  private crystalHud: HTMLElement | null
  private modeHud: HTMLElement | null
  private crystalsCollected = 0

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container)
    this.input = new InputManager()

    this.biomeMap = new BiomeMap(WORLD_CONFIG.seed)
    this.world = new World(this.renderer.scene, this.biomeMap)
    this.creatureManager = new CreatureManager(WORLD_CONFIG.seed, this.renderer.scene)
    this.world.setCreatureManager(this.creatureManager)
    this.controller = new FirstPersonController(this.renderer.camera, this.input)
    this.collision = new CollisionSystem(this.world)
    this.dayNight = new DayNightCycle(this.renderer.scene)
    this.skyDome = new SkyDome(this.renderer.scene)
    this.biomeTransition = new BiomeTransition(
      this.biomeMap,
      this.renderer.scene,
      this.renderer.colorGradePass,
      this.skyDome
    )

    let cc0 = this.renderer.scene.children.length
    this.castle = new Castle(WORLD_CONFIG.seed, this.renderer.scene)
    this.world.setCastleWalkables(this.castle.walkables)
    this.castleBreeze = new CastleBreeze(this.castle.position, this.renderer.scene)
    {
      const added: THREE.Object3D[] = []
      for (let i = cc0; i < this.renderer.scene.children.length; i++) added.push(this.renderer.scene.children[i])
      this.monumentObjects.push({ pos: this.castle.position, objects: added })
    }

    // Grand Staircase — base at closest Forest seed
    const stairSeed = this.biomeMap.getClosestSeedOf(BiomeType.Forest)
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
    const hellSeed = this.biomeMap.getClosestSeedOf(BiomeType.Volcanic)
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

    this.debugMap = new DebugMap(this.castle.position, this.landmarkManager.positions, stairPos, hellStairPos)

    // Flashlight — SpotLight attached to camera, auto-enables at night
    this.flashlight = new THREE.SpotLight(0xffe8cc, 0, 40, Math.PI / 5, 0.3, 1.5)
    this.renderer.scene.add(this.flashlight)
    this.renderer.scene.add(this.flashlight.target)

    this.perfOverlay = new PerfOverlay(this.renderer.renderer)

    this.debugPanel = new DebugPanel(
      this.dayNight,
      this.flashlight,
      this.renderer.colorGradePass,
      this.renderer.crtPass,
      this.renderer.retroPass,
      this.perfOverlay,
    )

    this.biomeHud = document.getElementById('biome-hud')
    this.timeHud = document.getElementById('time-hud')
    this.crystalHud = document.getElementById('crystal-hud')
    this.modeHud = document.getElementById('mode-hud')

    this.setupStartScreen()
  }

  private setupStartScreen() {
    const overlay = document.getElementById('overlay')
    if (!overlay) return

    overlay.addEventListener('click', () => {
      this.renderer.renderer.domElement.requestPointerLock()
      overlay.classList.add('hidden')
      setTimeout(() => overlay.remove(), 600)
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

    this.controller.update(delta)
    this.collision.update(this.renderer.camera, this.controller, delta)
    this.world.update(this.renderer.camera.position)
    this.dayNight.update(delta)

    // Update sky dome with sun position and day/night factor
    const t = this.dayNight.getTime()
    const sunAngle = t * Math.PI * 2
    const dayFactor = Math.max(0, Math.min(1, Math.sin(sunAngle) * 2.0 + 0.5))
    this.dayNight.getSunDirection(this._sunDir)
    this.dayNight.getSunColor(this._sunCol)
    this.skyDome.update(this.renderer.camera, t, this._sunDir, this._sunCol, delta)
    this.biomeTransition.setDayFactor(dayFactor)
    this.biomeTransition.update(this.renderer.camera.position, delta)
    this.creatureManager.update(delta, this.renderer.camera.position, this.world, this.dayNight.getTime())

    // Knockback from predator attacks
    const knockback = this.creatureManager.pendingKnockback
    if (knockback > 0) {
      this.creatureManager.pendingKnockback = 0
      this.renderer.camera.getWorldDirection(this._fwd)
      this.renderer.camera.position.x -= this._fwd.x * 2 * knockback
      this.renderer.camera.position.z -= this._fwd.z * 2 * knockback
    }

    // Explodable structures + camera shake
    this.world.tickExplodables(this.renderer.camera.position, delta)
    const rumble = this.world.getRumbleStrength(this.renderer.camera.position)
    if (rumble > 0) {
      this.renderer.camera.position.x += (Math.random() - 0.5) * rumble * 0.06
      this.renderer.camera.position.z += (Math.random() - 0.5) * rumble * 0.06
    }

    // Underwater effect
    const targetStrength = this.renderer.camera.position.y < WATER_LEVEL ? 1.0 : 0.0
    this.underwaterStrength += (targetStrength - this.underwaterStrength) * Math.min(1, delta * 8)
    this.renderer.underwaterPass.update(delta, this.underwaterStrength)

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

    // Flashlight — auto-enables at night (18:00–07:00), points where camera looks
    const isNight = t > 18 / 24 || t < 7 / 24
    const targetIntensity = isNight ? 4.0 : 0.0
    this.flashlight.intensity += (targetIntensity - this.flashlight.intensity) * Math.min(1, delta * 2)
    this.flashlight.position.copy(this.renderer.camera.position)
    this._lookDir.set(0, 0, -1).applyQuaternion(this.renderer.camera.quaternion)
    this.flashlight.target.position.copy(this.renderer.camera.position).addScaledVector(this._lookDir, 20)
    this.flashlight.target.updateMatrixWorld()

    // Crystal pickup detection
    const totalCrystals = this.landmarkManager.allCrystals.length
    for (const crystal of this.landmarkManager.allCrystals) {
      if (crystal.tryCollect(this.renderer.camera.position)) {
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
      const dx = entry.pos.x - this.renderer.camera.position.x
      const dz = entry.pos.z - this.renderer.camera.position.z
      const vis = dx * dx + dz * dz < mCullDistSq
      for (const obj of entry.objects) obj.visible = vis
    }
    this.landmarkManager.update(delta, this.lastTime / 1000, this.renderer.camera.position)
    this.castleBreeze.update(delta, this.renderer.camera.position)
    this.debugMap.update(this.renderer.camera.position, this.controller.heading)

    this.renderer.render(delta)
    this.perfOverlay.update(this.renderer.renderer)
    requestAnimationFrame((t) => this.loop(t))
  }
}
