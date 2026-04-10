import { BiomeType } from '../biomes/types'

/** Per-biome harmonic frequencies forming the world chord */
const BIOME_FREQUENCIES: Record<BiomeType, number> = {
  [BiomeType.Forest]:    261.6,  // C4
  [BiomeType.Desert]:    293.7,  // D4
  [BiomeType.Swamp]:     311.1,  // Eb4
  [BiomeType.Snow]:      349.2,  // F4
  [BiomeType.Volcanic]:  392.0,  // G4
  [BiomeType.Crystal]:   440.0,  // A4
  [BiomeType.Jungle]:    466.2,  // Bb4
  [BiomeType.Mesa]:      493.9,  // B4
  [BiomeType.CoralReef]: 523.3,  // C5
  [BiomeType.Heaven]:    659.3,  // E5
  [BiomeType.Hell]:      370.0,  // Gb4 (tritone from C4, resolves when activated)
}

export class HarmonicTone {
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private ctx: AudioContext
  private destination: AudioNode
  private frequency: number
  private biome: BiomeType
  private playing = false
  private baseGain = 0.04

  constructor(biome: BiomeType, ctx: AudioContext, destination: AudioNode) {
    this.biome = biome
    this.ctx = ctx
    this.destination = destination
    this.frequency = BIOME_FREQUENCIES[biome] ?? 440
  }

  /** Start the tone (called when site is activated) */
  start(): void {
    if (this.playing || !this.ctx) return
    this.playing = true

    this.oscillator = this.ctx.createOscillator()
    this.oscillator.type = 'sine'
    this.oscillator.frequency.setValueAtTime(this.frequency, this.ctx.currentTime)

    this.gainNode = this.ctx.createGain()
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime)
    // Gentle fade in
    this.gainNode.gain.linearRampToValueAtTime(this.baseGain, this.ctx.currentTime + 2.0)

    this.oscillator.connect(this.gainNode)
    this.gainNode.connect(this.destination)
    this.oscillator.start()
  }

  /** Update volume based on proximity — slight boost when player is in the same biome */
  update(playerInSameBiome: boolean): void {
    if (!this.gainNode || !this.playing) return
    const targetGain = playerInSameBiome ? 0.05 : this.baseGain
    // Smooth ramp to avoid clicks
    this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.3)
  }

  /**
   * Crescendo: briefly swell the volume of this tone then return to normal.
   * Used during the final ritual sequence — each tone swells in sequence.
   */
  crescendo(peakGain: number = 0.15, duration: number = 1.0): void {
    if (!this.gainNode || !this.playing) return

    const now = this.ctx.currentTime
    // Swell up over 30% of duration, sustain briefly, then decay back
    this.gainNode.gain.cancelScheduledValues(now)
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
    this.gainNode.gain.linearRampToValueAtTime(peakGain, now + duration * 0.3)
    this.gainNode.gain.linearRampToValueAtTime(peakGain * 0.8, now + duration * 0.7)
    this.gainNode.gain.linearRampToValueAtTime(this.baseGain, now + duration)
  }

  /** Stop the tone */
  stop(): void {
    if (!this.playing) return
    this.playing = false
    if (this.gainNode) {
      this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5)
    }
    const osc = this.oscillator
    if (osc) {
      setTimeout(() => { try { osc.stop() } catch { /* already stopped */ } }, 600)
    }
    this.oscillator = null
    this.gainNode = null
  }

  dispose(): void {
    this.stop()
  }
}
