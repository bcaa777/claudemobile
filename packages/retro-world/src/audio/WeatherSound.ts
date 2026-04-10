import { WeatherType } from '../systems/WeatherSystem'

export class WeatherSound {
  private ctx: AudioContext
  private master: GainNode

  // Rain uses two noise layers with different filtering for texture
  private rainSource1: AudioBufferSourceNode | null = null
  private rainSource2: AudioBufferSourceNode | null = null
  private rainFilter1: BiquadFilterNode
  private rainFilter2: BiquadFilterNode
  private rainGain: GainNode

  // Rain drop layer — intermittent plinks
  private dropTimer = 0

  // Thunder state
  private thunderTimer = 0

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx
    this.master = master

    this.rainGain = ctx.createGain()
    this.rainGain.gain.value = 0
    this.rainGain.connect(master)

    // High freq patter (individual drops)
    this.rainFilter1 = ctx.createBiquadFilter()
    this.rainFilter1.type = 'bandpass'
    this.rainFilter1.frequency.value = 4500
    this.rainFilter1.Q.value = 0.3
    this.rainFilter1.connect(this.rainGain)

    // Low freq body (steady wash)
    this.rainFilter2 = ctx.createBiquadFilter()
    this.rainFilter2.type = 'lowpass'
    this.rainFilter2.frequency.value = 1200
    this.rainFilter2.Q.value = 0.5
    this.rainFilter2.connect(this.rainGain)

    this.startNoise()
  }

  private startNoise() {
    const sr = this.ctx.sampleRate
    const len = sr * 3

    // Different noise buffers for each layer
    const buf1 = this.ctx.createBuffer(1, len, sr)
    const buf2 = this.ctx.createBuffer(1, len, sr)
    const d1 = buf1.getChannelData(0)
    const d2 = buf2.getChannelData(0)

    // Layer 1: pink-ish noise (high freq patter)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      d1[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11
    }

    // Layer 2: brown noise (low wash)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      d2[i] = last * 3.5
    }

    this.rainSource1 = this.ctx.createBufferSource()
    this.rainSource1.buffer = buf1
    this.rainSource1.loop = true
    this.rainSource1.connect(this.rainFilter1)
    this.rainSource1.start()

    this.rainSource2 = this.ctx.createBufferSource()
    this.rainSource2.buffer = buf2
    this.rainSource2.loop = true
    this.rainSource2.connect(this.rainFilter2)
    this.rainSource2.start()
  }

  update(delta: number, weather: WeatherType) {
    let targetVol = 0
    if (weather === WeatherType.Rain) targetVol = 0.1
    else if (weather === WeatherType.HeavyRain) targetVol = 0.18
    else if (weather === WeatherType.Blizzard) targetVol = 0.12
    else if (weather === WeatherType.AshFall) targetVol = 0.03

    // Smooth volume transitions
    const current = this.rainGain.gain.value
    this.rainGain.gain.value = current + (targetVol - current) * Math.min(1, delta * 0.8)

    // Adjust filters per weather
    if (weather === WeatherType.Blizzard) {
      this.rainFilter1.frequency.value += (1500 - this.rainFilter1.frequency.value) * 0.02
      this.rainFilter2.frequency.value += (500 - this.rainFilter2.frequency.value) * 0.02
    } else if (weather === WeatherType.AshFall) {
      this.rainFilter1.frequency.value += (2000 - this.rainFilter1.frequency.value) * 0.02
      this.rainFilter2.frequency.value += (400 - this.rainFilter2.frequency.value) * 0.02
    } else {
      this.rainFilter1.frequency.value += (4500 - this.rainFilter1.frequency.value) * 0.02
      this.rainFilter2.frequency.value += (1200 - this.rainFilter2.frequency.value) * 0.02
    }

    // Occasional rain drop "plinks" during rain
    if (weather === WeatherType.Rain || weather === WeatherType.HeavyRain) {
      this.dropTimer -= delta
      if (this.dropTimer <= 0) {
        this.dropTimer = weather === WeatherType.HeavyRain
          ? 0.05 + Math.random() * 0.15
          : 0.1 + Math.random() * 0.4
        this.playDrop()
      }
    }

    // Thunder
    if (weather === WeatherType.HeavyRain) {
      this.thunderTimer -= delta
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 8 + Math.random() * 15
        this.playThunder()
      }
    }
  }

  /** Individual raindrop impact — soft filtered noise impulse with tonal ping */
  private playDrop() {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * 0.045) // slightly longer for softer tail
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)
    // Shaped noise with soft attack to avoid click
    let prev = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const attack = Math.min(1, t / 0.002) // 2ms fade-in
      const white = Math.random() * 2 - 1
      // 1-pole lowpass to smooth the noise
      prev = prev * 0.5 + white * 0.5
      data[i] = prev * Math.exp(-t * 70) * attack * 0.25
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = 0.7 + Math.random() * 0.6

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2500 + Math.random() * 3000
    filter.Q.value = 0.8 // lower Q for smoother sound

    const gain = this.ctx.createGain()
    gain.gain.value = 0.015 + Math.random() * 0.02

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start()
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  /** Thunder — layered low rumble with noise crack */
  private playThunder() {
    const now = this.ctx.currentTime
    const duration = 1.5 + Math.random() * 1.5

    // Layer 1: Low rumble — multiple detuned oscillators
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = 25 + Math.random() * 20 + i * 8

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 80 + Math.random() * 40

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      // Quick attack, long rumbling decay
      gain.gain.linearRampToValueAtTime(0.06, now + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.master)
      osc.start(now)
      osc.stop(now + duration)
      osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect() }
    }

    // Layer 2: Noise crack — softened with layered filtering
    const sr = this.ctx.sampleRate
    const crackLen = Math.floor(sr * 0.2)
    const crackBuf = this.ctx.createBuffer(1, crackLen, sr)
    const crackData = crackBuf.getChannelData(0)
    // Brown-ish shaped noise for a rounder crack
    let crackPrev = 0
    for (let i = 0; i < crackLen; i++) {
      const t = i / sr
      const white = Math.random() * 2 - 1
      crackPrev = (crackPrev + 0.06 * white) / 1.06
      const attack = Math.min(1, t / 0.003) // soft 3ms fade-in
      crackData[i] = crackPrev * 5 * Math.exp(-t * 15) * attack
    }
    const crackSource = this.ctx.createBufferSource()
    crackSource.buffer = crackBuf

    const crackFilter = this.ctx.createBiquadFilter()
    crackFilter.type = 'bandpass'
    crackFilter.frequency.value = 250
    crackFilter.Q.value = 0.4

    // Second filter to further smooth
    const crackLP = this.ctx.createBiquadFilter()
    crackLP.type = 'lowpass'
    crackLP.frequency.value = 800

    const crackGain = this.ctx.createGain()
    crackGain.gain.setValueAtTime(0.001, now)
    crackGain.gain.linearRampToValueAtTime(0.06, now + 0.01)
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)

    crackSource.connect(crackFilter)
    crackFilter.connect(crackLP)
    crackLP.connect(crackGain)
    crackGain.connect(this.master)
    crackSource.start(now)
    crackSource.onended = () => { crackSource.disconnect(); crackFilter.disconnect(); crackLP.disconnect(); crackGain.disconnect() }
  }

  dispose() {
    this.rainSource1?.stop(); this.rainSource1?.disconnect()
    this.rainSource2?.stop(); this.rainSource2?.disconnect()
    this.rainFilter1.disconnect()
    this.rainFilter2.disconnect()
    this.rainGain.disconnect()
  }
}
