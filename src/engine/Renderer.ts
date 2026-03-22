import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { PixelatePass } from '../postprocessing/PixelatePass'
import { ColorGradePass } from '../postprocessing/ColorGradePass'
import { GodRayPass } from '../postprocessing/GodRayPass'
import { CRTPass } from '../postprocessing/CRTPass'
import { UnderwaterPass } from '../postprocessing/UnderwaterPass'
import { DamagePass } from '../postprocessing/DamagePass'
import { RetroPass } from '../postprocessing/RetroPass'
import { POST_CONFIG, RENDER_CONFIG, WORLD_CONFIG } from '../config'
import { CHUNK_SIZE } from '../world/TerrainGenerator'

export class Renderer {
  public renderer: THREE.WebGLRenderer
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public composer: EffectComposer

  public colorGradePass!: ColorGradePass
  public godRayPass!: GodRayPass
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

    const rw = POST_CONFIG.pixelWidth
    const rh = POST_CONFIG.pixelHeight
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

    const pixelatePass = new PixelatePass(POST_CONFIG.pixelWidth, POST_CONFIG.pixelHeight)
    this.composer.addPass(pixelatePass)

    this.colorGradePass = new ColorGradePass()
    this.composer.addPass(this.colorGradePass)

    this.godRayPass = new GodRayPass()
    this.composer.addPass(this.godRayPass)

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
    // Update camera far plane to match current render distance
    const maxDist = (WORLD_CONFIG.viewRadius + 2) * CHUNK_SIZE * RENDER_CONFIG.renderScale
    const targetFar = Math.max(500, maxDist * 1.5)
    if (Math.abs(this.camera.far - targetFar) > 10) {
      this.camera.far = targetFar
      this.camera.updateProjectionMatrix()
    }

    this.retroPass.update(deltaTime)
    this.composer.render()
  }
}
