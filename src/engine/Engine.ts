import { Renderer } from './Renderer'
import { InputManager } from './InputManager'
import { World } from '../world/World'
import { FirstPersonController } from '../player/FirstPersonController'
import { CollisionSystem } from '../player/CollisionSystem'
import { DayNightCycle } from '../lighting/DayNightCycle'
import { BiomeTransition } from '../systems/BiomeTransition'
import { BiomeMap } from '../world/BiomeMap'

export class Engine {
  private renderer: Renderer
  private input: InputManager
  private world: World
  private controller: FirstPersonController
  private collision: CollisionSystem
  private dayNight: DayNightCycle
  private biomeTransition: BiomeTransition
  private biomeMap: BiomeMap

  private lastTime = 0
  private running = false

  private biomeHud: HTMLElement | null
  private timeHud: HTMLElement | null

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container)
    this.input = new InputManager()

    this.biomeMap = new BiomeMap(42)
    this.world = new World(this.renderer.scene, this.biomeMap)
    this.controller = new FirstPersonController(this.renderer.camera, this.input)
    this.collision = new CollisionSystem(this.world)
    this.dayNight = new DayNightCycle(this.renderer.scene)
    this.biomeTransition = new BiomeTransition(
      this.biomeMap,
      this.renderer.scene,
      this.renderer.colorGradePass
    )

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
    this.collision.update(this.renderer.camera)
    this.world.update(this.renderer.camera.position)
    this.dayNight.update(delta)
    this.biomeTransition.update(this.renderer.camera.position, delta)

    // Update HUD
    if (this.biomeHud) {
      this.biomeHud.textContent = this.biomeTransition.getCurrentBiomeName()
    }
    if (this.timeHud) {
      this.timeHud.textContent = this.dayNight.getTimeString()
    }

    this.renderer.render(delta)
    requestAnimationFrame((t) => this.loop(t))
  }
}
