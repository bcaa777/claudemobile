export class ChimeSound {
  private ctx: AudioContext
  private master: GainNode
  private reverb: ConvolverNode
  private reverbGain: GainNode
  private dryGain: GainNode

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx
    this.master = master

    // Short shimmer reverb for all chimes
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.buildReverbIR(1.2)
    this.reverbGain = ctx.createGain()
    this.reverbGain.gain.value = 0.3
    this.reverb.connect(this.reverbGain)
    this.reverbGain.connect(master)

    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 0.7
    this.dryGain.connect(master)
  }

  /** Build a simple reverb impulse response — exponential decay noise */
  private buildReverbIR(duration: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(2, len, sr)
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.3))
      }
    }
    return buf
  }

  /** Route a node to both dry and reverb sends */
  private sendToBus(node: AudioNode) {
    node.connect(this.dryGain)
    node.connect(this.reverb)
  }

  /** Crystal/lore pickup — shimmering metallic arpeggio with harmonics */
  playPickup() {
    const now = this.ctx.currentTime
    const notes = [523, 659, 784] // C5, E5, G5

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.09
      const freq = notes[i]

      // Main tone — sine + slight detune for shimmer
      const osc1 = this.ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = freq

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 1.003 // slight detune

      // Soft harmonic overtone
      const osc3 = this.ctx.createOscillator()
      osc3.type = 'sine'
      osc3.frequency.value = freq * 2.01 // octave + tiny detune

      const mix = this.ctx.createGain()
      const vol = 0.04 - i * 0.005

      mix.gain.setValueAtTime(0.001, t)
      mix.gain.linearRampToValueAtTime(vol, t + 0.008)
      mix.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

      const overtoneGain = this.ctx.createGain()
      overtoneGain.gain.value = 0.3

      osc1.connect(mix)
      osc2.connect(mix)
      osc3.connect(overtoneGain)
      overtoneGain.connect(mix)
      this.sendToBus(mix)

      osc1.start(t); osc1.stop(t + 0.4)
      osc2.start(t); osc2.stop(t + 0.4)
      osc3.start(t); osc3.stop(t + 0.4)

      const cleanup = () => { osc1.disconnect(); osc2.disconnect(); osc3.disconnect(); overtoneGain.disconnect(); mix.disconnect() }
      osc1.onended = cleanup
    }

    // Soft noise transient at the start (sparkle)
    this.playSparkle(now, 0.02, 0.015)
  }

  /** Discovery popup — bright bell-like ping with resonance */
  playDiscovery() {
    const now = this.ctx.currentTime

    // Primary bell tone — two detuned sines + triangle overtone
    const freq = 880
    const osc1 = this.ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = freq

    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 1.005

    // Inharmonic overtone for bell character
    const osc3 = this.ctx.createOscillator()
    osc3.type = 'triangle'
    osc3.frequency.value = freq * 2.76 // bell-like inharmonic

    const mix = this.ctx.createGain()
    mix.gain.setValueAtTime(0.001, now)
    mix.gain.linearRampToValueAtTime(0.06, now + 0.005)
    mix.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    const overtoneGain = this.ctx.createGain()
    overtoneGain.gain.setValueAtTime(0.02, now)
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc1.connect(mix)
    osc2.connect(mix)
    osc3.connect(overtoneGain)
    overtoneGain.connect(mix)
    this.sendToBus(mix)

    osc1.start(now); osc1.stop(now + 0.7)
    osc2.start(now); osc2.stop(now + 0.7)
    osc3.start(now); osc3.stop(now + 0.3)

    osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); osc3.disconnect(); overtoneGain.disconnect(); mix.disconnect() }

    // Secondary shimmer note
    const osc4 = this.ctx.createOscillator()
    osc4.type = 'sine'
    osc4.frequency.value = 1320
    const g2 = this.ctx.createGain()
    g2.gain.setValueAtTime(0.001, now + 0.04)
    g2.gain.linearRampToValueAtTime(0.03, now + 0.05)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
    osc4.connect(g2)
    this.sendToBus(g2)
    osc4.start(now + 0.04); osc4.stop(now + 0.5)
    osc4.onended = () => { osc4.disconnect(); g2.disconnect() }

    this.playSparkle(now, 0.015, 0.02)
  }

  /** NPC dialogue open — warm wooden chord with gentle attack */
  playDialogue() {
    const now = this.ctx.currentTime
    const freqs = [330, 495, 412] // E4, B4, Ab4 — warm open voicing

    for (let i = 0; i < freqs.length; i++) {
      const freq = freqs[i]
      const t = now + i * 0.03

      const osc1 = this.ctx.createOscillator()
      osc1.type = 'triangle'
      osc1.frequency.value = freq

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 1.002

      // Gentle lowpass to warm it up
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1500
      filter.Q.value = 0.5

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.001, t)
      gain.gain.linearRampToValueAtTime(0.035, t + 0.04) // soft attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      this.sendToBus(gain)

      osc1.start(t); osc1.stop(t + 0.7)
      osc2.start(t); osc2.stop(t + 0.7)
      osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect() }
    }
  }

  /** Campfire placed — warm crackling thud + soft tone */
  playCampfire() {
    const now = this.ctx.currentTime

    // Low warm thud (fire igniting)
    const osc1 = this.ctx.createOscillator()
    osc1.type = 'triangle'
    osc1.frequency.setValueAtTime(180, now)
    osc1.frequency.exponentialRampToValueAtTime(90, now + 0.2)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400

    const gain1 = this.ctx.createGain()
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.linearRampToValueAtTime(0.06, now + 0.015)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc1.connect(filter)
    filter.connect(gain1)
    this.sendToBus(gain1)
    osc1.start(now); osc1.stop(now + 0.4)

    // Soft confirming tone after the thud
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 262
    const osc3 = this.ctx.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.value = 330

    const gain2 = this.ctx.createGain()
    gain2.gain.setValueAtTime(0.001, now + 0.08)
    gain2.gain.linearRampToValueAtTime(0.04, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

    osc2.connect(gain2)
    osc3.connect(gain2)
    this.sendToBus(gain2)
    osc2.start(now + 0.08); osc2.stop(now + 0.55)
    osc3.start(now + 0.08); osc3.stop(now + 0.55)

    // Crackle noise burst
    this.playCrackle(now, 0.04)

    osc1.onended = () => { osc1.disconnect(); filter.disconnect(); gain1.disconnect() }
    osc2.onended = () => { osc2.disconnect(); osc3.disconnect(); gain2.disconnect() }
  }

  /** Companion bonded — warm ascending arpeggio with vibrato */
  playBond() {
    const notes = [392, 494, 587, 784] // G4, B4, D5, G5
    const now = this.ctx.currentTime

    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.11
      const freq = notes[i]

      // Two detuned tones for warmth
      const osc1 = this.ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = freq

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.value = freq * 1.004

      // Gentle vibrato via LFO
      const vib = this.ctx.createOscillator()
      vib.type = 'sine'
      vib.frequency.value = 5.5
      const vibGain = this.ctx.createGain()
      vibGain.gain.value = freq * 0.006
      vib.connect(vibGain)
      vibGain.connect(osc1.frequency)

      const mix = this.ctx.createGain()
      const vol = 0.04 + i * 0.005 // crescendo
      mix.gain.setValueAtTime(0.001, t)
      mix.gain.linearRampToValueAtTime(vol, t + 0.02)
      mix.gain.exponentialRampToValueAtTime(0.001, t + 0.4)

      osc1.connect(mix)
      osc2.connect(mix)
      this.sendToBus(mix)

      osc1.start(t); osc1.stop(t + 0.45)
      osc2.start(t); osc2.stop(t + 0.45)
      vib.start(t); vib.stop(t + 0.45)

      osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); vib.disconnect(); vibGain.disconnect(); mix.disconnect() }
    }

    this.playSparkle(now + 0.3, 0.025, 0.012)
  }

  /** Rune challenge complete — majestic rising chord with bell harmonics */
  playRuneComplete() {
    const now = this.ctx.currentTime
    const notes = [440, 554, 659, 880] // A4, C#5, E5, A5

    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.13
      const freq = notes[i]

      // Rich layered tone
      const osc1 = this.ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = freq

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 1.005

      // Bell-like inharmonic partial
      const osc3 = this.ctx.createOscillator()
      osc3.type = 'sine'
      osc3.frequency.value = freq * 2.76

      const bellGain = this.ctx.createGain()
      bellGain.gain.setValueAtTime(0.015, t)
      bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)

      const mix = this.ctx.createGain()
      const vol = 0.05 + i * 0.008
      mix.gain.setValueAtTime(0.001, t)
      mix.gain.linearRampToValueAtTime(vol, t + 0.01)
      mix.gain.exponentialRampToValueAtTime(0.001, t + 0.6)

      osc1.connect(mix)
      osc2.connect(mix)
      osc3.connect(bellGain)
      bellGain.connect(mix)
      this.sendToBus(mix)

      osc1.start(t); osc1.stop(t + 0.65)
      osc2.start(t); osc2.stop(t + 0.65)
      osc3.start(t); osc3.stop(t + 0.25)

      osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); osc3.disconnect(); bellGain.disconnect(); mix.disconnect() }
    }

    // Extra shimmer burst at climax
    this.playSparkle(now + 0.35, 0.035, 0.02)
    this.playSparkle(now + 0.5, 0.025, 0.015)
  }

  /** Companion death — somber descending tones with slow decay */
  playCompanionDeath() {
    const now = this.ctx.currentTime
    const notes = [330, 262, 220] // E4, C4, A3 — descending minor
    const durations = [0.6, 0.7, 1.0]

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.25
      const freq = notes[i]
      const dur = durations[i]

      // Warm detuned pair through lowpass
      const osc1 = this.ctx.createOscillator()
      osc1.type = 'triangle'
      osc1.frequency.value = freq

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 0.998

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(1200, t)
      filter.frequency.exponentialRampToValueAtTime(300, t + dur)
      filter.Q.value = 0.7

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.001, t)
      gain.gain.linearRampToValueAtTime(0.045, t + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)

      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(gain)
      this.sendToBus(gain)

      osc1.start(t); osc1.stop(t + dur + 0.05)
      osc2.start(t); osc2.stop(t + dur + 0.05)

      osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect() }
    }
  }

  /** Short noise burst — adds sparkle/transient to tonal chimes */
  private playSparkle(time: number, volume: number, duration: number) {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / sr
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t / (duration * 0.25))
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 4000
    filter.Q.value = 0.5

    const gain = this.ctx.createGain()
    gain.gain.value = volume

    source.connect(filter)
    filter.connect(gain)
    this.sendToBus(gain)
    source.start(time)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  /** Short crackle — used for campfire sound */
  private playCrackle(time: number, volume: number) {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * 0.06)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / sr
      // Sparse crackle — occasional loud pops
      const pop = Math.random() > 0.85 ? (Math.random() * 2 - 1) : 0
      data[i] = pop * Math.exp(-t * 40)
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2000
    filter.Q.value = 1

    const gain = this.ctx.createGain()
    gain.gain.value = volume

    source.connect(filter)
    filter.connect(gain)
    this.sendToBus(gain)
    source.start(time)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  dispose() {
    this.reverb.disconnect()
    this.reverbGain.disconnect()
    this.dryGain.disconnect()
  }
}
