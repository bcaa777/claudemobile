import { BiomeType } from '../biomes/types'

export interface AmbienceLayer {
  type: 'drone' | 'texture' | 'detail' | 'occasional'
  waveform: OscillatorType
  baseFrequency: number
  frequencyRange: number
  filterType: BiquadFilterType
  filterFrequency: number
  gain: number
  modulationRate?: number
  modulationDepth?: number
  burstInterval?: number
  burstDuration?: number
}

export interface BiomeAmbience {
  layers: AmbienceLayer[]
}

export const BIOME_AMBIENCES: Record<BiomeType, BiomeAmbience> = {
  // ─── Forest: warm and alive ───
  [BiomeType.Forest]: {
    layers: [
      // Warm low hum (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 85, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.04,
        modulationRate: 0.05, modulationDepth: 8 },
      // Wind through canopy (texture)
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 220, frequencyRange: 40,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.012,
        modulationRate: 0.15, modulationDepth: 120 },
      // Bird calls / twig snaps (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 1800, frequencyRange: 600,
        filterType: 'bandpass', filterFrequency: 2200, gain: 0.008,
        modulationRate: 8, modulationDepth: 300 },
      // Distant waterfall (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 150, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 600, gain: 0.015,
        burstInterval: 12, burstDuration: 4 },
    ],
  },

  // ─── Desert: sparse and resonant ───
  [BiomeType.Desert]: {
    layers: [
      // Deep resonant void (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 55, frequencyRange: 3,
        filterType: 'lowpass', filterFrequency: 120, gain: 0.035,
        modulationRate: 0.03, modulationDepth: 5 },
      // Sand whisper (texture)
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 3000, frequencyRange: 500,
        filterType: 'highpass', filterFrequency: 2500, gain: 0.006,
        modulationRate: 0.2, modulationDepth: 400 },
      // Insect buzz (detail)
      { type: 'detail', waveform: 'square', baseFrequency: 280, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 350, gain: 0.005,
        modulationRate: 12, modulationDepth: 60 },
      // Distant rumble (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 40, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.02,
        burstInterval: 18, burstDuration: 3 },
    ],
  },

  // ─── Swamp: murky and organic ───
  [BiomeType.Swamp]: {
    layers: [
      // Murky low throb (drone)
      { type: 'drone', waveform: 'triangle', baseFrequency: 65, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 180, gain: 0.04,
        modulationRate: 0.25, modulationDepth: 15 },
      // Bubbling / dripping (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 350, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.01,
        modulationRate: 3.5, modulationDepth: 200 },
      // Frog chorus (detail)
      { type: 'detail', waveform: 'square', baseFrequency: 120, frequencyRange: 40,
        filterType: 'bandpass', filterFrequency: 180, gain: 0.007,
        modulationRate: 6, modulationDepth: 50 },
      // Splash / groan (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 80, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.018,
        burstInterval: 10, burstDuration: 2.5 },
    ],
  },

  // ─── Snow: quiet and cold ───
  [BiomeType.Snow]: {
    layers: [
      // White noise wind (drone) — triangle at high freq simulates noise-ish texture
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 2000, frequencyRange: 300,
        filterType: 'bandpass', filterFrequency: 1500, gain: 0.008,
        modulationRate: 0.06, modulationDepth: 200 },
      // Ice creak (texture)
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 400, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 600, gain: 0.005,
        modulationRate: 0.4, modulationDepth: 100 },
      // Silence gaps (detail — very quiet)
      { type: 'detail', waveform: 'sine', baseFrequency: 2500, frequencyRange: 500,
        filterType: 'highpass', filterFrequency: 2000, gain: 0.002,
        modulationRate: 0.02, modulationDepth: 200 },
      // Crack / avalanche (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 100, frequencyRange: 60,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.02,
        burstInterval: 20, burstDuration: 1.5 },
    ],
  },

  // ─── Volcanic: deep and threatening ───
  [BiomeType.Volcanic]: {
    layers: [
      // Rumbling bass (drone)
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 35, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 100, gain: 0.05,
        modulationRate: 0.08, modulationDepth: 8 },
      // Hiss / vent steam (texture)
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 4000, frequencyRange: 1000,
        filterType: 'highpass', filterFrequency: 3000, gain: 0.01,
        modulationRate: 0.3, modulationDepth: 600 },
      // Rock crumble (detail)
      { type: 'detail', waveform: 'square', baseFrequency: 200, frequencyRange: 100,
        filterType: 'bandpass', filterFrequency: 300, gain: 0.008,
        modulationRate: 15, modulationDepth: 80 },
      // Eruption boom (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 25, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.035,
        burstInterval: 15, burstDuration: 3 },
    ],
  },

  // ─── Crystal: pure and harmonic ───
  [BiomeType.Crystal]: {
    layers: [
      // Pure sine harmonics (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 440, frequencyRange: 10,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.015,
        modulationRate: 0.04, modulationDepth: 5 },
      // Resonant shimmer (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 880, frequencyRange: 50,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.008,
        modulationRate: 0.5, modulationDepth: 80 },
      // Chime cascades (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 2200, frequencyRange: 800,
        filterType: 'bandpass', filterFrequency: 2500, gain: 0.006,
        modulationRate: 4, modulationDepth: 500 },
      // Harmonic sweep (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 660, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.012,
        burstInterval: 14, burstDuration: 5 },
    ],
  },

  // ─── Jungle: dense and layered ───
  [BiomeType.Jungle]: {
    layers: [
      // Dense layered hum (drone)
      { type: 'drone', waveform: 'triangle', baseFrequency: 95, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.04,
        modulationRate: 0.07, modulationDepth: 12 },
      // Rain drip / rustle (texture)
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 1200, frequencyRange: 400,
        filterType: 'bandpass', filterFrequency: 1500, gain: 0.01,
        modulationRate: 2, modulationDepth: 300 },
      // Monkey calls / insects (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 2500, frequencyRange: 1000,
        filterType: 'bandpass', filterFrequency: 3000, gain: 0.007,
        modulationRate: 10, modulationDepth: 600 },
      // Thunder (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 30, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.03,
        burstInterval: 25, burstDuration: 3.5 },
    ],
  },

  // ─── Mesa: hollow and echoing ───
  [BiomeType.Mesa]: {
    layers: [
      // Hollow wind (drone)
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 130, frequencyRange: 20,
        filterType: 'bandpass', filterFrequency: 350, gain: 0.02,
        modulationRate: 0.1, modulationDepth: 40 },
      // Echo effect (texture)
      { type: 'texture', waveform: 'triangle', baseFrequency: 600, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.008,
        modulationRate: 0.15, modulationDepth: 150 },
      // Rock fall (detail)
      { type: 'detail', waveform: 'square', baseFrequency: 300, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 400, gain: 0.006,
        modulationRate: 18, modulationDepth: 100 },
      // Canyon moan (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 70, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.018,
        burstInterval: 16, burstDuration: 4 },
    ],
  },

  // ─── Coral Coast: rhythmic and watery ───
  [BiomeType.CoralReef]: {
    layers: [
      // Wave rhythm (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 75, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.03,
        modulationRate: 0.12, modulationDepth: 20 },
      // Underwater gurgle (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 250, frequencyRange: 100,
        filterType: 'bandpass', filterFrequency: 400, gain: 0.01,
        modulationRate: 4, modulationDepth: 150 },
      // Seabird cries (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 2000, frequencyRange: 700,
        filterType: 'bandpass', filterFrequency: 2400, gain: 0.006,
        modulationRate: 7, modulationDepth: 400 },
      // Shell wind chime (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 1400, frequencyRange: 400,
        filterType: 'bandpass', filterFrequency: 1600, gain: 0.01,
        burstInterval: 11, burstDuration: 3 },
    ],
  },

  // ─── Heaven: ethereal and serene ───
  [BiomeType.Heaven]: {
    layers: [
      // Ethereal choir pad (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 260, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 600, gain: 0.02,
        modulationRate: 0.03, modulationDepth: 8 },
      // Wind harp (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 520, frequencyRange: 60,
        filterType: 'bandpass', filterFrequency: 700, gain: 0.008,
        modulationRate: 0.2, modulationDepth: 50 },
      // Bell tones (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 1320, frequencyRange: 300,
        filterType: 'bandpass', filterFrequency: 1500, gain: 0.005,
        modulationRate: 0.5, modulationDepth: 100 },
      // Silence swells (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 390, frequencyRange: 40,
        filterType: 'lowpass', filterFrequency: 500, gain: 0.01,
        burstInterval: 18, burstDuration: 6 },
    ],
  },

  // ─── Hell: distorted and oppressive ───
  [BiomeType.Hell]: {
    layers: [
      // Distorted bass growl (drone)
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 40, frequencyRange: 6,
        filterType: 'lowpass', filterFrequency: 120, gain: 0.05,
        modulationRate: 0.1, modulationDepth: 10 },
      // Metal stress (texture)
      { type: 'texture', waveform: 'square', baseFrequency: 500, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 700, gain: 0.01,
        modulationRate: 0.6, modulationDepth: 150 },
      // Whispers (detail)
      { type: 'detail', waveform: 'sawtooth', baseFrequency: 1500, frequencyRange: 500,
        filterType: 'bandpass', filterFrequency: 1800, gain: 0.005,
        modulationRate: 5, modulationDepth: 300 },
      // Impact / collapse (occasional)
      { type: 'occasional', waveform: 'sawtooth', baseFrequency: 28, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.04,
        burstInterval: 12, burstDuration: 2 },
    ],
  },
}
