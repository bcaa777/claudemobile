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

// ── Forest extras ─────────────────────────────────────────────────────────

const drawForestFern: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const fronds = 3 + rng.int(0, 1)
  for (let i = 0; i < fronds; i++) {
    const angle = -Math.PI * 0.3 + (i / (fronds - 1)) * Math.PI * 0.6
    const len = 20 + rng.range(0, 10)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
    for (let t = 0; t < 1; t += 0.08) {
      const x = cx + Math.sin(angle) * len * t
      const y = baseY - Math.cos(angle) * len * t - t * t * 6
      const w = 4 * (1 - t * 0.6)
      ctx.fillRect(x - w / 2, y, w, 3)
    }
  }
}

const drawForestMushroom: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 2 + rng.int(0, 1)
  for (let i = 0; i < count; i++) {
    const mx = cx + rng.range(-14, 14)
    const h = 8 + rng.range(0, 6)
    // stem
    ctx.fillStyle = '#5a3010'
    ctx.fillRect(mx - 2, baseY - h, 4, h)
    // cap
    ctx.fillStyle = '#c03020'
    ctx.beginPath()
    ctx.ellipse(mx, baseY - h, 6 + rng.range(0, 3), 4, 0, Math.PI, 0)
    ctx.fill()
    // spots
    ctx.fillStyle = '#f0e0c0'
    ctx.fillRect(mx - 2, baseY - h - 2, 2, 2)
    ctx.fillRect(mx + 2, baseY - h - 1, 2, 2)
  }
}

const drawForestStump: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 18 + rng.range(0, 6)
  const h = 14 + rng.range(0, 4)
  // stump body
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // bark dark edge
  ctx.fillStyle = '#3a2008'
  ctx.fillRect(cx - w / 2, baseY - h, 3, h)
  ctx.fillRect(cx + w / 2 - 3, baseY - h, 3, h)
  // top face
  ctx.fillStyle = '#7a5030'
  ctx.fillRect(cx - w / 2, baseY - h, w, 4)
  // ring detail
  ctx.fillStyle = '#4a2810'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h + 2, w * 0.3, 2, 0, 0, Math.PI * 2)
  ctx.stroke()
}

const drawForestFallenLog: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  const logW = 28 + rng.range(0, 8)
  const logH = 8 + rng.range(0, 3)
  // main log
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx - logW / 2, cy - logH / 2, logW, logH)
  // bark shadow
  ctx.fillStyle = '#3a2008'
  ctx.fillRect(cx - logW / 2, cy + logH / 2 - 2, logW, 2)
  // moss patches
  ctx.fillStyle = '#2a5a10'
  for (let i = 0; i < 4; i++) {
    const mx = cx + rng.range(-logW * 0.4, logW * 0.4)
    const mw = 4 + rng.range(0, 4)
    ctx.fillRect(mx - mw / 2, cy - logH / 2 - 1, mw, 3)
  }
}

// ── Desert extras ─────────────────────────────────────────────────────────

const drawDesertBarrelCactus: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 14 + rng.range(0, 4)
  const h = 16 + rng.range(0, 4)
  // round body
  ctx.fillStyle = '#3a6020'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // vertical ridges
  ctx.fillStyle = '#2a4a14'
  for (let i = -2; i <= 2; i++) {
    const rx = cx + i * 3
    ctx.fillRect(rx, baseY - h + 2, 1, h - 4)
  }
  // pink flower on top
  ctx.fillStyle = '#e060a0'
  ctx.beginPath()
  ctx.arc(cx, baseY - h + 2, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0a0c0'
  ctx.fillRect(cx - 1, baseY - h, 2, 2)
}

const drawDesertSkull: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // skull shape
  ctx.fillStyle = '#d8d0b0'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // jaw
  ctx.fillRect(cx - 6, cy + 6, 12, 5)
  // eye sockets
  ctx.fillStyle = '#1a1008'
  ctx.beginPath()
  ctx.ellipse(cx - 4, cy - 2, 3, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 4, cy - 2, 3, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // nose hole
  ctx.fillRect(cx - 1, cy + 3, 2, 2)
  // horns
  ctx.fillStyle = '#b0a890'
  pixLine(ctx, cx - 10, cy - 6, cx - 20, cy - 16 + rng.range(0, 4), 2)
  pixLine(ctx, cx + 10, cy - 6, cx + 20, cy - 16 + rng.range(0, 4), 2)
}

const drawDesertDryBush: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 14 + rng.range(0, 4)
  // circular tangle of dry brown lines
  ctx.fillStyle = '#8a6a30'
  for (let i = 0; i < 20; i++) {
    const a1 = rng.range(0, Math.PI * 2)
    const a2 = a1 + rng.range(0.5, 2)
    const r1 = rng.range(2, r)
    const r2 = rng.range(2, r)
    pixLine(ctx,
      cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1,
      cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2, 1)
  }
}

const drawDesertBones: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  ctx.fillStyle = '#d8d0b0'
  for (let i = 0; i < 6; i++) {
    const bx = cx + rng.range(-16, 16)
    const by = cy + rng.range(-8, 8)
    const angle = rng.range(0, Math.PI)
    const len = 6 + rng.range(0, 8)
    pixLine(ctx,
      bx - Math.cos(angle) * len / 2, by - Math.sin(angle) * len / 2,
      bx + Math.cos(angle) * len / 2, by + Math.sin(angle) * len / 2, 2)
    // knob ends
    ctx.fillRect(bx - Math.cos(angle) * len / 2 - 1, by - Math.sin(angle) * len / 2 - 1, 3, 3)
    ctx.fillRect(bx + Math.cos(angle) * len / 2 - 1, by + Math.sin(angle) * len / 2 - 1, 3, 3)
  }
}

// ── Volcanic extras ───────────────────────────────────────────────────────

const drawVolcanicBoneSpire: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 36 + rng.range(0, 10)
  // twisted obsidian spire
  ctx.fillStyle = '#1a0a04'
  ctx.beginPath()
  ctx.moveTo(cx - 6, baseY)
  ctx.lineTo(cx + 6, baseY)
  ctx.lineTo(cx + 2 + rng.range(-2, 2), baseY - h)
  ctx.lineTo(cx - 2 + rng.range(-2, 2), baseY - h)
  ctx.closePath()
  ctx.fill()
  // lava crack lines
  ctx.fillStyle = '#ff4400'
  pixLine(ctx, cx - 3, baseY - h * 0.2, cx + 2, baseY - h * 0.45, 1)
  pixLine(ctx, cx + 1, baseY - h * 0.5, cx - 2, baseY - h * 0.7, 1)
  pixLine(ctx, cx, baseY - h * 0.75, cx + 1, baseY - h * 0.9, 1)
}

const drawVolcanicEmberBush: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 14 + rng.range(0, 4)
  // dark bush shape
  ctx.fillStyle = '#1a0808'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // glowing ember dots on edges
  ctx.fillStyle = '#ff6600'
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2)
    const d = r * rng.range(0.6, 1.0)
    ctx.fillRect(cx + Math.cos(a) * d - 1, cy + Math.sin(a) * d * 0.7 - 1, 3, 3)
  }
}

const drawVolcanicLavaRock: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.58
  const rx = 16 + rng.range(0, 6)
  const ry = 10 + rng.range(0, 4)
  // dark rock
  ctx.fillStyle = '#2a1008'
  ctx.beginPath()
  const sides = 6 + rng.int(0, 2)
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const x = cx + Math.cos(angle) * rx * (1 + rng.range(-0.15, 0.15))
    const y = cy + Math.sin(angle) * ry * (1 + rng.range(-0.15, 0.15))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // bright orange-red crack lines
  ctx.fillStyle = '#ff4400'
  for (let i = 0; i < 4; i++) {
    const x1 = cx + rng.range(-rx * 0.7, rx * 0.7)
    const y1 = cy + rng.range(-ry * 0.5, ry * 0.5)
    const x2 = cx + rng.range(-rx * 0.7, rx * 0.7)
    const y2 = cy + rng.range(-ry * 0.5, ry * 0.5)
    pixLine(ctx, x1, y1, x2, y2, 1)
  }
}

const drawVolcanicScorchMark: DrawFn = (ctx, _rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // outer edge
  ctx.fillStyle = '#1a0808'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 18, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark center
  ctx.fillStyle = '#0a0404'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 10, 6, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── Snow extras ───────────────────────────────────────────────────────────

const drawSnowBareTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const trunkH = 34 + rng.range(0, 8)
  // trunk
  ctx.fillStyle = '#6a5a4a'
  ctx.fillRect(cx - 3, baseY - trunkH, 6, trunkH)
  // branches
  const branches: [number, number, number, number][] = [
    [cx, baseY - trunkH * 0.7, cx - 16, baseY - trunkH * 0.85],
    [cx, baseY - trunkH * 0.7, cx + 14, baseY - trunkH * 0.9],
    [cx, baseY - trunkH * 0.5, cx - 12, baseY - trunkH * 0.6],
    [cx, baseY - trunkH * 0.5, cx + 10, baseY - trunkH * 0.55],
  ]
  ctx.fillStyle = '#6a5a4a'
  for (const [x1, y1, x2, y2] of branches) {
    pixLine(ctx, x1, y1, x2, y2, 2)
  }
  // snow blobs at branch intersections
  ctx.fillStyle = '#e8eeff'
  for (const [, , x2, y2] of branches) {
    ctx.beginPath()
    ctx.arc(x2, y2 - 2, 4 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawSnowIceBush: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  const r = 14 + rng.range(0, 4)
  // frozen bush body
  ctx.fillStyle = '#7888a0'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // icicle triangles hanging below
  ctx.fillStyle = '#c0d8f0'
  for (let i = 0; i < 5; i++) {
    const ix = cx + rng.range(-r * 0.7, r * 0.7)
    const iy = cy + r * 0.5
    ctx.beginPath()
    ctx.moveTo(ix - 2, iy)
    ctx.lineTo(ix + 2, iy)
    ctx.lineTo(ix, iy + 6 + rng.range(0, 4))
    ctx.closePath()
    ctx.fill()
  }
}

const drawSnowDrift: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE * 0.7
  const w = 24 + rng.range(0, 8)
  // main mound
  ctx.fillStyle = '#e0e8f8'
  ctx.beginPath()
  ctx.ellipse(cx, baseY, w, 8, 0, Math.PI, 0)
  ctx.fill()
  // subtle blue shadow
  ctx.fillStyle = '#a0b0c8'
  ctx.beginPath()
  ctx.ellipse(cx + 4, baseY, w * 0.5, 4, 0, Math.PI, 0)
  ctx.fill()
}

const drawSnowFrozenFlower: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // short stem
  ctx.fillStyle = '#7888a0'
  ctx.fillRect(cx - 1, baseY - 14, 2, 14)
  // 6-pointed ice crystal star
  ctx.fillStyle = '#c0e0ff'
  const starY = baseY - 16
  const starR = 5 + rng.range(0, 2)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const ex = cx + Math.cos(a) * starR
    const ey = starY + Math.sin(a) * starR
    pixLine(ctx, cx, starY, ex, ey, 2)
  }
  // center dot
  ctx.fillRect(cx - 1, starY - 1, 3, 3)
}

// ── Tundra (arctic steppe) ────────────────────────────────────────────────

const drawTundraShrub: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stunted wind-bent shrub, leaning right
  ctx.fillStyle = '#5a6050'
  const stemH = 20
  pixLine(ctx, cx - 4, baseY, cx + 6, baseY - stemH, 2)
  // small branches blown right
  pixLine(ctx, cx + 2, baseY - stemH * 0.6, cx + 14, baseY - stemH * 0.7, 1)
  pixLine(ctx, cx + 4, baseY - stemH * 0.8, cx + 12, baseY - stemH * 0.95, 1)
  // sparse leaf blobs
  ctx.fillStyle = '#4a5440'
  for (let i = 0; i < 3; i++) {
    const lx = cx + 6 + rng.range(0, 10)
    const ly = baseY - stemH * 0.5 - rng.range(0, stemH * 0.4)
    ctx.beginPath()
    ctx.ellipse(lx, ly, 4, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawTundraLichen: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.65
  // flat circular lichen patches on ground
  const patches = 3 + rng.int(0, 2)
  for (let i = 0; i < patches; i++) {
    const px = cx + rng.range(-12, 12)
    const py = cy + rng.range(-4, 4)
    const r = 4 + rng.range(0, 4)
    ctx.fillStyle = rng.next() > 0.5 ? '#8a8040' : '#7a6a40'
    ctx.beginPath()
    ctx.ellipse(px, py, r, r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawTundraDryGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const blades = 5 + rng.int(0, 2)
  ctx.fillStyle = '#8a7a50'
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-12, 12)
    const h = 8 + rng.range(0, 8)
    const lean = rng.range(-2, 2)
    pixLine(ctx, bx, baseY, bx + lean, baseY - h, 2)
  }
}

const drawTundraStandingStone: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 38 + rng.range(0, 8)
  const w = 10 + rng.range(0, 4)
  const tilt = rng.range(-3, 3)
  // tall narrow gray monolith
  ctx.fillStyle = '#606070'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx + w / 2 * 0.6 + tilt, baseY - h)
  ctx.lineTo(cx - w / 2 * 0.6 + tilt, baseY - h)
  ctx.closePath()
  ctx.fill()
  // rune scratch line
  ctx.fillStyle = '#808890'
  pixLine(ctx, cx + tilt * 0.5 - 2, baseY - h * 0.3, cx + tilt * 0.5 + 2, baseY - h * 0.6, 1)
  pixLine(ctx, cx + tilt * 0.5, baseY - h * 0.4, cx + tilt * 0.5 + 3, baseY - h * 0.45, 1)
}

const drawTundraSkull: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // weathered gray skull
  ctx.fillStyle = '#909090'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 10, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // jaw
  ctx.fillRect(cx - 5, cy + 5, 10, 4)
  // dark eye sockets
  ctx.fillStyle = '#303030'
  ctx.fillRect(cx - 5, cy - 3, 4, 4)
  ctx.fillRect(cx + 1, cy - 3, 4, 4)
  // antler suggestions
  ctx.fillStyle = '#787878'
  pixLine(ctx, cx - 8, cy - 5, cx - 18, cy - 18, 2)
  pixLine(ctx, cx - 18, cy - 18, cx - 22, cy - 14 + rng.range(0, 3), 1)
  pixLine(ctx, cx + 8, cy - 5, cx + 18, cy - 18, 2)
  pixLine(ctx, cx + 18, cy - 18, cx + 22, cy - 14 + rng.range(0, 3), 1)
}

// ── Swamp extras ──────────────────────────────────────────────────────────

const drawSwampCattail: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 3 + rng.int(0, 1)
  for (let i = 0; i < count; i++) {
    const rx = cx + rng.range(-10, 10)
    const h = 26 + rng.range(0, 10)
    // thin green reed
    ctx.fillStyle = '#2a4a10'
    pixLine(ctx, rx, baseY, rx + rng.range(-2, 2), baseY - h, 2)
    // brown oval seed head at top
    ctx.fillStyle = '#5a3a10'
    ctx.beginPath()
    ctx.ellipse(rx, baseY - h - 3, 3, 5, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawSwampMossyRock: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  const rx = 16 + rng.range(0, 6)
  const ry = 10 + rng.range(0, 4)
  // dark rock
  ctx.fillStyle = '#2a3020'
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  // green moss patches
  ctx.fillStyle = '#1a3a08'
  for (let i = 0; i < 4; i++) {
    const mx = cx + rng.range(-rx * 0.5, rx * 0.5)
    const my = cy + rng.range(-ry * 0.4, ry * 0.4)
    ctx.beginPath()
    ctx.ellipse(mx, my, 5 + rng.range(0, 3), 3 + rng.range(0, 2), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // dripping wisps
  ctx.fillStyle = '#1a3a08'
  for (let i = 0; i < 3; i++) {
    const wx = cx + rng.range(-rx * 0.5, rx * 0.5)
    const wy = cy + ry * 0.6
    pixLine(ctx, wx, wy, wx + rng.range(-2, 2), wy + 4 + rng.range(0, 4), 1)
  }
}

const drawSwampLantern: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const postH = 30 + rng.range(0, 8)
  // crooked brown post
  ctx.fillStyle = '#3a2010'
  pixLine(ctx, cx, baseY, cx + rng.range(-3, 3), baseY - postH, 3)
  // curved tip
  const tipX = cx + 8
  const tipY = baseY - postH - 2
  pixLine(ctx, cx, baseY - postH, tipX, tipY, 2)
  // warm yellow lantern
  ctx.fillStyle = '#ffcc44'
  ctx.fillRect(tipX - 3, tipY, 6, 7)
  // glow
  ctx.fillStyle = 'rgba(255,204,68,0.2)'
  ctx.beginPath()
  ctx.arc(tipX, tipY + 3, 10, 0, Math.PI * 2)
  ctx.fill()
}

// ── Savanna extras ────────────────────────────────────────────────────────

const drawSavannaDeadTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const trunkH = 36 + rng.range(0, 8)
  // bleached trunk
  ctx.fillStyle = '#c0b898'
  ctx.fillRect(cx - 4, baseY - trunkH, 8, trunkH)
  // bare twisted branches
  const branches: [number, number, number, number][] = [
    [cx, baseY - trunkH * 0.8, cx - 18, baseY - trunkH - 4],
    [cx, baseY - trunkH * 0.8, cx + 16, baseY - trunkH - 2],
    [cx, baseY - trunkH * 0.6, cx - 12, baseY - trunkH * 0.75],
    [cx, baseY - trunkH * 0.6, cx + 14, baseY - trunkH * 0.7],
  ]
  ctx.fillStyle = '#b0a888'
  for (const [x1, y1, x2, y2] of branches) {
    pixLine(ctx, x1, y1, x2, y2, 2)
  }
}

const drawSavannaTermiteMound: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 32 + rng.range(0, 10)
  const baseW = 16 + rng.range(0, 4)
  // tall tapering cone
  ctx.fillStyle = '#8a6030'
  ctx.beginPath()
  ctx.moveTo(cx - baseW / 2, baseY)
  ctx.lineTo(cx + baseW / 2, baseY)
  ctx.lineTo(cx + 3, baseY - h)
  ctx.lineTo(cx - 3, baseY - h)
  ctx.closePath()
  ctx.fill()
  // small dark holes
  ctx.fillStyle = '#3a2010'
  for (let i = 0; i < 5; i++) {
    const hx = cx + rng.range(-baseW * 0.3, baseW * 0.3)
    const hy = baseY - rng.range(4, h - 4)
    ctx.fillRect(hx - 1, hy - 1, 3, 2)
  }
}

const drawSavannaDryBush: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 12 + rng.range(0, 4)
  // golden-brown scrubby bush
  ctx.fillStyle = '#9a8040'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // darker patches
  ctx.fillStyle = '#7a6030'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-r * 0.4, r * 0.4)
    const py = cy + rng.range(-r * 0.3, r * 0.3)
    ctx.beginPath()
    ctx.ellipse(px, py, 4, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // thorn spikes protruding
  ctx.fillStyle = '#6a5020'
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2)
    const sx = cx + Math.cos(a) * r
    const sy = cy + Math.sin(a) * r * 0.7
    pixLine(ctx, sx, sy, sx + Math.cos(a) * 5, sy + Math.sin(a) * 5 * 0.7, 1)
  }
}

const drawSavannaWaypost: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const postH = 34 + rng.range(0, 6)
  // wooden post
  ctx.fillStyle = '#5a3210'
  ctx.fillRect(cx - 3, baseY - postH, 6, postH)
  // horizontal plank sign near top
  ctx.fillStyle = '#6a4220'
  ctx.fillRect(cx - 12, baseY - postH + 4, 24, 8)
  // dark line on sign
  ctx.fillStyle = '#3a2008'
  ctx.fillRect(cx - 10, baseY - postH + 7, 20, 1)
}

// ── Crystal extras ────────────────────────────────────────────────────────

const drawCrystalCluster: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 4 + rng.int(0, 1)
  for (let i = 0; i < count; i++) {
    const sx = cx + rng.range(-12, 12)
    const h = 12 + rng.range(0, 16)
    const w = 4 + rng.range(0, 3)
    // main facet
    ctx.fillStyle = '#60b0e0'
    ctx.beginPath()
    ctx.moveTo(sx, baseY - h)
    ctx.lineTo(sx + w / 2, baseY - h / 3)
    ctx.lineTo(sx + w / 2 * 0.6, baseY)
    ctx.lineTo(sx - w / 2 * 0.6, baseY)
    ctx.lineTo(sx - w / 2, baseY - h / 3)
    ctx.closePath()
    ctx.fill()
    // dark facet
    ctx.fillStyle = '#104060'
    ctx.beginPath()
    ctx.moveTo(sx, baseY - h)
    ctx.lineTo(sx - w / 2, baseY - h / 3)
    ctx.lineTo(sx - w * 0.1, baseY - h * 0.6)
    ctx.closePath()
    ctx.fill()
  }
}

const drawCrystalFlower: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.45
  // diamond-shaped crystal petals
  ctx.fillStyle = '#4080c0'
  const petalR = 8 + rng.range(0, 3)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const px = cx + Math.cos(a) * petalR
    const py = cy + Math.sin(a) * petalR
    ctx.beginPath()
    ctx.moveTo(px + Math.cos(a) * 4, py + Math.sin(a) * 4)
    ctx.lineTo(px + Math.cos(a + Math.PI / 2) * 2, py + Math.sin(a + Math.PI / 2) * 2)
    ctx.lineTo(px - Math.cos(a) * 4, py - Math.sin(a) * 4)
    ctx.lineTo(px + Math.cos(a - Math.PI / 2) * 2, py + Math.sin(a - Math.PI / 2) * 2)
    ctx.closePath()
    ctx.fill()
  }
  // central dot
  ctx.fillStyle = '#c0f0ff'
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fill()
  // short stem
  ctx.fillStyle = '#4080c0'
  ctx.fillRect(cx - 1, cy + petalR + 4, 2, SPRITE_SIZE - cy - petalR - 8)
}

const drawCrystalShard: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 30 + rng.range(0, 10)
  const w = 12 + rng.range(0, 4)
  const tilt = rng.range(-4, 4)
  // single large tilted crystal shard
  // base facet
  ctx.fillStyle = '#2860a0'
  ctx.beginPath()
  ctx.moveTo(cx + tilt, baseY - h)
  ctx.lineTo(cx + w / 2, baseY - h / 3)
  ctx.lineTo(cx + w / 2 * 0.6, baseY)
  ctx.lineTo(cx - w / 2 * 0.6, baseY)
  ctx.lineTo(cx - w / 2, baseY - h / 3)
  ctx.closePath()
  ctx.fill()
  // bright highlight facet
  ctx.fillStyle = '#c0f0ff'
  ctx.beginPath()
  ctx.moveTo(cx + tilt, baseY - h)
  ctx.lineTo(cx + w / 2, baseY - h / 3)
  ctx.lineTo(cx + w * 0.1, baseY - h * 0.6)
  ctx.closePath()
  ctx.fill()
}

const drawCrystalRuneStone: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 32 + rng.range(0, 8)
  const w = 14 + rng.range(0, 4)
  // standing crystal tablet
  ctx.fillStyle = '#2860a0'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // bright cyan rune lines
  ctx.fillStyle = '#60e0ff'
  // vertical line
  pixLine(ctx, cx, baseY - h + 6, cx, baseY - 6, 1)
  // horizontal bars
  pixLine(ctx, cx - w * 0.3, baseY - h * 0.7, cx + w * 0.3, baseY - h * 0.7, 1)
  pixLine(ctx, cx - w * 0.25, baseY - h * 0.4, cx + w * 0.25, baseY - h * 0.4, 1)
  // diagonal accents
  pixLine(ctx, cx - w * 0.2, baseY - h * 0.55, cx + w * 0.2, baseY - h * 0.55, 1)
}

// ── Crystal new sprites ──────────────────────────────────────────────────

const drawCrystalTowerTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 40 + rng.range(0, 10)
  const w = 10 + rng.range(0, 4)
  // hexagonal crystal tower
  ctx.fillStyle = pal[1] || '#30a0d0'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - h)
  ctx.lineTo(cx + w / 2, baseY - h + 6)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx - w / 2, baseY)
  ctx.lineTo(cx - w / 2, baseY - h + 6)
  ctx.closePath()
  ctx.fill()
  // bright facet stripe
  ctx.fillStyle = pal[5] || '#c0f0ff'
  ctx.fillRect(cx + 1, baseY - h + 8, w / 4, h - 12)
  // dark facet stripe
  ctx.fillStyle = pal[0] || '#104060'
  ctx.fillRect(cx - w / 3, baseY - h + 8, w / 5, h - 12)
  // top hex cap
  ctx.fillStyle = pal[3] || '#60c0e0'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - h - 4)
  ctx.lineTo(cx + w / 2 + 2, baseY - h + 2)
  ctx.lineTo(cx - w / 2 - 2, baseY - h + 2)
  ctx.closePath()
  ctx.fill()
}

const drawCrystalGeodeTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.45
  const outerR = 18 + rng.range(0, 4)
  // outer rock shell
  ctx.fillStyle = '#4a5060'
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.fill()
  // hollow interior
  ctx.fillStyle = '#1a1a2a'
  ctx.beginPath()
  ctx.arc(cx, cy, outerR * 0.65, 0, Math.PI * 2)
  ctx.fill()
  // crystal points inside
  const count = 6 + rng.int(0, 3)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const r = outerR * 0.6
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    const len = 4 + rng.range(0, 4)
    ctx.fillStyle = pal[Math.floor(rng.range(1, 5))] || '#60b0e0'
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px - Math.cos(a) * len - 2, py - Math.sin(a) * len)
    ctx.lineTo(px - Math.cos(a) * len + 2, py - Math.sin(a) * len)
    ctx.closePath()
    ctx.fill()
  }
}

const drawCrystalPrism: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  const count = 3 + rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const px = cx + rng.range(-14, 14)
    const py = cy + rng.range(-6, 6)
    const s = 6 + rng.range(0, 4)
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#4080c0'
    ctx.beginPath()
    ctx.moveTo(px, py - s)
    ctx.lineTo(px + s * 0.87, py + s * 0.5)
    ctx.lineTo(px - s * 0.87, py + s * 0.5)
    ctx.closePath()
    ctx.fill()
    // highlight edge
    ctx.fillStyle = pal[5] || '#c0f0ff'
    ctx.beginPath()
    ctx.moveTo(px, py - s)
    ctx.lineTo(px + s * 0.87, py + s * 0.5)
    ctx.lineTo(px + s * 0.2, py - s * 0.1)
    ctx.closePath()
    ctx.fill()
  }
}

const drawCrystalMoss: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // luminous crystal moss cluster
  const patches = 5 + rng.int(0, 3)
  for (let i = 0; i < patches; i++) {
    const px = cx + rng.range(-16, 16)
    const py = cy + rng.range(-8, 8)
    const r = 3 + rng.range(0, 3)
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#40a0b0'
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
    // glow center
    ctx.fillStyle = pal[5] || '#c0f0ff'
    ctx.beginPath()
    ctx.arc(px, py, r * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCrystalDust: DrawFn = (ctx, rng, _pal) => {
  const baseY = SPRITE_SIZE - 4
  const sparkles = 10 + rng.int(0, 5)
  for (let i = 0; i < sparkles; i++) {
    const x = rng.range(4, SPRITE_SIZE - 4)
    const y = baseY - rng.range(0, 20)
    const s = 1 + rng.range(0, 2)
    const bright = rng.next() > 0.5 ? '#c0f0ff' : '#80d0ee'
    ctx.fillStyle = bright
    ctx.fillRect(x, y, s, s)
  }
}

const drawCrystalStalagmite: DrawFn = (ctx, rng, pal) => {
  const baseY = SPRITE_SIZE - 4
  const count = 3 + rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const sx = 12 + rng.range(0, SPRITE_SIZE - 24)
    const h = 8 + rng.range(0, 8)
    const w = 3 + rng.range(0, 2)
    ctx.fillStyle = pal[Math.floor(rng.range(1, 4))] || '#60b0e0'
    ctx.beginPath()
    ctx.moveTo(sx, baseY - h)
    ctx.lineTo(sx + w, baseY)
    ctx.lineTo(sx - w, baseY)
    ctx.closePath()
    ctx.fill()
  }
}

const drawCrystalBoulder: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // large faceted boulder shape
  const sides = 6 + rng.int(0, 2)
  const rx = 16 + rng.range(0, 4)
  const ry = 12 + rng.range(0, 3)
  ctx.fillStyle = pal[1] || '#2860a0'
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * rx * (1 + rng.range(-0.15, 0.15))
    const y = cy + Math.sin(a) * ry * (1 + rng.range(-0.15, 0.15))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // bright highlight facet
  ctx.fillStyle = pal[5] || '#c0f0ff'
  ctx.beginPath()
  ctx.moveTo(cx - rx * 0.3, cy - ry * 0.6)
  ctx.lineTo(cx + rx * 0.4, cy - ry * 0.4)
  ctx.lineTo(cx + rx * 0.1, cy)
  ctx.closePath()
  ctx.fill()
  // dark facet
  ctx.fillStyle = pal[0] || '#104060'
  ctx.beginPath()
  ctx.moveTo(cx + rx * 0.4, cy - ry * 0.4)
  ctx.lineTo(cx + rx * 0.6, cy + ry * 0.2)
  ctx.lineTo(cx + rx * 0.1, cy)
  ctx.closePath()
  ctx.fill()
}

const drawCrystalPillar: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 44 + rng.range(0, 8)
  const w = 8 + rng.range(0, 3)
  // tall obelisk
  ctx.fillStyle = pal[1] || '#30a0d0'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - h)
  ctx.lineTo(cx + w / 2, baseY - h + 8)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx - w / 2, baseY)
  ctx.lineTo(cx - w / 2, baseY - h + 8)
  ctx.closePath()
  ctx.fill()
  // highlight strip
  ctx.fillStyle = pal[5] || '#c0f0ff'
  ctx.fillRect(cx + 1, baseY - h + 10, 2, h - 14)
  // rune marks
  ctx.fillStyle = '#60e0ff'
  for (let i = 0; i < 3; i++) {
    const ry = baseY - h * 0.3 - i * 10
    ctx.fillRect(cx - w / 3, ry, w * 0.6, 1)
  }
}

const drawCrystalGate: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 40 + rng.range(0, 6)
  const w = 28 + rng.range(0, 4)
  const pillarW = 6
  // left pillar
  ctx.fillStyle = pal[1] || '#30a0d0'
  ctx.fillRect(cx - w / 2, baseY - h, pillarW, h)
  // right pillar
  ctx.fillRect(cx + w / 2 - pillarW, baseY - h, pillarW, h)
  // arch top
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY - h)
  ctx.quadraticCurveTo(cx, baseY - h - 10, cx + w / 2, baseY - h)
  ctx.lineTo(cx + w / 2 - pillarW, baseY - h)
  ctx.quadraticCurveTo(cx, baseY - h - 4, cx - w / 2 + pillarW, baseY - h)
  ctx.closePath()
  ctx.fill()
  // highlight on left pillar
  ctx.fillStyle = pal[5] || '#c0f0ff'
  ctx.fillRect(cx - w / 2 + 1, baseY - h + 4, 2, h - 8)
  // glow in center
  ctx.fillStyle = 'rgba(96,224,255,0.15)'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h / 2, w / 3, h / 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── AshWastes extras ──────────────────────────────────────────────────────

const drawAshCharredTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const trunkH = 34 + rng.range(0, 8)
  // blackened splintered trunk
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(cx - 4, baseY - trunkH, 8, trunkH)
  // splinters at top
  ctx.fillRect(cx - 5, baseY - trunkH - 3, 3, 6)
  ctx.fillRect(cx + 2, baseY - trunkH - 5, 3, 8)
  // no canopy
  // ember glow dot at top
  ctx.fillStyle = '#ff4400'
  ctx.beginPath()
  ctx.arc(cx, baseY - trunkH - 2, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,68,0,0.2)'
  ctx.beginPath()
  ctx.arc(cx, baseY - trunkH - 2, 6, 0, Math.PI * 2)
  ctx.fill()
}

const drawAshBonePile: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // ash pieces
  ctx.fillStyle = '#404040'
  for (let i = 0; i < 4; i++) {
    const ax = cx + rng.range(-14, 14)
    const ay = cy + rng.range(-4, 6)
    ctx.fillRect(ax - 2, ay - 1, 4 + rng.range(0, 3), 3)
  }
  // bone shapes
  ctx.fillStyle = '#c0c0b0'
  for (let i = 0; i < 5; i++) {
    const bx = cx + rng.range(-12, 12)
    const by = cy + rng.range(-6, 4)
    const angle = rng.range(0, Math.PI)
    const len = 5 + rng.range(0, 6)
    pixLine(ctx,
      bx - Math.cos(angle) * len / 2, by - Math.sin(angle) * len / 2,
      bx + Math.cos(angle) * len / 2, by + Math.sin(angle) * len / 2, 2)
  }
}

const drawAshDeadBush: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // thin gray skeletal bush outline
  ctx.fillStyle = '#606060'
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, Math.PI * 2)
    const len = 8 + rng.range(0, 10)
    pixLine(ctx, cx, cy,
      cx + Math.cos(a) * len, cy + Math.sin(a) * len, 1)
    // sub-branch
    const mx = cx + Math.cos(a) * len * 0.6
    const my = cy + Math.sin(a) * len * 0.6
    const a2 = a + rng.range(-0.8, 0.8)
    pixLine(ctx, mx, my,
      mx + Math.cos(a2) * 5, my + Math.sin(a2) * 5, 1)
  }
}

const drawAshGravestone: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 22 + rng.range(0, 6)
  const w = 12 + rng.range(0, 4)
  const tilt = rng.range(-4, 4)
  // tilted cracked gray slab
  ctx.fillStyle = '#505050'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx + w / 2 * 0.8 + tilt, baseY - h)
  ctx.lineTo(cx - w / 2 * 0.8 + tilt, baseY - h)
  ctx.closePath()
  ctx.fill()
  // rounded top
  ctx.beginPath()
  ctx.ellipse(cx + tilt, baseY - h, w * 0.4, 4, 0, Math.PI, 0)
  ctx.fill()
  // cross etching
  ctx.fillStyle = '#404040'
  pixLine(ctx, cx + tilt * 0.5, baseY - h * 0.7, cx + tilt * 0.5, baseY - h * 0.3, 1)
  pixLine(ctx, cx + tilt * 0.5 - 3, baseY - h * 0.55, cx + tilt * 0.5 + 3, baseY - h * 0.55, 1)
  // crack
  pixLine(ctx, cx + tilt * 0.3 + 2, baseY - h * 0.8, cx + tilt * 0.3 - 1, baseY - h * 0.4, 1)
}

// ── Mushroom extras ───────────────────────────────────────────────────────

const drawMushroomSporePuff: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.45
  // 3-4 soft translucent purple-pink circles
  const count = 3 + rng.int(0, 1)
  for (let i = 0; i < count; i++) {
    const px = cx + rng.range(-10, 10)
    const py = cy + rng.range(-8, 8)
    const r = 6 + rng.range(0, 4)
    ctx.fillStyle = 'rgba(192,96,224,0.35)'
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // bright spore dots
  ctx.fillStyle = '#e0a0ff'
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(cx + rng.range(-16, 16), cy + rng.range(-12, 12), 2, 2)
  }
}

const drawMushroomCoralRock: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // base rock
  ctx.fillStyle = '#405870'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 14, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // branching purple coral-fungus protrusions
  ctx.fillStyle = '#7030a0'
  for (let i = 0; i < 5; i++) {
    const bx = cx + rng.range(-10, 10)
    const by = cy - 4
    const h = 8 + rng.range(0, 10)
    pixLine(ctx, bx, by, bx + rng.range(-5, 5), by - h, 2)
    // branch tip
    ctx.fillRect(bx + rng.range(-5, 5) - 1, by - h - 1, 3, 3)
  }
}

const drawMushroomWebbing: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // network of thin white-purple mycelium lines radiating outward
  ctx.fillStyle = '#b080d0'
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2)
    const len = 10 + rng.range(0, 14)
    pixLine(ctx, cx, cy,
      cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.5, 1)
    // sub-branches
    const mx = cx + Math.cos(a) * len * 0.5
    const my = cy + Math.sin(a) * len * 0.5 * 0.5
    const a2 = a + rng.range(-1, 1)
    pixLine(ctx, mx, my,
      mx + Math.cos(a2) * 6, my + Math.sin(a2) * 3, 1)
  }
}

const drawMushroomRing: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const ringR = 14 + rng.range(0, 4)
  const count = 6 + rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const mx = cx + Math.cos(a) * ringR
    const my = cy + Math.sin(a) * ringR * 0.5
    // tiny stem
    ctx.fillStyle = '#6090b0'
    ctx.fillRect(mx - 1, my - 4, 2, 6)
    // tiny cap
    ctx.fillStyle = '#7030a0'
    ctx.beginPath()
    ctx.ellipse(mx, my - 4, 3 + rng.range(0, 1), 2, 0, Math.PI, 0)
    ctx.fill()
  }
}

// ── Alpine sprites ────────────────────────────────────────────────────────

const drawAlpinePine: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk
  ctx.fillStyle = '#4a3828'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.55, 6, SPRITE_SIZE * 0.45)
  // layered snow-heavy triangles
  const layers = 5
  for (let i = 0; i < layers; i++) {
    const t = i / layers
    const y = SPRITE_SIZE * (0.55 - t * 0.45)
    const w = 8 + t * 18 + rng.range(-1, 1)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a4060'
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx - w, y + 10)
    ctx.lineTo(cx + w, y + 10)
    ctx.closePath()
    ctx.fill()
    // heavy snow cap
    ctx.fillStyle = '#e8eeff'
    const sw = w * 0.7
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx - sw, y + 4)
    ctx.lineTo(cx + sw, y + 4)
    ctx.closePath()
    ctx.fill()
  }
}

const drawAlpineFir: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  ctx.fillStyle = '#3a2818'
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.4, 8, SPRITE_SIZE * 0.6)
  // columnar canopy
  const canopyH = SPRITE_SIZE * 0.55
  const canopyW = 14 + rng.range(-2, 2)
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a3050'
  ctx.beginPath()
  ctx.moveTo(cx, SPRITE_SIZE * 0.05)
  ctx.lineTo(cx - canopyW, SPRITE_SIZE * 0.05 + canopyH)
  ctx.lineTo(cx + canopyW, SPRITE_SIZE * 0.05 + canopyH)
  ctx.closePath()
  ctx.fill()
  // snow patches
  ctx.fillStyle = '#dde8ff'
  for (let i = 0; i < 4; i++) {
    const py = SPRITE_SIZE * 0.1 + i * 12
    const pw = canopyW * (1 - i * 0.15)
    ctx.fillRect(cx - pw * 0.4, py, pw * 0.8, 3)
  }
}

const drawAlpineBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 12 + rng.range(0, 4)
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a5060'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
  // snow on top
  ctx.fillStyle = '#e0e8f8'
  ctx.beginPath()
  ctx.ellipse(cx, cy - r * 0.3, r * 0.8, 4, 0, Math.PI, 0)
  ctx.fill()
}

const drawAlpineFlower: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // short stem
  ctx.fillStyle = '#506050'
  ctx.fillRect(cx - 1, baseY - 12, 2, 12)
  // edelweiss-like white star flower
  ctx.fillStyle = '#f0f0e8'
  const petalR = 4 + rng.range(0, 2)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(a) * petalR
    const py = baseY - 14 + Math.sin(a) * petalR
    ctx.beginPath()
    ctx.ellipse(px, py, 3, 2, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffee88'
  ctx.beginPath()
  ctx.arc(cx, baseY - 14, 2, 0, Math.PI * 2)
  ctx.fill()
}

const drawAlpineMonolith: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 38 + rng.range(0, 10)
  const w = 14 + rng.range(0, 4)
  ctx.fillStyle = pal[1] || '#607080'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx + w * 0.3, baseY - h)
  ctx.lineTo(cx - w * 0.3, baseY - h)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#e0e8f8'
  ctx.fillRect(cx - w * 0.3, baseY - h, w * 0.6, 3)
  ctx.fillStyle = pal[0] || '#405060'
  ctx.fillRect(cx + w * 0.1, baseY - h, w * 0.2, h)
}

// ── Cliffs sprites ────────────────────────────────────────────────────────

const drawCliffScrubTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // wind-bent short tree
  const lean = 6 + rng.range(0, 4)
  ctx.fillStyle = '#5a4a38'
  pixLine(ctx, cx - 2, baseY, cx + lean, baseY - 24, 3)
  // small gnarled canopy
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#4a6050'
  ctx.beginPath()
  ctx.ellipse(cx + lean + 4, baseY - 26, 10 + rng.range(0, 4), 8, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawCliffBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // hardy grey-green scrub
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#5a6858'
  const r = 10 + rng.range(0, 3)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#4a5848'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-r * 0.4, r * 0.4)
    const py = cy + rng.range(-3, 3)
    ctx.beginPath()
    ctx.ellipse(px, py, 3, 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCliffSlateRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.58
  // stacked slate layers
  const layers = 3 + rng.int(0, 2)
  for (let i = 0; i < layers; i++) {
    const w = 20 + rng.range(-4, 4) - i * 3
    const h = 6 + rng.range(0, 3)
    const ox = rng.range(-3, 3)
    ctx.fillStyle = i % 2 === 0 ? (pal[1] || '#607080') : (pal[0] || '#4a5a68')
    ctx.fillRect(cx - w / 2 + ox, cy - i * 8, w, h)
  }
}

const drawCliffNestStructure: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // large bird nest - bowl of sticks
  ctx.fillStyle = '#6a5030'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 6, 16, 8, 0, 0, Math.PI)
  ctx.fill()
  // stick texture lines
  ctx.fillStyle = '#503a20'
  for (let i = 0; i < 8; i++) {
    const x1 = cx + rng.range(-14, 14)
    const y1 = baseY - 10 + rng.range(0, 6)
    pixLine(ctx, x1, y1, x1 + rng.range(-6, 6), y1 + rng.range(-3, 3), 1)
  }
  // eggs
  ctx.fillStyle = '#e8e0d0'
  for (let i = 0; i < 2; i++) {
    ctx.beginPath()
    ctx.ellipse(cx + rng.range(-6, 6), baseY - 10, 3, 4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCliffGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // sparse wiry cliff grass
  ctx.fillStyle = '#6a7a60'
  const blades = 4 + rng.int(0, 2)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-12, 12)
    const h = 8 + rng.range(0, 6)
    const lean = rng.range(-4, 4)
    pixLine(ctx, bx, baseY, bx + lean, baseY - h, 1)
  }
}

// ── FloatingIslands sprites ───────────────────────────────────────────────

const drawSkyTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // ethereal white-barked tree
  ctx.fillStyle = '#d0d8e0'
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.4, 8, SPRITE_SIZE * 0.6)
  // luminous blue-white canopy
  const canopyR = 18 + rng.range(-2, 4)
  const canopyY = SPRITE_SIZE * 0.32
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#88bbdd'
  ctx.beginPath()
  ctx.arc(cx, canopyY, canopyR, 0, Math.PI * 2)
  ctx.fill()
  // bright highlights
  ctx.fillStyle = '#c0e0ff'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-canopyR * 0.4, canopyR * 0.4)
    const py = canopyY + rng.range(-canopyR * 0.4, canopyR * 0.2)
    ctx.beginPath()
    ctx.arc(px, py, 4 + rng.range(0, 3), 0, Math.PI * 2)
    ctx.fill()
  }
  // floating wisps below
  ctx.fillStyle = 'rgba(180,220,255,0.15)'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE * 0.85, 16, 6, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#88aacc'
  const r = 12 + rng.range(0, 4)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // glowing particles
  ctx.fillStyle = '#c0e8ff'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + rng.range(-r, r), cy + rng.range(-r * 0.5, r * 0.5), 2, 2)
  }
}

const drawSkyRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // floating rock chunk
  const rx = 14 + rng.range(0, 6)
  const ry = 10 + rng.range(0, 4)
  ctx.fillStyle = pal[1] || '#8899aa'
  ctx.beginPath()
  const sides = 5 + rng.int(0, 2)
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const x = cx + Math.cos(angle) * rx * (1 + rng.range(-0.1, 0.1))
    const y = cy + Math.sin(angle) * ry * (1 + rng.range(-0.1, 0.1))
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  // light streak underneath
  ctx.fillStyle = 'rgba(180,220,255,0.2)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + ry + 4, rx * 0.6, 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyShrine: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // floating crystal pedestal
  ctx.fillStyle = pal[1] || '#8899aa'
  ctx.fillRect(cx - 10, baseY - 16, 20, 16)
  // crystal on top
  ctx.fillStyle = '#88ccff'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 36)
  ctx.lineTo(cx + 6, baseY - 20)
  ctx.lineTo(cx - 6, baseY - 20)
  ctx.closePath()
  ctx.fill()
  // glow
  ctx.fillStyle = 'rgba(136,204,255,0.2)'
  ctx.beginPath()
  ctx.arc(cx, baseY - 28, 10, 0, Math.PI * 2)
  ctx.fill()
}

// ── Heaven new sprites ───────────────────────────────────────────────────

const drawSkyCloudTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk of mist
  ctx.fillStyle = 'rgba(200,220,240,0.4)'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.5, 6, SPRITE_SIZE * 0.5)
  // fluffy cloud canopy from overlapping circles
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#c0d8f0'
  const blobs = 5 + rng.int(0, 2)
  for (let i = 0; i < blobs; i++) {
    const bx = cx + rng.range(-16, 16)
    const by = SPRITE_SIZE * 0.35 + rng.range(-8, 8)
    const r = 8 + rng.range(0, 6)
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // bright highlight
  ctx.fillStyle = '#e8f4ff'
  ctx.beginPath()
  ctx.arc(cx + rng.range(-4, 4), SPRITE_SIZE * 0.28, 6, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyGlowTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // luminous trunk
  ctx.fillStyle = '#d8e4f0'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.42, 6, SPRITE_SIZE * 0.58)
  // ethereal canopy
  const canopyR = 16 + rng.range(0, 4)
  const canopyY = SPRITE_SIZE * 0.32
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#aaccee'
  ctx.beginPath()
  ctx.arc(cx, canopyY, canopyR, 0, Math.PI * 2)
  ctx.fill()
  // bright light patches
  ctx.fillStyle = '#ffffcc'
  const patches = 4 + rng.int(0, 2)
  for (let i = 0; i < patches; i++) {
    const px = cx + rng.range(-canopyR * 0.5, canopyR * 0.5)
    const py = canopyY + rng.range(-canopyR * 0.5, canopyR * 0.3)
    ctx.beginPath()
    ctx.arc(px, py, 2 + rng.range(0, 3), 0, Math.PI * 2)
    ctx.fill()
  }
  // glow aura
  ctx.fillStyle = 'rgba(255,255,200,0.1)'
  ctx.beginPath()
  ctx.arc(cx, canopyY, canopyR + 6, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyFeather: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.45
  // feather shaft
  ctx.fillStyle = '#d0d8e0'
  pixLine(ctx, cx - 10, cy + 12, cx + 10, cy - 12, 1)
  // feather barbs
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#b0c8e0'
  const barbs = 8 + rng.int(0, 3)
  for (let i = 0; i < barbs; i++) {
    const t = i / barbs
    const bx = cx - 10 + t * 20
    const by = cy + 12 - t * 24
    const len = 6 + rng.range(0, 4)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#b0c8e0'
    pixLine(ctx, bx, by, bx - len, by - len * 0.5, 1)
    pixLine(ctx, bx, by, bx + len, by - len * 0.5, 1)
  }
}

const drawSkyBlossom: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.45
  // radiant blossom petals
  const petals = 5 + rng.int(0, 2)
  const petalR = 8 + rng.range(0, 3)
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    const px = cx + Math.cos(a) * petalR
    const py = cy + Math.sin(a) * petalR
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#c0d0ff'
    ctx.beginPath()
    ctx.ellipse(px, py, 6, 4, a, 0, Math.PI * 2)
    ctx.fill()
  }
  // glowing center
  ctx.fillStyle = '#ffffdd'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()
  // radiant glow
  ctx.fillStyle = 'rgba(255,255,220,0.15)'
  ctx.beginPath()
  ctx.arc(cx, cy, petalR + 6, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyStarGrass: DrawFn = (ctx, rng, pal) => {
  const baseY = SPRITE_SIZE - 4
  const blades = 6 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const x = 8 + rng.range(0, SPRITE_SIZE - 16)
    const h = 10 + rng.range(0, 14)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#a0b8d0'
    pixLine(ctx, x, baseY, x + rng.range(-3, 3), baseY - h, 1)
    // star tip
    ctx.fillStyle = '#ffffcc'
    const tx = x + rng.range(-3, 3)
    const ty = baseY - h
    ctx.fillRect(tx - 1, ty - 1, 3, 3)
    ctx.fillRect(tx, ty - 2, 1, 1)
    ctx.fillRect(tx, ty + 2, 1, 1)
  }
}

const drawSkyCloudRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // floating cloud-like rock from overlapping ellipses
  ctx.fillStyle = pal[1] || '#b0c0d8'
  const lumps = 3 + rng.int(0, 2)
  for (let i = 0; i < lumps; i++) {
    const lx = cx + rng.range(-10, 10)
    const ly = cy + rng.range(-4, 4)
    ctx.beginPath()
    ctx.ellipse(lx, ly, 10 + rng.range(0, 4), 6 + rng.range(0, 3), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // bright top highlight
  ctx.fillStyle = '#e0ecff'
  ctx.beginPath()
  ctx.ellipse(cx, cy - 4, 8, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // shadow underneath
  ctx.fillStyle = 'rgba(100,140,180,0.2)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 8, 12, 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawSkyPillar: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 42 + rng.range(0, 8)
  const w = 10 + rng.range(0, 3)
  // marble pillar body
  ctx.fillStyle = pal[1] || '#c8d4e0'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // capital (top)
  ctx.fillStyle = '#d8e4f0'
  ctx.fillRect(cx - w / 2 - 3, baseY - h - 3, w + 6, 5)
  // base
  ctx.fillRect(cx - w / 2 - 2, baseY - 4, w + 4, 4)
  // vertical fluting lines
  ctx.fillStyle = 'rgba(160,180,200,0.3)'
  for (let i = 0; i < 3; i++) {
    const lx = cx - w / 3 + i * (w / 3)
    ctx.fillRect(lx, baseY - h + 4, 1, h - 8)
  }
}

const drawSkyFountain: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // basin
  ctx.fillStyle = pal[1] || '#b0c0d8'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 8, 18, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // pedestal
  ctx.fillStyle = '#c8d4e0'
  ctx.fillRect(cx - 4, baseY - 24, 8, 16)
  // water spout arc
  ctx.fillStyle = 'rgba(180,220,255,0.5)'
  ctx.beginPath()
  ctx.arc(cx, baseY - 24, 8, Math.PI, 0)
  ctx.fill()
  // water droplets
  ctx.fillStyle = 'rgba(180,220,255,0.4)'
  for (let i = 0; i < 4; i++) {
    const dx = cx + rng.range(-12, 12)
    const dy = baseY - 14 + rng.range(-6, 4)
    ctx.fillRect(dx, dy, 2, 2)
  }
  // glow
  ctx.fillStyle = 'rgba(180,220,255,0.1)'
  ctx.beginPath()
  ctx.arc(cx, baseY - 16, 20, 0, Math.PI * 2)
  ctx.fill()
}

// ── Jungle sprites ────────────────────────────────────────────────────────

const drawJungleTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // thick dark trunk
  ctx.fillStyle = '#2a1808'
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.3, 12, SPRITE_SIZE * 0.7)
  // massive layered canopy
  const canopyR = 24 + rng.range(-2, 4)
  const canopyY = SPRITE_SIZE * 0.25
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#0a3808'
  ctx.beginPath()
  ctx.arc(cx, canopyY, canopyR, 0, Math.PI * 2)
  ctx.fill()
  // lighter patches
  ctx.fillStyle = pal[3] || '#1a5810'
  for (let i = 0; i < 4; i++) {
    const px = cx + rng.range(-canopyR * 0.5, canopyR * 0.5)
    const py = canopyY + rng.range(-canopyR * 0.4, canopyR * 0.3)
    ctx.beginPath()
    ctx.ellipse(px, py, 6 + rng.range(0, 4), 4 + rng.range(0, 3), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // hanging vines
  ctx.fillStyle = '#1a4808'
  for (let i = 0; i < 3; i++) {
    const vx = cx + rng.range(-canopyR * 0.6, canopyR * 0.6)
    const vy = canopyY + canopyR * 0.6
    pixLine(ctx, vx, vy, vx + rng.range(-3, 3), vy + 10 + rng.range(0, 8), 1)
  }
}

const drawJunglePalm: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const trunkH = 36 + rng.range(0, 8)
  // curved trunk
  ctx.fillStyle = '#4a3018'
  for (let t = 0; t < 1; t += 0.05) {
    const x = cx + Math.sin(t * 1.5) * 6
    const y = baseY - t * trunkH
    ctx.fillRect(x - 3, y, 6, 3)
  }
  // palm fronds radiating from top
  const topX = cx + Math.sin(1.5) * 6
  const topY = baseY - trunkH
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5808'
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const len = 14 + rng.range(0, 6)
    for (let t = 0; t < 1; t += 0.1) {
      const fx = topX + Math.cos(angle) * len * t
      const fy = topY + Math.sin(angle) * len * t * 0.5 + t * t * 8
      const w = 4 * (1 - t * 0.5)
      ctx.fillRect(fx - w / 2, fy, w, 2)
    }
  }
}

const drawJungleFern: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // large spreading fern
  const fronds = 4 + rng.int(0, 2)
  for (let i = 0; i < fronds; i++) {
    const angle = -Math.PI * 0.4 + (i / (fronds - 1)) * Math.PI * 0.8
    const len = 18 + rng.range(0, 8)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
    for (let t = 0; t < 1; t += 0.06) {
      const x = cx + Math.sin(angle) * len * t
      const y = baseY - Math.cos(angle) * len * t - t * t * 4
      const w = 5 * (1 - t * 0.5)
      ctx.fillRect(x - w / 2, y, w, 2)
    }
  }
}

const drawJungleVineRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.58
  // mossy stone
  ctx.fillStyle = '#4a5040'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 16, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // vine overlay
  ctx.fillStyle = '#1a4008'
  for (let i = 0; i < 5; i++) {
    const vx = cx + rng.range(-12, 12)
    const vy = cy + rng.range(-6, 6)
    pixLine(ctx, vx, vy, vx + rng.range(-4, 4), vy + rng.range(-4, 4), 2)
  }
}

const drawJungleRuin: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 28 + rng.range(0, 8)
  // crumbling stone pillar
  ctx.fillStyle = '#6a6858'
  ctx.fillRect(cx - 8, baseY - h, 16, h)
  // broken top
  ctx.fillStyle = '#5a5848'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx - 8 + i * 4 + rng.int(0, 1), baseY - h - rng.int(2, 6), 3, 4)
  }
  // vine overgrowth
  ctx.fillStyle = '#1a4808'
  for (let i = 0; i < 3; i++) {
    const vx = cx + rng.range(-6, 6)
    pixLine(ctx, vx, baseY - h + rng.range(0, 4), vx + rng.range(-3, 3), baseY - h + 14 + rng.range(0, 8), 1)
  }
}

const drawJungleGrass: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // tall tropical grass
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  const blades = 6 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 14 + rng.range(0, 12)
    const lean = rng.range(-4, 4)
    pixLine(ctx, bx, baseY, bx + lean, baseY - h, 2)
    ctx.fillRect(bx + lean - 1, baseY - h, 3, 3)
  }
}

// ── Mesa sprites ──────────────────────────────────────────────────────────

const drawMesaCactus: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  // sparse desert cactus variant
  ctx.fillStyle = '#4a6828'
  ctx.fillRect(cx - 4, SPRITE_SIZE * 0.4, 8, SPRITE_SIZE * 0.6)
  // single arm
  const armY = SPRITE_SIZE * 0.55
  const armDir = rng.next() > 0.5 ? 1 : -1
  ctx.fillRect(cx + armDir * 4, armY, armDir * 12, 5)
  ctx.fillRect(cx + armDir * 14, armY - 10, 5, 12)
}

const drawMesaScrub: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // dry sage brush
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#8a7a50'
  const r = 10 + rng.range(0, 3)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6a5a38'
  for (let i = 0; i < 3; i++) {
    const px = cx + rng.range(-r * 0.4, r * 0.4)
    const py = cy + rng.range(-3, 3)
    ctx.beginPath()
    ctx.ellipse(px, py, 3, 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawMesaPillar: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 40 + rng.range(0, 12)
  const w = 12 + rng.range(0, 4)
  // sandstone pillar with layered bands
  ctx.fillStyle = pal[1] || '#c08050'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx + w * 0.35, baseY - h)
  ctx.lineTo(cx - w * 0.35, baseY - h)
  ctx.closePath()
  ctx.fill()
  // horizontal layer bands
  ctx.fillStyle = pal[0] || '#a06838'
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(cx - w / 2, baseY - y, w, 1)
  }
}

const drawMesaAdobe: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 24 + rng.range(0, 6)
  // adobe wall fragment
  ctx.fillStyle = pal[1] || '#c08050'
  ctx.fillRect(cx - 10, baseY - h, 20, h)
  // dark window
  ctx.fillStyle = '#402820'
  ctx.fillRect(cx - 3, baseY - h + 6, 6, 8)
  // cracks
  ctx.fillStyle = pal[0] || '#a06838'
  pixLine(ctx, cx + 4, baseY - h + 2, cx + 6, baseY - h * 0.4, 1)
}

const drawMesaGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // sparse dry bunch grass
  ctx.fillStyle = '#9a8a58'
  const blades = 3 + rng.int(0, 2)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-10, 10)
    const h = 6 + rng.range(0, 5)
    pixLine(ctx, bx, baseY, bx + rng.range(-2, 2), baseY - h, 1)
  }
}

// ── CoralReef sprites ─────────────────────────────────────────────────────

const drawCoralTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // branching coral formation
  const branches = 3 + rng.int(0, 2)
  for (let i = 0; i < branches; i++) {
    const bx = cx + rng.range(-8, 8)
    const h = 20 + rng.range(0, 16)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ff6688'
    pixLine(ctx, bx, baseY, bx + rng.range(-8, 8), baseY - h, 3)
    // sub-branches
    const mx = bx + rng.range(-4, 4)
    const my = baseY - h * 0.6
    pixLine(ctx, mx, my, mx + rng.range(-6, 6), my - 8 + rng.range(0, 4), 2)
    // tip bulb
    ctx.beginPath()
    ctx.arc(bx + rng.range(-4, 4), baseY - h, 3 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCoralBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // fan coral
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ff88aa'
  const fanW = 18 + rng.range(-2, 4)
  const fanH = 20 + rng.range(-2, 4)
  ctx.beginPath()
  ctx.moveTo(cx, cy + fanH / 2)
  ctx.bezierCurveTo(cx - fanW, cy - fanH / 2, cx + fanW, cy - fanH / 2, cx, cy + fanH / 2)
  ctx.fill()
  // pattern lines
  ctx.fillStyle = pal[5] || '#ffaacc'
  for (let i = 0; i < 5; i++) {
    const ly = cy - fanH * 0.3 + i * 4
    ctx.fillRect(cx - fanW * 0.3, ly, fanW * 0.6, 1)
  }
}

const drawCoralRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // rounded coral-encrusted rock
  ctx.fillStyle = '#4a5860'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 14, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // colorful coral patches
  const colors = ['#ff6688', '#ffaa44', '#ff88cc', '#44ddaa']
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    const px = cx + rng.range(-10, 10)
    const py = cy + rng.range(-6, 6)
    ctx.beginPath()
    ctx.arc(px, py, 2 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCoralShell: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // large spiral shell
  ctx.fillStyle = pal[3] || '#ffccaa'
  ctx.beginPath()
  for (let a = 0; a < Math.PI * 4; a += 0.2) {
    const r = 2 + a * 2.2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r * 0.6
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.fillStyle = pal[1] || '#dd9988'
  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fill()
}

const drawCoralSeaweed: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // waving seaweed strands
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#44aa66'
  const strands = 4 + rng.int(0, 2)
  for (let i = 0; i < strands; i++) {
    const sx = cx + rng.range(-12, 12)
    const h = 16 + rng.range(0, 12)
    for (let t = 0; t < 1; t += 0.08) {
      const x = sx + Math.sin(t * 4) * 4
      const y = baseY - t * h
      ctx.fillRect(x - 1, y, 3, 3)
    }
  }
}

// ── CoralReef new sprites ────────────────────────────────────────────────

const drawCoralFanTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // trunk/stem
  ctx.fillStyle = pal[6] || '#884466'
  ctx.fillRect(cx - 2, baseY - 14, 4, 14)
  // fan shape — semicircle with radiating lines
  const fanR = 18 + rng.range(0, 6)
  const fanY = baseY - 14
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ff6688'
  ctx.beginPath()
  ctx.arc(cx, fanY, fanR, Math.PI, 0)
  ctx.fill()
  // radiating vein lines
  ctx.fillStyle = pal[5] || '#ffaacc'
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI
    const ex = cx + Math.cos(a) * fanR * 0.9
    const ey = fanY + Math.sin(a) * fanR * 0.9
    pixLine(ctx, cx, fanY, ex, ey, 1)
  }
}

const drawCoralTubeTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const tubes = 3 + rng.int(0, 2)
  for (let i = 0; i < tubes; i++) {
    const tx = cx + rng.range(-10, 10)
    const h = 20 + rng.range(0, 18)
    const w = 4 + rng.range(0, 3)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ff8866'
    ctx.fillRect(tx - w / 2, baseY - h, w, h)
    // open top rim
    ctx.fillStyle = pal[5] || '#ffccaa'
    ctx.beginPath()
    ctx.ellipse(tx, baseY - h, w / 2 + 1, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // dark interior
    ctx.fillStyle = '#442222'
    ctx.beginPath()
    ctx.ellipse(tx, baseY - h, w / 2 - 1, 1, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCoralAnemone: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // base mound
  ctx.fillStyle = pal[3] || '#cc6688'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 4, 12, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // wavy tentacle fronds
  const tentacles = 8 + rng.int(0, 4)
  for (let i = 0; i < tentacles; i++) {
    const a = (i / tentacles) * Math.PI * 2
    const len = 10 + rng.range(0, 8)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ff88aa'
    for (let t = 0; t < 1; t += 0.1) {
      const wave = Math.sin(t * 4 + i) * 3
      const x = cx + Math.cos(a) * t * len + wave
      const y = cy - t * len * 0.5 + Math.sin(a) * t * len * 0.3
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
    // bright tip
    ctx.fillStyle = pal[5] || '#ffccdd'
    const tipX = cx + Math.cos(a) * len
    const tipY = cy - len * 0.5 + Math.sin(a) * len * 0.3
    ctx.fillRect(tipX - 1, tipY - 1, 2, 2)
  }
}

const drawCoralSponge: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  const r = 12 + rng.range(0, 4)
  // round sponge body
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#ddaa44'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  // pores (dark dots)
  ctx.fillStyle = '#553322'
  const pores = 8 + rng.int(0, 4)
  for (let i = 0; i < pores; i++) {
    const a = rng.next() * Math.PI * 2
    const d = rng.range(0, r * 0.8)
    const px = cx + Math.cos(a) * d
    const py = cy + Math.sin(a) * d
    ctx.beginPath()
    ctx.arc(px, py, 1 + rng.range(0, 1.5), 0, Math.PI * 2)
    ctx.fill()
  }
  // highlight
  ctx.fillStyle = 'rgba(255,255,200,0.2)'
  ctx.beginPath()
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

const drawCoralKelp: DrawFn = (ctx, rng, pal) => {
  const baseY = SPRITE_SIZE - 4
  const strands = 3 + rng.int(0, 2)
  for (let i = 0; i < strands; i++) {
    const sx = SPRITE_SIZE / 2 + rng.range(-14, 14)
    const h = 24 + rng.range(0, 16)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#44aa66'
    for (let t = 0; t < 1; t += 0.05) {
      const wave = Math.sin(t * 6 + i * 2) * 5
      const x = sx + wave
      const y = baseY - t * h
      ctx.fillRect(x - 1, y, 3, 3)
    }
    // leaf nodes
    ctx.fillStyle = pal[3] || '#66cc88'
    for (let j = 0; j < 3; j++) {
      const lt = 0.3 + j * 0.25
      const lx = sx + Math.sin(lt * 6 + i * 2) * 5
      const ly = baseY - lt * h
      ctx.beginPath()
      ctx.ellipse(lx + 4, ly, 4, 2, 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const drawCoralBarnacle: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // base rock
  ctx.fillStyle = '#5a6068'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 2, 14, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // clustered barnacles
  const count = 5 + rng.int(0, 3)
  for (let i = 0; i < count; i++) {
    const bx = cx + rng.range(-10, 10)
    const by = cy + rng.range(-5, 5)
    const r = 2 + rng.range(0, 2)
    ctx.fillStyle = '#c0b8a8'
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fill()
    // dark opening
    ctx.fillStyle = '#3a3028'
    ctx.beginPath()
    ctx.arc(bx, by - r * 0.3, r * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCoralArch: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 36 + rng.range(0, 6)
  const w = 28 + rng.range(0, 4)
  // left pillar
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#cc7766'
  ctx.fillRect(cx - w / 2, baseY - h, 6, h)
  ctx.fillRect(cx + w / 2 - 6, baseY - h, 6, h)
  // arch top
  ctx.beginPath()
  ctx.arc(cx, baseY - h, w / 2, Math.PI, 0)
  ctx.fill()
  // inner arch (hollow)
  ctx.fillStyle = 'rgba(20,40,60,0.4)'
  ctx.beginPath()
  ctx.arc(cx, baseY - h, w / 2 - 6, Math.PI, 0)
  ctx.fill()
  // coral growth patches
  ctx.fillStyle = pal[5] || '#ffaacc'
  for (let i = 0; i < 4; i++) {
    const px = cx + rng.range(-w / 2, w / 2)
    const py = baseY - rng.range(4, h)
    ctx.beginPath()
    ctx.arc(px, py, 2 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawCoralAnchor: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // anchor shaft
  ctx.fillStyle = '#5a6068'
  ctx.fillRect(cx - 2, baseY - 36, 4, 32)
  // cross bar
  ctx.fillRect(cx - 10, baseY - 28, 20, 3)
  // ring at top
  ctx.beginPath()
  ctx.arc(cx, baseY - 38, 4, 0, Math.PI * 2)
  ctx.stroke()
  // flukes at bottom
  ctx.beginPath()
  ctx.moveTo(cx - 2, baseY - 4)
  ctx.quadraticCurveTo(cx - 14, baseY - 10, cx - 12, baseY - 18)
  ctx.moveTo(cx + 2, baseY - 4)
  ctx.quadraticCurveTo(cx + 14, baseY - 10, cx + 12, baseY - 18)
  ctx.strokeStyle = '#5a6068'
  ctx.lineWidth = 2
  ctx.stroke()
  // coral growth patches
  const colors = ['#ff6688', '#ffaa44', '#44ddaa']
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    ctx.beginPath()
    ctx.arc(cx + rng.range(-8, 8), baseY - rng.range(6, 32), 2 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Bog sprites ───────────────────────────────────────────────────────────

const drawBogTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // gnarled dark trunk
  ctx.fillStyle = '#1a1208'
  ctx.fillRect(cx - 5, SPRITE_SIZE * 0.35, 10, SPRITE_SIZE * 0.65)
  // drooping sparse canopy
  const canopyY = SPRITE_SIZE * 0.32
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a3a18'
  ctx.beginPath()
  ctx.ellipse(cx, canopyY, 20 + rng.range(-3, 3), 14 + rng.range(-1, 2), 0, 0, Math.PI * 2)
  ctx.fill()
  // hanging moss
  ctx.fillStyle = '#3a4a20'
  for (let i = 0; i < 4; i++) {
    const mx = cx + rng.range(-16, 16)
    const my = canopyY + 10
    pixLine(ctx, mx, my, mx + rng.range(-2, 2), my + 8 + rng.range(0, 6), 1)
  }
  // murky fog at base
  ctx.fillStyle = 'rgba(80,100,60,0.1)'
  ctx.beginPath()
  ctx.ellipse(cx, SPRITE_SIZE - 4, 18, 6, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawBogReed: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 3 + rng.int(0, 2)
  for (let i = 0; i < count; i++) {
    const rx = cx + rng.range(-10, 10)
    const h = 20 + rng.range(0, 10)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a5020'
    pixLine(ctx, rx, baseY, rx + rng.range(-2, 2), baseY - h, 2)
    // seed head
    ctx.fillStyle = '#5a4018'
    ctx.beginPath()
    ctx.ellipse(rx, baseY - h - 2, 2, 4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawBogMossRock: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // dark mossy rock
  ctx.fillStyle = '#2a3020'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 14, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // thick moss
  ctx.fillStyle = '#1a3a08'
  ctx.beginPath()
  ctx.ellipse(cx, cy - 4, 12, 5, 0, Math.PI, 0)
  ctx.fill()
}

const drawBogLantern: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const postH = 26 + rng.range(0, 6)
  // crooked post
  ctx.fillStyle = '#2a1a08'
  pixLine(ctx, cx, baseY, cx + rng.range(-3, 3), baseY - postH, 2)
  // eerie green lantern
  ctx.fillStyle = '#88ff44'
  const tipX = cx + 6
  const tipY = baseY - postH
  pixLine(ctx, cx, baseY - postH, tipX, tipY, 1)
  ctx.fillRect(tipX - 2, tipY - 1, 5, 5)
  // glow
  ctx.fillStyle = 'rgba(136,255,68,0.15)'
  ctx.beginPath()
  ctx.arc(tipX, tipY + 2, 8, 0, Math.PI * 2)
  ctx.fill()
}

const drawBogGrass: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a4a20'
  const blades = 5 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 10 + rng.range(0, 10)
    const lean = rng.range(-5, 5)
    pixLine(ctx, bx, baseY, bx + lean, baseY - h, 2)
  }
}

// ── Badlands sprites ──────────────────────────────────────────────────────

const drawBadlandsHoodoo: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 40 + rng.range(0, 12)
  // thin eroded pillar with wider cap
  const baseW = 8 + rng.range(0, 3)
  ctx.fillStyle = pal[1] || '#b07040'
  ctx.beginPath()
  ctx.moveTo(cx - baseW / 2, baseY)
  ctx.lineTo(cx + baseW / 2, baseY)
  ctx.lineTo(cx + baseW * 0.3, baseY - h + 6)
  ctx.lineTo(cx - baseW * 0.3, baseY - h + 6)
  ctx.closePath()
  ctx.fill()
  // wider cap rock
  ctx.fillStyle = pal[0] || '#8a5030'
  ctx.fillRect(cx - baseW * 0.6, baseY - h, baseW * 1.2, 8)
  // erosion bands
  ctx.fillStyle = pal[3] || '#c89060'
  for (let y = 0; y < h; y += 8) {
    ctx.fillRect(cx - baseW * 0.3, baseY - y, baseW * 0.6, 1)
  }
}

const drawBadlandsScrub: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // tiny dry scrub
  ctx.fillStyle = '#7a6a38'
  const r = 8 + rng.range(0, 3)
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, Math.PI * 2)
    const d = rng.range(2, r)
    pixLine(ctx, cx, cy, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1)
  }
}

const drawBadlandsArch: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // natural stone arch
  const archW = 24 + rng.range(0, 6)
  const archH = 28 + rng.range(0, 6)
  // pillars
  ctx.fillStyle = pal[1] || '#b07040'
  ctx.fillRect(cx - archW / 2, baseY - archH, 7, archH)
  ctx.fillRect(cx + archW / 2 - 7, baseY - archH, 7, archH)
  // arch top
  ctx.beginPath()
  ctx.ellipse(cx, baseY - archH, archW / 2, 8, 0, Math.PI, 0)
  ctx.fill()
  // erosion layers
  ctx.fillStyle = pal[0] || '#8a5030'
  for (let y = 0; y < archH; y += 7) {
    ctx.fillRect(cx - archW / 2, baseY - y, archW, 1)
  }
}

const drawBadlandsGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  ctx.fillStyle = '#8a7a48'
  const blades = 3 + rng.int(0, 1)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-8, 8)
    const h = 5 + rng.range(0, 4)
    pixLine(ctx, bx, baseY, bx + rng.range(-1, 1), baseY - h, 1)
  }
}

// ── Taiga sprites ─────────────────────────────────────────────────────────

const drawTaigaSpruce: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk
  ctx.fillStyle = '#3a2818'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.5, 6, SPRITE_SIZE * 0.5)
  // dense layered cone shape
  const layers = 6
  for (let i = 0; i < layers; i++) {
    const t = i / layers
    const y = SPRITE_SIZE * (0.50 - t * 0.42)
    const w = 6 + t * 20 + rng.range(-1, 1)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a3828'
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx - w, y + 10)
    ctx.lineTo(cx + w, y + 10)
    ctx.closePath()
    ctx.fill()
  }
}

const drawTaigaBirch: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // white trunk
  ctx.fillStyle = '#d8d8d0'
  ctx.fillRect(cx - 3, SPRITE_SIZE * 0.25, 6, SPRITE_SIZE * 0.75)
  // bark marks
  ctx.fillStyle = '#303020'
  for (let i = 0; i < 4; i++) {
    const y = SPRITE_SIZE * (0.3 + i * 0.14)
    ctx.fillRect(cx - 3, y, 6, 2)
  }
  // small yellow-green canopy
  const canopyY = SPRITE_SIZE * 0.22
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#4a6838'
  ctx.beginPath()
  ctx.ellipse(cx, canopyY, 12 + rng.range(-2, 2), 10, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawTaigaBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a5838'
  const r = 11 + rng.range(0, 3)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.65, 0, 0, Math.PI * 2)
  ctx.fill()
  // berries
  ctx.fillStyle = '#cc3344'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(cx + rng.range(-r * 0.4, r * 0.4), cy + rng.range(-3, 3), 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawTaigaCampfire: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // log ring
  ctx.fillStyle = '#4a3018'
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const lx = cx + Math.cos(a) * 10
    const ly = baseY - 4 + Math.sin(a) * 4
    ctx.fillRect(lx - 4, ly - 2, 8, 4)
  }
  // fire
  ctx.fillStyle = '#ff8800'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 18)
  ctx.lineTo(cx - 6, baseY - 4)
  ctx.lineTo(cx + 6, baseY - 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffcc44'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 12)
  ctx.lineTo(cx - 3, baseY - 4)
  ctx.lineTo(cx + 3, baseY - 4)
  ctx.closePath()
  ctx.fill()
  // smoke wisps
  ctx.fillStyle = 'rgba(128,128,128,0.15)'
  ctx.beginPath()
  ctx.ellipse(cx + rng.range(-3, 3), baseY - 22, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── Oasis sprites ─────────────────────────────────────────────────────────

const drawOasisPalm: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const trunkH = 34 + rng.range(0, 8)
  // curved trunk
  ctx.fillStyle = '#6a4a20'
  for (let t = 0; t < 1; t += 0.05) {
    const x = cx + Math.sin(t * 1.2) * 5
    const y = baseY - t * trunkH
    ctx.fillRect(x - 3, y, 6, 3)
  }
  // fronds
  const topX = cx + Math.sin(1.2) * 5
  const topY = baseY - trunkH
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a6a18'
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const len = 12 + rng.range(0, 5)
    for (let t = 0; t < 1; t += 0.1) {
      const fx = topX + Math.cos(angle) * len * t
      const fy = topY + Math.sin(angle) * len * t * 0.4 + t * t * 6
      ctx.fillRect(fx - 2, fy, 4, 2)
    }
  }
  // coconuts
  ctx.fillStyle = '#8a6a30'
  for (let i = 0; i < 2; i++) {
    ctx.beginPath()
    ctx.arc(topX + rng.range(-3, 3), topY + 2 + rng.range(0, 3), 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawOasisFlowerBush: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.5
  // lush green bush
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a6a28'
  const r = 14 + rng.range(0, 4)
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // bright flowers
  const flowerColors = ['#ff6688', '#ffaa44', '#ff88ff', '#ffee44']
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = flowerColors[rng.int(0, flowerColors.length - 1)]
    const fx = cx + rng.range(-r * 0.6, r * 0.6)
    const fy = cy + rng.range(-r * 0.4, r * 0.4)
    ctx.beginPath()
    ctx.arc(fx, fy, 2 + rng.range(0, 1), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawOasisWellStructure: DrawFn = (ctx, _rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stone well cylinder
  ctx.fillStyle = pal[1] || '#a09070'
  ctx.fillRect(cx - 10, baseY - 16, 20, 16)
  // darker top rim
  ctx.fillStyle = pal[0] || '#706050'
  ctx.fillRect(cx - 12, baseY - 18, 24, 4)
  // water inside
  ctx.fillStyle = '#4488cc'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 16, 8, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // roof posts
  ctx.fillStyle = '#5a3a18'
  ctx.fillRect(cx - 10, baseY - 30, 3, 14)
  ctx.fillRect(cx + 7, baseY - 30, 3, 14)
  // roof
  ctx.fillStyle = '#6a4a28'
  ctx.fillRect(cx - 12, baseY - 32, 24, 3)
}

const drawOasisGrass: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a7a28'
  const blades = 6 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 10 + rng.range(0, 10)
    const lean = rng.range(-4, 4)
    pixLine(ctx, bx, baseY, bx + lean, baseY - h, 2)
    ctx.fillRect(bx + lean - 1, baseY - h, 3, 2)
  }
}

// ── Jungle extras ────────────────────────────────────────────────────────

const drawJungleBanyan: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // wide trunk cluster
  ctx.fillStyle = '#2a1808'
  ctx.fillRect(cx - 10, baseY - 30, 6, 30)
  ctx.fillRect(cx - 2, baseY - 34, 6, 34)
  ctx.fillRect(cx + 6, baseY - 28, 5, 28)
  // massive canopy
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#0a3808'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 34, 28 + rng.range(-2, 4), 16, 0, 0, Math.PI * 2)
  ctx.fill()
  // hanging aerial roots
  ctx.fillStyle = '#3a2818'
  for (let i = 0; i < 6; i++) {
    const rx = cx + rng.range(-22, 22)
    const ry = baseY - 20 + rng.range(-4, 0)
    const rLen = 12 + rng.range(0, 10)
    pixLine(ctx, rx, ry, rx + rng.range(-2, 2), ry + rLen, 1)
  }
  // lighter leaf patches
  ctx.fillStyle = pal[3] || '#1a5810'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(cx + rng.range(-20, 18), baseY - 38 + rng.range(0, 12), 4, 3)
  }
}

const drawJungleBamboo: DrawFn = (ctx, rng, pal) => {
  const baseY = SPRITE_SIZE - 4
  const cx = SPRITE_SIZE / 2
  const stalks = 4 + rng.int(0, 3)
  for (let i = 0; i < stalks; i++) {
    const sx = cx - 10 + i * 6 + rng.range(-2, 2)
    const h = 38 + rng.range(0, 10)
    // stalk
    ctx.fillStyle = '#5a8828'
    ctx.fillRect(sx - 2, baseY - h, 4, h)
    // nodes
    ctx.fillStyle = '#4a7818'
    for (let n = 0; n < 4; n++) {
      const ny = baseY - h * 0.2 * (n + 1)
      ctx.fillRect(sx - 3, ny, 6, 2)
    }
    // small leaves at top
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#3a7818'
    const lx = sx + rng.range(-6, 6)
    const ly = baseY - h
    ctx.fillRect(lx, ly, 6, 3)
    ctx.fillRect(lx - 2, ly + 2, 4, 2)
  }
}

const drawJungleMonstera: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stem
  ctx.fillStyle = '#2a5018'
  pixLine(ctx, cx, baseY, cx - 2, baseY - 20, 2)
  // large leaf shape
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5808'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 26, 18, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  // leaf holes (monstera characteristic)
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 4; i++) {
    const hx = cx + rng.range(-10, 10)
    const hy = baseY - 26 + rng.range(-6, 6)
    ctx.beginPath()
    ctx.ellipse(hx, hy, 3, 2 + rng.range(0, 2), rng.range(0, Math.PI), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  // leaf vein
  ctx.fillStyle = '#1a4808'
  pixLine(ctx, cx, baseY - 14, cx, baseY - 38, 1)
}

const drawJungleOrchid: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // thin stem
  ctx.fillStyle = '#2a5018'
  pixLine(ctx, cx, baseY, cx + 2, baseY - 28, 2)
  // leaves at base
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5808'
  ctx.fillRect(cx - 8, baseY - 6, 16, 5)
  // flowers along stem
  const colors = ['#e040a0', '#d060c0', '#ff60b0', '#c050d0']
  for (let i = 0; i < 3; i++) {
    const fy = baseY - 12 - i * 8
    const fx = cx + 2 + rng.range(-2, 2)
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    // petals
    ctx.beginPath()
    ctx.arc(fx, fy, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffee88'
    ctx.fillRect(fx - 1, fy - 1, 2, 2)
  }
}

const drawJungleVine: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const tendrils = 3 + rng.int(0, 3)
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  for (let i = 0; i < tendrils; i++) {
    const sx = cx + rng.range(-16, 16)
    const topY = 2 + rng.range(0, 8)
    const len = 30 + rng.range(0, 20)
    // wavy vine
    for (let t = 0; t < 1; t += 0.04) {
      const x = sx + Math.sin(t * 4 + i) * 4
      const y = topY + t * len
      ctx.fillRect(x, y, 2, 2)
    }
    // small leaf at end
    ctx.fillRect(sx + Math.sin(4 + i) * 4 - 2, topY + len, 5, 3)
  }
}

const drawJungleMoss: DrawFn = (ctx, rng, pal) => {
  const baseY = SPRITE_SIZE - 4
  // thick moss carpet on ground
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4808'
  ctx.fillRect(4, baseY - 4, SPRITE_SIZE - 8, 6)
  // lumpy texture
  ctx.fillStyle = '#2a5818'
  for (let i = 0; i < 12; i++) {
    const mx = 6 + rng.range(0, SPRITE_SIZE - 14)
    const my = baseY - 4 + rng.range(-3, 2)
    ctx.beginPath()
    ctx.arc(mx, my, 3 + rng.range(0, 3), 0, Math.PI * 2)
    ctx.fill()
  }
  // darker spots
  ctx.fillStyle = '#0a3008'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(8 + rng.range(0, SPRITE_SIZE - 18), baseY - 3 + rng.range(-2, 1), 3, 2)
  }
}

const drawJungleBoulder: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.58
  // stone base
  ctx.fillStyle = '#5a5848'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 18 + rng.range(-2, 4), 12 + rng.range(-1, 3), 0, 0, Math.PI * 2)
  ctx.fill()
  // shadow detail
  ctx.fillStyle = '#4a4838'
  ctx.beginPath()
  ctx.ellipse(cx + 3, cy + 3, 12, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // moss patches on top
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  for (let i = 0; i < 6; i++) {
    const mx = cx + rng.range(-12, 10)
    const my = cy + rng.range(-8, 4)
    ctx.beginPath()
    ctx.arc(mx, my, 3 + rng.range(0, 3), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawJungleSkull: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // skull shape
  ctx.fillStyle = '#d8d0b8'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 14, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // jaw
  ctx.fillRect(cx - 8, baseY - 6, 16, 5)
  // eye sockets
  ctx.fillStyle = '#1a0808'
  ctx.beginPath()
  ctx.arc(cx - 5, baseY - 16, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + 5, baseY - 16, 3, 0, Math.PI * 2)
  ctx.fill()
  // nose
  ctx.fillRect(cx - 1, baseY - 12, 2, 3)
  // vine overgrowth
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  for (let i = 0; i < 3; i++) {
    const vx = cx + rng.range(-10, 10)
    pixLine(ctx, vx, baseY - 22, vx + rng.range(-4, 4), baseY - 8 + rng.range(0, 6), 1)
  }
  ctx.beginPath()
  ctx.arc(cx + rng.range(-6, 6), baseY - 20, 4, 0, Math.PI * 2)
  ctx.fill()
}

const drawJungleTemple: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stepped pyramid (3 tiers)
  ctx.fillStyle = '#7a7868'
  ctx.fillRect(cx - 20, baseY - 8, 40, 8)
  ctx.fillRect(cx - 14, baseY - 18, 28, 10)
  ctx.fillRect(cx - 8, baseY - 26, 16, 8)
  // top shrine
  ctx.fillStyle = '#6a6858'
  ctx.fillRect(cx - 4, baseY - 32, 8, 6)
  // dark doorway
  ctx.fillStyle = '#1a1808'
  ctx.fillRect(cx - 2, baseY - 30, 4, 4)
  // vine overgrowth
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  for (let i = 0; i < 5; i++) {
    const vx = cx + rng.range(-16, 16)
    const vy = baseY - rng.range(6, 24)
    pixLine(ctx, vx, vy, vx + rng.range(-3, 3), vy + 6 + rng.range(0, 6), 1)
  }
  // stone texture
  ctx.fillStyle = '#8a8878'
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(cx + rng.range(-18, 16), baseY - rng.range(2, 24), 2, 1)
  }
}

const drawJungleIdol: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stone pedestal
  ctx.fillStyle = '#6a6858'
  ctx.fillRect(cx - 10, baseY - 6, 20, 6)
  // idol body
  ctx.fillStyle = '#5a5848'
  ctx.fillRect(cx - 7, baseY - 28, 14, 22)
  // tiki face
  ctx.fillStyle = '#4a4838'
  ctx.fillRect(cx - 8, baseY - 30, 16, 8)
  // eyes
  ctx.fillStyle = '#ff4400'
  ctx.fillRect(cx - 5, baseY - 28, 3, 3)
  ctx.fillRect(cx + 2, baseY - 28, 3, 3)
  // mouth
  ctx.fillStyle = '#1a0808'
  ctx.fillRect(cx - 4, baseY - 22, 8, 3)
  // teeth
  ctx.fillStyle = '#d8d0b8'
  ctx.fillRect(cx - 3, baseY - 22, 2, 2)
  ctx.fillRect(cx + 1, baseY - 22, 2, 2)
  // moss on top
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a5008'
  ctx.beginPath()
  ctx.arc(cx, baseY - 31, 5 + rng.range(0, 2), 0, Math.PI * 2)
  ctx.fill()
}

// ── Volcanic extras ──────────────────────────────────────────────────────

const drawVolcanicObsidianSpire: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 40 + rng.range(0, 10)
  // tall jagged obsidian spike
  ctx.fillStyle = '#0a0408'
  ctx.beginPath()
  ctx.moveTo(cx - 8, baseY)
  ctx.lineTo(cx + 8, baseY)
  ctx.lineTo(cx + 2, baseY - h * 0.6)
  ctx.lineTo(cx + 1, baseY - h)
  ctx.lineTo(cx - 1, baseY - h + 2)
  ctx.lineTo(cx - 3, baseY - h * 0.5)
  ctx.closePath()
  ctx.fill()
  // glassy reflections
  ctx.fillStyle = '#2a2838'
  pixLine(ctx, cx - 4, baseY - 6, cx - 1, baseY - h * 0.4, 1)
  pixLine(ctx, cx + 3, baseY - 10, cx + 1, baseY - h * 0.7, 1)
  // faint lava glow at base
  ctx.fillStyle = '#ff220044'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 2, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

const drawVolcanicSmokeVent: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // vent hole
  ctx.fillStyle = '#2a1008'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 4, 10, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff3300'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 4, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // rising smoke puffs
  ctx.fillStyle = 'rgba(80,70,60,0.5)'
  for (let i = 0; i < 5; i++) {
    const sy = baseY - 10 - i * 8
    const sx = cx + rng.range(-4, 4) + Math.sin(i * 1.2) * 3
    const sr = 4 + rng.range(0, 3) + i * 1.5
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawVolcanicMagmaPool: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // dark crust ring
  ctx.fillStyle = '#1a0808'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 18, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // bright lava center
  ctx.fillStyle = '#ff4400'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 12, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // yellow-hot core
  ctx.fillStyle = '#ffaa00'
  ctx.beginPath()
  ctx.ellipse(cx + rng.range(-2, 2), cy + rng.range(-1, 1), 6, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // bubbles
  ctx.fillStyle = '#ffcc44'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(cx + rng.range(-8, 8), cy + rng.range(-4, 4), 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawVolcanicCinder: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.6
  // ash-grey pile base
  ctx.fillStyle = '#2a2020'
  ctx.beginPath()
  ctx.ellipse(cx, cy, 14, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // smoldering chunks
  ctx.fillStyle = '#4a1808'
  for (let i = 0; i < 6; i++) {
    const bx = cx + rng.range(-10, 10)
    const by = cy + rng.range(-5, 4)
    ctx.fillRect(bx, by, 3 + rng.int(0, 2), 3 + rng.int(0, 2))
  }
  // glowing embers within
  ctx.fillStyle = '#ff6600'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + rng.range(-8, 8), cy + rng.range(-4, 3), 2, 2)
  }
}

const drawVolcanicAshGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // ash dust on ground
  ctx.fillStyle = '#3a3030'
  ctx.fillRect(8, baseY - 2, SPRITE_SIZE - 16, 4)
  // sparse charred grass blades
  const blades = 3 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 8 + rng.range(0, 8)
    ctx.fillStyle = '#4a3828'
    pixLine(ctx, bx, baseY, bx + rng.range(-3, 3), baseY - h, 1)
  }
  // tiny ash particles
  ctx.fillStyle = '#5a5048'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + rng.range(-16, 16), baseY - rng.range(0, 4), 2, 1)
  }
}

const drawVolcanicEmber: DrawFn = (ctx, rng, _pal) => {
  // floating ember particles in air
  const colors = ['#ff4400', '#ff6600', '#ffaa00', '#ff8800']
  for (let i = 0; i < 8; i++) {
    const ex = rng.range(8, SPRITE_SIZE - 8)
    const ey = rng.range(8, SPRITE_SIZE - 12)
    const sz = 1 + rng.int(0, 2)
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    ctx.fillRect(ex, ey, sz, sz)
  }
  // faint glow spots
  ctx.fillStyle = 'rgba(255,68,0,0.15)'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(rng.range(12, SPRITE_SIZE - 12), rng.range(12, SPRITE_SIZE - 12), 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawVolcanicGlassRock: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.58
  // angular volcanic glass chunk
  ctx.fillStyle = '#0a0410'
  ctx.beginPath()
  ctx.moveTo(cx - 14, cy + 8)
  ctx.lineTo(cx - 10 + rng.range(-2, 2), cy - 10)
  ctx.lineTo(cx + 4 + rng.range(-2, 2), cy - 14)
  ctx.lineTo(cx + 16, cy + 4)
  ctx.lineTo(cx + 6, cy + 10)
  ctx.closePath()
  ctx.fill()
  // glassy highlight
  ctx.fillStyle = '#2a2040'
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy - 4)
  ctx.lineTo(cx + 2, cy - 8)
  ctx.lineTo(cx + 8, cy)
  ctx.lineTo(cx - 2, cy + 2)
  ctx.closePath()
  ctx.fill()
  // sharp edge highlights
  ctx.fillStyle = '#4a3860'
  pixLine(ctx, cx - 10, cy - 10, cx + 4, cy - 14, 1)
  pixLine(ctx, cx + 4, cy - 14, cx + 16, cy + 4, 1)
}

const drawVolcanicBasaltColumn: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // cluster of hexagonal basalt columns
  const cols = 3 + rng.int(0, 2)
  for (let i = 0; i < cols; i++) {
    const colX = cx - 12 + i * 10 + rng.range(-2, 2)
    const colH = 20 + rng.range(0, 16)
    ctx.fillStyle = '#2a2828'
    ctx.fillRect(colX - 4, baseY - colH, 8, colH)
    // flat hexagonal top
    ctx.fillStyle = '#3a3838'
    ctx.beginPath()
    for (let h = 0; h < 6; h++) {
      const a = (h / 6) * Math.PI * 2
      const hx = colX + Math.cos(a) * 5
      const hy = baseY - colH + Math.sin(a) * 2
      h === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy)
    }
    ctx.closePath()
    ctx.fill()
    // crack detail
    ctx.fillStyle = '#1a1818'
    pixLine(ctx, colX, baseY - colH + 4, colX + rng.range(-1, 1), baseY - 4, 1)
  }
}

const drawVolcanicForge: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // ruined stone walls
  ctx.fillStyle = '#3a2818'
  ctx.fillRect(cx - 16, baseY - 22, 6, 22)
  ctx.fillRect(cx + 10, baseY - 20, 6, 20)
  // broken back wall
  ctx.fillRect(cx - 16, baseY - 24, 32, 4)
  // anvil in center
  ctx.fillStyle = '#2a2828'
  ctx.fillRect(cx - 5, baseY - 12, 10, 4)
  ctx.fillRect(cx - 3, baseY - 8, 6, 8)
  // forge glow
  ctx.fillStyle = '#ff4400'
  ctx.fillRect(cx - 12, baseY - 16, 6, 4)
  ctx.fillStyle = '#ffaa00'
  ctx.fillRect(cx - 11, baseY - 15, 4, 2)
  // rubble
  ctx.fillStyle = '#4a3828'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + rng.range(-14, 14), baseY - rng.range(0, 4), 3, 2)
  }
}

const drawVolcanicSkull: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // pole
  ctx.fillStyle = '#2a1808'
  ctx.fillRect(cx - 2, baseY - 36, 4, 36)
  // demon skull
  ctx.fillStyle = '#4a3028'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 38, 10, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // jaw
  ctx.fillRect(cx - 7, baseY - 32, 14, 4)
  // horns
  ctx.fillStyle = '#3a2018'
  ctx.beginPath()
  ctx.moveTo(cx - 8, baseY - 40)
  ctx.lineTo(cx - 14, baseY - 50)
  ctx.lineTo(cx - 6, baseY - 42)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + 8, baseY - 40)
  ctx.lineTo(cx + 14, baseY - 50)
  ctx.lineTo(cx + 6, baseY - 42)
  ctx.closePath()
  ctx.fill()
  // glowing eyes
  ctx.fillStyle = '#ff4400'
  ctx.fillRect(cx - 5, baseY - 40, 3, 3)
  ctx.fillRect(cx + 2, baseY - 40, 3, 3)
}

const drawVolcanicCrack: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // ground surface
  ctx.fillStyle = '#2a1808'
  ctx.fillRect(4, baseY - 3, SPRITE_SIZE - 8, 5)
  // jagged crack through ground
  ctx.fillStyle = '#ff4400'
  let px = cx - 16
  let py = baseY - 2
  for (let i = 0; i < 8; i++) {
    const nx = px + 4 + rng.range(0, 3)
    const ny = baseY - 2 + rng.range(-2, 2)
    pixLine(ctx, px, py, nx, ny, 2)
    px = nx
    py = ny
  }
  // inner glow (brighter)
  ctx.fillStyle = '#ffaa00'
  let gx = cx - 14
  let gy = baseY - 1
  for (let i = 0; i < 7; i++) {
    const nx = gx + 4 + rng.range(0, 2)
    const ny = baseY - 1 + rng.range(-1, 1)
    pixLine(ctx, gx, gy, nx, ny, 1)
    gx = nx
    gy = ny
  }
}

// ── Forest extras (new) ──────────────────────────────────────────────────

const drawForestWillow: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // trunk — slightly leaning
  ctx.fillStyle = pal[6] || '#5a3010'
  ctx.fillRect(cx - 5, SPRITE_SIZE * 0.4, 10, SPRITE_SIZE * 0.6)
  // main canopy dome
  const canopyY = SPRITE_SIZE * 0.32
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.beginPath()
  ctx.arc(cx, canopyY, 18 + rng.range(0, 3), 0, Math.PI * 2)
  ctx.fill()
  // drooping branches
  ctx.strokeStyle = pal[Math.floor(rng.range(0, 3))] || '#2a6018'
  ctx.lineWidth = 2
  const strands = 8 + rng.int(0, 4)
  for (let i = 0; i < strands; i++) {
    const angle = Math.PI * 0.15 + (i / strands) * Math.PI * 0.7
    const sx = cx + Math.cos(angle) * 16
    const sy = canopyY + Math.sin(angle) * 8
    const ex = sx + Math.cos(angle) * (8 + rng.range(0, 6))
    const ey = sy + 20 + rng.range(0, 12)
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(sx + rng.range(-4, 4), (sy + ey) / 2, ex, ey)
    ctx.stroke()
  }
}

const drawForestMaple: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  // thick trunk
  ctx.fillStyle = pal[6] || '#5a3010'
  ctx.fillRect(cx - 6, SPRITE_SIZE * 0.5, 12, SPRITE_SIZE * 0.5)
  // wide spreading canopy — several overlapping circles
  const canopyY = SPRITE_SIZE * 0.35
  const spread = 24 + rng.range(0, 4)
  const blobs = 5 + rng.int(0, 2)
  for (let i = 0; i < blobs; i++) {
    const bx = cx + rng.range(-spread * 0.6, spread * 0.6)
    const by = canopyY + rng.range(-6, 6)
    const r = 10 + rng.range(0, 6)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // autumn colour highlights
  ctx.fillStyle = pal[4] || '#c06020'
  for (let i = 0; i < 4; i++) {
    const hx = cx + rng.range(-spread * 0.5, spread * 0.5)
    const hy = canopyY + rng.range(-4, 4)
    ctx.beginPath()
    ctx.arc(hx, hy, 3 + rng.range(0, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawForestSapling: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // thin trunk
  ctx.fillStyle = pal[6] || '#5a3010'
  ctx.fillRect(cx - 2, baseY - 22, 4, 22)
  // small crown — two tiny triangles
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 34)
  ctx.lineTo(cx - 8, baseY - 20)
  ctx.lineTo(cx + 8, baseY - 20)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 28)
  ctx.lineTo(cx - 6, baseY - 18)
  ctx.lineTo(cx + 6, baseY - 18)
  ctx.closePath()
  ctx.fill()
}

const drawForestBerry: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  // bush body
  const r = 12 + rng.range(0, 3)
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark patches
  ctx.fillStyle = '#0a2808'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx + rng.range(-r * 0.5, r * 0.5), cy + rng.range(-4, 4), 4, 3)
  }
  // red berries
  ctx.fillStyle = '#cc2020'
  const berries = 5 + rng.int(0, 3)
  for (let i = 0; i < berries; i++) {
    const bx = cx + rng.range(-r * 0.6, r * 0.6)
    const by = cy + rng.range(-r * 0.4, r * 0.4)
    ctx.beginPath()
    ctx.arc(bx, by, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawForestFlower: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 4 + rng.int(0, 3)
  const colors = ['#e04080', '#f0c020', '#8040d0', '#4080e0', '#e06030']
  for (let i = 0; i < count; i++) {
    const fx = cx + rng.range(-16, 16)
    const stemH = 10 + rng.range(0, 8)
    // stem
    ctx.fillStyle = '#2a6018'
    pixLine(ctx, fx, baseY, fx + rng.range(-2, 2), baseY - stemH, 1)
    // petals
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    ctx.beginPath()
    ctx.arc(fx, baseY - stemH - 2, 3 + rng.range(0, 1), 0, Math.PI * 2)
    ctx.fill()
    // center dot
    ctx.fillStyle = '#f0e060'
    ctx.fillRect(fx - 1, baseY - stemH - 3, 2, 2)
  }
}

const drawForestHedge: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 28 + rng.range(0, 8)
  const h = 18 + rng.range(0, 4)
  // main hedge block
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // rounded top bumps
  for (let i = 0; i < 4; i++) {
    const bx = cx - w / 2 + (i + 0.5) * (w / 4)
    ctx.beginPath()
    ctx.arc(bx, baseY - h, w / 8, Math.PI, 0)
    ctx.fill()
  }
  // dark leaf patches
  ctx.fillStyle = '#0a2808'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(cx + rng.range(-w * 0.4, w * 0.4), baseY - rng.range(2, h - 2), 3, 3)
  }
}

const drawForestBoulder: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 22 + rng.range(0, 6)
  const h = 18 + rng.range(0, 4)
  // main stone
  ctx.fillStyle = '#707060'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark side
  ctx.fillStyle = '#505048'
  ctx.beginPath()
  ctx.ellipse(cx + 3, baseY - h / 2 + 2, w / 2 - 2, h / 2 - 1, 0, 0.2, Math.PI * 0.8)
  ctx.fill()
  // moss on top
  ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a6020'
  for (let i = 0; i < 4; i++) {
    const mx = cx + rng.range(-w * 0.3, w * 0.3)
    const my = baseY - h + rng.range(0, 4)
    ctx.fillRect(mx - 2, my, 5 + rng.range(0, 3), 3)
  }
}

const drawForestLog: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.65
  const logW = 30 + rng.range(0, 8)
  const logH = 7 + rng.range(0, 2)
  // shadow beneath
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.fillRect(cx - logW / 2 + 2, cy + logH / 2, logW - 4, 3)
  // main log body
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx - logW / 2, cy - logH / 2, logW, logH)
  // bark highlight
  ctx.fillStyle = '#7a5030'
  ctx.fillRect(cx - logW / 2, cy - logH / 2, logW, 2)
  // cross-section circle on end
  ctx.fillStyle = '#7a5030'
  ctx.beginPath()
  ctx.ellipse(cx - logW / 2, cy, logH / 2 + 1, logH / 2 + 1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#4a2810'
  ctx.beginPath()
  ctx.arc(cx - logW / 2, cy, 2, 0, Math.PI * 2)
  ctx.fill()
}

const drawForestWell: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const stoneCol = pal[1] || '#808070'
  const darkCol = pal[0] || '#505048'
  // circular stone wall
  ctx.fillStyle = stoneCol
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 10, 14, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark interior
  ctx.fillStyle = '#101820'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 12, 9, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  // stone rim top
  ctx.fillStyle = darkCol
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 14, 14, 5, 0, Math.PI, 0)
  ctx.fill()
  // posts + roof
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx - 13, baseY - 30, 3, 20)
  ctx.fillRect(cx + 10, baseY - 30, 3, 20)
  // little roof
  ctx.fillStyle = '#3a2008'
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 36)
  ctx.lineTo(cx - 16, baseY - 28)
  ctx.lineTo(cx + 16, baseY - 28)
  ctx.closePath()
  ctx.fill()
}

const drawForestBridge: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const bw = 30 + rng.range(0, 6)
  // planks
  ctx.fillStyle = '#6a4820'
  for (let i = 0; i < 6; i++) {
    const px = cx - bw / 2 + i * (bw / 6)
    ctx.fillRect(px, cy - 3, bw / 6 - 1, 6)
  }
  // side rails
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx - bw / 2, cy - 6, bw, 2)
  ctx.fillRect(cx - bw / 2, cy + 4, bw, 2)
  // posts at ends
  ctx.fillRect(cx - bw / 2, cy - 12, 3, 14)
  ctx.fillRect(cx + bw / 2 - 3, cy - 12, 3, 14)
}

const drawForestTallGrass: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const blades = 7 + rng.int(0, 3)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-14, 14)
    const h = 16 + rng.range(0, 10)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#2a6018'
    pixLine(ctx, bx, baseY, bx + rng.range(-5, 5), baseY - h, 2)
  }
}

const drawForestClover: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 6
  const count = 5 + rng.int(0, 3)
  for (let i = 0; i < count; i++) {
    const lx = cx + rng.range(-14, 14)
    const ly = baseY + rng.range(-6, 2)
    ctx.fillStyle = '#2a6820'
    // three tiny leaves in a trefoil
    for (let a = 0; a < 3; a++) {
      const angle = (a / 3) * Math.PI * 2 - Math.PI / 2
      const dx = Math.cos(angle) * 3
      const dy = Math.sin(angle) * 3
      ctx.beginPath()
      ctx.ellipse(lx + dx, ly + dy, 3, 2.5, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    // tiny stem
    ctx.fillStyle = '#1a4810'
    pixLine(ctx, lx, ly + 2, lx, ly + 5, 1)
  }
}

const drawForestFern2: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // curled fiddlehead fern
  const stems = 2 + rng.int(0, 1)
  for (let s = 0; s < stems; s++) {
    const sx = cx + rng.range(-8, 8)
    ctx.fillStyle = pal[Math.floor(rng.range(0, 3))] || '#1a4010'
    // upward stem with spiral at top
    const h = 18 + rng.range(0, 8)
    pixLine(ctx, sx, baseY, sx, baseY - h, 2)
    // spiral curl at top
    const curl = 6 + rng.range(0, 3)
    for (let t = 0; t < 1; t += 0.06) {
      const angle = t * Math.PI * 2
      const r = curl * (1 - t)
      const px = sx + Math.cos(angle) * r
      const py = baseY - h - Math.sin(angle) * r
      ctx.fillRect(px - 1, py - 1, 3, 3)
    }
    // small side fronds
    for (let i = 0; i < 4; i++) {
      const fy = baseY - 4 - i * (h / 5)
      const dir = i % 2 === 0 ? 1 : -1
      pixLine(ctx, sx, fy, sx + dir * (5 + rng.range(0, 3)), fy - 3, 1)
    }
  }
}

// ── Mesa extras (new) ────────────────────────────────────────────────────

const drawMesaJoshuaTree: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 32 + rng.range(0, 8)
  // thick gnarled trunk
  ctx.fillStyle = '#5a4830'
  ctx.fillRect(cx - 4, baseY - h, 8, h)
  // forking branches with spiky tufts
  const forks = 2 + rng.int(0, 1)
  for (let i = 0; i < forks; i++) {
    const dir = i === 0 ? -1 : 1
    const by = baseY - h + 4 + rng.range(0, 6)
    ctx.fillStyle = '#5a4830'
    pixLine(ctx, cx, by, cx + dir * 14, by - 10, 3)
    // spiky tuft at end
    ctx.fillStyle = '#4a6828'
    const tx = cx + dir * 14
    const ty = by - 10
    for (let j = 0; j < 6; j++) {
      const a = rng.range(0, Math.PI * 2)
      pixLine(ctx, tx, ty, tx + Math.cos(a) * 7, ty + Math.sin(a) * 7, 1)
    }
  }
  // top tuft
  ctx.fillStyle = '#4a6828'
  for (let j = 0; j < 5; j++) {
    const a = rng.range(-Math.PI, 0)
    pixLine(ctx, cx, baseY - h, cx + Math.cos(a) * 8, baseY - h + Math.sin(a) * 8, 1)
  }
}

const drawMesaDeadTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 30 + rng.range(0, 8)
  // bleached white trunk
  ctx.fillStyle = '#d8d0c0'
  ctx.fillRect(cx - 3, baseY - h, 6, h)
  // bare branches
  ctx.fillStyle = '#c8c0b0'
  const branches = 3 + rng.int(0, 2)
  for (let i = 0; i < branches; i++) {
    const by = baseY - h + 4 + i * 8
    const dir = i % 2 === 0 ? -1 : 1
    pixLine(ctx, cx, by, cx + dir * (10 + rng.range(0, 8)), by - 6 - rng.range(0, 4), 2)
  }
  // dark shadow on trunk
  ctx.fillStyle = '#b0a890'
  ctx.fillRect(cx + 2, baseY - h, 1, h)
}

const drawMesaYucca: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // short thick stem
  ctx.fillStyle = '#5a4830'
  ctx.fillRect(cx - 3, baseY - 8, 6, 8)
  // radiating stiff leaves
  ctx.fillStyle = '#4a6828'
  const leaves = 8 + rng.int(0, 3)
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI * 2
    const len = 10 + rng.range(0, 6)
    pixLine(ctx, cx, baseY - 8, cx + Math.cos(angle) * len, baseY - 8 + Math.sin(angle) * len * 0.6, 2)
  }
  // optional flower stalk
  if (rng.next() > 0.5) {
    ctx.fillStyle = '#e0d0a0'
    pixLine(ctx, cx, baseY - 8, cx, baseY - 28, 1)
    ctx.fillRect(cx - 2, baseY - 30, 4, 4)
  }
}

const drawMesaTumbleweed: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 10 + rng.range(0, 4)
  // tangled sphere of dry twigs
  ctx.strokeStyle = '#8a7a50'
  ctx.lineWidth = 1
  const lines = 12 + rng.int(0, 4)
  for (let i = 0; i < lines; i++) {
    const a1 = rng.range(0, Math.PI * 2)
    const a2 = rng.range(0, Math.PI * 2)
    const x1 = cx + Math.cos(a1) * r * rng.range(0.3, 1)
    const y1 = cy + Math.sin(a1) * r * rng.range(0.3, 1)
    const x2 = cx + Math.cos(a2) * r * rng.range(0.3, 1)
    const y2 = cy + Math.sin(a2) * r * rng.range(0.3, 1)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  // outer circle hint
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

const drawMesaDryGrass: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  ctx.fillStyle = '#a89858'
  const blades = 4 + rng.int(0, 2)
  for (let i = 0; i < blades; i++) {
    const bx = cx + rng.range(-12, 12)
    const h = 8 + rng.range(0, 6)
    pixLine(ctx, bx, baseY, bx + rng.range(-3, 3), baseY - h, 1)
  }
  // seed heads at tips
  ctx.fillStyle = '#c0b070'
  for (let i = 0; i < 2; i++) {
    const bx = cx + rng.range(-10, 10)
    ctx.fillRect(bx - 1, baseY - 12 - rng.range(0, 4), 3, 2)
  }
}

const drawMesaFlower: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const count = 2 + rng.int(0, 2)
  const colors = ['#e06030', '#f0c020', '#d040a0']
  for (let i = 0; i < count; i++) {
    const fx = cx + rng.range(-12, 12)
    const stemH = 6 + rng.range(0, 4)
    ctx.fillStyle = '#5a7a30'
    pixLine(ctx, fx, baseY, fx, baseY - stemH, 1)
    ctx.fillStyle = colors[rng.int(0, colors.length - 1)]
    ctx.beginPath()
    ctx.arc(fx, baseY - stemH - 2, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawMesaRedRock: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 20 + rng.range(0, 6)
  const h = 14 + rng.range(0, 6)
  // irregular red sandstone block
  ctx.fillStyle = pal[1] || '#c06040'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx - w / 2 + 3, baseY - h)
  ctx.lineTo(cx + w / 2 - 2, baseY - h - 2)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.closePath()
  ctx.fill()
  // horizontal bands
  ctx.fillStyle = pal[0] || '#a04828'
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(cx - w / 2 + 2, baseY - y, w - 4, 1)
  }
  // highlight edge
  ctx.fillStyle = pal[3] || '#d08060'
  ctx.fillRect(cx - w / 2, baseY - h, 2, h)
}

const drawMesaFossil: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // stone slab
  const w = 22 + rng.range(0, 4)
  const h = 16 + rng.range(0, 4)
  ctx.fillStyle = pal[1] || '#b0a080'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // fossil outline — spiral ammonite shape
  ctx.strokeStyle = '#e0d8c0'
  ctx.lineWidth = 2
  ctx.beginPath()
  const fc = { x: cx, y: baseY - h / 2 }
  for (let t = 0.2; t < 2.5; t += 0.1) {
    const r = t * 3
    const angle = t * Math.PI * 1.2
    const x = fc.x + Math.cos(angle) * r
    const y = fc.y + Math.sin(angle) * r
    if (t < 0.3) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  // rib lines
  ctx.strokeStyle = '#d0c8b0'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    const a = 0.6 + i * 0.4
    const r = a * 3
    const angle = a * Math.PI * 1.2
    const x = fc.x + Math.cos(angle) * r
    const y = fc.y + Math.sin(angle) * r
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 3, y - 3)
    ctx.stroke()
  }
}

const drawMesaKiva: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 6
  // round kiva foundation
  const r = 16 + rng.range(0, 4)
  ctx.fillStyle = pal[1] || '#b07040'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 4, r, r * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark interior
  ctx.fillStyle = '#402820'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 5, r - 4, (r - 4) * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // low wall rim
  ctx.fillStyle = pal[0] || '#8a5030'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 6, r, r * 0.5, 0, Math.PI, 0)
  ctx.fill()
  // entrance gap
  ctx.fillStyle = '#402820'
  ctx.fillRect(cx - 3, baseY - 5, 6, 5)
}

const drawMesaPetroglyph: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 18 + rng.range(0, 4)
  const h = 22 + rng.range(0, 4)
  // flat rock face
  ctx.fillStyle = pal[1] || '#a08060'
  ctx.fillRect(cx - w / 2, baseY - h, w, h)
  // carved symbols in lighter colour
  ctx.fillStyle = '#d0c0a0'
  // stick figure
  pixLine(ctx, cx, baseY - h + 5, cx, baseY - h + 12, 1)
  pixLine(ctx, cx - 4, baseY - h + 8, cx + 4, baseY - h + 8, 1)
  pixLine(ctx, cx, baseY - h + 12, cx - 3, baseY - h + 16, 1)
  pixLine(ctx, cx, baseY - h + 12, cx + 3, baseY - h + 16, 1)
  // circle (sun)
  ctx.beginPath()
  ctx.arc(cx - 5, baseY - h + 18, 3, 0, Math.PI * 2)
  ctx.stroke()
  // zigzag (snake)
  for (let i = 0; i < 4; i++) {
    const x = cx + 3 + i * 3
    const y1 = baseY - h + 17
    const y2 = baseY - h + 20
    pixLine(ctx, x, i % 2 === 0 ? y1 : y2, x + 3, i % 2 === 0 ? y2 : y1, 1)
  }
}

const drawMesaSkull: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 6
  // bleached animal skull (side view)
  ctx.fillStyle = '#e8e0d0'
  // cranium
  ctx.beginPath()
  ctx.ellipse(cx - 2, baseY - 10, 10, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // snout
  ctx.fillRect(cx + 6, baseY - 10, 10, 6)
  // eye socket
  ctx.fillStyle = '#402820'
  ctx.beginPath()
  ctx.arc(cx, baseY - 11, 3, 0, Math.PI * 2)
  ctx.fill()
  // nose hole
  ctx.fillRect(cx + 14, baseY - 9, 2, 3)
  // jaw
  ctx.fillStyle = '#d8d0c0'
  ctx.fillRect(cx + 4, baseY - 4, 10, 3)
  // horn stubs
  ctx.fillStyle = '#c8c0a8'
  pixLine(ctx, cx - 6, baseY - 16, cx - 12, baseY - 22, 2)
  pixLine(ctx, cx + 2, baseY - 16, cx + 6, baseY - 22, 2)
}

const drawBadlandsSpire: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 44 + rng.range(0, 10)
  const w = 6 + rng.range(0, 3)
  // tall thin spire
  ctx.fillStyle = pal[1] || '#b07040'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
  ctx.lineTo(cx + 1, baseY - h)
  ctx.lineTo(cx - 1, baseY - h)
  ctx.closePath()
  ctx.fill()
  // erosion bands
  ctx.fillStyle = pal[3] || '#c89060'
  for (let y = 0; y < h; y += 6) {
    const bw = w * (1 - y / h) * 0.5
    ctx.fillRect(cx - bw, baseY - y, bw * 2, 1)
  }
  // slight widening midway
  ctx.fillStyle = pal[0] || '#8a5030'
  const midY = baseY - h * 0.5
  ctx.fillRect(cx - w * 0.4, midY - 2, w * 0.8, 4)
}

// ── Desert extras (new) ──────────────────────────────────────────────────

const drawDesertJoshuaTree: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 34 + rng.range(0, 6)
  // gnarled trunk
  ctx.fillStyle = '#6a5838'
  ctx.fillRect(cx - 4, baseY - h, 8, h)
  // forking branches
  const branches = 2 + rng.int(0, 2)
  for (let i = 0; i < branches; i++) {
    const dir = i % 2 === 0 ? -1 : 1
    const by = baseY - h + rng.range(2, 10)
    ctx.fillStyle = '#6a5838'
    pixLine(ctx, cx, by, cx + dir * 16, by - 12, 3)
    // spiky leaf cluster
    ctx.fillStyle = '#4a6828'
    const tx = cx + dir * 16
    const ty = by - 12
    for (let j = 0; j < 8; j++) {
      const a = rng.range(0, Math.PI * 2)
      pixLine(ctx, tx, ty, tx + Math.cos(a) * 8, ty + Math.sin(a) * 8, 1)
    }
  }
}

const drawDesertSaguaro: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const h = 42 + rng.range(0, 8)
  // tall main column
  ctx.fillStyle = '#3a6020'
  ctx.fillRect(cx - 5, baseY - h, 10, h)
  // dark ribs
  ctx.fillStyle = '#284515'
  ctx.fillRect(cx - 5, baseY - h, 2, h)
  ctx.fillRect(cx + 3, baseY - h, 2, h)
  // arms
  const arms = 1 + rng.int(0, 2)
  for (let i = 0; i < arms; i++) {
    const dir = i % 2 === 0 ? -1 : 1
    const armY = baseY - h * 0.5 + rng.range(-6, 6)
    ctx.fillStyle = '#3a6020'
    // horizontal segment
    ctx.fillRect(cx + dir * 4, armY, dir * 12, 6)
    // upward segment
    ctx.fillRect(cx + dir * 14, armY - 14, 6, 16)
    // dark rib on arm
    ctx.fillStyle = '#284515'
    ctx.fillRect(cx + dir * 14, armY - 14, 2, 16)
  }
  // spines
  ctx.fillStyle = '#d4c080'
  for (let i = 0; i < 6; i++) {
    const sy = baseY - h + 6 + i * 7
    ctx.fillRect(cx + 5, sy, 3, 1)
    ctx.fillRect(cx - 8, sy + 3, 3, 1)
  }
}

const drawDesertThorn: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const cy = SPRITE_SIZE * 0.55
  const r = 10 + rng.range(0, 3)
  // dark dry bush
  ctx.fillStyle = '#4a4020'
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  // thorny spikes sticking out
  ctx.fillStyle = '#7a6a40'
  const spikes = 8 + rng.int(0, 3)
  for (let i = 0; i < spikes; i++) {
    const a = rng.range(0, Math.PI * 2)
    const len = r + 3 + rng.range(0, 4)
    pixLine(ctx, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.3,
            cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.6, 1)
  }
}

const drawDesertAloe: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // rosette of thick pointed leaves
  ctx.fillStyle = '#4a7838'
  const leaves = 6 + rng.int(0, 2)
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI - Math.PI * 0.1
    const len = 12 + rng.range(0, 5)
    const tip_x = cx + Math.cos(angle) * len
    const tip_y = baseY - 4 + Math.sin(angle) * len * 0.3 - len * 0.4
    ctx.beginPath()
    ctx.moveTo(cx - 2, baseY - 4)
    ctx.lineTo(tip_x, tip_y)
    ctx.lineTo(cx + 2, baseY - 4)
    ctx.closePath()
    ctx.fill()
  }
  // lighter centre
  ctx.fillStyle = '#6a9850'
  ctx.beginPath()
  ctx.arc(cx, baseY - 6, 3, 0, Math.PI * 2)
  ctx.fill()
  // leaf edge dots (serration)
  ctx.fillStyle = '#e0d0a0'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + rng.range(-8, 8), baseY - 8 - rng.range(0, 8), 1, 1)
  }
}

const drawDesertSandDune: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 6
  // gentle dune ripple lines
  ctx.strokeStyle = '#c8b888'
  ctx.lineWidth = 1
  const ripples = 4 + rng.int(0, 2)
  for (let i = 0; i < ripples; i++) {
    const ry = baseY - i * 5 - rng.range(0, 3)
    const amp = 2 + rng.range(0, 2)
    ctx.beginPath()
    for (let x = cx - 20; x <= cx + 20; x += 2) {
      const y = ry + Math.sin((x - cx) * 0.15 + i) * amp
      if (x === cx - 20) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // a few grains
  ctx.fillStyle = '#d8c898'
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(cx + rng.range(-16, 16), baseY + rng.range(-12, 0), 1, 1)
  }
}

const drawDesertTracks: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 8
  // small animal footprints in sand
  ctx.fillStyle = '#a09060'
  const prints = 3 + rng.int(0, 2)
  for (let i = 0; i < prints; i++) {
    const px = cx + rng.range(-12, 12)
    const py = baseY - i * 8 + rng.range(-2, 2)
    // two toe pads
    ctx.beginPath()
    ctx.arc(px - 2, py - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px + 2, py - 2, 1.5, 0, Math.PI * 2)
    ctx.fill()
    // heel pad
    ctx.beginPath()
    ctx.arc(px, py + 1, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

const drawDesertMesa: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 26 + rng.range(0, 6)
  const h = 20 + rng.range(0, 6)
  // flat-topped mesa shape
  ctx.fillStyle = pal[1] || '#b07040'
  ctx.beginPath()
  ctx.moveTo(cx - w / 2 - 4, baseY)
  ctx.lineTo(cx - w / 2, baseY - h)
  ctx.lineTo(cx + w / 2, baseY - h)
  ctx.lineTo(cx + w / 2 + 4, baseY)
  ctx.closePath()
  ctx.fill()
  // flat top highlight
  ctx.fillStyle = pal[3] || '#c89060'
  ctx.fillRect(cx - w / 2, baseY - h, w, 3)
  // horizontal bands
  ctx.fillStyle = pal[0] || '#8a5030'
  for (let y = 4; y < h; y += 5) {
    ctx.fillRect(cx - w / 2, baseY - y, w, 1)
  }
}

const drawDesertPetrified: DrawFn = (ctx, rng, _pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const w = 16 + rng.range(0, 4)
  const h = 12 + rng.range(0, 4)
  // rounded stump shape
  ctx.fillStyle = '#8a7060'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // top flat cut
  ctx.fillStyle = '#a08a78'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h + 2, w / 2 - 1, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // ring pattern on top
  ctx.strokeStyle = '#6a5848'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(cx, baseY - h + 2, w * 0.25, 1.5, 0, 0, Math.PI * 2)
  ctx.stroke()
  // crystalline patches
  ctx.fillStyle = '#c0a888'
  ctx.fillRect(cx + rng.range(-4, 4), baseY - h / 2 + rng.range(-2, 2), 3, 2)
}

const drawDesertRuin: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  const wallH = 22 + rng.range(0, 6)
  const wallW = 24 + rng.range(0, 4)
  // crumbling wall
  ctx.fillStyle = pal[1] || '#b09060'
  ctx.fillRect(cx - wallW / 2, baseY - wallH, wallW, wallH)
  // broken top edge
  ctx.fillStyle = pal[0] || '#8a6840'
  for (let i = 0; i < 6; i++) {
    const bx = cx - wallW / 2 + i * (wallW / 6)
    const bh = rng.range(2, 8)
    ctx.fillRect(bx, baseY - wallH - bh, wallW / 6, bh + 2)
  }
  // block lines
  ctx.fillStyle = pal[0] || '#8a6840'
  for (let y = 0; y < wallH; y += 6) {
    ctx.fillRect(cx - wallW / 2, baseY - y, wallW, 1)
  }
  // dark window/door
  ctx.fillStyle = '#302018'
  ctx.fillRect(cx - 3, baseY - wallH + 6, 6, 10)
}

const drawDesertWell: DrawFn = (ctx, rng, pal) => {
  const cx = SPRITE_SIZE / 2
  const baseY = SPRITE_SIZE - 4
  // sandstone well
  ctx.fillStyle = pal[1] || '#b09060'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 8, 12, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // dark water inside
  ctx.fillStyle = '#204060'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 9, 8, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // water highlight
  ctx.fillStyle = '#4080b0'
  ctx.fillRect(cx - 2, baseY - 10, 4, 1)
  // rim
  ctx.fillStyle = pal[0] || '#8a6840'
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 11, 12, 4, 0, Math.PI, 0)
  ctx.fill()
  // simple post
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(cx + 8, baseY - 24, 3, 18)
  // rope hint
  ctx.strokeStyle = '#8a7a50'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx + 9, baseY - 24)
  ctx.lineTo(cx + 2, baseY - 16)
  ctx.stroke()
}

// ─── Sprite function tables (indexed by variant) ─────────────────────────────

type BiomeCategoryKey = `${BiomeType}_${SpriteCategory}`

const drawFunctions: Record<string, DrawFn[]> = {
  [`${BiomeType.Forest}_tree`]:      [drawForestTree, drawForestOak, drawForestBirch, drawForestWillow, drawForestMaple, drawForestSapling],
  [`${BiomeType.Forest}_bush`]:      [drawGrass, drawForestFern, drawForestMushroom, drawForestBerry, drawForestFlower, drawForestHedge],
  [`${BiomeType.Forest}_rock`]:      [drawRock, drawForestStump, drawForestBoulder, drawForestLog],
  [`${BiomeType.Forest}_structure`]: [drawStructure, drawForestShrine, drawForestWatchtower, drawForestFallenLog, drawForestWell, drawForestBridge],
  [`${BiomeType.Forest}_grass`]:     [drawGrass, drawForestTallGrass, drawForestClover, drawForestFern2],
  // Snow (merged: Tundra, Alpine, Cliffs, Taiga)
  [`${BiomeType.Snow}_tree`]:        [drawSnowPine, drawSnowBareTree, drawTundraShrub, drawAlpinePine, drawAlpineFir, drawCliffScrubTree, drawTaigaSpruce, drawTaigaBirch],
  [`${BiomeType.Snow}_bush`]:        [drawSnowIceBush, drawTundraLichen, drawAlpineBush, drawCliffBush, drawTaigaBush],
  [`${BiomeType.Snow}_rock`]:        [drawRock, drawSnowDrift, drawTundraSkull, drawAlpineMonolith, drawCliffSlateRock],
  [`${BiomeType.Snow}_structure`]:   [drawStructure, drawSnowCairn, drawSnowShrine, drawTundraStandingStone, drawAlpineMonolith, drawCliffNestStructure, drawTaigaCampfire],
  [`${BiomeType.Snow}_grass`]:       [drawGrass, drawSnowFrozenFlower, drawTundraDryGrass, drawAlpineFlower, drawCliffGrass],
  // Swamp (merged: Mushroom, Bog)
  [`${BiomeType.Swamp}_tree`]:       [drawSwampTree, drawSwampMangrove, drawSwampHollow, drawMushroomCap, drawMushroomCluster, drawMushroomGlowing, drawMushroomThin, drawBogTree],
  [`${BiomeType.Swamp}_bush`]:       [drawGrass, drawSwampCattail, drawMushroomSporePuff, drawBogReed],
  [`${BiomeType.Swamp}_rock`]:       [drawRock, drawSwampMossyRock, drawMushroomCoralRock, drawBogMossRock],
  [`${BiomeType.Swamp}_structure`]:  [drawStructure, drawSwampTotem, drawSwampLantern, drawMushroomRing, drawBogLantern],
  [`${BiomeType.Swamp}_grass`]:      [drawGrass, drawMushroomWebbing, drawBogGrass],
  // Volcanic (merged: AshWastes)
  [`${BiomeType.Volcanic}_tree`]:    [drawVolcanicDeadTree, drawVolcanicBoneSpire, drawAshSpire, drawAshCharredTree, drawVolcanicObsidianSpire, drawVolcanicSmokeVent],
  [`${BiomeType.Volcanic}_bush`]:    [drawVolcanicEmberBush, drawAshDeadBush, drawVolcanicMagmaPool, drawVolcanicCinder],
  [`${BiomeType.Volcanic}_rock`]:    [drawRock, drawVolcanicLavaRock, drawAshBonePile, drawVolcanicGlassRock, drawVolcanicBasaltColumn],
  [`${BiomeType.Volcanic}_structure`]: [drawStructure, drawVolcanicShrine, drawAshGravestone, drawVolcanicForge, drawVolcanicSkull],
  [`${BiomeType.Volcanic}_grass`]:   [drawVolcanicScorchMark, drawVolcanicAshGrass, drawVolcanicEmber, drawVolcanicCrack],
  // Desert (merged: Savanna, Oasis)
  [`${BiomeType.Desert}_tree`]:      [drawDesertCactus, drawDesertBarrelCactus, drawAcacia, drawBaobab, drawSavannaDeadTree, drawOasisPalm, drawDesertJoshuaTree, drawDesertSaguaro],
  [`${BiomeType.Desert}_bush`]:      [drawDesertDryBush, drawSavannaDryBush, drawOasisFlowerBush, drawDesertThorn, drawDesertAloe],
  [`${BiomeType.Desert}_rock`]:      [drawRock, drawDesertSkull, drawSavannaTermiteMound, drawDesertMesa, drawDesertPetrified],
  [`${BiomeType.Desert}_structure`]: [drawStructure, drawDesertObelisk, drawDesertArch, drawDesertBones, drawSavannaWaypost, drawOasisWellStructure, drawDesertRuin, drawDesertWell],
  [`${BiomeType.Desert}_grass`]:     [drawGrass, drawOasisGrass, drawDesertSandDune, drawDesertTracks],
  // Crystal
  [`${BiomeType.Crystal}_tree`]:       [drawCrystalSpire, drawCrystalCluster, drawCrystalTowerTree, drawCrystalGeodeTree],
  [`${BiomeType.Crystal}_bush`]:       [drawCrystalFlower, drawCrystalPrism, drawCrystalMoss],
  [`${BiomeType.Crystal}_rock`]:       [drawRock, drawCrystalShard, drawCrystalBoulder],
  [`${BiomeType.Crystal}_structure`]:  [drawStructure, drawCrystalAltar, drawCrystalRuneStone, drawCrystalPillar, drawCrystalGate],
  [`${BiomeType.Crystal}_grass`]:      [drawGrass, drawCrystalDust, drawCrystalStalagmite],
  // Jungle
  [`${BiomeType.Jungle}_tree`]:       [drawJungleTree, drawJunglePalm, drawJungleBanyan, drawJungleBamboo],
  [`${BiomeType.Jungle}_bush`]:       [drawJungleFern, drawJungleMonstera, drawJungleOrchid],
  [`${BiomeType.Jungle}_grass`]:      [drawJungleGrass, drawJungleVine, drawJungleMoss],
  [`${BiomeType.Jungle}_rock`]:       [drawRock, drawJungleVineRock, drawJungleBoulder, drawJungleSkull],
  [`${BiomeType.Jungle}_structure`]:  [drawStructure, drawJungleRuin, drawJungleTemple, drawJungleIdol],
  // Mesa (merged: Badlands)
  [`${BiomeType.Mesa}_tree`]:         [drawMesaCactus, drawBadlandsHoodoo, drawMesaJoshuaTree, drawMesaDeadTree],
  [`${BiomeType.Mesa}_bush`]:         [drawMesaScrub, drawBadlandsScrub, drawMesaYucca, drawMesaTumbleweed],
  [`${BiomeType.Mesa}_grass`]:        [drawMesaGrass, drawBadlandsGrass, drawMesaDryGrass, drawMesaFlower],
  [`${BiomeType.Mesa}_rock`]:         [drawRock, drawMesaPillar, drawBadlandsArch, drawMesaRedRock, drawMesaFossil, drawMesaSkull, drawBadlandsSpire],
  [`${BiomeType.Mesa}_structure`]:    [drawStructure, drawMesaAdobe, drawBadlandsArch, drawMesaKiva, drawMesaPetroglyph],
  // CoralReef
  [`${BiomeType.CoralReef}_tree`]:       [drawCoralTree, drawCoralFanTree, drawCoralTubeTree],
  [`${BiomeType.CoralReef}_bush`]:       [drawCoralBush, drawCoralAnemone, drawCoralSponge],
  [`${BiomeType.CoralReef}_grass`]:      [drawCoralSeaweed, drawCoralKelp],
  [`${BiomeType.CoralReef}_rock`]:       [drawCoralRock, drawCoralBarnacle],
  [`${BiomeType.CoralReef}_structure`]:  [drawCoralShell, drawCoralArch, drawCoralAnchor],
  // Heaven (merged: FloatingIslands)
  [`${BiomeType.Heaven}_tree`]:       [drawSkyTree, drawSkyCloudTree, drawSkyGlowTree],
  [`${BiomeType.Heaven}_bush`]:       [drawSkyBush, drawSkyFeather, drawSkyBlossom],
  [`${BiomeType.Heaven}_grass`]:      [drawGrass, drawSkyStarGrass],
  [`${BiomeType.Heaven}_rock`]:       [drawSkyRock, drawSkyCloudRock],
  [`${BiomeType.Heaven}_structure`]:  [drawSkyShrine, drawSkyPillar, drawSkyFountain],
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
