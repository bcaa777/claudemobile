import * as THREE from 'three'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { SeededRandom } from '../utils/SeededRandom'
import { SPRITE_CONFIG } from '../config'

const SPRITE_SIZE = SPRITE_CONFIG.spriteResolution

type DrawFn = (ctx: CanvasRenderingContext2D, rng: SeededRandom, palette: string[]) => void

// Convert [r,g,b] 0..1 to css hex
function toHex(r: number, g: number, b: number): string {
  const ri = Math.round(r * 255)
  const gi = Math.round(g * 255)
  const bi = Math.round(b * 255)
  return `#${ri.toString(16).padStart(2,'0')}${gi.toString(16).padStart(2,'0')}${bi.toString(16).padStart(2,'0')}`
}

// Pixel-art line helper
function pixLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size = 2) {
  ctx.fillRect(Math.round(x1) - Math.floor(size/2), Math.round(y1) - Math.floor(size/2), size, size)
  // Bresenham
  let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
  let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
  let err = dx - dy
  while (true) {
    ctx.fillRect(Math.round(x1) - Math.floor(size/2), Math.round(y1) - Math.floor(size/2), size, size)
    if (Math.abs(x1 - x2) < 1 && Math.abs(y1 - y2) < 1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x1 += sx }
    if (e2 < dx) { err += dx; y1 += sy }
  }
}

// ─── Draw functions per biome+category ─────────────────────────────────────

// ── Forest trees ──────────────────────────────────────────────────────────

const drawForestTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk
  ctx.fillStyle = pal[6] || '#5a3010'
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.55, 8, SPRITE_SIZE * 0.45)
  // layered triangles (pine)
  const layers = 4
  for (let i = 0; i < layers; i++) {
    const t = i / layers
    const y = SPRITE_SIZE * (0.55 - t * 0.45)
    const w = 10 + t * 22 + rng.range(-2, 2)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
    ctx.beginPath()
    ctx.moveTo(cx, y - 8)
    ctx.lineTo(cx - w, y + 14)
    ctx.lineTo(cx + w, y + 14)
    ctx.closePath()
    ctx.fill()
    // snow highlight on top
    ctx.fillStyle = 'rgba(180,220,180,0.15)'
    ctx.beginPath()
    ctx.moveTo(cx, y - 8)
    ctx.lineTo(cx - w * 0.4, y + 5)
    ctx.lineTo(cx + w * 0.4, y + 5)
    ctx.closePath()
    ctx.fill()
  }
}

const drawForestOak: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // Thick trunk
  ctx.fillStyle = pal[6] || '#5a3010'
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.45, 12, SPRITE_SIZE * 0.55)
  // Large round canopy
  const canopyR = 22 + rng.range(-2, 3)
  const canopyY = SPRITE_SIZE * 0.38
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.beginPath()
  ctx.arc(cx, canopyY, canopyR, 0, Math.PI * 2)
  ctx.fill()
  // 3 light patches
  ctx.fillStyle = pal[3] || '#2a6020'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-canopyR * 0.5, canopyR * 0.5)
    const py = canopyY + rng.range(-canopyR * 0.5, canopyR * 0.3)
    ctx.beginPath()
    ctx.ellipse(px, py, 7 + rng.range(0, 4), 5 + rng.range(0, 3), 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawForestBirch: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // Tall narrow white trunk
  ctx.fillStyle = '#e8e8e0'
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.2, 8, SPRITE_SIZE * 0.8)
  // Horizontal bark marks
  ctx.fillStyle = '#303020'
  for (let i = 0; i < 5; i++) {
    const y = SPRITE_SIZE * (0.25 + i * 0.12)
    ctx.fillRect(cx - 4, y, 8 + rng.int(-1, 2), 2)
  }
  // Small V-crown
  const crownY = SPRITE_SIZE * 0.22
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.beginPath()
  ctx.moveTo(cx, crownY - 10)
  ctx.lineTo(cx - 14, crownY + 10)
  ctx.lineTo(cx - 6, crownY + 4)
  ctx.lineTo(cx, crownY + 8)
  ctx.lineTo(cx + 6, crownY + 4)
  ctx.lineTo(cx + 14, crownY + 10)
  ctx.closePath()
  ctx.fill()
}

// ── Forest structures ──────────────────────────────────────────────────────

const drawStructure: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const dark = pal[0] || '#303030'
  const mid = pal[1] || '#505050'
  const light = pal[3] || '#707070'

  if (rng.next() > 0.5) {
    // Totem pole
    const blocks = 3 + rng.int(0, 2)
    for (let i = 0; i < blocks; i++) {
      const y = SPRITE_SIZE - 10 - i * 18
      const w = 12 - i * 1
      ctx.fillStyle = i % 2 === 0 ? mid : dark
      ctx.fillRect(cx - w/2, y - 14, w, 14)
      // carved pattern
      ctx.fillStyle = dark
      ctx.fillRect(cx - 3, y - 10, 6, 4)
      ctx.fillRect(cx - w/2, y - 8, 3, 3)
      ctx.fillRect(cx + w/2 - 3, y - 8, 3, 3)
    }
  } else {
    // Ruined wall/pillar
    const height = 30 + rng.range(0, 20)
    ctx.fillStyle = mid
    ctx.fillRect(cx - 8, SPRITE_SIZE - height, 16, height)
    // broken top
    ctx.fillStyle = dark
    ctx.fillRect(cx - 8, SPRITE_SIZE - height, 16, 4)
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 8 + i*4 + rng.int(0,1), SPRITE_SIZE - height - rng.int(2, 8), 3, 5)
    }
    // stone block divisions
    ctx.fillStyle = dark
    for (let y = SPRITE_SIZE - height + 8; y < SPRITE_SIZE; y += 8) {
      ctx.fillRect(cx - 8, y, 16, 1)
    }
    for (let x = cx - 8; x <= cx + 8; x += 8) {
      ctx.fillRect(x, SPRITE_SIZE - height, 1, height)
    }
    // highlight
    ctx.fillStyle = light
    ctx.fillRect(cx - 8, SPRITE_SIZE - height, 2, height)
  }
}

const drawForestShrine: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const dark = pal[0] || '#303030'
  const mid = pal[1] || '#505050'
  // Stone pedestal box
  ctx.fillStyle = mid
  ctx.fillRect(cx - 10, SPRITE_SIZE * 0.55, 20, SPRITE_SIZE * 0.45)
  ctx.fillStyle = dark
  ctx.fillRect(cx - 10, SPRITE_SIZE * 0.55, 20, 3)
  // Cross vertical bar
  ctx.fillStyle = dark
  ctx.fillRect(cx - 2, SPRITE_SIZE * 0.25, 4, SPRITE_SIZE * 0.32)
  // Cross horizontal bar
  ctx.fillRect(cx - 8, SPRITE_SIZE * 0.32, 16, 4)
  // Stone highlight
  ctx.fillStyle = pal[3] || '#707070'
  ctx.fillRect(cx - 10, SPRITE_SIZE * 0.55, 2, SPRITE_SIZE * 0.45)
}

const drawForestWatchtower: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const dark = pal[0] || '#303030'
  const mid = pal[1] || '#505050'
  const light = pal[3] || '#707070'
  // 3 stacked stone rectangles decreasing width
  const tiers = [
    { w: 20, h: 14, y: SPRITE_SIZE - 14 },
    { w: 16, h: 14, y: SPRITE_SIZE - 28 },
    { w: 12, h: 14, y: SPRITE_SIZE - 42 },
  ]
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]
    ctx.fillStyle = i % 2 === 0 ? mid : dark
    ctx.fillRect(cx - t.w / 2, t.y, t.w, t.h)
    ctx.fillStyle = dark
    ctx.fillRect(cx - t.w / 2, t.y, t.w, 1)
    ctx.fillStyle = light
    ctx.fillRect(cx - t.w / 2, t.y, 1, t.h)
  }
  // Broken crenellations on top
  ctx.fillStyle = mid
  const topTier = tiers[2]
  for (let i = 0; i < 3; i++) {
    const bx = cx - topTier.w / 2 + i * 5 + rng.int(0, 1)
    ctx.fillRect(bx, topTier.y - 5 - rng.int(0, 3), 3, 5)
  }
}

// ── Desert tree ────────────────────────────────────────────────────────────

const drawDesertCactus: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const green = '#3a6020'
  const darkGreen = '#284515'
  // main trunk
  ctx.fillStyle = green
  ctx.fillRect(cx - 5, 10, 10, SPRITE_SIZE - 20)
  ctx.fillStyle = darkGreen
  ctx.fillRect(cx - 5, 10, 2, SPRITE_SIZE - 20)
  // arms
  const armY = SPRITE_SIZE * 0.4
  ctx.fillStyle = green
  ctx.fillRect(cx - 18, armY, 14, 6)
  ctx.fillRect(cx - 18, armY - 12, 6, 14)
  ctx.fillRect(cx + 4, armY + 4, 14, 6)
  ctx.fillRect(cx + 12, armY - 8, 6, 14)
  // spines
  ctx.fillStyle = '#d4c080'
  for (let i = 0; i < 6; i++) {
    const sy = 15 + i * 8
    ctx.fillRect(cx + 5, sy, 3, 1)
    ctx.fillRect(cx - 8, sy + 2, 3, 1)
  }
}

// ── Desert structures ──────────────────────────────────────────────────────

const drawDesertObelisk: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const base = pal[1] || '#8a6040'
  const dark = pal[0] || '#604020'
  const obeliskH = SPRITE_SIZE * 0.8
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.moveTo(cx - 5, SPRITE_SIZE - 4)
  ctx.lineTo(cx + 5, SPRITE_SIZE - 4)
  ctx.lineTo(cx + 3, SPRITE_SIZE - obeliskH)
  ctx.lineTo(cx - 3, SPRITE_SIZE - obeliskH)
  ctx.closePath()
  ctx.fill()
  // Hieroglyph-stripe markings
  ctx.fillStyle = dark
  for (let i = 0; i < 4; i++) {
    const y = SPRITE_SIZE * 0.3 + i * 10
    ctx.fillRect(cx - 3, y, 6, 2)
    if (i % 2 === 0) ctx.fillRect(cx - 1, y + 3, 3, 1)
  }
  // Highlight
  ctx.fillStyle = pal[3] || '#c09060'
  ctx.fillRect(cx - 5, SPRITE_SIZE - obeliskH, 2, obeliskH)
}

const drawDesertArch: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const base = pal[1] || '#8a6040'
  const dark = pal[0] || '#604020'
  const pillarW = 8
  const pillarH = 26
  // Two squat pillars
  ctx.fillStyle = base
  ctx.fillRect(cx - 20, SPRITE_SIZE - pillarH, pillarW, pillarH)
  ctx.fillRect(cx + 12, SPRITE_SIZE - pillarH, pillarW, pillarH)
  // Block details on pillars
  ctx.fillStyle = dark
  for (let y = 4; y < pillarH; y += 8) {
    ctx.fillRect(cx - 20, SPRITE_SIZE - pillarH + y, pillarW, 1)
    ctx.fillRect(cx + 12, SPRITE_SIZE - pillarH + y, pillarW, 1)
  }
  // Crosspiece rect bridging them
  ctx.fillStyle = base
  ctx.fillRect(cx - 20, SPRITE_SIZE - pillarH - 6, 40, 8)
  ctx.fillStyle = dark
  ctx.fillRect(cx - 20, SPRITE_SIZE - pillarH - 6, 40, 2)
}

// ── Volcanic tree ──────────────────────────────────────────────────────────

const drawVolcanicDeadTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  ctx.fillStyle = '#1a0a04'
  // trunk
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.3, 8, SPRITE_SIZE * 0.7)
  // twisted branches
  const branches = [
    [cx, SPRITE_SIZE * 0.3, cx - 20, SPRITE_SIZE * 0.1],
    [cx, SPRITE_SIZE * 0.3, cx + 18, 5],
    [cx - 20, SPRITE_SIZE * 0.1, cx - 30, 2],
    [cx + 18, 5, cx + 25, -5],
  ]
  ctx.fillStyle = '#120604'
  for (const [x1, y1, x2, y2] of branches) {
    pixLine(ctx, x1, y1, x2, y2, 3)
  }
  // ember glow at tips
  ctx.fillStyle = 'rgba(255,80,0,0.4)'
  ctx.fillRect(cx - 32, -2, 6, 6)
  ctx.fillRect(cx + 23, -7, 5, 5)
}

// ── Volcanic structure ─────────────────────────────────────────────────────

const drawVolcanicShrine: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const dark = pal[0] || '#0a0804'
  const obsidian = pal[1] || '#1a1008'
  const lava = '#c83010'
  // Obsidian block base
  ctx.fillStyle = obsidian
  ctx.fillRect(cx - 12, SPRITE_SIZE * 0.65, 24, SPRITE_SIZE * 0.35)
  // Thin tall slab
  ctx.fillStyle = dark
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.22, 8, SPRITE_SIZE * 0.45)
  // Lava crack lines
  ctx.fillStyle = lava
  pixLine(ctx, cx - 2, SPRITE_SIZE * 0.3, cx + 3, SPRITE_SIZE * 0.45, 1)
  pixLine(ctx, cx + 1, SPRITE_SIZE * 0.5, cx - 2, SPRITE_SIZE * 0.62, 1)
  pixLine(ctx, cx - 8, SPRITE_SIZE * 0.7, cx + 8, SPRITE_SIZE * 0.8, 1)
  // Glow at base
  ctx.fillStyle = 'rgba(200,50,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE - 4, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── Snow tree ──────────────────────────────────────────────────────────────

const drawSnowPine: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk
  ctx.fillStyle = '#4a3020'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.6, 6, SPRITE_SIZE * 0.4)
  // layered triangles with snow
  const layers = 5
  for (let i = 0; i < layers; i++) {
    const t = i / layers
    const y = SPRITE_SIZE * (0.60 - t * 0.50)
    const w = 8 + t * 20 + rng.range(-1, 1)
    ctx.fillStyle = pal[2] || '#304868'
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx - w, y + 12)
    ctx.lineTo(cx + w, y + 12)
    ctx.closePath()
    ctx.fill()
    // snow cap
    const sw = w * 0.65
    ctx.fillStyle = pal[4] || '#e8eeff'
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx - sw, y + 5)
    ctx.lineTo(cx + sw, y + 5)
    ctx.closePath()
    ctx.fill()
  }
}

// ── Snow structures ────────────────────────────────────────────────────────

const drawSnowCairn: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const mid = pal[1] || '#606878'
  const dark = pal[0] || '#404850'
  const boxes = [
    { w: 18, h: 6 },
    { w: 15, h: 5 },
    { w: 12, h: 6 },
    { w: 9,  h: 5 },
    { w: 6,  h: 4 },
  ]
  let y = SPRITE_SIZE - 4
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    const ox = rng.range(-3, 3)
    y -= b.h
    ctx.fillStyle = i % 2 === 0 ? mid : dark
    ctx.fillRect(cx - b.w / 2 + ox, y, b.w, b.h)
    // Snow dusting
    ctx.fillStyle = 'rgba(220,230,255,0.4)'
    ctx.fillRect(cx - b.w / 2 + ox, y, b.w, 2)
  }
}

const drawSnowShrine: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const mid = pal[1] || '#606878'
  const dark = pal[0] || '#404850'
  // Stone slab base
  ctx.fillStyle = mid
  ctx.fillRect(cx - 12, SPRITE_SIZE * 0.7, 24, SPRITE_SIZE * 0.3)
  // Tall narrow slab upright
  ctx.fillStyle = dark
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.25, 8, SPRITE_SIZE * 0.47)
  // Small cap box
  ctx.fillStyle = mid
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.2, 12, 6)
  // Snow on top
  ctx.fillStyle = 'rgba(220,230,255,0.5)'
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.2, 12, 2)
  ctx.fillRect(cx - 12, SPRITE_SIZE * 0.7, 24, 2)
  // Stone highlight
  ctx.fillStyle = pal[3] || '#8090a8'
  ctx.fillRect(cx - 12, SPRITE_SIZE * 0.7, 2, SPRITE_SIZE * 0.3)
}

// ── Swamp trees ────────────────────────────────────────────────────────────

const drawSwampTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // gnarled trunk
  ctx.fillStyle = pal[5] || '#2a1a08'
  ctx.fillRect(cx - 5, SPRITE_SIZE * 0.35, 10, SPRITE_SIZE * 0.65)
  // drooping wide crown
  const crownY = SPRITE_SIZE * 0.35
  ctx.fillStyle = pal[Math.floor(rng.range(0, 2))] || '#0e2204'
  ctx.beginPath()
  ctx.ellipse(cx, crownY, 28 + rng.range(-4, 4), 18 + rng.range(-2, 2), 0, 0, Math.PI * 2)
  ctx.fill()
  // drooping branches
  ctx.fillStyle = pal[0] || '#0a1e04'
  for (let i = 0; i < 4; i++) {
    const bx = cx + rng.range(-20, 20)
    const by = crownY + 8 + rng.range(0, 10)
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + rng.range(-6, 6), by + 14 + rng.range(0, 8))
    ctx.lineWidth = 2
    ctx.strokeStyle = pal[5] || '#2a1a08'
    ctx.stroke()
  }
  // fog wisps at base
  ctx.fillStyle = 'rgba(160,200,100,0.08)'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE - 4, 22, 8, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawSwampMangrove: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // 4 thin diverging root trunks
  const roots: [number, number, number, number][] = [
    [cx, baseY, cx - 16, baseY - 26],
    [cx, baseY, cx + 14, baseY - 22],
    [cx, baseY, cx - 8,  baseY - 32],
    [cx, baseY, cx + 6,  baseY - 28],
  ]
  ctx.fillStyle = pal[5] || '#2a1a08'
  for (const [x1, y1, x2, y2] of roots) {
    pixLine(ctx, x1, y1, x2, y2, 2)
  }
  // Small dark crown
  const crownX = cx - 2
  const crownY = baseY - 28
  ctx.fillStyle = pal[0] || '#0a1e04'
  ctx.beginPath()
  ctx.ellipse(crownX, crownY, 14, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // Hanging moss wisps
  ctx.fillStyle = 'rgba(80,120,20,0.3)'
  for (let i = 0; i < 3; i++) {
    const mx = crownX + rng.range(-10, 10)
    pixLine(ctx, mx, crownY + 6, mx + rng.range(-3, 3), crownY + 16 + rng.range(0, 6), 1)
  }
}

const drawSwampHollow: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // Wide low bulging trunk base
  ctx.fillStyle = pal[5] || '#2a1a08'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE * 0.65, 18, SPRITE_SIZE * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(cx - 16, SPRITE_SIZE * 0.6, 32, SPRITE_SIZE * 0.4)
  // Hollow dark circle
  ctx.fillStyle = '#050808'
  ctx.beginPath()
  ctx.ellipse(cx + rng.range(-3, 3), SPRITE_SIZE * 0.58, 8, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // Minimal crown
  ctx.fillStyle = pal[0] || '#0a1e04'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE * 0.28, 10, 8, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── Swamp structures ───────────────────────────────────────────────────────

const drawSwampTotem: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const dark = pal[0] || '#1a1005'
  const mid = pal[1] || '#302010'
  // Totem pole shaft
  ctx.fillStyle = mid
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.2, 12, SPRITE_SIZE * 0.8)
  // Skull-like carved face
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE * 0.38, 8, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // Two glowing eye holes
  ctx.fillStyle = 'rgba(255,200,50,0.55)'
  ctx.beginPath()
  ctx.ellipse(cx - 3, SPRITE_SIZE * 0.34, 2, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 3, SPRITE_SIZE * 0.34, 2, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // Lower carved bands
  ctx.fillStyle = dark
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.52, 12, 4)
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.66, 12, 4)
}

// ── Mushroom trees ─────────────────────────────────────────────────────────

const drawMushroomCap: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const stemH = SPRITE_SIZE * 0.4
  // stem
  ctx.fillStyle = pal[6] || '#6090b0'
  ctx.fillRect(cx - 5, SPRITE_SIZE - stemH, 10, stemH)
  // stem highlight
  ctx.fillStyle = pal[3] || '#d060e0'
  ctx.fillRect(cx - 5, SPRITE_SIZE - stemH, 3, stemH)
  // cap
  const capW = 24 + rng.range(-4, 4)
  const capH = 16 + rng.range(-2, 2)
  const capY = SPRITE_SIZE - stemH - capH + 4
  ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#8020b0'
  ctx.beginPath()
  ctx.ellipse(cx, capY + capH, capW, capH, 0, Math.PI, 0)
  ctx.fill()
  // dots on cap
  ctx.fillStyle = pal[5] || '#f0d030'
  const dots = 3 + rng.int(0, 3)
  for (let i = 0; i < dots; i++) {
    const dx = cx + rng.range(-capW * 0.6, capW * 0.6)
    const dy = capY + capH - rng.range(4, capH - 2)
    ctx.beginPath()
    ctx.arc(dx, dy, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  // glow rim
  ctx.fillStyle = 'rgba(200,100,255,0.15)'
  ctx.beginPath()
  ctx.ellipse(cx, capY + capH, capW + 4, capH + 3, 0, Math.PI, 0)
  ctx.fill()
}

const drawMushroomCluster: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const offsets = [-10, 0, 10]
  const heights = [SPRITE_SIZE * 0.5, SPRITE_SIZE * 0.38, SPRITE_SIZE * 0.44]
  const capSizes = [10, 13, 9]
  for (let i = 0; i < 3; i++) {
    const sx = cx + offsets[i]
    const stemH = heights[i]
    // stem
    ctx.fillStyle = pal[6] || '#6090b0'
    ctx.fillRect(sx - 3, SPRITE_SIZE - stemH, 6, stemH)
    // cap
    const capW = capSizes[i]
    const capH = 8
    const capY = SPRITE_SIZE - stemH
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#8020b0'
    ctx.beginPath()
    ctx.ellipse(sx, capY + capH, capW, capH, 0, Math.PI, 0)
    ctx.fill()
    // dot
    ctx.fillStyle = pal[5] || '#f0d030'
    ctx.beginPath()
    ctx.arc(sx + rng.range(-3, 3), capY + capH * 0.5, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawMushroomGlowing: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const stemH = SPRITE_SIZE * 0.35
  // Thick stem
  ctx.fillStyle = pal[6] || '#6090b0'
  ctx.fillRect(cx - 6, SPRITE_SIZE - stemH, 12, stemH)
  // Sphere-like cap
  const capR = 20 + rng.range(-2, 2)
  const capY = SPRITE_SIZE - stemH - capR + 4
  ctx.fillStyle = pal[Math.floor(rng.range(2, 5))] || '#c040e0'
  ctx.beginPath()
  ctx.arc(cx, capY, capR, 0, Math.PI * 2)
  ctx.fill()
  // Thick glow ring at rim
  ctx.strokeStyle = 'rgba(255,150,255,0.65)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(cx, capY + capR * 0.65, capR + 4, 5, 0, 0, Math.PI * 2)
  ctx.stroke()
  // Bright highlight patch
  ctx.fillStyle = pal[3] || '#e080f0'
  ctx.beginPath()
  ctx.arc(cx - capR * 0.2, capY - capR * 0.1, capR * 0.3, 0, Math.PI * 2)
  ctx.fill()
  // Ambient glow
  ctx.fillStyle = 'rgba(200,80,255,0.12)'
  ctx.beginPath()
  ctx.arc(cx, capY, capR + 8, 0, Math.PI * 2)
  ctx.fill()
}

const drawMushroomThin: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // Very tall thin stem
  const stemH = SPRITE_SIZE * 0.75
  ctx.fillStyle = pal[6] || '#6090b0'
  ctx.fillRect(cx - 2, SPRITE_SIZE - stemH, 4, stemH)
  // Stem highlight
  ctx.fillStyle = pal[3] || '#d060e0'
  ctx.fillRect(cx - 2, SPRITE_SIZE - stemH, 1, stemH)
  // Tiny pointed cap
  const capW = 8
  const capY = SPRITE_SIZE - stemH
  ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#8020b0'
  ctx.beginPath()
  ctx.moveTo(cx, capY - 8)
  ctx.lineTo(cx - capW, capY + 4)
  ctx.lineTo(cx + capW, capY + 4)
  ctx.closePath()
  ctx.fill()
  // Wispy spores floating around
  ctx.fillStyle = 'rgba(200,100,255,0.28)'
  for (let i = 0; i < 6; i++) {
    const sx = cx + rng.range(-18, 18)
    const sy = capY + rng.range(-10, 20)
    ctx.fillRect(sx, sy, 2, 2)
  }
}

// ── Ash Wastes tree ────────────────────────────────────────────────────────

const drawAshSpire: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const spires = 2 + rng.int(0, 2)
  for (let i = 0; i < spires; i++) {
    const sx = cx + rng.range(-14, 14)
    const h  = 20 + rng.range(10, 30)
    const w  = 4 + rng.range(0, 4)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#303030'
    // tapered column
    ctx.beginPath()
    ctx.moveTo(sx - w/2, SPRITE_SIZE - 4)
    ctx.lineTo(sx + w/2, SPRITE_SIZE - 4)
    ctx.lineTo(sx + w/4, SPRITE_SIZE - 4 - h)
    ctx.lineTo(sx - w/4, SPRITE_SIZE - 4 - h)
    ctx.closePath()
    ctx.fill()
    // ash highlight
    ctx.fillStyle = pal[5] || '#a0a090'
    ctx.fillRect(sx - w/2, SPRITE_SIZE - 4 - h, 2, h)
  }
  // ash base
  ctx.fillStyle = pal[1] || '#252525'
  ctx.fillRect(cx - 20, SPRITE_SIZE - 8, 40, 8)
}

// ── Crystal tree ───────────────────────────────────────────────────────────

const drawCrystalSpire: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const spires = 2 + rng.int(0, 2)
  for (let i = 0; i < spires; i++) {
    const sx = cx + rng.range(-12, 12)
    const h  = 24 + rng.range(8, 24)
    const w  = 8 + rng.range(0, 6)
    // main facet
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#30a0d0'
    ctx.beginPath()
    ctx.moveTo(sx, SPRITE_SIZE - 4 - h)
    ctx.lineTo(sx + w/2, SPRITE_SIZE - 4 - h/3)
    ctx.lineTo(sx + w/2 * 0.6, SPRITE_SIZE - 4)
    ctx.lineTo(sx - w/2 * 0.6, SPRITE_SIZE - 4)
    ctx.lineTo(sx - w/2, SPRITE_SIZE - 4 - h/3)
    ctx.closePath()
    ctx.fill()
    // bright facet
    ctx.fillStyle = pal[5] || '#c0f0ff'
    ctx.beginPath()
    ctx.moveTo(sx, SPRITE_SIZE - 4 - h)
    ctx.lineTo(sx + w/2, SPRITE_SIZE - 4 - h/3)
    ctx.lineTo(sx + w * 0.1, SPRITE_SIZE - 4 - h * 0.6)
    ctx.closePath()
    ctx.fill()
    // dark facet
    ctx.fillStyle = pal[0] || '#104060'
    ctx.beginPath()
    ctx.moveTo(sx, SPRITE_SIZE - 4 - h)
    ctx.lineTo(sx - w/2, SPRITE_SIZE - 4 - h/3)
    ctx.lineTo(sx - w * 0.1, SPRITE_SIZE - 4 - h * 0.6)
    ctx.closePath()
    ctx.fill()
  }
}

// ── Crystal structure ──────────────────────────────────────────────────────

const drawCrystalAltar: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const base = pal[1] || '#30a0d0'
  const bright = pal[5] || '#c0f0ff'
  const dark = pal[0] || '#104060'
  // Flat wide base
  ctx.fillStyle = base
  ctx.fillRect(cx - 16, SPRITE_SIZE * 0.72, 32, SPRITE_SIZE * 0.28)
  ctx.fillStyle = dark
  ctx.fillRect(cx - 16, SPRITE_SIZE * 0.72, 32, 2)
  // 3 crystal spires of different heights
  const spires = [
    { sx: cx - 10, h: 30, w: 6 },
    { sx: cx,      h: 42, w: 7 },
    { sx: cx + 10, h: 26, w: 5 },
  ]
  const baseY = SPRITE_SIZE * 0.72
  for (const s of spires) {
    ctx.fillStyle = base
    ctx.beginPath()
    ctx.moveTo(s.sx, baseY - s.h)
    ctx.lineTo(s.sx + s.w / 2, baseY - s.h / 3)
    ctx.lineTo(s.sx + s.w / 2 * 0.6, baseY)
    ctx.lineTo(s.sx - s.w / 2 * 0.6, baseY)
    ctx.lineTo(s.sx - s.w / 2, baseY - s.h / 3)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = bright
    ctx.beginPath()
    ctx.moveTo(s.sx, baseY - s.h)
    ctx.lineTo(s.sx + s.w / 2, baseY - s.h / 3)
    ctx.lineTo(s.sx + s.w * 0.1, baseY - s.h * 0.6)
    ctx.closePath()
    ctx.fill()
  }
}

// ── Savanna trees ──────────────────────────────────────────────────────────

const drawAcacia: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const trunkH = SPRITE_SIZE * 0.55
  // trunk
  ctx.fillStyle = pal[5] || '#3a2808'
  ctx.fillRect(cx - 4, SPRITE_SIZE - trunkH, 8, trunkH)
  // flat-top canopy — wide ellipse
  const canopyW = 30 + rng.range(-4, 4)
  const canopyH = 10 + rng.range(-1, 3)
  const canopyY = SPRITE_SIZE - trunkH - canopyH / 2
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#806010'
  ctx.beginPath()
  ctx.ellipse(cx, canopyY, canopyW, canopyH, 0, 0, Math.PI * 2)
  ctx.fill()
  // sparse highlight patches
  ctx.fillStyle = pal[6] || '#b08020'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-canopyW * 0.6, canopyW * 0.6)
    const py = canopyY + rng.range(-canopyH * 0.4, canopyH * 0.4)
    ctx.beginPath()
    ctx.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawBaobab: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const trunkH = SPRITE_SIZE * 0.62
  // Very wide short trunk
  ctx.fillStyle = pal[5] || '#3a2808'
  ctx.fillRect(cx - 14, SPRITE_SIZE - trunkH, 28, trunkH)
  // Trunk shadow side
  ctx.fillStyle = pal[0] || '#2a1808'
  ctx.fillRect(cx + 8, SPRITE_SIZE - trunkH, 6, trunkH)
  // Disproportionately small crown
  const crownW = 16 + rng.range(-2, 2)
  const crownH = 8
  const crownY = SPRITE_SIZE - trunkH - crownH
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#806010'
  ctx.beginPath()
  ctx.ellipse(cx, crownY, crownW, crownH + 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // Small branch clusters
  ctx.fillStyle = pal[6] || '#a08020'
  for (let i = 0; i < 3; i++) {
    const bx = cx + rng.range(-crownW, crownW)
    ctx.beginPath()
    ctx.ellipse(bx, crownY + rng.range(-4, 4), 4, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Generic ────────────────────────────────────────────────────────────────

const drawRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  const rx = 18 + rng.range(0, 8)
  const ry = 12 + rng.range(0, 6)
  ctx.fillStyle = pal[1] || '#404040'
  ctx.beginPath()
  // Irregular polygon
  const sides = 6 + rng.int(0, 3)
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const r = (i % 2 === 0 ? 0.8 : 1.0) * (i < sides/2 ? rx : ry * 0.8)
    const x = cx + Math.cos(angle) * r * (1 + rng.range(-0.1, 0.1))
    const y = cy + Math.sin(angle) * ry * 0.7 * (1 + rng.range(-0.1, 0.1))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // shadow face
  ctx.fillStyle = pal[0] || '#303030'
  ctx.beginPath()
  ctx.moveTo(cx + rx * 0.1, cy - ry * 0.3)
  ctx.lineTo(cx + rx * 0.8, cy + ry * 0.2)
  ctx.lineTo(cx + rx * 0.3, cy + ry * 0.6)
  ctx.closePath()
  ctx.fill()
  // highlight face
  ctx.fillStyle = pal[3] || '#606060'
  ctx.beginPath()
  ctx.moveTo(cx - rx * 0.6, cy - ry * 0.4)
  ctx.lineTo(cx, cy - ry * 0.7)
  ctx.lineTo(cx - rx * 0.1, cy - ry * 0.1)
  ctx.closePath()
  ctx.fill()
}

const drawGrass: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const blades = 5 + rng.int(0, 4)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 12 + rng.range(0, 16)
    const lean = rng.range(-6, 6)
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#1a3010'
    pixLine(ctx, bx, SPRITE_SIZE - 2, bx + lean, SPRITE_SIZE - 2 - h, 2)
    // tip
    ctx.fillRect(bx + lean - 1, SPRITE_SIZE - 2 - h, 3, 3)
  }
}

// ─── Sprite function tables (indexed by variant) ─────────────────────────────

type BiomeCategoryKey = `${BiomeType}_${SpriteCategory}`

const drawFunctions: Record<string, DrawFn[]> = {
  [`${BiomeType.Forest}_tree`]:      [drawForestTree, drawForestOak, drawForestBirch],
  [`${BiomeType.Forest}_bush`]:      [drawGrass],
  [`${BiomeType.Forest}_rock`]:      [drawRock],
  [`${BiomeType.Forest}_structure`]: [drawStructure, drawForestShrine, drawForestWatchtower],
  [`${BiomeType.Forest}_grass`]:     [drawGrass],
  [`${BiomeType.Desert}_tree`]:      [drawDesertCactus],
  [`${BiomeType.Desert}_bush`]:      [drawGrass],
  [`${BiomeType.Desert}_rock`]:      [drawRock],
  [`${BiomeType.Desert}_structure`]: [drawStructure, drawDesertObelisk, drawDesertArch],
  [`${BiomeType.Desert}_grass`]:     [drawGrass],
  [`${BiomeType.Volcanic}_tree`]:    [drawVolcanicDeadTree],
  [`${BiomeType.Volcanic}_bush`]:    [drawGrass],
  [`${BiomeType.Volcanic}_rock`]:    [drawRock],
  [`${BiomeType.Volcanic}_structure`]: [drawStructure, drawVolcanicShrine],
  [`${BiomeType.Snow}_tree`]:        [drawSnowPine],
  [`${BiomeType.Snow}_bush`]:        [drawGrass],
  [`${BiomeType.Snow}_rock`]:        [drawRock],
  [`${BiomeType.Snow}_structure`]:   [drawStructure, drawSnowCairn, drawSnowShrine],
  [`${BiomeType.Snow}_grass`]:       [drawGrass],
  [`${BiomeType.Swamp}_tree`]:       [drawSwampTree, drawSwampMangrove, drawSwampHollow],
  [`${BiomeType.Swamp}_bush`]:       [drawGrass],
  [`${BiomeType.Swamp}_rock`]:       [drawRock],
  [`${BiomeType.Swamp}_structure`]:  [drawStructure, drawSwampTotem],
  [`${BiomeType.Swamp}_grass`]:      [drawGrass],
  [`${BiomeType.Tundra}_tree`]:      [drawSnowPine],
  [`${BiomeType.Tundra}_bush`]:      [drawGrass],
  [`${BiomeType.Tundra}_rock`]:      [drawRock],
  [`${BiomeType.Tundra}_structure`]: [drawStructure, drawSnowCairn, drawSnowShrine],
  [`${BiomeType.Tundra}_grass`]:     [drawGrass],
  [`${BiomeType.Mushroom}_tree`]:       [drawMushroomCap, drawMushroomCluster, drawMushroomGlowing, drawMushroomThin],
  [`${BiomeType.Mushroom}_bush`]:       [drawGrass],
  [`${BiomeType.Mushroom}_rock`]:       [drawRock],
  [`${BiomeType.Mushroom}_structure`]:  [drawStructure],
  [`${BiomeType.Mushroom}_grass`]:      [drawGrass],
  [`${BiomeType.AshWastes}_tree`]:       [drawAshSpire],
  [`${BiomeType.AshWastes}_bush`]:       [drawGrass],
  [`${BiomeType.AshWastes}_rock`]:       [drawRock],
  [`${BiomeType.AshWastes}_structure`]:  [drawStructure],
  [`${BiomeType.AshWastes}_grass`]:      [drawGrass],
  [`${BiomeType.Crystal}_tree`]:       [drawCrystalSpire],
  [`${BiomeType.Crystal}_bush`]:       [drawGrass],
  [`${BiomeType.Crystal}_rock`]:       [drawRock],
  [`${BiomeType.Crystal}_structure`]:  [drawStructure, drawCrystalAltar],
  [`${BiomeType.Crystal}_grass`]:      [drawGrass],
  [`${BiomeType.Savanna}_tree`]:       [drawAcacia, drawBaobab],
  [`${BiomeType.Savanna}_bush`]:       [drawGrass],
  [`${BiomeType.Savanna}_rock`]:       [drawRock],
  [`${BiomeType.Savanna}_structure`]:  [drawStructure],
  [`${BiomeType.Savanna}_grass`]:      [drawGrass],
}

export function generateSpriteTexture(
  biome: BiomeType,
  category: SpriteCategory,
  palette: [number, number, number][],
  seed: number,
  variant = 0,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')!

  const rng = new SeededRandom(seed)
  const csspalette = palette.map(([r, g, b]) => toHex(r, g, b))

  const key: BiomeCategoryKey = `${biome}_${category}`
  const fns = drawFunctions[key]
  if (fns && fns.length > 0) {
    const drawFn = fns[variant % fns.length]
    drawFn(ctx, rng, csspalette)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
}
