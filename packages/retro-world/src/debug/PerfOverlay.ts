import * as THREE from 'three'

export class PerfOverlay {
  private el: HTMLElement
  private frames: number[] = []
  private lastTime = performance.now()
  private visible = true

  constructor(renderer: THREE.WebGLRenderer) {
    // Disable auto-reset so we capture stats across ALL render passes
    renderer.info.autoReset = false

    this.el = document.createElement('div')
    Object.assign(this.el.style, {
      position: 'absolute',
      top: '10px',
      left: '10px',
      padding: '6px 10px',
      background: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      font: '11px "Courier New", monospace',
      lineHeight: '1.5',
      zIndex: '150',
      pointerEvents: 'none',
      borderRadius: '3px',
      whiteSpace: 'pre',
    })
    document.getElementById('app')?.appendChild(this.el)
  }

  update(renderer: THREE.WebGLRenderer) {
    if (!this.visible) return

    const now = performance.now()
    const dt = now - this.lastTime
    this.lastTime = now
    this.frames.push(dt)
    if (this.frames.length > 60) this.frames.shift()

    const avgDt = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    const fps = Math.round(1000 / avgDt)

    const info = renderer.info
    const calls = info.render.calls
    const tris = info.render.triangles
    const geos = info.memory.geometries
    const texs = info.memory.textures

    this.el.textContent =
      `FPS: ${fps}\n` +
      `Draw: ${calls}\n` +
      `Tris: ${tris}\n` +
      `Geo: ${geos}\n` +
      `Tex: ${texs}`

    // Manually reset for next frame (since autoReset is off)
    info.reset()
  }

  setVisible(v: boolean) {
    this.visible = v
    this.el.style.display = v ? 'block' : 'none'
  }

  getVisible(): boolean {
    return this.visible
  }

  dispose() {
    this.el.remove()
  }
}
