import { createNoise2D } from 'simplex-noise'

export type Noise2DFn = (x: number, y: number) => number

// Mulberry32 — fast seeded PRNG (inline to avoid cross-package dependency)
class SeededRandom {
  private state: number
  constructor(seed: number) { this.state = seed >>> 0 }
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let z = this.state
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }
}

export function makeNoise2D(seed: number): Noise2DFn {
  const rng = new SeededRandom(seed)
  return createNoise2D(() => rng.next())
}

// Fractal Brownian Motion — multi-octave noise in [0, 1]
export function fbm(
  noise2d: Noise2DFn,
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.0,
  persistence = 0.5
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += noise2d(x * frequency, y * frequency) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }

  return (value / maxValue + 1) * 0.5 // normalize to [0,1]
}
