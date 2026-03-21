export class WindSound {
  private ctx: AudioContext
  private gain: GainNode

  // Two noise layers at different filter bands for depth
  private sources: AudioBufferSourceNode[] = []
  private filters: BiquadFilterNode[] = []

  // LFO to modulate filter frequency (organic swelling)
  private lfo: OscillatorNode
  private lfoGain: GainNode

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx

    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(master)

    // LFO for slow wind swelling — modulates filter cutoffs
    this.lfo = ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = 0.15 // very slow
    this.lfoGain = ctx.createGain()
    this.lfoGain.gain.value = 100 // ±100 Hz modulation
    this.lfo.connect(this.lfoGain)
    this.lfo.start()

    // Create two filtered noise layers
    const buffer = this.createBrownNoise(2)

    // Low breathy layer
    this.addLayer(buffer, 'lowpass', 300, 0.7)
    // Mid whoosh layer
    this.addLayer(buffer, 'bandpass', 800, 0.4)
  }

  private createBrownNoise(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = sr * seconds
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    // Brown noise — integrated white noise, much smoother than white
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5 // amplify
    }
    return buf
  }

  private addLayer(buffer: AudioBuffer, filterType: BiquadFilterType, freq: number, q: number) {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = this.ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = freq
    filter.Q.value = q

    // Connect LFO to modulate this filter's frequency
    this.lfoGain.connect(filter.frequency)

    source.connect(filter)
    filter.connect(this.gain)
    source.start()

    this.sources.push(source)
    this.filters.push(filter)
  }

  update(altitude: number, weatherIntensity: number, isBlizzard: boolean) {
    const altFactor = Math.min(1, Math.max(0, altitude / 80))
    const volume = Math.min(0.25, altFactor * 0.1 + weatherIntensity * 0.18)
    this.gain.gain.value += (volume - this.gain.gain.value) * 0.02

    // Blizzard: deeper, more intense, faster LFO modulation
    if (isBlizzard) {
      this.lfo.frequency.value += (0.4 - this.lfo.frequency.value) * 0.02
      this.lfoGain.gain.value += (250 - this.lfoGain.gain.value) * 0.02
      if (this.filters[0]) this.filters[0].frequency.value += (180 - this.filters[0].frequency.value) * 0.02
      if (this.filters[1]) this.filters[1].frequency.value += (500 - this.filters[1].frequency.value) * 0.02
    } else {
      this.lfo.frequency.value += (0.15 - this.lfo.frequency.value) * 0.02
      this.lfoGain.gain.value += (100 - this.lfoGain.gain.value) * 0.02
      const baseFreq = 300 + altitude * 1.5
      if (this.filters[0]) this.filters[0].frequency.value += (baseFreq * 0.5 - this.filters[0].frequency.value) * 0.02
      if (this.filters[1]) this.filters[1].frequency.value += (baseFreq - this.filters[1].frequency.value) * 0.02
    }
  }

  dispose() {
    for (const s of this.sources) { s.stop(); s.disconnect() }
    for (const f of this.filters) f.disconnect()
    this.lfo.stop(); this.lfo.disconnect()
    this.lfoGain.disconnect()
    this.gain.disconnect()
  }
}
