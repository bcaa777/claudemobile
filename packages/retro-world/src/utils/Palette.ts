// Bayer 4x4 ordered dithering matrix (normalized 0..1)
const BAYER_4X4 = [
  [ 0/16,  8/16,  2/16, 10/16],
  [12/16,  4/16, 14/16,  6/16],
  [ 3/16, 11/16,  1/16,  9/16],
  [15/16,  7/16, 13/16,  5/16],
]

// Quantize a value 0..1 to N steps
export function quantize(value: number, steps: number): number {
  return Math.round(value * steps) / steps
}

// Apply Bayer dithering to a color channel [0..1] at pixel (px, py)
export function ditherChannel(
  value: number,
  px: number,
  py: number,
  threshold = 0.5
): number {
  const bayerVal = BAYER_4X4[py & 3][px & 3]
  return value + (bayerVal - threshold) * 0.15
}

// Quantize RGB to PS1-style limited color (5-bit per channel = 32 levels)
export function quantizePS1(r: number, g: number, b: number, px = 0, py = 0): [number, number, number] {
  const steps = 31 // 5-bit color
  return [
    Math.max(0, Math.min(1, quantize(ditherChannel(r, px, py), steps))),
    Math.max(0, Math.min(1, quantize(ditherChannel(g, px, py), steps))),
    Math.max(0, Math.min(1, quantize(ditherChannel(b, px, py), steps))),
  ]
}

// Find nearest color in a palette (returns [r,g,b] 0..1)
export function nearestPaletteColor(
  r: number, g: number, b: number,
  palette: [number, number, number][]
): [number, number, number] {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dist = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2
    if (dist < bestDist) { bestDist = dist; best = c }
  }
  return best
}
