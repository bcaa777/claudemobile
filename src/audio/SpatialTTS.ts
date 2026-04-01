import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { createSpatialPanner } from './SpatialAudioHelper'
import type { EnvironmentReverb } from './EnvironmentReverb'

interface VoiceProfile {
  pitch: number
  rate: number
  oscType: OscillatorType
  oscFreq: number
  oscFreq2: number
  filterFreq: number
  filterQ: number
}

const BIOME_VOICES: Record<number, VoiceProfile> = {
  [BiomeType.Forest]:    { pitch: 1.0, rate: 0.9,  oscType: 'sine',     oscFreq: 220,  oscFreq2: 0,   filterFreq: 2000, filterQ: 1 },
  [BiomeType.Desert]:    { pitch: 0.8, rate: 0.85, oscType: 'sawtooth', oscFreq: 180,  oscFreq2: 0,   filterFreq: 3000, filterQ: 2 },
  [BiomeType.Volcanic]:  { pitch: 0.6, rate: 0.8,  oscType: 'sawtooth', oscFreq: 80,   oscFreq2: 82,  filterFreq: 600,  filterQ: 1 },
  [BiomeType.Snow]:      { pitch: 1.1, rate: 0.85, oscType: 'sine',     oscFreq: 440,  oscFreq2: 443, filterFreq: 4000, filterQ: 0.5 },
  [BiomeType.Heaven]:    { pitch: 1.3, rate: 0.9,  oscType: 'sine',     oscFreq: 520,  oscFreq2: 523, filterFreq: 5000, filterQ: 0.5 },
  [BiomeType.Hell]:      { pitch: 0.5, rate: 0.75, oscType: 'sawtooth', oscFreq: 60,   oscFreq2: 63,  filterFreq: 400,  filterQ: 3 },
  [BiomeType.Swamp]:     { pitch: 0.9, rate: 0.8,  oscType: 'triangle', oscFreq: 150,  oscFreq2: 0,   filterFreq: 800,  filterQ: 4 },
  [BiomeType.Crystal]:   { pitch: 1.2, rate: 0.9,  oscType: 'sine',     oscFreq: 660,  oscFreq2: 665, filterFreq: 4000, filterQ: 2 },
  [BiomeType.Jungle]:    { pitch: 0.95, rate: 0.95, oscType: 'sawtooth', oscFreq: 200, oscFreq2: 0,   filterFreq: 1500, filterQ: 1 },
  [BiomeType.Mesa]:      { pitch: 0.85, rate: 0.85, oscType: 'triangle', oscFreq: 160, oscFreq2: 0,   filterFreq: 1200, filterQ: 5 },
  [BiomeType.CoralReef]: { pitch: 1.05, rate: 0.9,  oscType: 'sine',     oscFreq: 330, oscFreq2: 0,   filterFreq: 2500, filterQ: 1 },
}

const DEFAULT_VOICE: VoiceProfile = { pitch: 1.0, rate: 0.9, oscType: 'sine', oscFreq: 220, oscFreq2: 0, filterFreq: 2000, filterQ: 1 }

const REF_DISTANCE = 5
const MAX_DISTANCE = 50
const ACCOMP_VOLUME = 0.25

export class SpatialTTS {
  private ctx: AudioContext
  private masterGain: GainNode
  private reverb: EnvironmentReverb | null

  private utterance: SpeechSynthesisUtterance | null = null
  private sourcePos: THREE.Vector3 | null = null
  private accompGain: GainNode | null = null
  private accompNodes: AudioNode[] = []

  private voices: SpeechSynthesisVoice[] = []

  constructor(ctx: AudioContext, masterGain: GainNode, reverb: EnvironmentReverb | null) {
    this.ctx = ctx
    this.masterGain = masterGain
    this.reverb = reverb

    this.voices = speechSynthesis.getVoices()
    speechSynthesis.addEventListener('voiceschanged', () => {
      this.voices = speechSynthesis.getVoices()
    })
  }

  speak(text: string, position: THREE.Vector3, biome: BiomeType): void {
    this.cancel()

    const profile = BIOME_VOICES[biome] ?? DEFAULT_VOICE
    this.sourcePos = position.clone()

    const utt = new SpeechSynthesisUtterance(text)
    utt.pitch = profile.pitch
    utt.rate = profile.rate
    utt.volume = 1.0

    const enVoice = this.voices.find(v => v.lang.startsWith('en'))
    if (enVoice) utt.voice = enVoice

    utt.onend = () => this.cleanup()
    utt.onerror = () => this.cleanup()
    this.utterance = utt

    this.buildAccompaniment(position, profile)

    speechSynthesis.speak(utt)
  }

  private buildAccompaniment(position: THREE.Vector3, profile: VoiceProfile): void {
    const ctx = this.ctx

    const gain = ctx.createGain()
    gain.gain.value = ACCOMP_VOLUME
    this.accompGain = gain

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = profile.filterFreq
    filter.Q.value = profile.filterQ

    const osc1 = ctx.createOscillator()
    osc1.type = profile.oscType
    osc1.frequency.value = profile.oscFreq
    osc1.connect(filter)
    this.accompNodes.push(osc1)

    if (profile.oscFreq2 > 0) {
      const osc2 = ctx.createOscillator()
      osc2.type = profile.oscType
      osc2.frequency.value = profile.oscFreq2
      osc2.connect(filter)
      osc2.start()
      this.accompNodes.push(osc2)
    }

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 2.5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()
    this.accompNodes.push(lfo, lfoGain)

    const panner = createSpatialPanner(ctx, position.x, position.y, position.z, REF_DISTANCE, MAX_DISTANCE)

    filter.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    if (this.reverb) panner.connect(this.reverb.getSendNode())

    this.accompNodes.push(filter, gain, panner)

    osc1.start()
  }

  update(cameraPosition: THREE.Vector3): void {
    if (!this.sourcePos || !this.utterance) return

    const dx = cameraPosition.x - this.sourcePos.x
    const dy = cameraPosition.y - this.sourcePos.y
    const dz = cameraPosition.z - this.sourcePos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist > MAX_DISTANCE) {
      this.cancel()
      return
    }

    const vol = dist <= REF_DISTANCE ? 1.0 : Math.max(0, 1.0 - (dist - REF_DISTANCE) / (MAX_DISTANCE - REF_DISTANCE))
    if (this.accompGain) {
      this.accompGain.gain.value = ACCOMP_VOLUME * vol
    }
  }

  cancel(): void {
    speechSynthesis.cancel()
    this.cleanup()
  }

  private cleanup(): void {
    for (const node of this.accompNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop()
        node.disconnect()
      } catch { /* already stopped */ }
    }
    this.accompNodes = []
    this.accompGain = null
    this.utterance = null
    this.sourcePos = null
  }

  dispose(): void {
    this.cancel()
  }
}
