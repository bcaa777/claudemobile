import { createNoise2D, createNoise3D } from 'simplex-noise'
import { SeededRandom } from './SeededRandom'

export type Noise2DFn = (x: number, y: number) => number
export type Noise3DFn = (x: number, y: number, z: number) => number

export function makeNoise2D(seed: number): Noise2DFn {
  const rng = new SeededRandom(seed)
  return createNoise2D(() => rng.next())
}

export function makeNoise3D(seed: number): Noise3DFn {
  const rng = new SeededRandom(seed)
  return createNoise3D(() => rng.next())
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
