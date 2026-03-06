import * as THREE from 'three'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { SeededRandom } from '../utils/SeededRandom'

const SPRITE_SIZE = 64  // canvas pixels for each sprite

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

// ─── Sprite Generator ────────────────────────────────────────────────────────

type BiomeCategoryKey = `${BiomeType}_${SpriteCategory}`

const drawFunctions: Record<string, DrawFn> = {
  [`${BiomeType.Forest}_tree`]:      drawForestTree,
  [`${BiomeType.Forest}_bush`]:      drawGrass,
  [`${BiomeType.Forest}_rock`]:      drawRock,
  [`${BiomeType.Forest}_structure`]: drawStructure,
  [`${BiomeType.Forest}_grass`]:     drawGrass,
  [`${BiomeType.Desert}_tree`]:      drawDesertCactus,
  [`${BiomeType.Desert}_bush`]:      drawGrass,
  [`${BiomeType.Desert}_rock`]:      drawRock,
  [`${BiomeType.Desert}_structure`]: drawStructure,
  [`${BiomeType.Desert}_grass`]:     drawGrass,
  [`${BiomeType.Volcanic}_tree`]:    drawVolcanicDeadTree,
  [`${BiomeType.Volcanic}_bush`]:    drawGrass,
  [`${BiomeType.Volcanic}_rock`]:    drawRock,
  [`${BiomeType.Volcanic}_structure`]: drawStructure,
  [`${BiomeType.Snow}_tree`]:        drawSnowPine,
  [`${BiomeType.Snow}_bush`]:        drawGrass,
  [`${BiomeType.Snow}_rock`]:        drawRock,
  [`${BiomeType.Snow}_structure`]:   drawStructure,
  [`${BiomeType.Snow}_grass`]:       drawGrass,
}

export function generateSpriteTexture(
  biome: BiomeType,
  category: SpriteCategory,
  palette: [number, number, number][],
  seed: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')!

  const rng = new SeededRandom(seed)
  const csspalette = palette.map(([r, g, b]) => toHex(r, g, b))

  const key: BiomeCategoryKey = `${biome}_${category}`
  const drawFn = drawFunctions[key]
  if (drawFn) drawFn(ctx, rng, csspalette)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  return tex
}
