const MUTE_KEY = 'audio_muted'

/** Per-layer gain configuration for the audio graph */
export interface AudioLayerConfig {
  ambience?: number
  music?: number
  creatures?: number
  sfx?: number
  harmonic?: number
  uiChimes?: number
}

const DEFAULT_LAYER_CONFIG: Required<AudioLayerConfig> = {
  ambience: 1.0,
  music: 0.7,
  creatures: 0.8,
  sfx: 0.8,
  harmonic: 0.3,
  uiChimes: 0.8,
}

/**
 * Core audio system: manages AudioContext, per-layer gain hierarchy, and mute state.
 *
 * Gain hierarchy:
 *   Master gain: 1.0
 *   ├── Ambience:        configurable (default 1.0)
 *   ├── Music:           configurable (default 0.7)
 *   ├── Creatures:       configurable (default 0.8)
 *   ├── SFX:             configurable (default 0.8)
 *   ├── Harmonic tones:  configurable (default 0.3)
 *   └── UI chimes:       configurable (default 0.8)
 */
export class AudioSystem {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  private ambienceGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private creaturesGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private harmonicGain: GainNode | null = null
  private uiChimesGain: GainNode | null = null

  private initialized = false
  private muted = false
  private muteEl: HTMLElement | null

  constructor(muteElementId = 'mute-hud') {
    this.muteEl = document.getElementById(muteElementId)
    this.muted = localStorage.getItem(MUTE_KEY) === '1'
    this.updateMuteDisplay()
  }

  /** Must be called from a user gesture (e.g., overlay click) */
  init(layerConfig: AudioLayerConfig = {}) {
    if (this.initialized) return
    const cfg = { ...DEFAULT_LAYER_CONFIG, ...layerConfig }
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted ? 0 : 1
      this.masterGain.connect(this.ctx.destination)

      const makeLayer = (gain: number): GainNode => {
        const node = this.ctx!.createGain()
        node.gain.value = gain
        node.connect(this.masterGain!)
        return node
      }
      this.ambienceGain  = makeLayer(cfg.ambience)
      this.musicGain     = makeLayer(cfg.music)
      this.creaturesGain = makeLayer(cfg.creatures)
      this.sfxGain       = makeLayer(cfg.sfx)
      this.harmonicGain  = makeLayer(cfg.harmonic)
      this.uiChimesGain  = makeLayer(cfg.uiChimes)

      this.initialized = true
    } catch {
      // Web Audio not available
    }
  }

  /** Resume context if suspended. Call each frame before game-specific audio updates. */
  protected resumeContext() {
    if (!this.initialized || !this.ctx) return
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 1
    }
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    this.updateMuteDisplay()
  }

  isMuted(): boolean { return this.muted }
  isInitialized(): boolean { return this.initialized }

  getContext(): AudioContext | null { return this.ctx }
  getMasterGain(): GainNode | null { return this.masterGain }
  getAmbienceGain(): GainNode | null { return this.ambienceGain }
  getMusicGain(): GainNode | null { return this.musicGain }
  getCreaturesGain(): GainNode | null { return this.creaturesGain }
  getSfxGain(): GainNode | null { return this.sfxGain }
  getHarmonicGain(): GainNode | null { return this.harmonicGain }
  getUiChimesGain(): GainNode | null { return this.uiChimesGain }

  private updateMuteDisplay() {
    if (this.muteEl) {
      this.muteEl.textContent = this.muted ? '🔇 MUTED' : ''
      this.muteEl.style.display = this.muted ? 'block' : 'none'
    }
  }
}
