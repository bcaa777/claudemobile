import { AudioSystem } from '@engine/core'

export class GameAudio extends AudioSystem {
  private biomeMusic: OscillatorNode | null = null
  private biomeFifth: OscillatorNode | null = null
  private combatLayer: OscillatorNode | null = null
  private threatLevel = 0

  init(): void {
    super.init()
    // AudioContext is now available
  }

  /** Start biome-appropriate ambient music */
  startBiomeMusic(biomeType: number): void {
    this.stopBiomeMusic()
    const ctx = this.getContext()
    if (!ctx) return
    const gain = this.getAmbienceGain()
    if (!gain) return

    // Each biome has a different base note and waveform
    const biomeNotes: Record<number, { freq: number; type: OscillatorType }> = {
      0: { freq: 220, type: 'sine' },        // Forest: warm A3
      1: { freq: 293.66, type: 'triangle' }, // Desert: D4
      2: { freq: 196, type: 'sine' },        // Swamp: G3 low
      3: { freq: 329.63, type: 'sine' },     // Snow: E4 bright
      4: { freq: 146.83, type: 'sawtooth' }, // Volcanic: D3 harsh
      5: { freq: 440, type: 'sine' },        // Crystal: A4 pure
      6: { freq: 261.63, type: 'triangle' }, // Jungle: C4
      7: { freq: 174.61, type: 'triangle' }, // Mesa: F3
      8: { freq: 392, type: 'sine' },        // CoralReef: G4
    }
    const note = biomeNotes[biomeType] ?? { freq: 220, type: 'sine' as OscillatorType }

    // Base drone
    const osc = ctx.createOscillator()
    osc.type = note.type
    osc.frequency.value = note.freq
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.04
    osc.connect(oscGain)
    oscGain.connect(gain)
    osc.start()
    this.biomeMusic = osc

    // Fifth harmony
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = note.freq * 1.5
    const g2 = ctx.createGain()
    g2.gain.value = 0.02
    osc2.connect(g2)
    g2.connect(gain)
    osc2.start()
    this.biomeFifth = osc2
  }

  stopBiomeMusic(): void {
    try { this.biomeMusic?.stop() } catch { /* already stopped */ }
    try { this.biomeFifth?.stop() } catch { /* already stopped */ }
    this.biomeMusic = null
    this.biomeFifth = null
  }

  /** Adjust combat intensity (0-1) based on nearby enemy count */
  setCombatIntensity(intensity: number): void {
    this.threatLevel = Math.max(0, Math.min(1, intensity))
  }

  // SFX methods — short oscillator bursts
  playHitSound(): void       { this.playTone(800,  0.05, 0.1,  'square') }
  playKillSound(): void      { this.playTone(600,  0.08, 0.15, 'sawtooth') }
  playPickupSound(): void    { this.playTone(1200, 0.03, 0.08, 'sine') }
  playPlayerHitSound(): void { this.playTone(200,  0.08, 0.2,  'square') }
  playMenuClick(): void      { this.playTone(1000, 0.02, 0.05, 'sine') }

  playLevelUpSound(): void {
    this.playTone(523, 0.1, 0.3, 'sine')
    setTimeout(() => this.playTone(659, 0.1, 0.3, 'sine'), 100)
    setTimeout(() => this.playTone(784, 0.1, 0.3, 'sine'), 200)
  }

  playBossMusic(): void {
    // Stop biome drone and replace with ominous boss tone
    this.stopBiomeMusic()
    this.playTone(110, 0.06, 999, 'sawtooth')
  }

  private playTone(freq: number, volume: number, duration: number, type: OscillatorType): void {
    const ctx = this.getContext()
    if (!ctx) return
    const sfxGain = this.getSfxGain()
    if (!sfxGain) return

    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq

    const g = ctx.createGain()
    g.gain.setValueAtTime(volume, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

    osc.connect(g)
    g.connect(sfxGain)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.05)
  }
}
