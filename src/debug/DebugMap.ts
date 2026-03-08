import * as THREE from 'three'

const MAP_SIZE = 300          // canvas pixels
const WORLD_RADIUS = 220      // world units visible from center to edge
const SCALE = MAP_SIZE / 2 / WORLD_RADIUS

export class DebugMap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private castlePos: THREE.Vector3
  private visible = false

  constructor(castlePos: THREE.Vector3) {
    this.castlePos = castlePos.clone()

    this.canvas = document.createElement('canvas')
    this.canvas.width = MAP_SIZE
    this.canvas.height = MAP_SIZE
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'none',
      borderRadius: '4px',
      imageRendering: 'pixelated',
      zIndex: '100',
    })
    document.getElementById('app')?.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggle()
    })
  }

  private toggle() {
    this.visible = !this.visible
    this.canvas.style.display = this.visible ? 'block' : 'none'
  }

  update(playerPos: THREE.Vector3) {
    if (!this.visible) return
    const c = this.ctx
    const cx = MAP_SIZE / 2
    const cy = MAP_SIZE / 2

    // Background
    c.clearRect(0, 0, MAP_SIZE, MAP_SIZE)
    c.fillStyle = 'rgba(0,0,0,0.88)'
    c.fillRect(0, 0, MAP_SIZE, MAP_SIZE)

    // Border
    c.strokeStyle = '#665533'
    c.lineWidth = 2
    c.strokeRect(1, 1, MAP_SIZE - 2, MAP_SIZE - 2)

    // Grid lines (every 100 world units)
    c.strokeStyle = 'rgba(255,255,255,0.06)'
    c.lineWidth = 1
    const gridSpacing = 100 * SCALE
    const originOffX = ((-playerPos.x) % 100) * SCALE
    const originOffZ = ((-playerPos.z) % 100) * SCALE
    for (let x = cx + originOffX % gridSpacing - gridSpacing; x < MAP_SIZE; x += gridSpacing) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, MAP_SIZE); c.stroke()
    }
    for (let y = cy + originOffZ % gridSpacing - gridSpacing; y < MAP_SIZE; y += gridSpacing) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(MAP_SIZE, y); c.stroke()
    }

    // Castle position on map
    const castleDX = (this.castlePos.x - playerPos.x) * SCALE
    const castleDZ = (this.castlePos.z - playerPos.z) * SCALE
    const castleMapX = cx + castleDX
    const castleMapZ = cy + castleDZ

    const castleInBounds = castleMapX >= 8 && castleMapX <= MAP_SIZE - 8 &&
                           castleMapZ >= 8 && castleMapZ <= MAP_SIZE - 8

    if (castleInBounds) {
      // Castle icon — golden diamond
      c.save()
      c.translate(castleMapX, castleMapZ)
      c.fillStyle = '#e8c060'
      c.beginPath()
      c.moveTo(0, -9)
      c.lineTo(7, 0)
      c.lineTo(0, 9)
      c.lineTo(-7, 0)
      c.closePath()
      c.fill()
      c.strokeStyle = '#fff8'
      c.lineWidth = 1
      c.stroke()
      // Castle label
      c.fillStyle = '#e8c060'
      c.font = '9px "Courier New", monospace'
      c.textAlign = 'center'
      c.fillText('CASTLE', 0, 20)
      c.restore()
    }

    // Direction arrow to castle (always visible at map edge if castle off-screen)
    const dist = Math.sqrt(castleDX * castleDX + castleDZ * castleDZ) / SCALE
    if (!castleInBounds) {
      // Clamp arrow to map circle edge
      const angle = Math.atan2(castleDZ, castleDX)
      const edgeR = MAP_SIZE / 2 - 16
      const ex = cx + Math.cos(angle) * edgeR
      const ey = cy + Math.sin(angle) * edgeR

      c.save()
      c.translate(ex, ey)
      c.rotate(angle + Math.PI / 2)
      c.fillStyle = '#e8c060'
      c.beginPath()
      c.moveTo(0, -10)
      c.lineTo(6, 6)
      c.lineTo(0, 2)
      c.lineTo(-6, 6)
      c.closePath()
      c.fill()
      c.restore()
    }

    // Player dot (always center)
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(cx, cy, 5, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#000'
    c.lineWidth = 1.5
    c.stroke()

    // Player direction indicator (small forward tick)
    // (we don't have camera angle here, so just a static cross)
    c.strokeStyle = '#fff'
    c.lineWidth = 1
    c.beginPath(); c.moveTo(cx, cy - 10); c.lineTo(cx, cy - 5); c.stroke()

    // HUD text
    c.fillStyle = '#aaa'
    c.font = '10px "Courier New", monospace'
    c.textAlign = 'left'
    c.fillText(`POS  ${Math.round(playerPos.x)}, ${Math.round(playerPos.z)}`, 8, MAP_SIZE - 42)
    c.fillText(`CASTLE  ${Math.round(this.castlePos.x)}, ${Math.round(this.castlePos.z)}`, 8, MAP_SIZE - 28)

    const distStr = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`
    c.fillStyle = dist < 60 ? '#88ff88' : '#e8c060'
    c.fillText(`DISTANCE  ${distStr}`, 8, MAP_SIZE - 14)

    // Title
    c.fillStyle = '#665533'
    c.font = '11px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('[ M ] WORLD MAP', MAP_SIZE / 2, 14)

    // Scale indicator (bottom right)
    const scaleBarWorld = 100
    const scaleBarPx = scaleBarWorld * SCALE
    const sbX = MAP_SIZE - 12 - scaleBarPx
    const sbY = MAP_SIZE - 10
    c.strokeStyle = '#666'
    c.lineWidth = 1
    c.beginPath(); c.moveTo(sbX, sbY); c.lineTo(sbX + scaleBarPx, sbY); c.stroke()
    c.beginPath(); c.moveTo(sbX, sbY - 3); c.lineTo(sbX, sbY + 3); c.stroke()
    c.beginPath(); c.moveTo(sbX + scaleBarPx, sbY - 3); c.lineTo(sbX + scaleBarPx, sbY + 3); c.stroke()
    c.fillStyle = '#666'
    c.font = '8px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('100u', sbX + scaleBarPx / 2, sbY - 5)

    // Cardinal directions
    c.fillStyle = 'rgba(255,255,255,0.25)'
    c.font = '10px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('N', MAP_SIZE / 2, 26)
    c.fillText('S', MAP_SIZE / 2, MAP_SIZE - 26)
    c.textAlign = 'left'
    c.fillText('W', 10, MAP_SIZE / 2 + 4)
    c.textAlign = 'right'
    c.fillText('E', MAP_SIZE - 10, MAP_SIZE / 2 + 4)
  }
}
