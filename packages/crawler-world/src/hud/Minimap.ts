import * as THREE from 'three'
import type { EnemyManager } from '../enemies/EnemyFactory'
import type { CompanionSystem } from '../companion/CompanionSystem'
import type { BossSystem } from '../enemies/BossSystem'

const SIZE = 160
const SCALE = 1 // 1 pixel per world unit → 80-unit radius

export class Minimap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = SIZE
    this.canvas.height = SIZE
    this.canvas.style.cssText = `
      position: fixed;
      z-index: 110;
      bottom: 16px;
      right: 16px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      background: rgba(0,0,0,0.55);
      pointer-events: none;
      image-rendering: pixelated;
    `
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
  }

  update(
    playerPos: THREE.Vector3,
    enemyManager: EnemyManager,
    companionSystem: CompanionSystem,
    bossSystem: BossSystem,
  ): void {
    const ctx = this.ctx
    const cx = SIZE / 2
    const cy = SIZE / 2

    // Background
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.fillStyle = 'rgba(10, 18, 30, 0.8)'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let g = 0; g < SIZE; g += 16) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(SIZE, g); ctx.stroke()
    }

    // Range circle
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, SIZE / 2 - 1, 0, Math.PI * 2)
    ctx.stroke()

    // Enemies (red dots)
    ctx.fillStyle = '#ff3333'
    for (const enemy of enemyManager.enemies) {
      const dx = (enemy.mesh.position.x - playerPos.x) * SCALE
      const dz = (enemy.mesh.position.z - playerPos.z) * SCALE
      const px = cx + dx
      const py = cy + dz
      if (px < 0 || px > SIZE || py < 0 || py > SIZE) continue
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Boss (large red diamond)
    const bossPos = bossSystem.getPosition()
    if (bossSystem.active && bossPos) {
      const bPos = bossPos
      const dx = (bPos.x - playerPos.x) * SCALE
      const dz = (bPos.z - playerPos.z) * SCALE
      const px = cx + dx
      const py = cy + dz
      if (px >= 0 && px <= SIZE && py >= 0 && py <= SIZE) {
        ctx.fillStyle = '#ff0000'
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(-5, -5, 10, 10)
        ctx.restore()
      }
    }

    // Companion (green dot)
    const companionPos = companionSystem.getPosition()
    if (companionSystem.active && companionPos) {
      const cPos = companionPos
      const dx = (cPos.x - playerPos.x) * SCALE
      const dz = (cPos.z - playerPos.z) * SCALE
      const px = cx + dx
      const py = cy + dz
      if (px >= 0 && px <= SIZE && py >= 0 && py <= SIZE) {
        ctx.fillStyle = '#44ff88'
        ctx.beginPath()
        ctx.arc(px, py, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Player (white dot at center)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()

    // Player direction dot
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(cx, cy - 7, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  destroy(): void {
    this.canvas.parentElement?.removeChild(this.canvas)
  }
}
