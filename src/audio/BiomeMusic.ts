import { BiomeType } from '../biomes/types'

/**
 * Procedural ambient music per biome — evolving drone/pad textures with
 * chord progressions, arpeggios, countermelodies, rhythmic pulses, and
 * layered noise textures. Two voice slots crossfade on biome transitions.
 */

// ──────────────────────────────────────────────
//  Scale & chord definitions
// ──────────────────────────────────────────────

// Frequency ratios for scale degrees (just intonation)
const MAJOR_SCALE = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2]
const MINOR_SCALE = [1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5, 2]
const PENTA_MAJOR = [1, 9/8, 5/4, 3/2, 5/3, 2, 9/4, 5/2]
const PENTA_MINOR = [1, 6/5, 4/3, 3/2, 9/5, 2, 12/5, 8/3]

// Chord shapes as scale-degree indices (0-based)
const CHORD_I   = [0, 2, 4]     // root triad
const CHORD_IV  = [3, 5, 0+7]   // subdominant (0+7 = octave root)
const CHORD_V   = [4, 6, 1+7]   // dominant
const CHORD_VI  = [5, 0+7, 2+7] // relative minor/major
const CHORD_III = [2, 4, 6]     // mediant
const CHORD_II  = [1, 3, 5]     // supertonic

type ChordShape = number[]

interface BiomeMusicDef {
  root: number               // root frequency Hz
  scale: number[]            // frequency ratios
  pentatonic: number[]       // pentatonic ratios for melody
  isMinor: boolean
  // Chord progression (cycles)
  chords: ChordShape[]
  chordDuration: number      // seconds per chord
  // Drone
  droneOctave: number        // 0 = root octave, -1 = octave below, etc.
  droneType: OscillatorType
  droneVol: number
  // Pad (chord tones)
  padType: OscillatorType
  padVol: number
  padFilterFreq: number
  padFilterQ: number
  // Arpeggio layer
  arpEnabled: boolean
  arpSpeed: number           // seconds per note
  arpOctave: number          // additional octave shift
  arpVol: number
  // Bass pulse
  bassEnabled: boolean
  bassPulseRate: number      // Hz (0 = no pulse, just sustained)
  bassVol: number
  // Noise texture
  noiseType: 'brown' | 'pink' | 'white' | null
  noiseVol: number
  noiseFilterFreq: number
  // LFO
  lfoRate: number
  lfoDepth: number
  // Overall
  volume: number
  // Rhythmic sub-bass pulse (heartbeat-like)
  pulseEnabled: boolean
  pulseRate: number          // BPM
  pulseVol: number
}

// ──────────────────────────────────────────────
//  Per-biome music definitions
// ──────────────────────────────────────────────

const DEFS: Record<number, BiomeMusicDef> = {
  [BiomeType.Forest]: {
    root: 110, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_VI, CHORD_IV, CHORD_V],
    chordDuration: 8,
    droneOctave: 0, droneType: 'sine', droneVol: 0.08,
    padType: 'sine', padVol: 0.04, padFilterFreq: 900, padFilterQ: 0.6,
    arpEnabled: true, arpSpeed: 1.2, arpOctave: 2, arpVol: 0.02,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.05,
    noiseType: 'brown', noiseVol: 0.015, noiseFilterFreq: 400,
    lfoRate: 0.07, lfoDepth: 180,
    volume: 0.11,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Desert]: {
    root: 73.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_III, CHORD_VI, CHORD_IV],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.07,
    padType: 'triangle', padVol: 0.03, padFilterFreq: 600, padFilterQ: 1.5,
    arpEnabled: true, arpSpeed: 2.0, arpOctave: 2, arpVol: 0.018,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.04, lfoDepth: 140,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Volcanic]: {
    root: 36.7, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_II, CHORD_I, CHORD_III],
    chordDuration: 6,
    droneOctave: 0, droneType: 'sawtooth', droneVol: 0.07,
    padType: 'sawtooth', padVol: 0.03, padFilterFreq: 300, padFilterQ: 2.5,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.06,
    noiseType: 'brown', noiseVol: 0.035, noiseFilterFreq: 200,
    lfoRate: 0.1, lfoDepth: 80,
    volume: 0.13,
    pulseEnabled: true, pulseRate: 40, pulseVol: 0.04,
  },

  [BiomeType.Snow]: {
    root: 220, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_IV, CHORD_I, CHORD_V],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.04, padFilterFreq: 1400, padFilterQ: 0.3,
    arpEnabled: true, arpSpeed: 1.5, arpOctave: 1, arpVol: 0.02,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'white', noiseVol: 0.006, noiseFilterFreq: 3000,
    lfoRate: 0.04, lfoDepth: 250,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Swamp]: {
    root: 65.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_III, CHORD_IV, CHORD_I],
    chordDuration: 8,
    droneOctave: 0, droneType: 'triangle', droneVol: 0.07,
    padType: 'sine', padVol: 0.035, padFilterFreq: 500, padFilterQ: 1.8,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.05,
    noiseType: 'brown', noiseVol: 0.025, noiseFilterFreq: 300,
    lfoRate: 0.06, lfoDepth: 100,
    volume: 0.10,
    pulseEnabled: true, pulseRate: 50, pulseVol: 0.025,
  },

  [BiomeType.Tundra]: {
    root: 82.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_IV, CHORD_VI, CHORD_V],
    chordDuration: 12,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'sine', padVol: 0.04, padFilterFreq: 700, padFilterQ: 0.5,
    arpEnabled: true, arpSpeed: 2.5, arpOctave: 2, arpVol: 0.015,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'pink', noiseVol: 0.012, noiseFilterFreq: 500,
    lfoRate: 0.03, lfoDepth: 160,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Mushroom]: {
    root: 146.8, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_III, CHORD_V, CHORD_VI],
    chordDuration: 6,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'triangle', padVol: 0.04, padFilterFreq: 1000, padFilterQ: 2,
    arpEnabled: true, arpSpeed: 0.6, arpOctave: 1, arpVol: 0.025,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.04,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.15, lfoDepth: 300,
    volume: 0.09,
    pulseEnabled: true, pulseRate: 70, pulseVol: 0.02,
  },

  [BiomeType.AshWastes]: {
    root: 49, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_II, CHORD_IV, CHORD_I],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sawtooth', droneVol: 0.05,
    padType: 'sine', padVol: 0.03, padFilterFreq: 400, padFilterQ: 1.2,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.04,
    noiseType: 'brown', noiseVol: 0.02, noiseFilterFreq: 250,
    lfoRate: 0.04, lfoDepth: 70,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Crystal]: {
    root: 261.6, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_V, CHORD_IV, CHORD_I],
    chordDuration: 8,
    droneOctave: -1, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.04, padFilterFreq: 2000, padFilterQ: 0.3,
    arpEnabled: true, arpSpeed: 0.8, arpOctave: 1, arpVol: 0.025,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'white', noiseVol: 0.005, noiseFilterFreq: 5000,
    lfoRate: 0.06, lfoDepth: 350,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Savanna]: {
    root: 98, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_IV, CHORD_V, CHORD_I],
    chordDuration: 8,
    droneOctave: 0, droneType: 'sine', droneVol: 0.07,
    padType: 'triangle', padVol: 0.035, padFilterFreq: 900, padFilterQ: 0.6,
    arpEnabled: true, arpSpeed: 1.0, arpOctave: 2, arpVol: 0.02,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.04,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.05, lfoDepth: 180,
    volume: 0.10,
    pulseEnabled: true, pulseRate: 55, pulseVol: 0.02,
  },

  [BiomeType.Heaven]: {
    root: 261.6, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_IV, CHORD_VI, CHORD_V],
    chordDuration: 12,
    droneOctave: -1, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.05, padFilterFreq: 2500, padFilterQ: 0.2,
    arpEnabled: true, arpSpeed: 1.8, arpOctave: 1, arpVol: 0.02,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'white', noiseVol: 0.004, noiseFilterFreq: 6000,
    lfoRate: 0.03, lfoDepth: 250,
    volume: 0.07,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Hell]: {
    root: 32.7, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_II, CHORD_III, CHORD_I],
    chordDuration: 6,
    droneOctave: 0, droneType: 'sawtooth', droneVol: 0.08,
    padType: 'sawtooth', padVol: 0.03, padFilterFreq: 250, padFilterQ: 3,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.06,
    noiseType: 'brown', noiseVol: 0.04, noiseFilterFreq: 150,
    lfoRate: 0.1, lfoDepth: 70,
    volume: 0.14,
    pulseEnabled: true, pulseRate: 35, pulseVol: 0.05,
  },

  [BiomeType.Alpine]: {
    root: 130.8, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_V, CHORD_VI, CHORD_IV],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'sine', padVol: 0.04, padFilterFreq: 1100, padFilterQ: 0.4,
    arpEnabled: true, arpSpeed: 1.5, arpOctave: 2, arpVol: 0.018,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.04, lfoDepth: 200,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Cliffs]: {
    root: 82.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_IV, CHORD_III, CHORD_V],
    chordDuration: 8,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'triangle', padVol: 0.035, padFilterFreq: 700, padFilterQ: 0.8,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.04,
    noiseType: 'pink', noiseVol: 0.015, noiseFilterFreq: 600,
    lfoRate: 0.06, lfoDepth: 180,
    volume: 0.10,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.FloatingIslands]: {
    root: 174.6, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_VI, CHORD_IV, CHORD_V],
    chordDuration: 12,
    droneOctave: -1, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.045, padFilterFreq: 1500, padFilterQ: 0.3,
    arpEnabled: true, arpSpeed: 1.8, arpOctave: 1, arpVol: 0.022,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'white', noiseVol: 0.005, noiseFilterFreq: 4000,
    lfoRate: 0.03, lfoDepth: 300,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Jungle]: {
    root: 73.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_III, CHORD_IV, CHORD_VI],
    chordDuration: 7,
    droneOctave: 0, droneType: 'triangle', droneVol: 0.07,
    padType: 'sine', padVol: 0.035, padFilterFreq: 600, padFilterQ: 1.2,
    arpEnabled: true, arpSpeed: 0.8, arpOctave: 2, arpVol: 0.02,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.05,
    noiseType: 'brown', noiseVol: 0.02, noiseFilterFreq: 350,
    lfoRate: 0.08, lfoDepth: 130,
    volume: 0.11,
    pulseEnabled: true, pulseRate: 60, pulseVol: 0.02,
  },

  [BiomeType.Mesa]: {
    root: 98, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_IV, CHORD_I, CHORD_V],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'triangle', padVol: 0.03, padFilterFreq: 700, padFilterQ: 1,
    arpEnabled: true, arpSpeed: 2.5, arpOctave: 2, arpVol: 0.015,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.035, lfoDepth: 140,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.CoralReef]: {
    root: 164.8, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_III, CHORD_IV, CHORD_V],
    chordDuration: 9,
    droneOctave: -1, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.04, padFilterFreq: 600, padFilterQ: 2,
    arpEnabled: true, arpSpeed: 1.2, arpOctave: 1, arpVol: 0.022,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'pink', noiseVol: 0.015, noiseFilterFreq: 400,
    lfoRate: 0.05, lfoDepth: 180,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Bog]: {
    root: 55, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_III, CHORD_II, CHORD_IV],
    chordDuration: 8,
    droneOctave: 0, droneType: 'triangle', droneVol: 0.06,
    padType: 'sine', padVol: 0.035, padFilterFreq: 450, padFilterQ: 1.5,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.05,
    noiseType: 'brown', noiseVol: 0.03, noiseFilterFreq: 250,
    lfoRate: 0.05, lfoDepth: 90,
    volume: 0.10,
    pulseEnabled: true, pulseRate: 45, pulseVol: 0.025,
  },

  [BiomeType.Badlands]: {
    root: 82.4, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_II, CHORD_IV, CHORD_III],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.05,
    padType: 'sawtooth', padVol: 0.02, padFilterFreq: 500, padFilterQ: 1.5,
    arpEnabled: false, arpSpeed: 0, arpOctave: 0, arpVol: 0,
    bassEnabled: true, bassPulseRate: 0, bassVol: 0.04,
    noiseType: null, noiseVol: 0, noiseFilterFreq: 0,
    lfoRate: 0.04, lfoDepth: 100,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Taiga]: {
    root: 98, scale: MINOR_SCALE, pentatonic: PENTA_MINOR, isMinor: true,
    chords: [CHORD_I, CHORD_IV, CHORD_VI, CHORD_V],
    chordDuration: 10,
    droneOctave: 0, droneType: 'sine', droneVol: 0.06,
    padType: 'sine', padVol: 0.04, padFilterFreq: 800, padFilterQ: 0.6,
    arpEnabled: true, arpSpeed: 2.0, arpOctave: 2, arpVol: 0.015,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'pink', noiseVol: 0.01, noiseFilterFreq: 500,
    lfoRate: 0.035, lfoDepth: 170,
    volume: 0.09,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },

  [BiomeType.Oasis]: {
    root: 146.8, scale: MAJOR_SCALE, pentatonic: PENTA_MAJOR, isMinor: false,
    chords: [CHORD_I, CHORD_IV, CHORD_V, CHORD_VI],
    chordDuration: 9,
    droneOctave: 0, droneType: 'sine', droneVol: 0.05,
    padType: 'sine', padVol: 0.04, padFilterFreq: 1200, padFilterQ: 0.4,
    arpEnabled: true, arpSpeed: 1.3, arpOctave: 1, arpVol: 0.022,
    bassEnabled: false, bassPulseRate: 0, bassVol: 0,
    noiseType: 'white', noiseVol: 0.005, noiseFilterFreq: 3000,
    lfoRate: 0.05, lfoDepth: 220,
    volume: 0.08,
    pulseEnabled: false, pulseRate: 0, pulseVol: 0,
  },
}

// ──────────────────────────────────────────────
//  Voice — all live audio nodes for one biome
// ──────────────────────────────────────────────

interface Voice {
  def: BiomeMusicDef
  biome: BiomeType
  masterGain: GainNode

  // Drone (root + fifth, two detuned oscs)
  droneOscs: OscillatorNode[]
  droneFilter: BiquadFilterNode
  droneGain: GainNode

  // Pad (chord tones — 3 oscs that crossfade on chord changes)
  padOscs: OscillatorNode[]
  padFilter: BiquadFilterNode
  padGain: GainNode

  // Bass (sub-bass sine, follows root of current chord)
  bassOsc: OscillatorNode | null
  bassFilter: BiquadFilterNode | null
  bassGain: GainNode | null

  // Noise texture
  noiseSource: AudioBufferSourceNode | null
  noiseFilter: BiquadFilterNode | null
  noiseGain: GainNode | null

  // LFO for filter sweeps
  lfo: OscillatorNode
  lfoGain: GainNode

  // Tremolo
  tremolo: OscillatorNode
  tremoloGain: GainNode

  // Rhythmic pulse oscillator
  pulseOsc: OscillatorNode | null
  pulseGain: GainNode | null

  // Chord progression state
  chordIndex: number
  chordTimer: number

  // Arpeggio state
  arpTimer: number
  arpNoteIndex: number
}

// ──────────────────────────────────────────────
//  BiomeMusic class
// ──────────────────────────────────────────────

export class BiomeMusic {
  private ctx: AudioContext
  private master: GainNode
  private activeVoice: Voice | null = null
  private fadingVoice: Voice | null = null
  private currentBiome: BiomeType = -1 as BiomeType
  private fadeSpeed = 0.35

  // Pre-generated noise buffers
  private brownBuf: AudioBuffer
  private pinkBuf: AudioBuffer
  private whiteBuf: AudioBuffer

  // Melody system
  private melodyTimer = 0
  private melodyGain: GainNode
  // Counter-melody system (plays between melody notes, different rhythm)
  private counterTimer = 0
  private counterGain: GainNode

  constructor(ctx: AudioContext, master: GainNode) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.55
    this.master.connect(master)

    const sr = ctx.sampleRate
    const len = sr * 3
    this.brownBuf = this.genBrown(len, sr)
    this.pinkBuf = this.genPink(len, sr)
    this.whiteBuf = this.genWhite(len, sr)

    this.melodyGain = ctx.createGain()
    this.melodyGain.gain.value = 0.5
    this.melodyGain.connect(this.master)

    this.counterGain = ctx.createGain()
    this.counterGain.gain.value = 0.35
    this.counterGain.connect(this.master)
  }

  private genBrown(len: number, sr: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.5
    }
    return buf
  }

  private genPink(len: number, sr: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      d[i] = (b0 + b1 + b2 + w * 0.5362) * 0.11
    }
    return buf
  }

  private genWhite(len: number, sr: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  // ── Resolve a scale-degree index to a frequency ──

  private degreeToFreq(root: number, scale: number[], degree: number): number {
    const octaves = Math.floor(degree / scale.length)
    const idx = degree % scale.length
    return root * scale[idx] * Math.pow(2, octaves)
  }

  // ── Update (called every frame) ──

  update(delta: number, biome: BiomeType) {
    if (biome !== this.currentBiome) {
      this.currentBiome = biome
      this.crossfadeTo(biome)
    }

    // Fade in active voice
    if (this.activeVoice) {
      const g = this.activeVoice.masterGain.gain
      const target = this.activeVoice.def.volume
      g.value = Math.min(target, g.value + delta * this.fadeSpeed * target)

      // Progress chord
      this.tickChord(this.activeVoice, delta)
      // Progress arpeggio
      this.tickArpeggio(this.activeVoice, delta)
    }

    // Fade out old voice
    if (this.fadingVoice) {
      const g = this.fadingVoice.masterGain.gain
      g.value = Math.max(0, g.value - delta * this.fadeSpeed * 0.12)
      if (g.value <= 0.001) {
        this.destroyVoice(this.fadingVoice)
        this.fadingVoice = null
      }
    }

    // Melody note
    this.melodyTimer -= delta
    if (this.melodyTimer <= 0) {
      this.melodyTimer = 3.5 + Math.random() * 6
      this.playMelodyNote(biome)
    }

    // Counter-melody (offset timing from melody)
    this.counterTimer -= delta
    if (this.counterTimer <= 0) {
      this.counterTimer = 5 + Math.random() * 8
      this.playCounterMelody(biome)
    }
  }

  // ── Chord progression ──

  private tickChord(v: Voice, delta: number) {
    v.chordTimer -= delta
    if (v.chordTimer > 0) return

    v.chordTimer = v.def.chordDuration
    v.chordIndex = (v.chordIndex + 1) % v.def.chords.length
    this.applyChord(v)
  }

  private applyChord(v: Voice) {
    const chord = v.def.chords[v.chordIndex]
    const now = this.ctx.currentTime
    const glide = 1.5 // seconds to glide to new chord tones

    // Move pad oscillators to new chord tones
    for (let i = 0; i < v.padOscs.length && i < chord.length; i++) {
      const freq = this.degreeToFreq(v.def.root * 2, v.def.scale, chord[i])
      v.padOscs[i].frequency.linearRampToValueAtTime(freq, now + glide)
    }

    // Move bass to root of chord
    if (v.bassOsc) {
      const bassRoot = this.degreeToFreq(v.def.root, v.def.scale, chord[0])
      v.bassOsc.frequency.linearRampToValueAtTime(bassRoot * 0.5, now + glide)
    }

    // Move drone fifth to match new chord's fifth (if present)
    if (v.droneOscs.length >= 2 && chord.length >= 2) {
      const fifth = this.degreeToFreq(v.def.root * Math.pow(2, v.def.droneOctave), v.def.scale, chord[1])
      v.droneOscs[1].frequency.linearRampToValueAtTime(fifth, now + glide)
    }
  }

  // ── Arpeggio ──

  private tickArpeggio(v: Voice, delta: number) {
    if (!v.def.arpEnabled) return
    v.arpTimer -= delta
    if (v.arpTimer > 0) return

    v.arpTimer = v.def.arpSpeed
    const chord = v.def.chords[v.chordIndex]
    const degree = chord[v.arpNoteIndex % chord.length]
    v.arpNoteIndex = (v.arpNoteIndex + 1) % (chord.length * 2) // up and down

    const ascending = v.arpNoteIndex < chord.length
    const idx = ascending ? v.arpNoteIndex % chord.length : chord.length - 1 - (v.arpNoteIndex % chord.length)
    const actualDegree = chord[idx]

    const freq = this.degreeToFreq(
      v.def.root * Math.pow(2, v.def.arpOctave),
      v.def.scale,
      actualDegree,
    )

    this.playArpNote(freq, v.def.arpVol, v.masterGain)
  }

  private playArpNote(freq: number, vol: number, dest: GainNode) {
    const now = this.ctx.currentTime
    const dur = 0.8 + Math.random() * 0.6

    const osc1 = this.ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = freq

    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 1.004 // slight detune

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1200 + Math.random() * 400
    filter.Q.value = 0.5

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.15)
    gain.gain.setValueAtTime(vol * 0.8, now + dur * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(dest)

    osc1.start(now); osc1.stop(now + dur + 0.1)
    osc2.start(now); osc2.stop(now + dur + 0.1)
    osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  // ── Melody note (pentatonic, independent of chord) ──

  private playMelodyNote(biome: BiomeType) {
    const def = DEFS[biome]
    if (!def) return

    const penta = def.pentatonic
    const idx = Math.floor(Math.random() * penta.length)
    const freq = def.root * penta[idx] * 2

    const now = this.ctx.currentTime
    const dur = 1.5 + Math.random() * 2.5

    // Three detuned sines for rich pad-like melody tone
    const oscs: OscillatorNode[] = []
    const detunes = [0, 1.003, 0.997]
    for (const d of detunes) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * d
      oscs.push(osc)
    }

    // Vibrato
    const vib = this.ctx.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = 4 + Math.random() * 2
    const vibGain = this.ctx.createGain()
    vibGain.gain.value = freq * 0.005
    vib.connect(vibGain)
    vibGain.connect(oscs[0].frequency)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600 + Math.random() * 400, now)
    filter.frequency.linearRampToValueAtTime(1000 + Math.random() * 600, now + dur * 0.3)
    filter.frequency.linearRampToValueAtTime(400, now + dur)
    filter.Q.value = 0.5

    const gain = this.ctx.createGain()
    const vol = 0.018 + Math.random() * 0.012
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.4)
    gain.gain.setValueAtTime(vol * 0.9, now + dur * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    for (const osc of oscs) {
      osc.connect(filter)
      osc.start(now)
      osc.stop(now + dur + 0.1)
    }
    filter.connect(gain)
    gain.connect(this.melodyGain)
    vib.start(now); vib.stop(now + dur + 0.1)

    oscs[0].onended = () => {
      for (const o of oscs) o.disconnect()
      vib.disconnect(); vibGain.disconnect()
      filter.disconnect(); gain.disconnect()
    }
  }

  // ── Counter-melody (responds to melody with complementary tone) ──

  private playCounterMelody(biome: BiomeType) {
    const def = DEFS[biome]
    if (!def) return

    // Use scale tones instead of pentatonic for more harmonic variety
    const scale = def.scale
    const idx = Math.floor(Math.random() * scale.length)
    // Lower octave than melody for depth
    const freq = def.root * scale[idx]

    const now = this.ctx.currentTime
    const dur = 2 + Math.random() * 3

    const osc1 = this.ctx.createOscillator()
    osc1.type = 'triangle'
    osc1.frequency.value = freq

    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 1.002

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500 + Math.random() * 300
    filter.Q.value = 0.7

    const gain = this.ctx.createGain()
    const vol = 0.015 + Math.random() * 0.01
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.5)
    gain.gain.setValueAtTime(vol * 0.85, now + dur * 0.5)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(this.counterGain)

    osc1.start(now); osc1.stop(now + dur + 0.1)
    osc2.start(now); osc2.stop(now + dur + 0.1)
    osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  // ── Voice building ──

  private crossfadeTo(biome: BiomeType) {
    if (this.fadingVoice) this.destroyVoice(this.fadingVoice)
    this.fadingVoice = this.activeVoice

    const def = DEFS[biome]
    if (!def) { this.activeVoice = null; return }
    this.activeVoice = this.buildVoice(biome, def)
  }

  private buildVoice(biome: BiomeType, p: BiomeMusicDef): Voice {
    const masterGain = this.ctx.createGain()
    masterGain.gain.value = 0.001
    masterGain.connect(this.master)

    // LFO for filter sweeps
    const lfo = this.ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = p.lfoRate
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = p.lfoDepth
    lfo.connect(lfoGain)
    lfo.start()

    // Tremolo on master
    const tremolo = this.ctx.createOscillator()
    tremolo.type = 'sine'
    tremolo.frequency.value = p.lfoRate * 0.7
    const tremoloGain = this.ctx.createGain()
    tremoloGain.gain.value = p.volume * 0.2
    tremolo.connect(tremoloGain)
    tremoloGain.connect(masterGain.gain)
    tremolo.start()

    // ── Drone: root + fifth, two detuned oscs each ──
    const droneFilter = this.ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.value = p.padFilterFreq * 0.8
    droneFilter.Q.value = 0.5
    lfoGain.connect(droneFilter.frequency)
    const droneGain = this.ctx.createGain()
    droneGain.gain.value = p.droneVol
    droneFilter.connect(droneGain)
    droneGain.connect(masterGain)

    const droneRoot = p.root * Math.pow(2, p.droneOctave)
    const droneFifth = droneRoot * 1.5
    const droneOscs: OscillatorNode[] = []

    for (const freq of [droneRoot, droneRoot * 1.002, droneFifth, droneFifth * 0.998]) {
      const osc = this.ctx.createOscillator()
      osc.type = p.droneType
      osc.frequency.value = freq
      osc.connect(droneFilter)
      osc.start()
      droneOscs.push(osc)
    }

    // ── Pad: chord tones (3 oscs) ──
    const padFilter = this.ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = p.padFilterFreq
    padFilter.Q.value = p.padFilterQ
    lfoGain.connect(padFilter.frequency)
    const padGain = this.ctx.createGain()
    padGain.gain.value = p.padVol
    padFilter.connect(padGain)
    padGain.connect(masterGain)

    const chord = p.chords[0]
    const padOscs: OscillatorNode[] = []
    for (let i = 0; i < chord.length; i++) {
      const freq = this.degreeToFreq(p.root * 2, p.scale, chord[i])
      const osc = this.ctx.createOscillator()
      osc.type = p.padType
      osc.frequency.value = freq
      osc.connect(padFilter)
      osc.start()
      padOscs.push(osc)

      // Add a detuned double for each pad voice
      const osc2 = this.ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 1.003
      osc2.connect(padFilter)
      osc2.start()
      padOscs.push(osc2)
    }

    // ── Bass ──
    let bassOsc: OscillatorNode | null = null
    let bassFilter: BiquadFilterNode | null = null
    let bassGain: GainNode | null = null
    if (p.bassEnabled) {
      bassOsc = this.ctx.createOscillator()
      bassOsc.type = 'sine'
      bassOsc.frequency.value = p.root * 0.5
      bassFilter = this.ctx.createBiquadFilter()
      bassFilter.type = 'lowpass'
      bassFilter.frequency.value = 200
      bassFilter.Q.value = 1
      bassGain = this.ctx.createGain()
      bassGain.gain.value = p.bassVol
      bassOsc.connect(bassFilter)
      bassFilter.connect(bassGain)
      bassGain.connect(masterGain)
      bassOsc.start()
    }

    // ── Noise texture ──
    let noiseSource: AudioBufferSourceNode | null = null
    let noiseFilter: BiquadFilterNode | null = null
    let noiseGain: GainNode | null = null
    if (p.noiseType) {
      const buf = p.noiseType === 'brown' ? this.brownBuf
        : p.noiseType === 'pink' ? this.pinkBuf : this.whiteBuf
      noiseSource = this.ctx.createBufferSource()
      noiseSource.buffer = buf
      noiseSource.loop = true
      noiseFilter = this.ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = p.noiseFilterFreq
      noiseFilter.Q.value = 0.5
      noiseGain = this.ctx.createGain()
      noiseGain.gain.value = p.noiseVol
      noiseSource.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterGain)
      noiseSource.start()
    }

    // ── Rhythmic sub-bass pulse ──
    let pulseOsc: OscillatorNode | null = null
    let pulseGain: GainNode | null = null
    if (p.pulseEnabled && p.pulseRate > 0) {
      // Sub-bass sine pulsing at BPM rate via amplitude LFO
      pulseOsc = this.ctx.createOscillator()
      pulseOsc.type = 'sine'
      pulseOsc.frequency.value = p.root * 0.25 // two octaves below root

      const pulseLFO = this.ctx.createOscillator()
      pulseLFO.type = 'sine'
      pulseLFO.frequency.value = p.pulseRate / 60 // BPM → Hz
      const pulseLFOGain = this.ctx.createGain()
      pulseLFOGain.gain.value = p.pulseVol * 0.5
      pulseLFO.connect(pulseLFOGain)

      pulseGain = this.ctx.createGain()
      pulseGain.gain.value = p.pulseVol * 0.5
      pulseLFOGain.connect(pulseGain.gain)

      const pulseFilter = this.ctx.createBiquadFilter()
      pulseFilter.type = 'lowpass'
      pulseFilter.frequency.value = 100
      pulseFilter.Q.value = 1

      pulseOsc.connect(pulseFilter)
      pulseFilter.connect(pulseGain)
      pulseGain.connect(masterGain)
      pulseOsc.start()
      pulseLFO.start()
    }

    return {
      def: p, biome, masterGain,
      droneOscs, droneFilter, droneGain,
      padOscs, padFilter, padGain,
      bassOsc, bassFilter, bassGain,
      noiseSource, noiseFilter, noiseGain,
      lfo, lfoGain, tremolo, tremoloGain,
      pulseOsc, pulseGain,
      chordIndex: 0, chordTimer: p.chordDuration,
      arpTimer: p.arpEnabled ? p.arpSpeed : 99999,
      arpNoteIndex: 0,
    }
  }

  private destroyVoice(v: Voice) {
    const stop = (o: OscillatorNode) => { try { o.stop() } catch {} o.disconnect() }
    for (const o of v.droneOscs) stop(o)
    v.droneFilter.disconnect(); v.droneGain.disconnect()
    for (const o of v.padOscs) stop(o)
    v.padFilter.disconnect(); v.padGain.disconnect()
    if (v.bassOsc) { stop(v.bassOsc); v.bassFilter?.disconnect(); v.bassGain?.disconnect() }
    if (v.noiseSource) { try { v.noiseSource.stop() } catch {} v.noiseSource.disconnect() }
    if (v.noiseFilter) v.noiseFilter.disconnect()
    if (v.noiseGain) v.noiseGain.disconnect()
    stop(v.lfo); v.lfoGain.disconnect()
    stop(v.tremolo); v.tremoloGain.disconnect()
    if (v.pulseOsc) { stop(v.pulseOsc); v.pulseGain?.disconnect() }
    v.masterGain.disconnect()
  }

  dispose() {
    if (this.activeVoice) this.destroyVoice(this.activeVoice)
    if (this.fadingVoice) this.destroyVoice(this.fadingVoice)
    this.melodyGain.disconnect()
    this.counterGain.disconnect()
    this.master.disconnect()
  }
}
