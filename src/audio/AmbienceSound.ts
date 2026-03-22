import { BiomeType } from '../biomes/types'
import { EnvironmentReverb } from './EnvironmentReverb'
import { AmbienceLayer, BIOME_AMBIENCES } from './AmbienceData'

// ─── Per-layer AudioNode chain ───

interface LayerChain {
  oscillator: OscillatorNode
  filter: BiquadFilterNode
  gain: GainNode
  lfo: OscillatorNode | null
  lfoGain: GainNode | null
  def: AmbienceLayer
  // For occasional layers
  burstTimer: number
  burstActive: boolean
  burstRemaining: number
  // For detail layers — random pitch drift
  pitchDriftTimer: number
}

const CROSSFADE_TIME = 3      // seconds
const MAX_LAYERS = 4

export class AmbienceSound {
  private ctx: AudioContext
  private output: GainNode
  private reverb: EnvironmentReverb

  private activeChains: LayerChain[] = []
  private fadingChains: LayerChain[] = []   // old chains fading out
  private currentBiome: BiomeType | null = null

  constructor(ctx: AudioContext, master: GainNode, reverb: EnvironmentReverb) {
    this.ctx = ctx
    this.reverb = reverb

    this.output = ctx.createGain()
    this.output.gain.value = 1
    this.output.connect(master)
    this.output.connect(reverb.getSendNode())
  }

  /** Scale master output volume (0–1 multiplier) */
  setVolume(v: number) { this.output.gain.value = v }

  update(delta: number, biome: BiomeType) {
    // Biome changed — crossfade to new layers
    if (biome !== this.currentBiome) {
      this.transitionTo(biome)
      this.currentBiome = biome
    }

    // Update active layer behaviours
    for (const chain of this.activeChains) {
      this.updateChain(chain, delta)
    }

    // Clean up fully-faded old chains
    this.cleanFadingChains()
  }

  private updateChain(chain: LayerChain, delta: number) {
    const def = chain.def

    // Detail layers: subtle random pitch drift
    if (def.type === 'detail') {
      chain.pitchDriftTimer -= delta
      if (chain.pitchDriftTimer <= 0) {
        chain.pitchDriftTimer = 0.5 + Math.random() * 1.5
        const newFreq = def.baseFrequency + (Math.random() - 0.5) * def.frequencyRange
        const t = this.ctx.currentTime
        chain.oscillator.frequency.linearRampToValueAtTime(
          Math.max(20, newFreq), t + 0.3,
        )
      }
    }

    // Occasional layers: burst on/off cycle
    if (def.type === 'occasional' && def.burstInterval && def.burstDuration) {
      if (chain.burstActive) {
        chain.burstRemaining -= delta
        if (chain.burstRemaining <= 0) {
          // End burst — fade out
          chain.burstActive = false
          chain.burstTimer = def.burstInterval * (0.7 + Math.random() * 0.6)
          const t = this.ctx.currentTime
          chain.gain.gain.linearRampToValueAtTime(0, t + 0.8)
        }
      } else {
        chain.burstTimer -= delta
        if (chain.burstTimer <= 0) {
          // Start burst — fade in with random pitch offset
          chain.burstActive = true
          chain.burstRemaining = def.burstDuration * (0.8 + Math.random() * 0.4)
          const t = this.ctx.currentTime
          const freq = def.baseFrequency + (Math.random() - 0.5) * def.frequencyRange
          chain.oscillator.frequency.linearRampToValueAtTime(Math.max(20, freq), t + 0.1)
          chain.gain.gain.linearRampToValueAtTime(def.gain, t + 0.5)
        }
      }
    }
  }

  private transitionTo(biome: BiomeType) {
    const ambience = BIOME_AMBIENCES[biome]
    if (!ambience) return

    const t = this.ctx.currentTime

    // Move current active chains to fading list
    for (const chain of this.activeChains) {
      chain.gain.gain.linearRampToValueAtTime(0, t + CROSSFADE_TIME)
      this.fadingChains.push(chain)
    }
    // Schedule cleanup of fading chains
    setTimeout(() => this.cleanFadingChains(), (CROSSFADE_TIME + 0.2) * 1000)

    // Create new layer chains
    this.activeChains = []
    const layers = ambience.layers.slice(0, MAX_LAYERS)

    for (const def of layers) {
      const chain = this.createChain(def, t)
      this.activeChains.push(chain)
    }
  }

  private createChain(def: AmbienceLayer, startTime: number): LayerChain {
    const ctx = this.ctx

    // Oscillator
    const osc = ctx.createOscillator()
    osc.type = def.waveform
    const freq = def.baseFrequency + (Math.random() - 0.5) * def.frequencyRange * 0.3
    osc.frequency.value = Math.max(20, freq)

    // Filter
    const filter = ctx.createBiquadFilter()
    filter.type = def.filterType
    filter.frequency.value = def.filterFrequency
    filter.Q.value = 1

    // Gain envelope
    const gain = ctx.createGain()

    // For occasional layers, start silent and let the burst timer trigger them
    if (def.type === 'occasional') {
      gain.gain.setValueAtTime(0, startTime)
    } else {
      // Fade in over crossfade time
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(def.gain, startTime + CROSSFADE_TIME)
    }

    // Connect: oscillator → filter → gain → output
    osc.connect(filter).connect(gain).connect(this.output)

    // Optional LFO modulation
    let lfo: OscillatorNode | null = null
    let lfoGain: GainNode | null = null
    if (def.modulationRate && def.modulationDepth) {
      lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = def.modulationRate
      lfoGain = ctx.createGain()
      lfoGain.gain.value = def.modulationDepth
      lfo.connect(lfoGain).connect(osc.frequency)
      lfo.start(startTime)
    }

    osc.start(startTime)

    return {
      oscillator: osc,
      filter,
      gain,
      lfo,
      lfoGain,
      def,
      burstTimer: def.burstInterval
        ? def.burstInterval * (0.3 + Math.random() * 0.7)
        : 0,
      burstActive: false,
      burstRemaining: 0,
      pitchDriftTimer: Math.random() * 2,
    }
  }

  private cleanFadingChains() {
    const t = this.ctx.currentTime
    const toRemove: number[] = []

    for (let i = 0; i < this.fadingChains.length; i++) {
      const chain = this.fadingChains[i]
      // Check if gain has reached ~0
      if (chain.gain.gain.value < 0.001) {
        this.destroyChain(chain)
        toRemove.push(i)
      }
    }

    // Remove in reverse order to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.fadingChains.splice(toRemove[i], 1)
    }
  }

  private destroyChain(chain: LayerChain) {
    try { chain.oscillator.stop() } catch { /* already stopped */ }
    chain.oscillator.disconnect()
    chain.filter.disconnect()
    chain.gain.disconnect()
    if (chain.lfo) {
      try { chain.lfo.stop() } catch { /* already stopped */ }
      chain.lfo.disconnect()
    }
    if (chain.lfoGain) {
      chain.lfoGain.disconnect()
    }
  }
}
