// Mulberry32 — fast seeded PRNG
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let z = this.state
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
  }

  // Float in [min, max)
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  // Integer in [min, max]
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }
}

// Hash-based seed from chunk coords for deterministic generation
export function chunkSeed(cx: number, cz: number, salt = 0): number {
  let h = (cx * 1619 + cz * 31337 + salt * 6791) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}
