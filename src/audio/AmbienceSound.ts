import { BiomeType } from '../biomes/types'
import { EnvironmentReverb } from './EnvironmentReverb'

type NoiseColor = 'white' | 'pink' | 'brown'

interface ContinuousLayerDef {
  noiseColor: NoiseColor
  filterType: BiquadFilterType
  filterFreq: number
  filterQ: number
  volume: number
  lfoRate?: number   // Hz, modulates filter frequency
  lfoDepth?: number  // 0-1
}

interface IntermittentLayerDef {
  minInterval: number
  maxInterval: number
  generate: (ctx: AudioContext, output: AudioNode) => void
}

interface AmbienceDef {
  continuous: ContinuousLayerDef[]
  intermittent: IntermittentLayerDef[]
}

// ─── Helper: one-shot noise burst ───
function noiseImpulse(ctx: AudioContext, output: AudioNode, freq: number, q: number, dur: number, vol: number) {
  const sr = ctx.sampleRate
  const len = Math.floor(sr * dur)
  const buf = ctx.createBuffer(1, len, sr)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    d[i] = (Math.random() * 2 - 1) * Math.exp(-t * (3 / dur))
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const flt = ctx.createBiquadFilter()
  flt.type = 'bandpass'
  flt.frequency.value = freq
  flt.Q.value = q
  const g = ctx.createGain()
  g.gain.value = vol
  src.connect(flt).connect(g).connect(output)
  src.start()
  src.onended = () => { src.disconnect(); flt.disconnect(); g.disconnect() }
}

// ─── Helper: FM chirp (bird/insect) ───
function fmChirp(
  ctx: AudioContext, output: AudioNode,
  carrierHz: number, modHz: number, modDepth: number,
  dur: number, vol: number, slideUp = true,
) {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = carrierHz

  const mod = ctx.createOscillator()
  mod.type = 'sine'
  mod.frequency.value = modHz
  const modGain = ctx.createGain()
  modGain.gain.value = modDepth
  mod.connect(modGain).connect(osc.frequency)

  if (slideUp) {
    osc.frequency.linearRampToValueAtTime(carrierHz * 1.4, t0 + dur * 0.5)
    osc.frequency.linearRampToValueAtTime(carrierHz * 0.8, t0 + dur)
  }

  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)

  osc.connect(env).connect(output)
  osc.start(t0)
  osc.stop(t0 + dur)
  mod.start(t0)
  mod.stop(t0 + dur)
  osc.onended = () => { osc.disconnect(); mod.disconnect(); modGain.disconnect(); env.disconnect() }
}

// ─── Helper: pitched tone with decay ───
function tonePing(ctx: AudioContext, output: AudioNode, freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const env = ctx.createGain()
  env.gain.setValueAtTime(vol, t0)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(env).connect(output)
  osc.start(t0)
  osc.stop(t0 + dur)
  osc.onended = () => { osc.disconnect(); env.disconnect() }
}

// ─── Helper: bubble sound ───
function bubble(ctx: AudioContext, output: AudioNode, vol: number) {
  const t0 = ctx.currentTime
  const dur = 0.06 + Math.random() * 0.08
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const startF = 150 + Math.random() * 200
  osc.frequency.setValueAtTime(startF, t0)
  osc.frequency.exponentialRampToValueAtTime(startF * 3, t0 + dur)
  const env = ctx.createGain()
  env.gain.setValueAtTime(vol, t0)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(env).connect(output)
  osc.start(t0)
  osc.stop(t0 + dur)
  osc.onended = () => { osc.disconnect(); env.disconnect() }
}

// ─── Helper: creak/groan sound ───
function creak(ctx: AudioContext, output: AudioNode, baseFreq: number, dur: number, vol: number) {
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(baseFreq, t0)
  osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, t0 + dur)
  const flt = ctx.createBiquadFilter()
  flt.type = 'bandpass'
  flt.frequency.value = baseFreq * 2
  flt.Q.value = 8
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(vol, t0 + dur * 0.1)
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(flt).connect(env).connect(output)
  osc.start(t0)
  osc.stop(t0 + dur)
  osc.onended = () => { osc.disconnect(); flt.disconnect(); env.disconnect() }
}

// ─── Biome ambience definitions ───

function buildDefs(): Record<BiomeType, AmbienceDef> {
  return {
    [BiomeType.Forest]: {
      continuous: [
        { noiseColor: 'pink', filterType: 'bandpass', filterFreq: 4500, filterQ: 0.8, volume: 0.018, lfoRate: 0.1, lfoDepth: 0.3 },
      ],
      intermittent: [
        { minInterval: 3, maxInterval: 8, generate: (ctx, out) => fmChirp(ctx, out, 1800 + Math.random() * 800, 30, 200, 0.12, 0.02) },
        { minInterval: 5, maxInterval: 14, generate: (ctx, out) => fmChirp(ctx, out, 2200 + Math.random() * 600, 25, 300, 0.08, 0.015) },
        { minInterval: 8, maxInterval: 20, generate: (ctx, out) => noiseImpulse(ctx, out, 2000, 1, 0.04, 0.025) },
      ],
    },
    [BiomeType.Jungle]: {
      continuous: [
        { noiseColor: 'pink', filterType: 'bandpass', filterFreq: 5500, filterQ: 1.2, volume: 0.025, lfoRate: 0.08, lfoDepth: 0.4 },
        { noiseColor: 'brown', filterType: 'lowpass', filterFreq: 800, filterQ: 0.5, volume: 0.012 },
      ],
      intermittent: [
        { minInterval: 2, maxInterval: 5, generate: (ctx, out) => fmChirp(ctx, out, 2500 + Math.random() * 1500, 40, 400, 0.1, 0.02, true) },
        { minInterval: 4, maxInterval: 10, generate: (ctx, out) => fmChirp(ctx, out, 120 + Math.random() * 40, 60, 50, 0.2, 0.018) },
        { minInterval: 3, maxInterval: 7, generate: (ctx, out) => {
          // Rapid insect trill
          const n = 4 + Math.floor(Math.random() * 6)
          for (let i = 0; i < n; i++) {
            setTimeout(() => tonePing(ctx, out, 5000 + Math.random() * 2000, 0.02, 0.008), i * 30)
          }
        }},
      ],
    },
    [BiomeType.Swamp]: {
      continuous: [
        { noiseColor: 'brown', filterType: 'bandpass', filterFreq: 400, filterQ: 2, volume: 0.015, lfoRate: 0.2, lfoDepth: 0.5 },
      ],
      intermittent: [
        { minInterval: 2, maxInterval: 6, generate: (ctx, out) => bubble(ctx, out, 0.025) },
        { minInterval: 4, maxInterval: 12, generate: (ctx, out) => fmChirp(ctx, out, 120, 60, 50, 0.18, 0.02) },
        { minInterval: 3, maxInterval: 8, generate: (ctx, out) => {
          // Insect buzz cluster
          const dur = 0.3 + Math.random() * 0.4
          fmChirp(ctx, out, 300 + Math.random() * 100, 150, 80, dur, 0.01)
        }},
      ],
    },
    [BiomeType.Desert]: {
      continuous: [],
      intermittent: [
        { minInterval: 8, maxInterval: 25, generate: (ctx, out) => noiseImpulse(ctx, out, 1500, 0.5, 0.6, 0.012) },
        { minInterval: 12, maxInterval: 30, generate: (ctx, out) => noiseImpulse(ctx, out, 600, 0.3, 0.3, 0.008) },
      ],
    },
    [BiomeType.Snow]: {
      continuous: [
        { noiseColor: 'white', filterType: 'bandpass', filterFreq: 1500, filterQ: 0.3, volume: 0.01 },
      ],
      intermittent: [
        { minInterval: 8, maxInterval: 22, generate: (ctx, out) => creak(ctx, out, 400 + Math.random() * 200, 0.15, 0.012) },
        { minInterval: 12, maxInterval: 30, generate: (ctx, out) => tonePing(ctx, out, 2000 + Math.random() * 1000, 0.3, 0.006) },
      ],
    },
    [BiomeType.Volcanic]: {
      continuous: [
        { noiseColor: 'brown', filterType: 'bandpass', filterFreq: 80, filterQ: 1.5, volume: 0.035 },
        { noiseColor: 'brown', filterType: 'lowpass', filterFreq: 200, filterQ: 0.8, volume: 0.02 },
      ],
      intermittent: [
        { minInterval: 3, maxInterval: 8, generate: (ctx, out) => noiseImpulse(ctx, out, 3000, 2, 0.08, 0.02) },
        { minInterval: 5, maxInterval: 15, generate: (ctx, out) => {
          // Distant rumble
          const t0 = ctx.currentTime
          const dur = 0.8 + Math.random() * 0.6
          const osc = ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = 30 + Math.random() * 20
          const flt = ctx.createBiquadFilter()
          flt.type = 'lowpass'
          flt.frequency.value = 100
          const env = ctx.createGain()
          env.gain.setValueAtTime(0, t0)
          env.gain.linearRampToValueAtTime(0.025, t0 + 0.1)
          env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
          osc.connect(flt).connect(env).connect(out)
          osc.start(t0)
          osc.stop(t0 + dur)
          osc.onended = () => { osc.disconnect(); flt.disconnect(); env.disconnect() }
        }},
      ],
    },
    [BiomeType.Hell]: {
      continuous: [
        { noiseColor: 'brown', filterType: 'bandpass', filterFreq: 60, filterQ: 2, volume: 0.04 },
        { noiseColor: 'pink', filterType: 'lowpass', filterFreq: 300, filterQ: 1, volume: 0.015 },
      ],
      intermittent: [
        { minInterval: 2, maxInterval: 6, generate: (ctx, out) => noiseImpulse(ctx, out, 4000, 3, 0.05, 0.018) },
        { minInterval: 4, maxInterval: 10, generate: (ctx, out) => creak(ctx, out, 50, 0.6, 0.015) },
      ],
    },
    [BiomeType.Crystal]: {
      continuous: [
        { noiseColor: 'white', filterType: 'bandpass', filterFreq: 6000, filterQ: 4, volume: 0.006 },
      ],
      intermittent: [
        { minInterval: 3, maxInterval: 9, generate: (ctx, out) => {
          // Crystalline chime tinkle — detuned sine cluster
          const baseF = 1200 + Math.random() * 2000
          tonePing(ctx, out, baseF, 0.8, 0.008)
          tonePing(ctx, out, baseF * 1.003, 0.9, 0.006)
          setTimeout(() => tonePing(ctx, out, baseF * 1.5, 0.6, 0.005), 80)
        }},
        { minInterval: 6, maxInterval: 16, generate: (ctx, out) => {
          // Resonant shimmer
          const f = 3000 + Math.random() * 2000
          tonePing(ctx, out, f, 1.2, 0.004)
          tonePing(ctx, out, f * 0.998, 1.3, 0.004)
        }},
      ],
    },
    [BiomeType.Heaven]: {
      continuous: [
        { noiseColor: 'white', filterType: 'bandpass', filterFreq: 3000, filterQ: 0.3, volume: 0.008 },
      ],
      intermittent: [
        { minInterval: 5, maxInterval: 15, generate: (ctx, out) => {
          // Ethereal choir shimmer
          const baseF = 500 + Math.random() * 300
          tonePing(ctx, out, baseF, 1.5, 0.005, 'sine')
          tonePing(ctx, out, baseF * 1.5, 1.8, 0.003, 'sine')
          tonePing(ctx, out, baseF * 2, 1.2, 0.002, 'sine')
        }},
      ],
    },
    [BiomeType.Mesa]: {
      continuous: [
        { noiseColor: 'pink', filterType: 'bandpass', filterFreq: 800, filterQ: 3, volume: 0.012, lfoRate: 0.12, lfoDepth: 0.6 },
      ],
      intermittent: [
        { minInterval: 8, maxInterval: 25, generate: (ctx, out) => noiseImpulse(ctx, out, 1500, 0.8, 0.5, 0.01) },
      ],
    },
    [BiomeType.CoralReef]: {
      continuous: [
        { noiseColor: 'pink', filterType: 'lowpass', filterFreq: 1500, filterQ: 0.5, volume: 0.015 },
      ],
      intermittent: [
        { minInterval: 1.5, maxInterval: 4, generate: (ctx, out) => bubble(ctx, out, 0.02) },
        { minInterval: 4, maxInterval: 10, generate: (ctx, out) => {
          // Underwater click
          tonePing(ctx, out, 4000 + Math.random() * 2000, 0.02, 0.008)
        }},
      ],
    },
  }
}

// ─── Active layer state ───

interface ActiveContinuousLayer {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  lfo?: OscillatorNode
  lfoGain?: GainNode
}

interface IntermittentTimer {
  def: IntermittentLayerDef
  remaining: number
}

export class AmbienceSound {
  private ctx: AudioContext
  private output: GainNode
  private reverb: EnvironmentReverb
  private defs: Record<BiomeType, AmbienceDef>

  private activeLayers: ActiveContinuousLayer[] = []
  private intermittentTimers: IntermittentTimer[] = []
  private currentBiome: BiomeType | null = null

  // Pre-generated noise buffers (2 seconds looping)
  private noiseBufs: Record<NoiseColor, AudioBuffer>

  constructor(ctx: AudioContext, master: GainNode, reverb: EnvironmentReverb) {
    this.ctx = ctx
    this.reverb = reverb
    this.defs = buildDefs()

    // Output bus
    this.output = ctx.createGain()
    this.output.gain.value = 1
    this.output.connect(master)
    this.output.connect(reverb.getSendNode())

    // Pre-generate looping noise buffers
    this.noiseBufs = {
      white: this.genNoise('white'),
      pink: this.genNoise('pink'),
      brown: this.genNoise('brown'),
    }
  }

  private genNoise(color: NoiseColor): AudioBuffer {
    const sr = this.ctx.sampleRate
    const len = sr * 2 // 2 seconds
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)

    if (color === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } else if (color === 'pink') {
      // Voss-McCartney pink noise approximation
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
    } else {
      // Brown noise
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    return buf
  }

  update(delta: number, biome: BiomeType) {
    // Biome changed — crossfade layers
    if (biome !== this.currentBiome) {
      this.transitionTo(biome)
      this.currentBiome = biome
    }

    // Tick intermittent timers
    for (const timer of this.intermittentTimers) {
      timer.remaining -= delta
      if (timer.remaining <= 0) {
        timer.remaining = timer.def.minInterval + Math.random() * (timer.def.maxInterval - timer.def.minInterval)
        try {
          timer.def.generate(this.ctx, this.output)
        } catch { /* synthesis error — skip */ }
      }
    }
  }

  private transitionTo(biome: BiomeType) {
    const def = this.defs[biome]
    if (!def) return

    const t = this.ctx.currentTime
    const fadeOut = 3

    // Fade out and stop old continuous layers
    for (const layer of this.activeLayers) {
      layer.gain.gain.linearRampToValueAtTime(0, t + fadeOut)
      const src = layer.source
      const flt = layer.filter
      const g = layer.gain
      const lfo = layer.lfo
      const lg = layer.lfoGain
      setTimeout(() => {
        try { src.stop() } catch {}
        src.disconnect(); flt.disconnect(); g.disconnect()
        if (lfo) { try { lfo.stop() } catch {}; lfo.disconnect() }
        if (lg) lg.disconnect()
      }, fadeOut * 1000 + 100)
    }
    this.activeLayers = []

    // Create new continuous layers (fade in)
    for (const layerDef of def.continuous) {
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBufs[layerDef.noiseColor]
      src.loop = true

      const flt = this.ctx.createBiquadFilter()
      flt.type = layerDef.filterType
      flt.frequency.value = layerDef.filterFreq
      flt.Q.value = layerDef.filterQ

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(layerDef.volume, t + fadeOut)

      src.connect(flt).connect(gain).connect(this.output)

      const active: ActiveContinuousLayer = { source: src, filter: flt, gain }

      // Optional LFO on filter frequency
      if (layerDef.lfoRate && layerDef.lfoDepth) {
        const lfo = this.ctx.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = layerDef.lfoRate
        const lfoGain = this.ctx.createGain()
        lfoGain.gain.value = layerDef.filterFreq * layerDef.lfoDepth
        lfo.connect(lfoGain).connect(flt.frequency)
        lfo.start()
        active.lfo = lfo
        active.lfoGain = lfoGain
      }

      src.start()
      this.activeLayers.push(active)
    }

    // Reset intermittent timers
    this.intermittentTimers = def.intermittent.map(d => ({
      def: d,
      remaining: d.minInterval + Math.random() * (d.maxInterval - d.minInterval),
    }))
  }
}
