import * as THREE from 'three'
import { BiomeType } from '../biomes/types'

const MAP_SIZE = 300          // canvas pixels
const WORLD_RADIUS = 220      // world units visible from center to edge
const SCALE = MAP_SIZE / 2 / WORLD_RADIUS

// Compass heading to cardinal abbreviation
function headingDir(rad: number): string {
  const deg = (((rad * 180 / Math.PI) % 360) + 360) % 360
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

// Per-biome landmark display config
const LANDMARK_INFO: Partial<Record<BiomeType, { color: string; label: string }>> = {
  [BiomeType.Forest]:    { color: '#44cc44', label: 'FR' },
  [BiomeType.Desert]:    { color: '#ddaa22', label: 'DS' },
  [BiomeType.Volcanic]:  { color: '#ee3300', label: 'VC' },
  [BiomeType.Snow]:      { color: '#88ccff', label: 'SN' },
  [BiomeType.Swamp]:     { color: '#336633', label: 'SW' },
  [BiomeType.Tundra]:    { color: '#8888aa', label: 'TU' },
  [BiomeType.Mushroom]:  { color: '#bb44ee', label: 'MS' },
  [BiomeType.AshWastes]: { color: '#888877', label: 'AW' },
  [BiomeType.Crystal]:   { color: '#4466ee', label: 'CR' },
  [BiomeType.Savanna]:   { color: '#cc8833', label: 'SV' },
}

export class DebugMap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private castlePos: THREE.Vector3
  private landmarkPositions: Map<BiomeType, THREE.Vector3>
  private visible = false

  constructor(castlePos: THREE.Vector3, landmarkPositions: Map<BiomeType, THREE.Vector3> = new Map()) {
    this.castlePos = castlePos.clone()
    this.landmarkPositions = landmarkPositions

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

  // heading = camera.rotation.y (Three.js yaw, 0 = looking north / -Z)
  update(playerPos: THREE.Vector3, heading: number) {
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

    // ── Rotated world view (forward = screen-up) ─────────────────────────
    c.save()
    c.translate(cx, cy)
    c.rotate(heading)     // rotate so player's facing direction is always up
    c.translate(-cx, -cy)

    // Grid lines (every 100 world units)
    c.strokeStyle = 'rgba(255,255,255,0.06)'
    c.lineWidth = 1
    const gridSpacing = 100 * SCALE
    const originOffX = ((-playerPos.x) % 100) * SCALE
    const originOffZ = ((-playerPos.z) % 100) * SCALE
    for (let x = cx + originOffX % gridSpacing - gridSpacing * 2; x < MAP_SIZE + gridSpacing; x += gridSpacing) {
      c.beginPath(); c.moveTo(x, -MAP_SIZE); c.lineTo(x, MAP_SIZE * 2); c.stroke()
    }
    for (let y = cy + originOffZ % gridSpacing - gridSpacing * 2; y < MAP_SIZE + gridSpacing; y += gridSpacing) {
      c.beginPath(); c.moveTo(-MAP_SIZE, y); c.lineTo(MAP_SIZE * 2, y); c.stroke()
    }

    // Castle
    const castleDX = (this.castlePos.x - playerPos.x) * SCALE
    const castleDZ = (this.castlePos.z - playerPos.z) * SCALE
    const castleMapX = cx + castleDX
    const castleMapZ = cy + castleDZ

    const castleInBounds = castleMapX >= 8 && castleMapX <= MAP_SIZE - 8 &&
                           castleMapZ >= 8 && castleMapZ <= MAP_SIZE - 8
    if (castleInBounds) {
      c.save()
      c.translate(castleMapX, castleMapZ)
      c.fillStyle = '#e8c060'
      c.beginPath()
      c.moveTo(0, -9); c.lineTo(7, 0); c.lineTo(0, 9); c.lineTo(-7, 0)
      c.closePath(); c.fill()
      c.strokeStyle = '#fff8'; c.lineWidth = 1; c.stroke()
      c.fillStyle = '#e8c060'
      c.font = '9px "Courier New", monospace'
      c.textAlign = 'center'
      c.fillText('CASTLE', 0, 20)
      c.restore()
    }

    // Edge arrow to castle when off-screen
    const distWorld = Math.sqrt(castleDX * castleDX + castleDZ * castleDZ) / SCALE
    if (!castleInBounds) {
      const angle = Math.atan2(castleDZ, castleDX)
      const edgeR = MAP_SIZE / 2 - 16
      const ex = cx + Math.cos(angle) * edgeR
      const ey = cy + Math.sin(angle) * edgeR
      c.save()
      c.translate(ex, ey)
      c.rotate(angle + Math.PI / 2)
      c.fillStyle = '#e8c060'
      c.beginPath()
      c.moveTo(0, -10); c.lineTo(6, 6); c.lineTo(0, 2); c.lineTo(-6, 6)
      c.closePath(); c.fill()
      c.restore()
    }

    // Landmarks
    for (const [biome, lmPos] of this.landmarkPositions) {
      const info = LANDMARK_INFO[biome]
      if (!info) continue
      const ldx = (lmPos.x - playerPos.x) * SCALE
      const ldz = (lmPos.z - playerPos.z) * SCALE
      const lmx = cx + ldx
      const lmz = cy + ldz
      const inBounds = lmx >= 8 && lmx <= MAP_SIZE - 8 && lmz >= 8 && lmz <= MAP_SIZE - 8
      if (inBounds) {
        c.save()
        c.translate(lmx, lmz)
        c.fillStyle = info.color
        c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#fff8'; c.lineWidth = 1; c.stroke()
        c.fillStyle = info.color
        c.font = '8px "Courier New", monospace'
        c.textAlign = 'center'
        c.fillText(info.label, 0, 16)
        c.restore()
      } else {
        // Edge arrow
        const lAngle = Math.atan2(ldz, ldx)
        const edgeR = MAP_SIZE / 2 - 14
        const ex = cx + Math.cos(lAngle) * edgeR
        const ey = cy + Math.sin(lAngle) * edgeR
        c.save()
        c.translate(ex, ey)
        c.rotate(lAngle + Math.PI / 2)
        c.fillStyle = info.color
        c.beginPath()
        c.moveTo(0, -7); c.lineTo(4, 5); c.lineTo(0, 2); c.lineTo(-4, 5)
        c.closePath(); c.fill()
        c.restore()
      }
    }

    c.restore()   // end rotated world view

    // ── Player dot (always centered, never rotates) ───────────────────────
    c.fillStyle = '#ffffff'
    c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke()

    // Forward direction triangle (always points toward screen-top = forward)
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.moveTo(cx, cy - 11)
    c.lineTo(cx - 4, cy - 4)
    c.lineTo(cx + 4, cy - 4)
    c.closePath(); c.fill()

    // ── Compass rose (top-right corner, screen-space) ─────────────────────
    const compX = MAP_SIZE - 24
    const compY = 26

    // Background circle
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.beginPath(); c.arc(compX, compY, 17, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#444'; c.lineWidth = 1
    c.beginPath(); c.arc(compX, compY, 17, 0, Math.PI * 2); c.stroke()

    // Rotating needle: +heading so N needle always points toward world north
    c.save()
    c.translate(compX, compY)
    c.rotate(heading)
    // N half (red)
    c.fillStyle = '#ff5050'
    c.beginPath(); c.moveTo(0, -14); c.lineTo(4, 2); c.lineTo(0, 0); c.lineTo(-4, 2); c.closePath(); c.fill()
    // S half (dim)
    c.fillStyle = '#444'
    c.beginPath(); c.moveTo(0, 14); c.lineTo(4, -2); c.lineTo(0, 0); c.lineTo(-4, -2); c.closePath(); c.fill()
    // Centre dot
    c.fillStyle = '#888'
    c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2); c.fill()
    c.restore()

    // Fixed "N" label above compass (reminder: red = N)
    c.fillStyle = '#ff8080'
    c.font = '8px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('N', compX, compY - 22)

    // ── HUD text ──────────────────────────────────────────────────────────
    c.fillStyle = '#aaa'
    c.font = '10px "Courier New", monospace'
    c.textAlign = 'left'
    c.fillText(`POS  ${Math.round(playerPos.x)}, ${Math.round(playerPos.z)}`, 8, MAP_SIZE - 52)
    c.fillText(`FACING  ${headingDir(-heading)}`, 8, MAP_SIZE - 38)
    c.fillText(`CASTLE  ${Math.round(this.castlePos.x)}, ${Math.round(this.castlePos.z)}`, 8, MAP_SIZE - 24)

    const distStr = distWorld >= 1000 ? `${(distWorld / 1000).toFixed(1)}km` : `${Math.round(distWorld)}m`
    c.fillStyle = distWorld < 60 ? '#88ff88' : '#e8c060'
    c.fillText(`DISTANCE  ${distStr}`, 8, MAP_SIZE - 10)

    // Title
    c.fillStyle = '#665533'
    c.font = '11px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('[ M ] WORLD MAP', MAP_SIZE / 2, 14)

    // Scale indicator (bottom right)
    const scaleBarWorld = 100
    const scaleBarPx = scaleBarWorld * SCALE
    const sbX = MAP_SIZE - 14 - scaleBarPx
    const sbY = MAP_SIZE - 8
    c.strokeStyle = '#555'; c.lineWidth = 1
    c.beginPath(); c.moveTo(sbX, sbY); c.lineTo(sbX + scaleBarPx, sbY); c.stroke()
    c.beginPath(); c.moveTo(sbX, sbY - 3); c.lineTo(sbX, sbY + 3); c.stroke()
    c.beginPath(); c.moveTo(sbX + scaleBarPx, sbY - 3); c.lineTo(sbX + scaleBarPx, sbY + 3); c.stroke()
    c.fillStyle = '#555'
    c.font = '8px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('100u', sbX + scaleBarPx / 2, sbY - 5)
  }
}
