import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { Creature } from '../creatures/Creature'

/**
 * Adaptive music system — per-biome motifs with contextual fade-in/out
 * and silence gaps. Music plays in phrases (~20-40s) separated by silence
 * (~15-45s), fading in/out over 3 seconds. Context signals (weather,
 * combat proximity, sprinting) suppress music for atmosphere-only periods.
 *
 * State machine: silent → fading_in → playing → fading_out → silent
 */

// ──────────────────────────────────────────────
//  Scale definitions (semitone offsets from root)
// ──────────────────────────────────────────────

// Semitone-to-frequency ratio
const semi = (n: number) => Math.pow(2, n / 12)

// Scale patterns as semitone offsets
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9]           // C D E G A
const MINOR_PENTATONIC = [0, 3, 5, 7, 10]          // C Eb F G Bb
const MINOR_SCALE      = [0, 2, 3, 5, 7, 8, 10]    // natural minor
const MAJOR_SCALE      = [0, 2, 4, 5, 7, 9, 11]    // major
const DORIAN_SCALE     = [0, 2, 3, 5, 7, 9, 10]    // dorian
const LYDIAN_SCALE     = [0, 2, 4, 6, 7, 9, 11]    // lydian
const TRITONE_SCALE    = [0, 1, 4, 6, 7, 10]       // whole-tone/tritone hybrid

type MusicState = 'silent' | 'fading_in' | 'playing' | 'fading_out'

// ──────────────────────────────────────────────
//  Per-biome motif definitions
// ──────────────────────────────────────────────

interface BiomeMotif {
  rootNote: number         // MIDI note number for root
  scale: number[]          // semitone offsets
  tempo: number            // BPM
  waveform: OscillatorType // primary timbre
  useFilter: boolean       // filtered sawtooth for eerie timbres
  filterFreq: number       // lowpass cutoff if useFilter
  useHarmonics: boolean    // add overtones (bells/choir)
  harmonicRatios: number[] // frequency multipliers for harmonics
  harmonicGains: number[]  // gain per harmonic
  volume: number           // overall motif volume
  noteDuration: number     // base note duration in seconds
  legato: number           // 0-1, how much notes overlap
}

// MIDI note to frequency
const midiToFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12)

const MOTIFS: Record<number, BiomeMotif> = {
  [BiomeType.Forest]: {
    rootNote: 60, // C4
    scale: MAJOR_PENTATONIC,
    tempo: 72,
    waveform: 'sine',
    useFilter: false, filterFreq: 2000,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.06,
    noteDuration: 1.2,
    legato: 0.3,
  },
  [BiomeType.Desert]: {
    rootNote: 62, // D4
    scale: MINOR_PENTATONIC,
    tempo: 60,
    waveform: 'triangle',
    useFilter: false, filterFreq: 1500,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.055,
    noteDuration: 1.5,
    legato: 0.2,
  },
  [BiomeType.Swamp]: {
    rootNote: 58, // Bb3
    scale: MINOR_SCALE,
    tempo: 50,
    waveform: 'sawtooth',
    useFilter: true, filterFreq: 800,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.05,
    noteDuration: 1.8,
    legato: 0.5,
  },
  [BiomeType.Snow]: {
    rootNote: 65, // F4
    scale: MAJOR_SCALE,
    tempo: 66,
    waveform: 'sine',
    useFilter: false, filterFreq: 3000,
    useHarmonics: true,
    harmonicRatios: [1, 2, 3],
    harmonicGains: [0.6, 0.25, 0.1],
    volume: 0.05,
    noteDuration: 1.4,
    legato: 0.4,
  },
  [BiomeType.Volcanic]: {
    rootNote: 52, // E3
    scale: MINOR_SCALE,
    tempo: 80,
    waveform: 'square',
    useFilter: true, filterFreq: 600,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.055,
    noteDuration: 0.8,
    legato: 0.15,
  },
  [BiomeType.Crystal]: {
    rootNote: 69, // A4
    scale: MAJOR_SCALE,
    tempo: 55,
    waveform: 'sine',
    useFilter: false, filterFreq: 4000,
    useHarmonics: true,
    harmonicRatios: [1, 2, 3, 5],
    harmonicGains: [0.5, 0.3, 0.15, 0.08],
    volume: 0.05,
    noteDuration: 1.6,
    legato: 0.5,
  },
  [BiomeType.Jungle]: {
    rootNote: 55, // G3
    scale: MINOR_PENTATONIC,
    tempo: 90,
    waveform: 'triangle',
    useFilter: false, filterFreq: 1800,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.055,
    noteDuration: 0.7,
    legato: 0.2,
  },
  [BiomeType.Mesa]: {
    rootNote: 62, // D4
    scale: DORIAN_SCALE,
    tempo: 58,
    waveform: 'triangle',
    useFilter: false, filterFreq: 1200,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.05,
    noteDuration: 1.5,
    legato: 0.25,
  },
  [BiomeType.CoralReef]: {
    rootNote: 60, // C4
    scale: MAJOR_SCALE,
    tempo: 70,
    waveform: 'sine',
    useFilter: false, filterFreq: 2500,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.05,
    noteDuration: 1.2,
    legato: 0.35,
  },
  [BiomeType.Heaven]: {
    rootNote: 65, // F4
    scale: LYDIAN_SCALE,
    tempo: 48,
    waveform: 'sine',
    useFilter: false, filterFreq: 3000,
    useHarmonics: true,
    harmonicRatios: [1, 1.5, 2, 3],
    harmonicGains: [0.4, 0.2, 0.2, 0.1],
    volume: 0.045,
    noteDuration: 2.0,
    legato: 0.6,
  },
  [BiomeType.Hell]: {
    rootNote: 40, // E2
    scale: TRITONE_SCALE,
    tempo: 100,
    waveform: 'square',
    useFilter: true, filterFreq: 500,
    useHarmonics: false, harmonicRatios: [], harmonicGains: [],
    volume: 0.06,
    noteDuration: 0.6,
    legato: 0.1,
  },
}

// ──────────────────────────────────────────────
//  Context for suppression signals
// ──────────────────────────────────────────────

export interface MusicContext {
  weatherSeverity: number     // 0-1, >0.5 suppresses music
  playerSpeed: number         // units/sec, high = sprinting
  playerPos: THREE.Vector3
  creatures: Map<string, Creature>
}

// ──────────────────────────────────────────────
//  BiomeMusic class — adaptive phrase-based system
// ──────────────────────────────────────────────

export class BiomeMusic {
  private ctx: AudioContext
  private master: GainNode
  private currentBiome: BiomeType = -1 as BiomeType

  // State machine
  private state: MusicState = 'silent'
  private stateTimer = 5 // start with short silence before first phrase
  private readonly FADE_DURATION = 3
  private readonly SILENT_MIN = 15
  private readonly SILENT_MAX = 45
  private readonly PLAYING_MIN = 20
  private readonly PLAYING_MAX = 40

  // Current phrase volume envelope
  private phraseGain: GainNode
  private currentPhraseVolume = 0

  // Melody state
  private melodyTimer = 0
  private lastScaleDegreeIndex = 0 // index into the scale array for stepwise motion
  private activeNotes: OscillatorNode[] = [] // track for cleanup

  // Suppression
  private suppressed = false

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.55
    this.master.connect(master)

    this.phraseGain = ctx.createGain()
    this.phraseGain.gain.value = 0
    this.phraseGain.connect(this.master)
  }

  // ── Update (called every frame) ──

  update(delta: number, biome: BiomeType, context?: MusicContext) {
    // Handle biome change
    if (biome !== this.currentBiome) {
      this.currentBiome = biome
      // Reset melody position on biome change
      const motif = MOTIFS[biome]
      if (motif) {
        this.lastScaleDegreeIndex = Math.floor(motif.scale.length / 2)
      }
      // If currently playing, fade out and restart
      if (this.state === 'playing' || this.state === 'fading_in') {
        this.transitionTo('fading_out')
      }
    }

    // Check suppression signals
    const shouldSuppress = this.checkSuppression(context)
    if (shouldSuppress && !this.suppressed) {
      this.suppressed = true
      if (this.state === 'playing' || this.state === 'fading_in') {
        this.transitionTo('fading_out')
      }
    } else if (!shouldSuppress && this.suppressed) {
      this.suppressed = false
    }

    // State machine tick
    this.stateTimer -= delta
    switch (this.state) {
      case 'silent':
        if (this.stateTimer <= 0 && !this.suppressed) {
          this.transitionTo('fading_in')
        }
        break

      case 'fading_in': {
        const progress = 1 - (this.stateTimer / this.FADE_DURATION)
        const motif = MOTIFS[this.currentBiome]
        const targetVol = motif ? motif.volume : 0.05
        this.currentPhraseVolume = targetVol * Math.min(1, Math.max(0, progress))
        this.phraseGain.gain.value = this.currentPhraseVolume
        if (this.stateTimer <= 0) {
          this.transitionTo('playing')
        }
        // Play notes during fade-in too
        this.tickMelody(delta)
        break
      }

      case 'playing':
        this.tickMelody(delta)
        if (this.stateTimer <= 0) {
          this.transitionTo('fading_out')
        }
        break

      case 'fading_out': {
        const progress = this.stateTimer / this.FADE_DURATION
        const motif = MOTIFS[this.currentBiome]
        const targetVol = motif ? motif.volume : 0.05
        this.currentPhraseVolume = targetVol * Math.min(1, Math.max(0, progress))
        this.phraseGain.gain.value = this.currentPhraseVolume
        if (this.stateTimer <= 0) {
          this.transitionTo('silent')
        }
        break
      }
    }
  }

  private checkSuppression(context?: MusicContext): boolean {
    if (!context) return false

    // Weather severity > 0.5 suppresses music
    if (context.weatherSeverity > 0.5) return true

    // Player sprinting (speed > 8 units/sec)
    if (context.playerSpeed > 8) return true

    // Hostile creature within 20 units — check for chase/attack states
    for (const [, creature] of context.creatures) {
      if (creature.state === 'chase' || creature.state === 'attack') {
        const dist = creature.position.distanceTo(context.playerPos)
        if (dist < 20) return true
      }
    }

    return false
  }

  private transitionTo(newState: MusicState) {
    this.state = newState
    switch (newState) {
      case 'silent':
        this.stateTimer = this.SILENT_MIN + Math.random() * (this.SILENT_MAX - this.SILENT_MIN)
        this.phraseGain.gain.value = 0
        this.currentPhraseVolume = 0
        break
      case 'fading_in':
        this.stateTimer = this.FADE_DURATION
        this.melodyTimer = 0 // start playing notes immediately
        break
      case 'playing':
        this.stateTimer = this.PLAYING_MIN + Math.random() * (this.PLAYING_MAX - this.PLAYING_MIN)
        break
      case 'fading_out':
        this.stateTimer = this.FADE_DURATION
        break
    }
  }

  // ── Melody generation with stepwise motion preference ──

  private tickMelody(delta: number) {
    this.melodyTimer -= delta
    if (this.melodyTimer > 0) return

    const motif = MOTIFS[this.currentBiome]
    if (!motif) return

    // Time per note from tempo
    const beatDuration = 60 / motif.tempo
    // Vary timing: sometimes half beat, sometimes full, sometimes 1.5
    const timingVariations = [0.5, 1, 1, 1, 1.5, 2]
    const timing = timingVariations[Math.floor(Math.random() * timingVariations.length)]
    this.melodyTimer = beatDuration * timing

    // Occasionally rest instead of playing a note (adds breathing room)
    if (Math.random() < 0.2) return

    // Choose next scale degree with stepwise motion preference
    const scaleLen = motif.scale.length
    const roll = Math.random()
    let newIndex: number
    if (roll < 0.45) {
      // Step up
      newIndex = (this.lastScaleDegreeIndex + 1) % scaleLen
    } else if (roll < 0.9) {
      // Step down
      newIndex = (this.lastScaleDegreeIndex - 1 + scaleLen) % scaleLen
    } else {
      // Leap (2-3 steps)
      const leap = Math.random() < 0.5 ? 2 : 3
      newIndex = (this.lastScaleDegreeIndex + (Math.random() < 0.5 ? leap : -leap) + scaleLen * 2) % scaleLen
    }
    this.lastScaleDegreeIndex = newIndex

    // Determine octave — melody sits 1-2 octaves above root
    const octaveShift = Math.random() < 0.7 ? 12 : 24
    const noteFreq = midiToFreq(motif.rootNote + motif.scale[newIndex] + octaveShift)

    this.playNote(motif, noteFreq, motif.noteDuration)
  }

  private playNote(motif: BiomeMotif, freq: number, baseDuration: number) {
    const now = this.ctx.currentTime
    // Vary duration slightly
    const dur = baseDuration * (0.8 + Math.random() * 0.4)

    if (motif.useHarmonics && motif.harmonicRatios.length > 0) {
      // Multi-harmonic note (bells, choir, ethereal)
      this.playHarmonicNote(motif, freq, dur, now)
    } else if (motif.useFilter) {
      // Filtered waveform (eerie, harsh)
      this.playFilteredNote(motif, freq, dur, now)
    } else {
      // Clean waveform
      this.playCleanNote(motif, freq, dur, now)
    }
  }

  private playCleanNote(motif: BiomeMotif, freq: number, dur: number, now: number) {
    const osc = this.ctx.createOscillator()
    osc.type = motif.waveform
    osc.frequency.value = freq

    // Slight detune for warmth
    const osc2 = this.ctx.createOscillator()
    osc2.type = motif.waveform
    osc2.frequency.value = freq * 1.003

    const gain = this.ctx.createGain()
    const vol = 0.5 + Math.random() * 0.3 // relative to phraseGain
    const attack = 0.1 + motif.legato * 0.3
    const release = 0.2 + motif.legato * 0.5

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + attack)
    gain.gain.setValueAtTime(vol * 0.85, now + dur - release)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(this.phraseGain)

    osc.start(now)
    osc.stop(now + dur + 0.05)
    osc2.start(now)
    osc2.stop(now + dur + 0.05)

    osc.onended = () => {
      osc.disconnect()
      osc2.disconnect()
      gain.disconnect()
    }
  }

  private playFilteredNote(motif: BiomeMotif, freq: number, dur: number, now: number) {
    const osc = this.ctx.createOscillator()
    osc.type = motif.waveform
    osc.frequency.value = freq

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(motif.filterFreq * 0.5, now)
    filter.frequency.linearRampToValueAtTime(motif.filterFreq, now + dur * 0.3)
    filter.frequency.linearRampToValueAtTime(motif.filterFreq * 0.3, now + dur)
    filter.Q.value = 1.5

    const gain = this.ctx.createGain()
    const vol = 0.5 + Math.random() * 0.3
    const attack = 0.08
    const release = 0.3

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + attack)
    gain.gain.setValueAtTime(vol * 0.8, now + dur - release)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.phraseGain)

    osc.start(now)
    osc.stop(now + dur + 0.05)

    osc.onended = () => {
      osc.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  }

  private playHarmonicNote(motif: BiomeMotif, freq: number, dur: number, now: number) {
    const oscs: OscillatorNode[] = []
    const gains: GainNode[] = []

    const masterNoteGain = this.ctx.createGain()
    const vol = 0.4 + Math.random() * 0.2
    const attack = 0.15 + motif.legato * 0.4
    const release = 0.3 + motif.legato * 0.6

    masterNoteGain.gain.setValueAtTime(0.001, now)
    masterNoteGain.gain.linearRampToValueAtTime(vol, now + attack)
    masterNoteGain.gain.setValueAtTime(vol * 0.85, now + dur - release)
    masterNoteGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
    masterNoteGain.connect(this.phraseGain)

    for (let i = 0; i < motif.harmonicRatios.length; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * motif.harmonicRatios[i]

      const hGain = this.ctx.createGain()
      hGain.gain.value = motif.harmonicGains[i] ?? 0.1

      osc.connect(hGain)
      hGain.connect(masterNoteGain)
      osc.start(now)
      osc.stop(now + dur + 0.05)
      oscs.push(osc)
      gains.push(hGain)
    }

    oscs[0].onended = () => {
      for (const o of oscs) o.disconnect()
      for (const g of gains) g.disconnect()
      masterNoteGain.disconnect()
    }
  }

  dispose() {
    this.phraseGain.disconnect()
    this.master.disconnect()
  }
}
