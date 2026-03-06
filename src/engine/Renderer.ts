import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { PixelatePass } from '../postprocessing/PixelatePass'
import { ColorGradePass } from '../postprocessing/ColorGradePass'
import { CRTPass } from '../postprocessing/CRTPass'
import { RetroPass } from '../postprocessing/RetroPass'

export const RENDER_WIDTH = 320
export const RENDER_HEIGHT = 240

export class Renderer {
  public renderer: THREE.WebGLRenderer
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public composer: EffectComposer

  public colorGradePass!: ColorGradePass
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

    this.renderTarget = new THREE.WebGLRenderTarget(RENDER_WIDTH, RENDER_HEIGHT, {
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

    const pixelatePass = new PixelatePass(RENDER_WIDTH, RENDER_HEIGHT)
    this.composer.addPass(pixelatePass)

    this.colorGradePass = new ColorGradePass()
    this.composer.addPass(this.colorGradePass)

    const crtPass = new CRTPass()
    this.composer.addPass(crtPass)

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
    this.retroPass.update(deltaTime)
    this.composer.render()
  }
}
