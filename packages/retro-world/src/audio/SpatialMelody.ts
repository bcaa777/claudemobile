import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { EnvironmentReverb } from './EnvironmentReverb'
import { createSpatialPanner } from './SpatialAudioHelper'

/**
 * Soft, mysterious melodies that emanate from landmarks and artifacts.
 * Each biome has a unique melodic motif — eerie, calming, sad, beautiful.
 * Volume and presence are distance-based: louder as you approach, with
 * lowpass filtering at distance for a "carried by wind" effect.
 * Uses HRTF spatial panning for true 3D positioning.
 */

interface BiomeMelody {
  root: number
  intervals: number[]
  tempo: number
  noteCount: number
  noteDuration: number
  mood: 'ethereal' | 'haunting' | 'somber' | 'mystical' | 'serene' | 'dark' | 'ancient'
  phraseGap: number
}

const MELODIES: Record<number, BiomeMelody> = {
  [BiomeType.Forest]: {
    root: 64, intervals: [0, 3, 5, 7, 10, 12, 15],
    tempo: 1.2, noteCount: 6, noteDuration: 2.5, mood: 'serene', phraseGap: 6,
  },
  [BiomeType.Desert]: {
    root: 62, intervals: [0, 1, 5, 7, 8, 12, 13],
    tempo: 1.8, noteCount: 5, noteDuration: 3.0, mood: 'ancient', phraseGap: 8,
  },
  [BiomeType.Volcanic]: {
    root: 48, intervals: [0, 1, 3, 6, 7, 12],
    tempo: 1.5, noteCount: 4, noteDuration: 3.5, mood: 'dark', phraseGap: 10,
  },
  [BiomeType.Snow]: {
    root: 69, intervals: [0, 2, 4, 7, 9, 12, 14],
    tempo: 2.0, noteCount: 5, noteDuration: 3.0, mood: 'ethereal', phraseGap: 7,
  },
  [BiomeType.Swamp]: {
    root: 55, intervals: [0, 3, 5, 6, 7, 10, 12],
    tempo: 1.6, noteCount: 5, noteDuration: 2.8, mood: 'haunting', phraseGap: 8,
  },
  [BiomeType.Crystal]: {
    root: 72, intervals: [0, 4, 7, 11, 12, 16, 19],
    tempo: 1.3, noteCount: 6, noteDuration: 2.5, mood: 'ethereal', phraseGap: 5,
  },
  [BiomeType.Heaven]: {
    root: 72, intervals: [0, 4, 7, 12, 16, 19, 24],
    tempo: 2.0, noteCount: 5, noteDuration: 4.0, mood: 'ethereal', phraseGap: 7,
  },
  [BiomeType.Hell]: {
    root: 45, intervals: [0, 1, 3, 6, 7, 12, 13],
    tempo: 1.8, noteCount: 4, noteDuration: 3.5, mood: 'dark', phraseGap: 10,
  },
  [BiomeType.Jungle]: {
    root: 55, intervals: [0, 3, 5, 7, 10, 12, 15],
    tempo: 1.2, noteCount: 6, noteDuration: 2.0, mood: 'mystical', phraseGap: 5,
  },
  [BiomeType.Mesa]: {
    root: 60, intervals: [0, 2, 3, 5, 7, 10, 12],
    tempo: 2.0, noteCount: 5, noteDuration: 3.0, mood: 'ancient', phraseGap: 8,
  },
  [BiomeType.CoralReef]: {
    root: 64, intervals: [0, 4, 5, 7, 11, 12, 16],
    tempo: 1.5, noteCount: 6, noteDuration: 2.5, mood: 'ethereal', phraseGap: 6,
  },
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export class SpatialMelody {
  private ctx: AudioContext
  private master: GainNode
  private reverb: EnvironmentReverb | null

  // Distance-based filter (artistic "carried by wind" effect)
  private spatialFilter: BiquadFilterNode
  private spatialGain: GainNode

  // State
  private phraseTimer = 5
  private isPlaying = false
  private nearestBiome: BiomeType = BiomeType.Forest
  private nearestPos: THREE.Vector3 | null = null

  private readonly maxDist = 120
  private readonly fullDist = 20

  constructor(ctx: AudioContext, master: GainNode, reverb?: EnvironmentReverb) {
    this.ctx = ctx
    this.reverb = reverb ?? null

    this.master = ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(master)

    // Spatial lowpass — opens up as you get closer
    this.spatialFilter = ctx.createBiquadFilter()
    this.spatialFilter.type = 'lowpass'
    this.spatialFilter.frequency.value = 400
    this.spatialFilter.Q.value = 0.3

    this.spatialGain = ctx.createGain()
    this.spatialGain.gain.value = 0

    this.spatialFilter.connect(this.spatialGain)
    this.spatialGain.connect(this.master)
  }

  private sendToBus(node: AudioNode) {
    node.connect(this.spatialFilter)
    if (this.reverb) node.connect(this.reverb.getSendNode())
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    landmarks: Map<BiomeType, THREE.Vector3>,
    runePositions: THREE.Vector3[],
  ) {
    let bestDist = this.maxDist + 1
    let bestBiome = this.nearestBiome
    let bestPos: THREE.Vector3 | null = null

    for (const [biome, pos] of landmarks) {
      const dx = pos.x - playerPos.x
      const dz = pos.z - playerPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < bestDist) {
        bestDist = dist
        bestBiome = biome
        bestPos = pos
      }
    }

    for (const pos of runePositions) {
      const dx = pos.x - playerPos.x
      const dz = pos.z - playerPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < bestDist) {
        bestDist = dist
        bestPos = pos
      }
    }

    this.nearestBiome = bestBiome
    this.nearestPos = bestPos

    // Update spatial processing based on distance
    if (bestDist < this.maxDist) {
      const t = Math.max(0, 1 - (bestDist - this.fullDist) / (this.maxDist - this.fullDist))
      const targetVol = t * 0.5
      const targetFilter = 400 + t * 3600

      this.spatialGain.gain.value += (targetVol - this.spatialGain.gain.value) * Math.min(1, delta * 2)
      this.spatialFilter.frequency.value += (targetFilter - this.spatialFilter.frequency.value) * Math.min(1, delta * 2)
    } else {
      this.spatialGain.gain.value += (0 - this.spatialGain.gain.value) * Math.min(1, delta * 2)
    }

    // Phrase timing
    if (!this.isPlaying && bestDist < this.maxDist) {
      this.phraseTimer -= delta
      if (this.phraseTimer <= 0) {
        const mel = MELODIES[bestBiome]
        if (mel) {
          this.phraseTimer = mel.phraseGap + Math.random() * 5
          this.playPhrase(bestBiome)
        }
      }
    }
  }

  private playPhrase(biome: BiomeType) {
    const mel = MELODIES[biome]
    if (!mel) return
    this.isPlaying = true

    // Create spatial panner at the landmark/rune position
    let panner: PannerNode | null = null
    if (this.nearestPos) {
      panner = createSpatialPanner(
        this.ctx,
        this.nearestPos.x, this.nearestPos.y + 2, this.nearestPos.z,
        8, 80, 1.0,
      )
      panner.connect(this.spatialFilter)
      if (this.reverb) panner.connect(this.reverb.getSendNode())
    }

    const output = panner || this.spatialFilter

    const notes: number[] = []
    let currentIdx = Math.floor(Math.random() * 3)

    for (let i = 0; i < mel.noteCount; i++) {
      notes.push(mel.intervals[currentIdx])

      if (Math.random() < 0.7) {
        const dir = Math.random() < 0.6 ? 1 : -1
        currentIdx = Math.max(0, Math.min(mel.intervals.length - 1, currentIdx + dir))
      } else {
        currentIdx = Math.floor(Math.random() * mel.intervals.length)
      }
    }

    const now = this.ctx.currentTime

    for (let i = 0; i < notes.length; i++) {
      const noteTime = now + i * mel.tempo
      const freq = midiToHz(mel.root + notes[i])
      const dur = mel.noteDuration + Math.random() * 0.5
      const isLast = i === notes.length - 1

      this.playEtherealNote(freq, noteTime, dur, mel.mood, isLast, output)
    }

    if (Math.random() < 0.6) {
      const harmIdx = Math.random() < 0.5 ? 2 : 4
      if (harmIdx < mel.intervals.length) {
        const harmFreq = midiToHz(mel.root + mel.intervals[harmIdx] - 12)
        const harmDur = mel.noteCount * mel.tempo + 2
        this.playHarmonyPad(harmFreq, now, harmDur, output)
      }
    }

    const phraseDur = mel.noteCount * mel.tempo + mel.noteDuration + 1
    setTimeout(() => {
      this.isPlaying = false
      if (panner) panner.disconnect()
    }, phraseDur * 1000)
  }

  private playEtherealNote(
    freq: number,
    time: number,
    duration: number,
    mood: string,
    isLast: boolean,
    output: AudioNode,
  ) {
    const detunes = [0, 1.003, 0.997]
    const oscs: OscillatorNode[] = []

    const vibRate = mood === 'haunting' || mood === 'somber' ? 3.5 : 5
    const vibDepth = mood === 'haunting' || mood === 'somber' ? 0.008 : 0.004

    const vib = this.ctx.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = vibRate + Math.random()
    const vibGain = this.ctx.createGain()
    vibGain.gain.value = freq * vibDepth
    vib.connect(vibGain)

    for (const d of detunes) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * d
      vibGain.connect(osc.frequency)
      oscs.push(osc)
    }

    if (mood === 'dark' || mood === 'haunting' || mood === 'somber') {
      const sub = this.ctx.createOscillator()
      sub.type = 'triangle'
      sub.frequency.value = freq * 0.5
      vibGain.connect(sub.frequency)
      oscs.push(sub)
    }

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    const filterOpen = mood === 'ethereal' || mood === 'mystical' ? 2000 : 1000
    const filterClose = mood === 'dark' ? 250 : 400
    filter.frequency.setValueAtTime(filterClose, time)
    filter.frequency.linearRampToValueAtTime(filterOpen, time + duration * 0.3)
    filter.frequency.linearRampToValueAtTime(filterClose, time + duration)
    filter.Q.value = 0.5

    const gain = this.ctx.createGain()
    const vol = mood === 'dark' ? 0.044 : 0.056
    const attackTime = mood === 'ethereal' || mood === 'mystical' ? 0.6 : 0.4
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(vol, time + attackTime)
    if (isLast) {
      gain.gain.setValueAtTime(vol * 0.9, time + duration * 0.4)
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 1)
    } else {
      gain.gain.setValueAtTime(vol * 0.85, time + duration * 0.5)
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
    }

    for (const osc of oscs) {
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + duration + (isLast ? 1.5 : 0.5))
    }
    filter.connect(gain)
    gain.connect(output)
    vib.start(time); vib.stop(time + duration + (isLast ? 1.5 : 0.5))

    oscs[0].onended = () => {
      for (const o of oscs) o.disconnect()
      vib.disconnect(); vibGain.disconnect()
      filter.disconnect(); gain.disconnect()
    }
  }

  private playHarmonyPad(freq: number, time: number, duration: number, output: AudioNode) {
    const osc1 = this.ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = freq

    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 1.002

    const osc3 = this.ctx.createOscillator()
    osc3.type = 'triangle'
    osc3.frequency.value = freq * 0.5

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600
    filter.Q.value = 0.3

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.linearRampToValueAtTime(0.03, time + 1.5)
    gain.gain.setValueAtTime(0.024, time + duration * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration)

    osc1.connect(filter)
    osc2.connect(filter)
    osc3.connect(filter)
    filter.connect(gain)
    gain.connect(output)

    osc1.start(time); osc1.stop(time + duration + 0.5)
    osc2.start(time); osc2.stop(time + duration + 0.5)
    osc3.start(time); osc3.stop(time + duration + 0.5)

    osc1.onended = () => {
      osc1.disconnect(); osc2.disconnect(); osc3.disconnect()
      filter.disconnect(); gain.disconnect()
    }
  }

  dispose() {
    this.spatialFilter.disconnect()
    this.spatialGain.disconnect()
    this.master.disconnect()
  }
}
