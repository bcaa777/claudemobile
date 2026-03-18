import * as THREE from 'three'
import { SeededRandom } from './SeededRandom'

export type TexturePattern =
  | 'stone' | 'darkStone' | 'wood' | 'sand' | 'ice' | 'obsidian'
  | 'gold' | 'moss' | 'mushroom' | 'ash' | 'crystal' | 'marble'
  | 'lava' | 'runeGlow' | 'crystalGlow' | 'mushroomGlow' | 'emberGlow' | 'beaconGlow' | 'scales'

const SIZE = 16

export interface TextureResult {
  map: THREE.DataTexture
  emissiveMap?: THREE.DataTexture
}

function makeTexture(data: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data as unknown as BufferSource, SIZE, SIZE)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.needsUpdate = true
  return tex
}

function colorToRGB(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function setPixel(data: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const i = (y * SIZE + x) * 4
  data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b); data[i + 3] = a
}

function fillBase(data: Uint8Array, r: number, g: number, b: number) {
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255
  }
}

type PatternFn = (data: Uint8Array, baseColor: number, rng: SeededRandom) => void

const patterns: Record<TexturePattern, PatternFn> = {
  stone(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Brick pattern: mortar lines at rows 0,8 and cols 0,8
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const isMortar = y === 0 || y === 8 || ((y < 8 ? x === 0 : x === 8))
        if (isMortar) {
          setPixel(data, x, y, r * 0.6, g * 0.6, b * 0.6)
        } else {
          const noise = 1 + (rng.next() - 0.5) * 0.2
          setPixel(data, x, y, r * noise, g * noise, b * noise)
        }
      }
    }
  },

  darkStone(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const isMortar = y === 0 || y === 8 || ((y < 8 ? x === 0 : x === 8))
        if (isMortar) {
          setPixel(data, x, y, r * 0.5, g * 0.5, b * 0.5)
        } else {
          const noise = 1 + (rng.next() - 0.5) * 0.3
          // Occasional black specks
          if (rng.next() < 0.06) {
            setPixel(data, x, y, r * 0.2, g * 0.2, b * 0.2)
          } else {
            setPixel(data, x, y, r * noise, g * noise, b * noise)
          }
        }
      }
    }
  },

  wood(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Horizontal grain bands
    const bands: number[] = []
    for (let y = 0; y < SIZE; y++) {
      bands[y] = 0.85 + (Math.sin(y * 1.2) * 0.1) + (rng.next() - 0.5) * 0.08
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const grain = bands[y] + (rng.next() - 0.5) * 0.06
        setPixel(data, x, y, r * grain, g * grain, b * grain)
      }
    }
    // 1-2 knots
    const knots = 1 + (rng.next() > 0.5 ? 1 : 0)
    for (let k = 0; k < knots; k++) {
      const kx = rng.int(2, 13)
      const ky = rng.int(2, 13)
      setPixel(data, kx, ky, r * 0.5, g * 0.5, b * 0.5)
    }
  },

  sand(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const noise = 1 + (rng.next() - 0.5) * 0.3
        setPixel(data, x, y, r * noise, g * noise, b * noise)
      }
    }
    // Darker grain dots
    for (let i = 0; i < 8; i++) {
      const dx = rng.int(0, 15)
      const dy = rng.int(0, 15)
      setPixel(data, dx, dy, r * 0.65, g * 0.65, b * 0.65)
    }
  },

  ice(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r, g, b)
    // Diagonal frost streaks
    for (let i = 0; i < 3; i++) {
      let sx = rng.int(0, 15)
      let sy = rng.int(0, 15)
      for (let s = 0; s < 6; s++) {
        if (sx >= 0 && sx < SIZE && sy >= 0 && sy < SIZE) {
          setPixel(data, sx, sy, clamp(r * 1.2), clamp(g * 1.2), clamp(b * 1.15))
        }
        sx += 1; sy += 1
      }
    }
    // Subtle blue highlights
    for (let i = 0; i < 5; i++) {
      const hx = rng.int(0, 15)
      const hy = rng.int(0, 15)
      setPixel(data, hx, hy, clamp(r * 0.9), clamp(g * 0.95), clamp(b * 1.15))
    }
  },

  obsidian(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const noise = 1 + (rng.next() - 0.5) * 0.08
        setPixel(data, x, y, r * noise, g * noise, b * noise)
      }
    }
    // 2-3 bright glass-reflection specks
    const specks = 2 + (rng.next() > 0.5 ? 1 : 0)
    for (let i = 0; i < specks; i++) {
      const sx = rng.int(0, 15)
      const sy = rng.int(0, 15)
      setPixel(data, sx, sy, 180, 180, 200)
    }
  },

  gold(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r, g, b)
    // Diagonal lighter streak (sheen)
    for (let i = 0; i < SIZE; i++) {
      const x = i
      const y = (i + rng.int(0, 2)) % SIZE
      if (x < SIZE && y < SIZE) {
        setPixel(data, x, y, clamp(r * 1.25), clamp(g * 1.2), clamp(b * 1.1))
      }
    }
    // Minimal noise
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = (y * SIZE + x) * 4
        if (data[idx] === r && rng.next() < 0.3) {
          const n = 1 + (rng.next() - 0.5) * 0.06
          data[idx] = clamp(data[idx] * n)
          data[idx + 1] = clamp(data[idx + 1] * n)
          data[idx + 2] = clamp(data[idx + 2] * n)
        }
      }
    }
  },

  moss(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Patchy: clusters of green shades with darker gaps
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const cluster = Math.sin(x * 1.5 + rng.next()) * Math.cos(y * 1.2 + rng.next())
        const shade = 0.7 + cluster * 0.3 + (rng.next() - 0.5) * 0.15
        setPixel(data, x, y, r * shade, g * shade, b * shade)
      }
    }
  },

  mushroom(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r, g, b)
    // Circular spot/pore pattern
    for (let i = 0; i < 4; i++) {
      const cx = rng.int(2, 13)
      const cy = rng.int(2, 13)
      const rad = rng.int(1, 2)
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const px = cx + dx
          const py = cy + dy
          if (px >= 0 && px < SIZE && py >= 0 && py < SIZE && dx * dx + dy * dy <= rad * rad) {
            const dist = Math.sqrt(dx * dx + dy * dy) / rad
            const shade = 1.15 - dist * 0.3
            setPixel(data, px, py, r * shade, g * shade, b * shade)
          }
        }
      }
      // Darker edge ring
      for (let a = 0; a < 8; a++) {
        const angle = a * Math.PI / 4
        const ex = cx + Math.round(Math.cos(angle) * (rad + 1))
        const ey = cy + Math.round(Math.sin(angle) * (rad + 1))
        if (ex >= 0 && ex < SIZE && ey >= 0 && ey < SIZE) {
          setPixel(data, ex, ey, r * 0.65, g * 0.65, b * 0.65)
        }
      }
    }
  },

  ash(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Very low noise base
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const noise = 1 + (rng.next() - 0.5) * 0.1
        setPixel(data, x, y, r * noise, g * noise, b * noise)
      }
    }
    // 1-2 orange ember pixels
    const embers = 1 + (rng.next() > 0.5 ? 1 : 0)
    for (let i = 0; i < embers; i++) {
      const ex = rng.int(0, 15)
      const ey = rng.int(0, 15)
      setPixel(data, ex, ey, 255, 100, 20)
    }
  },

  crystal(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r, g, b)
    // 2-3 hue-shifted scattered pixels (rainbow effect)
    const shifts = [
      [1.3, 0.8, 0.9],
      [0.8, 1.3, 0.9],
      [0.9, 0.9, 1.3],
      [1.2, 1.1, 0.7],
    ]
    for (let i = 0; i < 6; i++) {
      const px = rng.int(0, 15)
      const py = rng.int(0, 15)
      const s = shifts[rng.int(0, shifts.length - 1)]
      setPixel(data, px, py, r * s[0], g * s[1], b * s[2])
    }
    // Subtle facet lines
    for (let i = 0; i < 2; i++) {
      const sx = rng.int(0, 15)
      let sy = rng.int(0, 15)
      for (let s = 0; s < 4; s++) {
        if (sy < SIZE) {
          setPixel(data, (sx + s) % SIZE, sy, r * 1.15, g * 1.15, b * 1.15)
        }
        sy++
      }
    }
  },

  marble(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r, g, b)
    // Wandering darker vein lines
    for (let v = 0; v < 2; v++) {
      let vx = rng.int(0, 15)
      let vy = 0
      for (let s = 0; s < SIZE; s++) {
        if (vx >= 0 && vx < SIZE && vy < SIZE) {
          setPixel(data, vx, vy, r * 0.75, g * 0.75, b * 0.78)
        }
        vy++
        vx += rng.int(-1, 1)
        vx = Math.max(0, Math.min(15, vx))
      }
    }
  },

  lava(data, _baseColor, rng) {
    // Dark base with bright orange/red crack lines
    const dr = 0x1a, dg = 0x04, db = 0x04
    fillBase(data, dr, dg, db)
    // Crack network
    for (let c = 0; c < 3; c++) {
      let cx = rng.int(0, 15)
      let cy = rng.int(0, 15)
      for (let s = 0; s < 8; s++) {
        if (cx >= 0 && cx < SIZE && cy >= 0 && cy < SIZE) {
          const bright = 0.7 + rng.next() * 0.3
          setPixel(data, cx, cy, 255 * bright, 100 * bright, 10)
        }
        cx += rng.int(-1, 1)
        cy += rng.int(0, 1)
        cx = Math.max(0, Math.min(15, cx))
        cy = cy % SIZE
      }
    }
  },

  runeGlow(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Dark base
    fillBase(data, r * 0.3, g * 0.3, b * 0.3)
    // Rune symbol: simple cross/diamond pattern
    const cx = 7, cy = 7
    const runePixels = [
      [cx, cy - 3], [cx, cy - 2], [cx, cy - 1], [cx, cy], [cx, cy + 1], [cx, cy + 2], [cx, cy + 3],
      [cx - 2, cy], [cx - 1, cy], [cx + 1, cy], [cx + 2, cy],
      [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
    ]
    for (const [px, py] of runePixels) {
      if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
        setPixel(data, px, py, r, g, b)
      }
    }
    // Random accent pixels
    for (let i = 0; i < 4; i++) {
      setPixel(data, rng.int(0, 15), rng.int(0, 15), r * 0.6, g * 0.6, b * 0.6)
    }
  },

  crystalGlow(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Faceted pattern with bright core
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - 7.5, dy = y - 7.5
        const dist = Math.sqrt(dx * dx + dy * dy) / 10
        const shade = 1.2 - dist * 0.5
        setPixel(data, x, y, r * shade * 0.7, g * shade * 0.7, b * shade * 0.7)
      }
    }
    // Bright core pixels
    for (let i = 0; i < 4; i++) {
      const px = 6 + rng.int(0, 3)
      const py = 6 + rng.int(0, 3)
      setPixel(data, px, py, r, g, b)
    }
  },

  mushroomGlow(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    fillBase(data, r * 0.4, g * 0.4, b * 0.4)
    // Organic spots with bioluminescent centers
    for (let i = 0; i < 5; i++) {
      const sx = rng.int(1, 14)
      const sy = rng.int(1, 14)
      setPixel(data, sx, sy, r, g, b)
      // Dimmer surrounding
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = sx + dx, ny = sy + dy
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
          setPixel(data, nx, ny, r * 0.7, g * 0.7, b * 0.7)
        }
      }
    }
  },

  emberGlow(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Dark base
    fillBase(data, r * 0.15, g * 0.15, b * 0.15)
    // Scattered bright ember dots
    for (let i = 0; i < 8; i++) {
      const ex = rng.int(0, 15)
      const ey = rng.int(0, 15)
      const bright = 0.6 + rng.next() * 0.4
      setPixel(data, ex, ey, r * bright, g * bright, b * bright)
    }
  },

  beaconGlow(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Radial gradient: bright center fading outward
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dx = x - 7.5, dy = y - 7.5
        const dist = Math.sqrt(dx * dx + dy * dy) / 10
        const shade = Math.max(0.3, 1 - dist * 0.6) + (rng.next() - 0.5) * 0.05
        setPixel(data, x, y, r * shade, g * shade, b * shade)
      }
    }
  },

  scales(data, baseColor, rng) {
    const [r, g, b] = colorToRGB(baseColor)
    // Overlapping scale pattern
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        // Scale pattern: offset rows
        const row = Math.floor(y / 4)
        const offset = (row % 2) * 4
        const lx = (x + offset) % 8
        const ly = y % 4
        // Edge of each scale = darker
        const isEdge = lx === 0 || ly === 0
        if (isEdge) {
          setPixel(data, x, y, r * 0.7, g * 0.7, b * 0.7)
        } else {
          const noise = 1 + (rng.next() - 0.5) * 0.12
          setPixel(data, x, y, r * noise, g * noise, b * noise)
        }
      }
    }
  },
}

export class PixelTextureGenerator {
  private cache = new Map<string, TextureResult>()

  getTexture(pattern: TexturePattern, baseColor: number, seed = 0): TextureResult {
    const key = `${pattern}_${baseColor}_${seed}`
    let result = this.cache.get(key)
    if (result) return result

    const data = new Uint8Array(SIZE * SIZE * 4)
    const rng = new SeededRandom(baseColor ^ (seed * 7919) ^ (pattern.charCodeAt(0) * 31))
    patterns[pattern](data, baseColor, rng)

    const map = makeTexture(data)
    result = { map }
    this.cache.set(key, result)
    return result
  }

  getEmissiveTexture(pattern: TexturePattern, baseColor: number, seed = 0): THREE.DataTexture {
    const key = `emissive_${pattern}_${baseColor}_${seed}`
    const cached = this.cache.get(key)
    if (cached) return cached.map

    const data = new Uint8Array(SIZE * SIZE * 4)
    const rng = new SeededRandom(baseColor ^ (seed * 7919) ^ (pattern.charCodeAt(0) * 31) ^ 0xE)

    // Generate a grayscale version of the pattern for emissive use
    patterns[pattern](data, baseColor, rng)
    const map = makeTexture(data)
    this.cache.set(key, { map })
    return map
  }
}

export const texGen = new PixelTextureGenerator()
