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

// All gains are intentionally very low (0.001–0.02) because raw oscillators
// through Web Audio are much louder than sampled audio. Sawtooth/square
// waveforms are kept below 0.005 gain. High frequencies are always filtered.
// Modulation rates below 1 Hz for drones/textures, 2-5 Hz for details.

export const BIOME_AMBIENCES: Record<BiomeType, BiomeAmbience> = {
  // ─── Forest: warm and alive ───
  [BiomeType.Forest]: {
    layers: [
      // Warm low hum (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 85, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.015,
        modulationRate: 0.05, modulationDepth: 8 },
      // Wind through canopy (texture) — filtered sawtooth, very quiet
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 180, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.003,
        modulationRate: 0.15, modulationDepth: 40 },
      // Bird-like chirps (detail) — sine, gentle modulation
      { type: 'detail', waveform: 'sine', baseFrequency: 1200, frequencyRange: 300,
        filterType: 'bandpass', filterFrequency: 1400, gain: 0.003,
        modulationRate: 3, modulationDepth: 150 },
      // Distant waterfall (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 120, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.008,
        burstInterval: 14, burstDuration: 4 },
    ],
  },

  // ─── Desert: sparse and resonant ───
  [BiomeType.Desert]: {
    layers: [
      // Deep resonant void (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 55, frequencyRange: 3,
        filterType: 'lowpass', filterFrequency: 120, gain: 0.012,
        modulationRate: 0.03, modulationDepth: 5 },
      // Sand whisper (texture) — very quiet filtered noise-like
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 400, frequencyRange: 100,
        filterType: 'lowpass', filterFrequency: 600, gain: 0.002,
        modulationRate: 0.2, modulationDepth: 80 },
      // Insect buzz (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 280, frequencyRange: 40,
        filterType: 'bandpass', filterFrequency: 350, gain: 0.002,
        modulationRate: 4, modulationDepth: 30 },
      // Distant rumble (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 40, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.01,
        burstInterval: 20, burstDuration: 3 },
    ],
  },

  // ─── Swamp: murky and organic ───
  [BiomeType.Swamp]: {
    layers: [
      // Murky low throb (drone)
      { type: 'drone', waveform: 'triangle', baseFrequency: 65, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 180, gain: 0.015,
        modulationRate: 0.25, modulationDepth: 12 },
      // Bubbling (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 300, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 400, gain: 0.004,
        modulationRate: 2.5, modulationDepth: 100 },
      // Frog croak (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 120, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.003,
        modulationRate: 4, modulationDepth: 30 },
      // Splash (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 80, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.008,
        burstInterval: 12, burstDuration: 2 },
    ],
  },

  // ─── Snow: quiet and cold ───
  [BiomeType.Snow]: {
    layers: [
      // Wind (drone) — low sine, not sawtooth
      { type: 'drone', waveform: 'sine', baseFrequency: 140, frequencyRange: 30,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.008,
        modulationRate: 0.06, modulationDepth: 40 },
      // Ice creak (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 350, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.003,
        modulationRate: 0.3, modulationDepth: 60 },
      // Sparse high tone (detail) — very quiet
      { type: 'detail', waveform: 'sine', baseFrequency: 900, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.001,
        modulationRate: 0.5, modulationDepth: 100 },
      // Crack (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 100, frequencyRange: 40,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.01,
        burstInterval: 22, burstDuration: 1.5 },
    ],
  },

  // ─── Volcanic: deep and threatening ───
  [BiomeType.Volcanic]: {
    layers: [
      // Rumbling bass (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 35, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.02,
        modulationRate: 0.08, modulationDepth: 8 },
      // Steam hiss (texture) — very quiet, filtered
      { type: 'texture', waveform: 'sawtooth', baseFrequency: 500, frequencyRange: 100,
        filterType: 'lowpass', filterFrequency: 800, gain: 0.002,
        modulationRate: 0.3, modulationDepth: 80 },
      // Rock crumble (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 180, frequencyRange: 60,
        filterType: 'lowpass', filterFrequency: 300, gain: 0.003,
        modulationRate: 3, modulationDepth: 40 },
      // Eruption boom (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 25, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.015,
        burstInterval: 18, burstDuration: 3 },
    ],
  },

  // ─── Crystal: pure and harmonic ───
  [BiomeType.Crystal]: {
    layers: [
      // Pure sine harmonics (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 220, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.008,
        modulationRate: 0.04, modulationDepth: 3 },
      // Resonant shimmer (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 440, frequencyRange: 20,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.004,
        modulationRate: 0.3, modulationDepth: 30 },
      // Chime cascades (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 880, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.003,
        modulationRate: 2, modulationDepth: 150 },
      // Harmonic sweep (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 330, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.006,
        burstInterval: 16, burstDuration: 5 },
    ],
  },

  // ─── Jungle: dense and layered ───
  [BiomeType.Jungle]: {
    layers: [
      // Dense hum (drone)
      { type: 'drone', waveform: 'triangle', baseFrequency: 95, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 220, gain: 0.012,
        modulationRate: 0.07, modulationDepth: 10 },
      // Rain drip / rustle (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 500, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 700, gain: 0.003,
        modulationRate: 2, modulationDepth: 100 },
      // Insect chirp (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 800, frequencyRange: 300,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.003,
        modulationRate: 5, modulationDepth: 200 },
      // Thunder (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 30, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 80, gain: 0.015,
        burstInterval: 28, burstDuration: 3 },
    ],
  },

  // ─── Mesa: hollow and echoing ───
  [BiomeType.Mesa]: {
    layers: [
      // Hollow wind (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 110, frequencyRange: 15,
        filterType: 'lowpass', filterFrequency: 250, gain: 0.01,
        modulationRate: 0.1, modulationDepth: 20 },
      // Echo (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 330, frequencyRange: 80,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.004,
        modulationRate: 0.15, modulationDepth: 60 },
      // Rock fall (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 250, frequencyRange: 80,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.003,
        modulationRate: 3, modulationDepth: 50 },
      // Canyon moan (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 70, frequencyRange: 15,
        filterType: 'lowpass', filterFrequency: 180, gain: 0.008,
        burstInterval: 18, burstDuration: 4 },
    ],
  },

  // ─── Coral Coast: rhythmic and watery ───
  [BiomeType.CoralReef]: {
    layers: [
      // Wave rhythm (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 75, frequencyRange: 10,
        filterType: 'lowpass', filterFrequency: 200, gain: 0.012,
        modulationRate: 0.12, modulationDepth: 15 },
      // Underwater gurgle (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 220, frequencyRange: 60,
        filterType: 'bandpass', filterFrequency: 350, gain: 0.004,
        modulationRate: 3, modulationDepth: 80 },
      // Seabird cries (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 800, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 1000, gain: 0.003,
        modulationRate: 4, modulationDepth: 150 },
      // Shell wind chime (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 660, frequencyRange: 150,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.005,
        burstInterval: 14, burstDuration: 3 },
    ],
  },

  // ─── Heaven: ethereal and serene ───
  [BiomeType.Heaven]: {
    layers: [
      // Ethereal choir pad (drone)
      { type: 'drone', waveform: 'sine', baseFrequency: 260, frequencyRange: 5,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.008,
        modulationRate: 0.03, modulationDepth: 5 },
      // Wind harp (texture)
      { type: 'texture', waveform: 'sine', baseFrequency: 390, frequencyRange: 30,
        filterType: 'bandpass', filterFrequency: 500, gain: 0.004,
        modulationRate: 0.15, modulationDepth: 30 },
      // Bell tones (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 660, frequencyRange: 100,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.003,
        modulationRate: 0.5, modulationDepth: 50 },
      // Silence swells (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 260, frequencyRange: 20,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.005,
        burstInterval: 20, burstDuration: 6 },
    ],
  },

  // ─── Hell: distorted and oppressive ───
  [BiomeType.Hell]: {
    layers: [
      // Distorted bass growl (drone)
      { type: 'drone', waveform: 'sawtooth', baseFrequency: 40, frequencyRange: 6,
        filterType: 'lowpass', filterFrequency: 100, gain: 0.008,
        modulationRate: 0.1, modulationDepth: 8 },
      // Metal stress (texture)
      { type: 'texture', waveform: 'triangle', baseFrequency: 200, frequencyRange: 60,
        filterType: 'lowpass', filterFrequency: 400, gain: 0.003,
        modulationRate: 0.5, modulationDepth: 40 },
      // Whispers (detail)
      { type: 'detail', waveform: 'sine', baseFrequency: 600, frequencyRange: 200,
        filterType: 'bandpass', filterFrequency: 800, gain: 0.002,
        modulationRate: 3, modulationDepth: 100 },
      // Impact / collapse (occasional)
      { type: 'occasional', waveform: 'sine', baseFrequency: 28, frequencyRange: 8,
        filterType: 'lowpass', filterFrequency: 60, gain: 0.015,
        burstInterval: 14, burstDuration: 2 },
    ],
  },
}
