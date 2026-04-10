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

// All gains are intentionally very low. Modulation depths are kept small
// (1-5 Hz range for frequency wobble) to avoid audible warbling.
// Drones use NO modulation (static tones). Textures use very slow drift only.
// Details use pitch drift via the update loop, not LFO.

export const BIOME_AMBIENCES: Record<BiomeType, BiomeAmbience> = {
  // ─── Forest: warm and alive ───
  [BiomeType.Forest]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 85, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.048 },
      { type: 'texture', waveform: 'sine', baseFrequency: 170, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 350, gain: 0.012,
        modulationRate: 0.04, modulationDepth: 3 },
      { type: 'detail', waveform: 'sine', baseFrequency: 1100, frequencyRange: 400,
        filterType: 'bandpass', filterFrequency: 1300, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 120, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.024,
        burstInterval: 14, burstDuration: 4 },
    ],
  },

  // ─── Desert: sparse and resonant ───
  [BiomeType.Desert]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 55, frequencyRange: 3,
        filterType: 'lowpass', filterFrequency: 120, gain: 0.04 },
      { type: 'texture', waveform: 'sine', baseFrequency: 180, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.008,
        modulationRate: 0.06, modulationDepth: 4 },
      { type: 'detail', waveform: 'sine', baseFrequency: 280, frequencyRange: 40,
        filterType: 'bandpass', filterFrequency: 350, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 40, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.032,
        burstInterval: 20, burstDuration: 3 },
    ],
  },

  // ─── Swamp: murky and organic ───
  [BiomeType.Swamp]: {
    layers: [
      { type: 'drone', waveform: 'triangle', baseFrequency: 65, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 180, gain: 0.04 },
      { type: 'texture', waveform: 'sine', baseFrequency: 280, frequencyRange: 60,
        filterType: 'bandpass', filterFrequency: 400, gain: 0.012,
        modulationRate: 0.08, modulationDepth: 5 },
      { type: 'detail', waveform: 'sine', baseFrequency: 120, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 80, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.024,
        burstInterval: 12, burstDuration: 2 },
    ],
  },

  // ─── Snow: quiet and cold ───
  [BiomeType.Snow]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 130, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 280, gain: 0.024 },
      { type: 'texture', waveform: 'sine', baseFrequency: 320, frequencyRange: 50,
        filterType: 'bandpass', filterFrequency: 450, gain: 0.008,
        modulationRate: 0.03, modulationDepth: 3 },
      { type: 'detail', waveform: 'sine', baseFrequency: 800, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 900, gain: 0.004 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 100, frequencyRange: 40,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.032,
        burstInterval: 22, burstDuration: 1.5 },
    ],
  },

  // ─── Volcanic: deep and threatening ───
  [BiomeType.Volcanic]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 35, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.06 },
      { type: 'texture', waveform: 'sine', baseFrequency: 200, frequencyRange: 40,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.008,
        modulationRate: 0.05, modulationDepth: 4 },
      { type: 'detail', waveform: 'sine', baseFrequency: 160, frequencyRange: 50,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 25, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.048,
        burstInterval: 18, burstDuration: 3 },
    ],
  },

  // ─── Crystal: pure and harmonic ───
  [BiomeType.Crystal]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 220, frequencyRange: 3,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.024 },
      { type: 'texture', waveform: 'sine', baseFrequency: 440, frequencyRange: 10,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.012,
        modulationRate: 0.02, modulationDepth: 2 },
      { type: 'detail', waveform: 'sine', baseFrequency: 880, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 330, frequencyRange: 60,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.016,
        burstInterval: 16, burstDuration: 5 },
    ],
  },

  // ─── Jungle: dense and layered ───
  [BiomeType.Jungle]: {
    layers: [
      { type: 'drone', waveform: 'triangle', baseFrequency: 95, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 220, gain: 0.04 },
      { type: 'texture', waveform: 'sine', baseFrequency: 400, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 600, gain: 0.008,
        modulationRate: 0.07, modulationDepth: 5 },
      { type: 'detail', waveform: 'sine', baseFrequency: 700, frequencyRange: 250,
        filterType: 'bandpass', filterFrequency: 900, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 30, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.048,
        burstInterval: 28, burstDuration: 3 },
    ],
  },

  // ─── Mesa: hollow and echoing ───
  [BiomeType.Mesa]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 110, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.032 },
      { type: 'texture', waveform: 'sine', baseFrequency: 300, frequencyRange: 50,
        filterType: 'bandpass', filterFrequency: 450, gain: 0.012,
        modulationRate: 0.05, modulationDepth: 4 },
      { type: 'detail', waveform: 'sine', baseFrequency: 230, frequencyRange: 60,
        filterType: 'lowpass', filterFrequency: 380, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 70, frequencyRange: 15,
        filterType: 'lowpass', filterFrequency: 180, gain: 0.024,
        burstInterval: 18, burstDuration: 4 },
    ],
  },

  // ─── Coral Coast: rhythmic and watery ───
  [BiomeType.CoralReef]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 75, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.04 },
      { type: 'texture', waveform: 'sine', baseFrequency: 200, frequencyRange: 40,
        filterType: 'bandpass', filterFrequency: 320, gain: 0.012,
        modulationRate: 0.06, modulationDepth: 4 },
      { type: 'detail', waveform: 'sine', baseFrequency: 700, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 900, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 550, frequencyRange: 100,
        filterType: 'bandpass', filterFrequency: 700, gain: 0.016,
        burstInterval: 14, burstDuration: 3 },
    ],
  },

  // ─── Heaven: ethereal and serene ───
  [BiomeType.Heaven]: {
    layers: [
      { type: 'drone', waveform: 'sine', baseFrequency: 260, frequencyRange: 3,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.024 },
      { type: 'texture', waveform: 'sine', baseFrequency: 390, frequencyRange: 15,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.012,
        modulationRate: 0.03, modulationDepth: 2 },
      { type: 'detail', waveform: 'sine', baseFrequency: 660, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 260, frequencyRange: 15,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.016,
        burstInterval: 20, burstDuration: 6 },
    ],
  },

  // ─── Hell: distorted and oppressive ───
  [BiomeType.Hell]: {
    layers: [
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 40, frequencyRange: 6,
        filterType: 'lowpass', filterFrequency: 100, gain: 0.024,
        modulationRate: 0.08, modulationDepth: 3 },
      { type: 'texture', waveform: 'triangle', baseFrequency: 180, frequencyRange: 40,
        filterType: 'lowpass', filterFrequency: 350, gain: 0.008 },
      { type: 'detail', waveform: 'sine', baseFrequency: 500, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 700, gain: 0.008 },
      { type: 'occasional', waveform: 'sine', baseFrequency: 28, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.048,
        burstInterval: 14, burstDuration: 2 },
    ],
  },
}
