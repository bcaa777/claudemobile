import * as THREE from 'three'
import { Renderer } from './Renderer'
import { InputManager } from './InputManager'
import { World } from '../world/World'
import { FirstPersonController } from '../player/FirstPersonController'
import { CollisionSystem } from '../player/CollisionSystem'
import { DayNightCycle } from '../lighting/DayNightCycle'
import { BiomeTransition } from '../systems/BiomeTransition'
import { BiomeMap } from '../world/BiomeMap'
import { CreatureManager } from '../creatures/CreatureManager'
import { Castle } from '../castle/Castle'
import { CastleBreeze } from '../castle/CastleBreeze'
import { DebugMap } from '../debug/DebugMap'
import { WORLD_CONFIG } from '../config'
import { WATER_LEVEL } from '../world/TerrainGenerator'

export class Engine {
  private renderer: Renderer
  private input: InputManager
  private world: World
  private controller: FirstPersonController
  private collision: CollisionSystem
  private dayNight: DayNightCycle
  private biomeTransition: BiomeTransition
  private biomeMap: BiomeMap
  private creatureManager: CreatureManager
  private castle: Castle
  private castleBreeze: CastleBreeze
  private debugMap: DebugMap

  private lastTime = 0
  private running = false
  private underwaterStrength = 0

  private biomeHud: HTMLElement | null
  private timeHud: HTMLElement | null

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
    this.biomeTransition = new BiomeTransition(
      this.biomeMap,
      this.renderer.scene,
      this.renderer.colorGradePass
    )

    this.castle = new Castle(WORLD_CONFIG.seed, this.renderer.scene)
    this.world.setCastleWalkables(this.castle.walkables)
    this.castleBreeze = new CastleBreeze(this.castle.position, this.renderer.scene)
    this.debugMap = new DebugMap(this.castle.position)

    this.biomeHud = document.getElementById('biome-hud')
    this.timeHud = document.getElementById('time-hud')

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

    // Re-acquire pointer lock on click after losing focus
    document.addEventListener('click', () => {
      if (document.pointerLockElement === null && this.running) {
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
    this.collision.update(this.renderer.camera, this.controller)
    this.world.update(this.renderer.camera.position)
    this.dayNight.update(delta)
    this.biomeTransition.update(this.renderer.camera.position, delta)
    this.creatureManager.update(delta, this.renderer.camera.position, this.world, this.dayNight.getTime())

    // Knockback from predator attacks
    const knockback = this.creatureManager.pendingKnockback
    if (knockback > 0) {
      this.creatureManager.pendingKnockback = 0
      const fwd = new THREE.Vector3()
      this.renderer.camera.getWorldDirection(fwd)
      this.renderer.camera.position.x -= fwd.x * 2 * knockback
      this.renderer.camera.position.z -= fwd.z * 2 * knockback
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

    this.castle.update(delta, this.lastTime / 1000)
    this.castleBreeze.update(delta, this.renderer.camera.position)
    this.debugMap.update(this.renderer.camera.position)

    this.renderer.render(delta)
    requestAnimationFrame((t) => this.loop(t))
  }
}
