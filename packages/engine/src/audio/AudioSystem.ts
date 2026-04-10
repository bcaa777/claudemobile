/**
 * Core audio infrastructure.
 * Manages AudioContext, master gain, named audio layers, and mute state.
 * Game-specific audio systems build on top of this.
 */

export interface AudioLayerConfig {
  name: string
  gain: number
}

export class AudioSystem {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private layers = new Map<string, GainNode>()
  private _initialized = false
  private _muted = false

  get initialized(): boolean { return this._initialized }
  get muted(): boolean { return this._muted }

  getContext(): AudioContext | null { return this.ctx }
  getMasterGain(): GainNode | null { return this.masterGain }

  /** Get a named audio layer gain node */
  getLayer(name: string): GainNode | null {
    return this.layers.get(name) ?? null
  }

  /**
   * Initialize the AudioContext and create audio layers.
   * Must be called from a user gesture (e.g., click handler).
   */
  init(layerConfigs: AudioLayerConfig[]): void {
    if (this._initialized) return
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this._muted ? 0 : 1
      this.masterGain.connect(this.ctx.destination)

      for (const config of layerConfigs) {
        const node = this.ctx.createGain()
        node.gain.value = config.gain
        node.connect(this.masterGain)
        this.layers.set(config.name, node)
      }

      this._initialized = true
    } catch {
      // Web Audio not available
    }
  }

  /** Toggle mute state. Returns new muted state. */
  toggleMute(): boolean {
    this._muted = !this._muted
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 1
    }
    return this._muted
  }

  /** Set mute state directly. */
  setMuted(muted: boolean): void {
    this._muted = muted
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : 1
    }
  }

  /** Resume suspended AudioContext (needed after page interaction policies). */
  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume()
    }
  }

  /** Update a layer's gain value. */
  setLayerGain(name: string, value: number): void {
    const layer = this.layers.get(name)
    if (layer) {
      layer.gain.value = value
    }
  }
}
