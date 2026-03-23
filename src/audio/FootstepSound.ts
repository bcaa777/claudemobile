import { BiomeType } from '../biomes/types'
import { EnvironmentReverb } from './EnvironmentReverb'

const JUMP_SPEED = 32 // matches PLAYER_CONFIG.jumpSpeed

export class FootstepSound {
  private ctx: AudioContext
  private master: GainNode
  private reverb: EnvironmentReverb | null
  private stepTimer = 0
  private stepInterval = 0.35

  // Ground transition tracking
  private wasGrounded = true
  private lastVerticalVelocity = 0

  // Pre-baked noise buffers per surface type for variety
  private dirtBuffers: AudioBuffer[] = []
  private snowBuffers: AudioBuffer[] = []
  private wetBuffers: AudioBuffer[] = []
  private sandBuffers: AudioBuffer[] = []
  private stoneBuffers: AudioBuffer[] = []

  // Pre-baked landing buffers
  private dirtLandBuffers: AudioBuffer[] = []
  private snowLandBuffers: AudioBuffer[] = []
  private wetLandBuffers: AudioBuffer[] = []
  private sandLandBuffers: AudioBuffer[] = []
  private stoneLandBuffers: AudioBuffer[] = []

  // Pre-baked jump whoosh
  private jumpBuffer: AudioBuffer

  constructor(ctx: AudioContext, master: GainNode, reverb?: EnvironmentReverb) {
    this.ctx = ctx
    this.master = master
    this.reverb = reverb ?? null

    // Generate several variants of each surface type
    for (let i = 0; i < 4; i++) {
      this.dirtBuffers.push(this.bakeFootstep('dirt', i))
      this.snowBuffers.push(this.bakeFootstep('snow', i))
      this.wetBuffers.push(this.bakeFootstep('wet', i))
      this.sandBuffers.push(this.bakeFootstep('sand', i))
      this.stoneBuffers.push(this.bakeFootstep('stone', i))
    }

    // Generate landing variants (2 per surface)
    for (let i = 0; i < 2; i++) {
      this.dirtLandBuffers.push(this.bakeLanding('dirt', i))
      this.snowLandBuffers.push(this.bakeLanding('snow', i))
      this.wetLandBuffers.push(this.bakeLanding('wet', i))
      this.sandLandBuffers.push(this.bakeLanding('sand', i))
      this.stoneLandBuffers.push(this.bakeLanding('stone', i))
    }

    // Generate jump whoosh
    this.jumpBuffer = this.bakeJumpWhoosh()
  }

  /** Offline-render a footstep into a buffer for zero-allocation playback */
  private bakeFootstep(surface: string, variant: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const duration = surface === 'snow' ? 0.14 : surface === 'wet' ? 0.12 : 0.09
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)

    const seed = variant * 1337 + surface.charCodeAt(0)
    let rng = seed
    const rand = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647 }

    switch (surface) {
      case 'dirt': {
        let prev = 0
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const attack = Math.min(1, t / 0.004)
          const decay = Math.exp(-t * 28)
          const noise = (rand() * 2 - 1) * decay * attack
          const smoothed = prev * 0.6 + noise * 0.4
          prev = smoothed
          const thud = Math.sin(t * 130 * Math.PI * 2) * Math.exp(-t * 50) * 0.25
          const grit = (rand() > 0.7 ? (rand() * 2 - 1) * 0.15 : 0) * Math.exp(-t * 20)
          data[i] = smoothed * 0.55 + thud + grit
        }
        break
      }
      case 'snow': {
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 18) * Math.min(1, t / 0.008)
          let noise = rand() * 2 - 1
          noise = Math.max(-0.3, Math.min(0.3, noise * 2))
          const squeak = Math.sin(t * (3000 + rand() * 1000) * Math.PI * 2) * 0.08 * Math.exp(-t * 40)
          data[i] = (noise + squeak) * env * 0.6
        }
        break
      }
      case 'wet': {
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 25) * Math.min(1, t / 0.003)
          const noise = (rand() * 2 - 1) * env * 0.5
          const bubbleFreq = 200 + t * 3000
          const bubble = Math.sin(t * bubbleFreq * Math.PI * 2) * Math.exp(-t * 50) * 0.2
          data[i] = noise + bubble
        }
        break
      }
      case 'sand': {
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 30) * Math.min(1, t / 0.004)
          const noise = (rand() * 2 - 1) * env
          const prev = i > 0 ? data[i - 1] : 0
          data[i] = (noise - prev * 0.7) * 0.4
        }
        break
      }
      case 'stone': {
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const attack = Math.min(1, t / 0.003)
          const clickDecay = Math.exp(-t * 45)
          const click = (rand() * 2 - 1) * clickDecay * attack * 0.35
          const thud = Math.sin(t * 200 * Math.PI * 2) * Math.exp(-t * 70) * 0.15
          const ring1 = Math.sin(t * 750 * Math.PI * 2) * Math.exp(-t * 35) * 0.08
          const ring2 = Math.sin(t * 810 * Math.PI * 2) * Math.exp(-t * 40) * 0.05
          data[i] = click + thud + ring1 + ring2
        }
        break
      }
    }

    return buf
  }

  /** Bake a landing impact buffer — heavier than footstep, longer tail */
  private bakeLanding(surface: string, variant: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const duration = surface === 'wet' ? 0.25 : surface === 'snow' ? 0.28 : 0.18
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)

    const seed = variant * 7919 + surface.charCodeAt(0) * 31
    let rng = seed
    const rand = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647 }

    switch (surface) {
      case 'dirt': {
        // Heavy thud + dirt scatter
        let prev = 0
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const attack = Math.min(1, t / 0.002)
          const decay = Math.exp(-t * 18)
          const noise = (rand() * 2 - 1) * decay * attack
          const smoothed = prev * 0.5 + noise * 0.5
          prev = smoothed
          // Deeper thud than footstep
          const thud = Math.sin(t * 80 * Math.PI * 2) * Math.exp(-t * 25) * 0.5
          // Secondary body
          const body = Math.sin(t * 60 * Math.PI * 2) * Math.exp(-t * 20) * 0.3
          // Scatter particles
          const scatter = (rand() > 0.6 ? (rand() * 2 - 1) * 0.2 : 0) * Math.exp(-t * 12)
          data[i] = smoothed * 0.4 + thud + body + scatter
        }
        break
      }
      case 'snow': {
        // Deep compression crunch
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 10) * Math.min(1, t / 0.005)
          let noise = rand() * 2 - 1
          noise = Math.max(-0.4, Math.min(0.4, noise * 2.5))
          const crunch = Math.sin(t * (1500 + rand() * 800) * Math.PI * 2) * 0.1 * Math.exp(-t * 15)
          const sub = Math.sin(t * 100 * Math.PI * 2) * Math.exp(-t * 20) * 0.2
          data[i] = (noise + crunch) * env * 0.5 + sub
        }
        break
      }
      case 'wet': {
        // Big splash with multiple bubbles
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 12) * Math.min(1, t / 0.002)
          const noise = (rand() * 2 - 1) * env * 0.6
          // Multiple bubble tones
          const b1 = Math.sin(t * (300 + t * 4000) * Math.PI * 2) * Math.exp(-t * 30) * 0.25
          const b2 = Math.sin(t * (400 + t * 3000) * Math.PI * 2) * Math.exp(-t * 25) * 0.15
          const b3 = Math.sin(t * (200 + t * 5000) * Math.PI * 2) * Math.exp(-t * 35) * 0.1
          data[i] = noise + b1 + b2 + b3
        }
        break
      }
      case 'sand': {
        // Soft fwump — low filtered noise
        let prev = 0
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const env = Math.exp(-t * 15) * Math.min(1, t / 0.003)
          const noise = (rand() * 2 - 1) * env
          const smoothed = prev * 0.8 + noise * 0.2
          prev = smoothed
          const sub = Math.sin(t * 50 * Math.PI * 2) * Math.exp(-t * 18) * 0.2
          data[i] = smoothed * 0.35 + sub
        }
        break
      }
      case 'stone': {
        // Sharp impact + long ring
        for (let i = 0; i < len; i++) {
          const t = i / sr
          const attack = Math.min(1, t / 0.001)
          const clickDecay = Math.exp(-t * 35)
          const click = (rand() * 2 - 1) * clickDecay * attack * 0.5
          // Heavier thud
          const thud = Math.sin(t * 150 * Math.PI * 2) * Math.exp(-t * 30) * 0.35
          // Longer ring
          const ring1 = Math.sin(t * 600 * Math.PI * 2) * Math.exp(-t * 15) * 0.12
          const ring2 = Math.sin(t * 720 * Math.PI * 2) * Math.exp(-t * 18) * 0.08
          const ring3 = Math.sin(t * 900 * Math.PI * 2) * Math.exp(-t * 22) * 0.05
          data[i] = click + thud + ring1 + ring2 + ring3
        }
        break
      }
    }

    return buf
  }

  /** Bake an upward-sweeping air whoosh for jumping */
  private bakeJumpWhoosh(): AudioBuffer {
    const sr = this.ctx.sampleRate
    const duration = 0.15
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)

    let rng = 12345
    const rand = () => { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647 }

    // Bandpass sweep 400 → 1200 Hz (applied via simple resonant filter)
    let y1 = 0, y2 = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const env = Math.sin(t / duration * Math.PI) // smooth arc envelope
      const noise = (rand() * 2 - 1) * env

      // Sweep center frequency
      const centerF = 400 + (t / duration) * 800
      const w0 = 2 * Math.PI * centerF / sr
      const q = 2
      const alpha = Math.sin(w0) / (2 * q)
      const b0 = alpha
      const a1 = -2 * Math.cos(w0)
      const a2 = 1 - alpha

      const out = (b0 * noise - a1 * y1 - a2 * y2) / (1 + alpha)
      y2 = y1
      y1 = out
      data[i] = out * 0.8
    }

    return buf
  }

  update(delta: number, speed: number, grounded: boolean, verticalVelocity: number, biome: BiomeType) {
    // Detect ground transitions
    if (this.wasGrounded && !grounded && verticalVelocity > 0) {
      this.playJump()
    } else if (!this.wasGrounded && grounded) {
      const impactSpeed = Math.abs(this.lastVerticalVelocity)
      if (impactSpeed > 2) { // only play for meaningful impacts
        this.playLanding(biome, impactSpeed)
      }
    }
    this.wasGrounded = grounded
    this.lastVerticalVelocity = verticalVelocity

    // Regular footstep logic
    if (!grounded || speed < 0.5) {
      this.stepTimer = 0
      return
    }

    const walkSpeed = 8
    this.stepInterval = 0.35 / Math.max(0.3, speed / walkSpeed)
    this.stepTimer += delta

    if (this.stepTimer >= this.stepInterval) {
      this.stepTimer -= this.stepInterval
      this.playStep(biome)
    }
  }

  private playJump() {
    const source = this.ctx.createBufferSource()
    source.buffer = this.jumpBuffer
    source.playbackRate.value = 0.9 + Math.random() * 0.2

    const gain = this.ctx.createGain()
    gain.gain.value = 0.012

    source.connect(gain)
    gain.connect(this.master)
    if (this.reverb) gain.connect(this.reverb.getSendNode())
    source.start()
    source.onended = () => { source.disconnect(); gain.disconnect() }
  }

  private playLanding(biome: BiomeType, impactSpeed: number) {
    const { landBuffers, volume } = this.getLandingSurface(biome)
    const buf = landBuffers[Math.floor(Math.random() * landBuffers.length)]

    const source = this.ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = 0.85 + Math.random() * 0.3

    // Scale volume by impact strength (normalized to jump speed)
    const intensity = Math.min(1, impactSpeed / JUMP_SPEED)
    const vol = 0.008 + intensity * 0.03 // 0.008 - 0.038 range

    const gain = this.ctx.createGain()
    gain.gain.value = vol * (volume / 0.07) // scale relative to surface base volume

    source.connect(gain)
    gain.connect(this.master)
    if (this.reverb) gain.connect(this.reverb.getSendNode())
    source.start()
    source.onended = () => { source.disconnect(); gain.disconnect() }
  }

  private playStep(biome: BiomeType) {
    const { buffers, volume } = this.getSurface(biome)
    const buf = buffers[Math.floor(Math.random() * buffers.length)]

    const source = this.ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = 0.9 + Math.random() * 0.2

    const gain = this.ctx.createGain()
    gain.gain.value = volume

    source.connect(gain)
    gain.connect(this.master)
    if (this.reverb) gain.connect(this.reverb.getSendNode())
    source.start()
    source.onended = () => { source.disconnect(); gain.disconnect() }
  }

  private getSurface(biome: BiomeType): { buffers: AudioBuffer[]; volume: number } {
    switch (biome) {
      case BiomeType.Swamp:
      case BiomeType.CoralReef:
        return { buffers: this.wetBuffers, volume: 0.025 }
      case BiomeType.Snow:
        return { buffers: this.snowBuffers, volume: 0.018 }
      case BiomeType.Desert:
        return { buffers: this.sandBuffers, volume: 0.015 }
      case BiomeType.Volcanic:
      case BiomeType.Mesa:
      case BiomeType.Crystal:
        return { buffers: this.stoneBuffers, volume: 0.02 }
      default:
        return { buffers: this.dirtBuffers, volume: 0.02 }
    }
  }

  private getLandingSurface(biome: BiomeType): { landBuffers: AudioBuffer[]; volume: number } {
    switch (biome) {
      case BiomeType.Swamp:
      case BiomeType.CoralReef:
        return { landBuffers: this.wetLandBuffers, volume: 0.025 }
      case BiomeType.Snow:
        return { landBuffers: this.snowLandBuffers, volume: 0.018 }
      case BiomeType.Desert:
        return { landBuffers: this.sandLandBuffers, volume: 0.015 }
      case BiomeType.Volcanic:
      case BiomeType.Mesa:
      case BiomeType.Crystal:
        return { landBuffers: this.stoneLandBuffers, volume: 0.02 }
      default:
        return { landBuffers: this.dirtLandBuffers, volume: 0.02 }
    }
  }
}
