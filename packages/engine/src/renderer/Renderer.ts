import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import {
  PixelatePass,
  ColorGradePass,
  GodRayPass,
  HeatDistortionPass,
  CRTPass,
  UnderwaterPass,
  DamagePass,
  RetroPass,
} from './passes'

// Default internal render resolution (PS1-style 640×480)
const DEFAULT_PIXEL_WIDTH = 640
const DEFAULT_PIXEL_HEIGHT = 480

// Default per-category draw distances (world units)
const DEFAULT_DRAW_GEOMETRY = 200
const DEFAULT_DRAW_SPRITES = 120
const DEFAULT_DRAW_CREATURES = 150
const DEFAULT_DRAW_PARTICLES = 100

export class Renderer {
  public renderer: THREE.WebGLRenderer
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public composer: EffectComposer

  public colorGradePass!: ColorGradePass
  public godRayPass!: GodRayPass
  public heatDistortionPass!: HeatDistortionPass
  public crtPass!: CRTPass
  public underwaterPass!: UnderwaterPass
  public damagePass!: DamagePass
  public retroPass!: RetroPass

  private renderTarget: THREE.WebGLRenderTarget

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      500
    )
    this.camera.position.set(0, 2, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: false })
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = false
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    container.appendChild(this.renderer.domElement)

    const rw = DEFAULT_PIXEL_WIDTH
    const rh = DEFAULT_PIXEL_HEIGHT
    this.renderTarget = new THREE.WebGLRenderTarget(rw, rh, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    })

    this.composer = new EffectComposer(this.renderer, this.renderTarget)
    this.setupPostProcessing()

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private setupPostProcessing() {
    const renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(renderPass)

    const pixelatePass = new PixelatePass(DEFAULT_PIXEL_WIDTH, DEFAULT_PIXEL_HEIGHT)
    this.composer.addPass(pixelatePass)

    this.colorGradePass = new ColorGradePass()
    this.composer.addPass(this.colorGradePass)

    this.godRayPass = new GodRayPass()
    this.composer.addPass(this.godRayPass)

    this.heatDistortionPass = new HeatDistortionPass()
    this.composer.addPass(this.heatDistortionPass)

    this.crtPass = new CRTPass()
    this.composer.addPass(this.crtPass)

    this.underwaterPass = new UnderwaterPass()
    this.composer.addPass(this.underwaterPass)

    this.damagePass = new DamagePass()
    this.composer.addPass(this.damagePass)

    this.retroPass = new RetroPass()
    this.composer.addPass(this.retroPass)
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  render(deltaTime: number) {
    // Camera far plane = max of all category draw distances (with margin for fog fade)
    const maxDraw = Math.max(
      DEFAULT_DRAW_GEOMETRY,
      DEFAULT_DRAW_SPRITES,
      DEFAULT_DRAW_CREATURES,
      DEFAULT_DRAW_PARTICLES
    )
    const targetFar = maxDraw * 1.1
    if (Math.abs(this.camera.far - targetFar) > 5) {
      this.camera.far = targetFar
      this.camera.updateProjectionMatrix()
    }

    this.retroPass.update(deltaTime)
    this.composer.render()
  }
}
