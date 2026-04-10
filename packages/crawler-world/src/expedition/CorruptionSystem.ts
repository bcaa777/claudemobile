export class CorruptionSystem {
  isCorrupted = false

  check(cleansedCount: number): void {
    this.isCorrupted = cleansedCount >= 4
  }

  /** Returns modified fog/tint for corrupted biomes */
  getCorruptionOverlay(): { fogColor: number; fogDensity: number; tintR: number; tintG: number; tintB: number } | null {
    if (!this.isCorrupted) return null
    return {
      fogColor: 0x1a0a2a,     // dark purple fog
      fogDensity: 0.025,
      tintR: 0.8, tintG: 0.5, tintB: 0.9,  // purple tint
    }
  }

  /** Mutation rate multiplier for corrupted biomes */
  getMutationMultiplier(): number {
    return this.isCorrupted ? 2.0 : 1.0
  }
}
