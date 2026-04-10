import { BiomeType } from '../biomes/types'

interface ReverbProfile {
  duration: number
  decay: number
  lpFreq: number   // 0 = no lowpass
  hpFreq: number   // 0 = no highpass
  earlyDensity: number // 0-1
  wetGain: number
}

const PROFILES: Record<string, ReverbProfile> = {
  forest:   { duration: 1.8, decay: 0.4,  lpFreq: 2000, hpFreq: 0,    earlyDensity: 0.5, wetGain: 0.25 },
  cave:     { duration: 3.0, decay: 0.8,  lpFreq: 0,    hpFreq: 200,  earlyDensity: 0.3, wetGain: 0.50 },
  desert:   { duration: 0.6, decay: 0.15, lpFreq: 0,    hpFreq: 500,  earlyDensity: 0.1, wetGain: 0.08 },
  swamp:    { duration: 1.0, decay: 0.3,  lpFreq: 800,  hpFreq: 0,    earlyDensity: 0.6, wetGain: 0.20 },
  infernal: { duration: 2.5, decay: 0.6,  lpFreq: 1200, hpFreq: 0,    earlyDensity: 0.4, wetGain: 0.35 },
  snow:     { duration: 2.2, decay: 0.5,  lpFreq: 0,    hpFreq: 0,    earlyDensity: 0.35, wetGain: 0.30 },
  ethereal: { duration: 3.5, decay: 0.9,  lpFreq: 0,    hpFreq: 100,  earlyDensity: 0.2, wetGain: 0.45 },
  savanna:  { duration: 1.2, decay: 0.25, lpFreq: 3000, hpFreq: 0,    earlyDensity: 0.3, wetGain: 0.15 },
  cliffs:   { duration: 2.0, decay: 0.5,  lpFreq: 4000, hpFreq: 300,  earlyDensity: 0.5, wetGain: 0.35 },
}

const BIOME_TO_PROFILE: Record<BiomeType, string> = {
  [BiomeType.Forest]:    'forest',
  [BiomeType.Jungle]:    'forest',
  [BiomeType.Crystal]:   'cave',
  [BiomeType.Desert]:    'desert',
  [BiomeType.Mesa]:      'desert',
  [BiomeType.Swamp]:     'swamp',
  [BiomeType.CoralReef]: 'swamp',
  [BiomeType.Volcanic]:  'infernal',
  [BiomeType.Hell]:      'infernal',
  [BiomeType.Snow]:      'snow',
  [BiomeType.Heaven]:    'ethereal',
}

export class EnvironmentReverb {
  private ctx: AudioContext
  private master: GainNode

  // A/B crossfade slots
  private convolverA: ConvolverNode
  private convolverB: ConvolverNode
  private gainA: GainNode
  private gainB: GainNode
  private activeSlot: 'A' | 'B' = 'A'

  // Send bus — subsystems connect to this
  private sendGain: GainNode
  private dryGain: GainNode

  private currentProfile = ''
  private irCache = new Map<string, AudioBuffer>()

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx
    this.master = master

    // Send input that subsystems route through
    this.sendGain = ctx.createGain()
    this.sendGain.gain.value = 1

    // Dry pass-through
    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 0.7
    this.sendGain.connect(this.dryGain)
    this.dryGain.connect(master)

    // Convolver A
    this.convolverA = ctx.createConvolver()
    this.gainA = ctx.createGain()
    this.gainA.gain.value = 0
    this.sendGain.connect(this.convolverA)
    this.convolverA.connect(this.gainA)
    this.gainA.connect(master)

    // Convolver B
    this.convolverB = ctx.createConvolver()
    this.gainB = ctx.createGain()
    this.gainB.gain.value = 0
    this.sendGain.connect(this.convolverB)
    this.convolverB.connect(this.gainB)
    this.gainB.connect(master)

    // Initialize with forest profile
    const ir = this.getIR('forest')
    this.convolverA.buffer = ir
    this.gainA.gain.value = PROFILES.forest.wetGain
    this.currentProfile = 'forest'
  }

  /** Node that subsystems connect their output to for reverb processing */
  getSendNode(): GainNode {
    return this.sendGain
  }

  update(biome: BiomeType) {
    const profileKey = BIOME_TO_PROFILE[biome] || 'forest'
    if (profileKey === this.currentProfile) return

    const profile = PROFILES[profileKey]
    const ir = this.getIR(profileKey)
    const t = this.ctx.currentTime

    // Crossfade: active slot fades out, inactive fades in with new IR
    if (this.activeSlot === 'A') {
      this.convolverB.buffer = ir
      this.gainA.gain.linearRampToValueAtTime(0, t + 2)
      this.gainB.gain.linearRampToValueAtTime(profile.wetGain, t + 2)
      this.activeSlot = 'B'
    } else {
      this.convolverA.buffer = ir
      this.gainB.gain.linearRampToValueAtTime(0, t + 2)
      this.gainA.gain.linearRampToValueAtTime(profile.wetGain, t + 2)
      this.activeSlot = 'A'
    }

    this.currentProfile = profileKey
  }

  private getIR(profileKey: string): AudioBuffer {
    let ir = this.irCache.get(profileKey)
    if (ir) return ir
    ir = this.buildParametricIR(PROFILES[profileKey])
    this.irCache.set(profileKey, ir)
    return ir
  }

  private buildParametricIR(p: ReverbProfile): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * p.duration)
    const buf = this.ctx.createBuffer(2, len, sr)
    const L = buf.getChannelData(0)
    const R = buf.getChannelData(1)

    let rng = 42
    const rand = () => { rng = (rng * 16807 + 0) % 2147483647; return (rng / 2147483647) * 2 - 1 }

    // Early reflections (first 80ms)
    const earlyEnd = Math.floor(sr * 0.08)
    const numReflections = Math.floor(6 + p.earlyDensity * 14)
    for (let r = 0; r < numReflections; r++) {
      const pos = Math.floor(Math.random() * earlyEnd)
      const amp = (0.3 + Math.random() * 0.5) * (1 - pos / earlyEnd)
      if (pos < len) {
        L[pos] += amp * (0.5 + Math.random() * 0.5)
        R[pos] += amp * (0.5 + Math.random() * 0.5)
      }
    }

    // Late diffuse tail
    const decayRate = -6.908 / (p.decay * p.duration) // -ln(0.001) / (decay * duration)
    for (let i = earlyEnd; i < len; i++) {
      const t = i / sr
      const env = Math.exp(decayRate * t)
      L[i] += rand() * env * 0.5
      R[i] += rand() * env * 0.5
    }

    // Apply filtering to the IR in-place
    if (p.lpFreq > 0) {
      this.applyOnePoleLP(L, sr, p.lpFreq)
      this.applyOnePoleLP(R, sr, p.lpFreq)
    }
    if (p.hpFreq > 0) {
      this.applyOnePoleHP(L, sr, p.hpFreq)
      this.applyOnePoleHP(R, sr, p.hpFreq)
    }

    return buf
  }

  private applyOnePoleLP(data: Float32Array, sr: number, freq: number) {
    const rc = 1 / (2 * Math.PI * freq)
    const dt = 1 / sr
    const a = dt / (rc + dt)
    let prev = 0
    for (let i = 0; i < data.length; i++) {
      prev = prev + a * (data[i] - prev)
      data[i] = prev
    }
  }

  private applyOnePoleHP(data: Float32Array, sr: number, freq: number) {
    const rc = 1 / (2 * Math.PI * freq)
    const dt = 1 / sr
    const a = rc / (rc + dt)
    let prev = 0
    let prevIn = 0
    for (let i = 0; i < data.length; i++) {
      const out = a * (prev + data[i] - prevIn)
      prevIn = data[i]
      data[i] = out
      prev = out
    }
  }
}
