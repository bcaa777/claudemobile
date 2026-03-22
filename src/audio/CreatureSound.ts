import * as THREE from 'three'
import { Creature } from '../creatures/Creature'
import { SPECIES, SpeciesId } from '../creatures/Species'
import { EnvironmentReverb } from './EnvironmentReverb'
import { createSpatialPanner } from './SpatialAudioHelper'
import { WorldState } from '../systems/WorldState'

const MAX_CREATURES = 3
/** Creatures beyond this distance are inaudible */
const MAX_RANGE = 60
const MAX_RANGE_SQ = MAX_RANGE * MAX_RANGE // 3600
/** Creatures within this distance play at full volume */
const FULL_VOLUME_RANGE = 10

/** Interval (seconds) for rhythmic calls near Resonance Sites */
const SITE_CALL_INTERVAL = 2.0

export class CreatureSound {
  private ctx: AudioContext
  private master: GainNode
  private reverb: EnvironmentReverb | null
  private callTimer = 0
  private callInterval = 4 + Math.random() * 4

  /** Elapsed time accumulator for global sync clock */
  private elapsedTime = 0

  constructor(ctx: AudioContext, master: GainNode, reverb?: EnvironmentReverb) {
    this.ctx = ctx
    this.master = master
    this.reverb = reverb ?? null
  }

  update(delta: number, playerPos: THREE.Vector3, creatures: Map<string, Creature>, worldState?: WorldState) {
    this.elapsedTime += delta
    this.callTimer -= delta
    if (this.callTimer > 0) return

    this.callTimer = this.callInterval
    this.callInterval = 4 + Math.random() * 5

    // Find up to MAX_CREATURES nearest living creatures within range
    const candidates: { creature: Creature; distSq: number }[] = []
    for (const c of creatures.values()) {
      if (c.state === 'dead' || c.state === 'sleep') continue
      const dx = c.position.x - playerPos.x
      const dz = c.position.z - playerPos.z
      const distSq = dx * dx + dz * dz
      if (distSq < MAX_RANGE_SQ) {
        candidates.push({ creature: c, distSq })
      }
    }

    // Sort by distance, take closest
    candidates.sort((a, b) => a.distSq - b.distSq)
    const count = Math.min(candidates.length, MAX_CREATURES)

    // Determine current biome stability from player's biome (creatures near player share similar biome)
    const playerBiome = worldState?.playerBiome
    const biomeStability = playerBiome !== undefined
      ? (worldState?.biomeStability.get(playerBiome) ?? 1.0)
      : 1.0
    const isUnstable = biomeStability < 0.5

    for (let i = 0; i < count; i++) {
      const { creature, distSq } = candidates[i]
      // Distance attenuation: full volume within FULL_VOLUME_RANGE, linear falloff to 0 at MAX_RANGE
      const dist = Math.sqrt(distSq)
      const attenuated = dist <= FULL_VOLUME_RANGE
        ? 1.0
        : 1.0 - (dist - FULL_VOLUME_RANGE) / (MAX_RANGE - FULL_VOLUME_RANGE)
      const volume = Math.max(0, 0.07 * attenuated)

      const isNearSite = creature.state === 'reverence' || creature.state === 'resonating'
      const sp = SPECIES[creature.species]
      const isPredator = sp.role === 'predator'

      // Predators go silent near Resonance Sites (truce zone)
      if (isNearSite && isPredator && creature.state === 'idle') continue

      // Compute frequency multiplier and timing
      let freqMultiplier = 1.0
      let extraDelay = 0

      if (isNearSite) {
        // Pitch shifts up slightly near sites
        freqMultiplier = 1.15

        // Synchronize herbivore calls to global clock (rhythm every SITE_CALL_INTERVAL seconds)
        if (!isPredator) {
          const syncPhase = this.elapsedTime % SITE_CALL_INTERVAL
          // Align next fire to the nearest sync boundary with a small per-creature offset
          const syncOffset = (i * 0.15) % SITE_CALL_INTERVAL
          extraDelay = ((SITE_CALL_INTERVAL - syncPhase + syncOffset) % SITE_CALL_INTERVAL)
          // Cap delay so it doesn't push too far out
          if (extraDelay > SITE_CALL_INTERVAL) extraDelay = 0
          // Next interval should also be rhythmic
          if (i === 0) {
            this.callInterval = SITE_CALL_INTERVAL
          }
        }
      } else if (isUnstable) {
        // Destabilization zone: pitch jitter ±20%
        freqMultiplier = 0.8 + Math.random() * 0.4
        // Random timing delays 0-1 seconds
        extraDelay = Math.random()
      }

      // Stagger calls slightly so they don't all play at the exact same instant
      const staggerDelay = i * (0.3 + Math.random() * 0.5)
      const totalDelay = staggerDelay + extraDelay

      if (totalDelay > 0) {
        setTimeout(
          () => this.playCall(creature.species, volume, creature.position, freqMultiplier),
          totalDelay * 1000,
        )
      } else {
        this.playCall(creature.species, volume, creature.position, freqMultiplier)
      }
    }
  }

  private createOutput(position: THREE.Vector3): { output: AudioNode; cleanup: () => void } {
    const panner = createSpatialPanner(this.ctx, position.x, position.y, position.z)
    panner.connect(this.master)
    if (this.reverb) panner.connect(this.reverb.getSendNode())
    return {
      output: panner,
      cleanup: () => panner.disconnect(),
    }
  }

  private playCall(species: SpeciesId, volume: number, position: THREE.Vector3, freqMultiplier = 1.0) {
    const sp = SPECIES[species]
    const { output, cleanup } = this.createOutput(position)

    if (sp.mobility === 'air' && sp.role === 'herbivore') {
      this.playBirdSong(volume, species, output, cleanup, freqMultiplier)
    } else if (species === 'wolf' || species === 'hellhound') {
      this.playWolfHowl(volume, species === 'hellhound', output, cleanup, freqMultiplier)
    } else if (species === 'toad') {
      this.playToadCroak(volume, output, cleanup, freqMultiplier)
    } else if (species === 'bear') {
      this.playBearGrowl(volume, output, cleanup, freqMultiplier)
    } else if (species === 'lion') {
      this.playLionRumble(volume, output, cleanup, freqMultiplier)
    } else if (species === 'deer' || species === 'goat' || species === 'mammoth') {
      this.playHerbivoreCall(volume, output, cleanup, freqMultiplier)
    } else if (species === 'dragon') {
      this.playDragonRoar(volume, output, cleanup, freqMultiplier)
    } else if (species === 'crab' || species === 'scorpion') {
      this.playChittering(volume, output, cleanup, freqMultiplier)
    } else if (sp.role === 'predator') {
      this.playPredatorGrowl(volume, output, cleanup)
    } else {
      this.playAmbientRustle(volume, output, cleanup)
    }
  }

  /** Bird song — FM synthesis with rapid pitch sweeps */
  private playBirdSong(volume: number, species: SpeciesId, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const isParrot = species === 'parrot'
    const noteCount = 2 + Math.floor(Math.random() * 3)
    const baseFreq = (isParrot ? 1600 + Math.random() * 600 : 2200 + Math.random() * 800) * freqMult
    let lastStopTime = now

    for (let n = 0; n < noteCount; n++) {
      const noteStart = now + n * (0.08 + Math.random() * 0.06)
      const noteDur = 0.04 + Math.random() * 0.06

      const carrier = this.ctx.createOscillator()
      carrier.type = 'sine'
      const noteFreq = baseFreq + (Math.random() - 0.5) * 400
      carrier.frequency.setValueAtTime(noteFreq, noteStart)
      carrier.frequency.linearRampToValueAtTime(noteFreq + (Math.random() - 0.3) * 600, noteStart + noteDur)

      const mod = this.ctx.createOscillator()
      mod.type = 'sine'
      mod.frequency.value = 25 + Math.random() * 15
      const modGain = this.ctx.createGain()
      modGain.gain.value = 50 + Math.random() * 30
      mod.connect(modGain).connect(carrier.frequency)

      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.001, noteStart)
      env.gain.linearRampToValueAtTime(volume, noteStart + 0.005)
      env.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDur)

      carrier.connect(env).connect(output)

      const stopTime = noteStart + noteDur + 0.01
      carrier.start(noteStart)
      carrier.stop(stopTime)
      mod.start(noteStart)
      mod.stop(stopTime)
      if (stopTime > lastStopTime) lastStopTime = stopTime

      carrier.onended = () => { carrier.disconnect(); env.disconnect(); mod.disconnect(); modGain.disconnect() }
    }

    // Cleanup panner after all notes done
    setTimeout(cleanupPanner, (lastStopTime - now) * 1000 + 50)
  }

  /** Wolf howl — rich harmonic sweep with breathy noise layer */
  private playWolfHowl(volume: number, isHellhound: boolean, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 1.2 + Math.random() * 0.8
    const baseFreq = (isHellhound ? 90 : 150) * freqMult

    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      const detune = i === 0 ? 0 : 3 + Math.random() * 4
      osc.frequency.setValueAtTime(baseFreq + detune, now)
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, now + dur * 0.3)
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.3, now + dur * 0.7)
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.8, now + dur)

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = isHellhound ? 300 : 500
      filter.Q.value = 2

      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.001, now)
      env.gain.linearRampToValueAtTime(volume * 0.6, now + dur * 0.15)
      env.gain.setValueAtTime(volume * 0.6, now + dur * 0.5)
      env.gain.exponentialRampToValueAtTime(0.001, now + dur)

      osc.connect(filter).connect(env).connect(output)
      osc.start(now)
      osc.stop(now + dur)
      osc.onended = () => { osc.disconnect(); filter.disconnect(); env.disconnect() }
    }

    this.playBreathLayer(now, dur, volume * 0.3, 400, output)
    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Toad croak — FM-synthesized resonant burst */
  private playToadCroak(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 0.15 + Math.random() * 0.1

    const carrier = this.ctx.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = (120 + Math.random() * 40) * freqMult

    const mod = this.ctx.createOscillator()
    mod.type = 'sine'
    mod.frequency.value = (60 + Math.random() * 20) * freqMult
    const modGain = this.ctx.createGain()
    modGain.gain.value = 80
    mod.connect(modGain).connect(carrier.frequency)

    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.001, now)
    env.gain.linearRampToValueAtTime(volume, now + 0.01)
    env.gain.exponentialRampToValueAtTime(0.001, now + dur)

    carrier.connect(env).connect(output)
    carrier.start(now)
    carrier.stop(now + dur + 0.01)
    mod.start(now)
    mod.stop(now + dur + 0.01)

    carrier.onended = () => { carrier.disconnect(); env.disconnect(); mod.disconnect(); modGain.disconnect() }

    // Often comes in pairs — second croak reuses same panner
    if (Math.random() > 0.4) {
      const delay = (dur + 0.05) * 1000
      setTimeout(() => {
        const c2 = this.ctx.createOscillator()
        c2.type = 'sine'
        c2.frequency.value = (120 + Math.random() * 40) * freqMult
        const m2 = this.ctx.createOscillator()
        m2.type = 'sine'
        m2.frequency.value = (60 + Math.random() * 20) * freqMult
        const mg2 = this.ctx.createGain()
        mg2.gain.value = 80
        m2.connect(mg2).connect(c2.frequency)
        const e2 = this.ctx.createGain()
        const t = this.ctx.currentTime
        e2.gain.setValueAtTime(0.001, t)
        e2.gain.linearRampToValueAtTime(volume * 0.7, t + 0.01)
        e2.gain.exponentialRampToValueAtTime(0.001, t + dur)
        c2.connect(e2).connect(output)
        c2.start(t)
        c2.stop(t + dur + 0.01)
        m2.start(t)
        m2.stop(t + dur + 0.01)
        c2.onended = () => { c2.disconnect(); e2.disconnect(); m2.disconnect(); mg2.disconnect(); cleanupPanner() }
      }, delay)
      return
    }

    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Bear growl — low noise through resonant filter */
  private playBearGrowl(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 0.6 + Math.random() * 0.4
    this.playBreathLayer(now, dur, volume, 200, output)

    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = (60 + Math.random() * 20) * freqMult

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 150
    filter.Q.value = 3

    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.001, now)
    env.gain.linearRampToValueAtTime(volume * 0.5, now + 0.05)
    env.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(filter).connect(env).connect(output)
    osc.start(now)
    osc.stop(now + dur)
    osc.onended = () => { osc.disconnect(); filter.disconnect(); env.disconnect() }

    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Lion rumble — chest-deep resonance */
  private playLionRumble(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 0.8 + Math.random() * 0.5

    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = i === 0 ? 'sawtooth' : 'triangle'
      osc.frequency.value = (70 + i * 5 + Math.random() * 10) * freqMult

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(250, now)
      filter.frequency.linearRampToValueAtTime(120, now + dur)
      filter.Q.value = 4

      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.001, now)
      env.gain.linearRampToValueAtTime(volume * 0.5, now + 0.04)
      env.gain.exponentialRampToValueAtTime(0.001, now + dur)

      osc.connect(filter).connect(env).connect(output)
      osc.start(now)
      osc.stop(now + dur)
      osc.onended = () => { osc.disconnect(); filter.disconnect(); env.disconnect() }
    }

    this.playBreathLayer(now, dur * 0.6, volume * 0.4, 300, output)
    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Dragon roar — distorted low sweep with noise burst */
  private playDragonRoar(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 0.8 + Math.random() * 0.6

    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(50 * freqMult, now)
    osc.frequency.linearRampToValueAtTime(120 * freqMult, now + dur * 0.2)
    osc.frequency.linearRampToValueAtTime(40 * freqMult, now + dur)

    const shaper = this.ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1
      curve[i] = Math.tanh(x * 3)
    }
    shaper.curve = curve

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 200
    filter.Q.value = 5

    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.001, now)
    env.gain.linearRampToValueAtTime(volume * 0.7, now + 0.03)
    env.gain.exponentialRampToValueAtTime(0.001, now + dur)

    osc.connect(shaper).connect(filter).connect(env).connect(output)
    osc.start(now)
    osc.stop(now + dur)
    osc.onended = () => { osc.disconnect(); shaper.disconnect(); filter.disconnect(); env.disconnect() }

    this.playBreathLayer(now, dur * 0.5, volume * 0.5, 250, output)
    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Herbivore call — gentle bleat/huff */
  private playHerbivoreCall(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const dur = 0.2 + Math.random() * 0.15

    const carrier = this.ctx.createOscillator()
    carrier.type = 'triangle'
    const freq = (300 + Math.random() * 150) * freqMult
    carrier.frequency.setValueAtTime(freq, now)
    carrier.frequency.linearRampToValueAtTime(freq * 0.8, now + dur)

    const vib = this.ctx.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = 6
    const vibGain = this.ctx.createGain()
    vibGain.gain.value = 15
    vib.connect(vibGain).connect(carrier.frequency)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = 1.5

    const env = this.ctx.createGain()
    env.gain.setValueAtTime(0.001, now)
    env.gain.linearRampToValueAtTime(volume, now + 0.015)
    env.gain.exponentialRampToValueAtTime(0.001, now + dur)

    carrier.connect(filter).connect(env).connect(output)
    carrier.start(now)
    carrier.stop(now + dur + 0.01)
    vib.start(now)
    vib.stop(now + dur + 0.01)
    carrier.onended = () => { carrier.disconnect(); filter.disconnect(); env.disconnect(); vib.disconnect(); vibGain.disconnect() }

    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Chittering (insects, crabs) — rapid noise-based clicks */
  private playChittering(volume: number, output: AudioNode, cleanupPanner: () => void, freqMult = 1.0) {
    const now = this.ctx.currentTime
    const clicks = 3 + Math.floor(Math.random() * 4)
    const sr = this.ctx.sampleRate
    let maxTime = 0

    for (let i = 0; i < clicks; i++) {
      const t = now + i * (0.03 + Math.random() * 0.04)
      const dur = 0.02 + Math.random() * 0.015

      const len = Math.floor(sr * dur)
      const buf = this.ctx.createBuffer(1, len, sr)
      const data = buf.getChannelData(0)
      let prev = 0
      for (let j = 0; j < len; j++) {
        const s = j / sr
        const attack = Math.min(1, s / 0.001)
        const white = Math.random() * 2 - 1
        prev = prev * 0.3 + white * 0.7
        const tone = Math.sin(s * (1200 + Math.random() * 800) * freqMult * Math.PI * 2) * 0.3
        data[j] = (prev * 0.7 + tone) * Math.exp(-s * 60) * attack
      }

      const source = this.ctx.createBufferSource()
      source.buffer = buf

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = (2000 + Math.random() * 2000) * freqMult
      filter.Q.value = 1.5

      const env = this.ctx.createGain()
      env.gain.setValueAtTime(0.001, t)
      env.gain.linearRampToValueAtTime(volume * 0.3, t + 0.002)
      env.gain.exponentialRampToValueAtTime(0.001, t + dur)

      source.connect(filter).connect(env).connect(output)
      source.start(t)
      source.onended = () => { source.disconnect(); filter.disconnect(); env.disconnect() }

      const endTime = t + dur - now
      if (endTime > maxTime) maxTime = endTime
    }

    setTimeout(cleanupPanner, maxTime * 1000 + 100)
  }

  /** Generic predator growl */
  private playPredatorGrowl(volume: number, output: AudioNode, cleanupPanner: () => void) {
    const now = this.ctx.currentTime
    const dur = 0.3 + Math.random() * 0.3
    this.playBreathLayer(now, dur, volume * 0.6, 250, output)
    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Ambient rustle — very quiet noise texture */
  private playAmbientRustle(volume: number, output: AudioNode, cleanupPanner: () => void) {
    const now = this.ctx.currentTime
    const dur = 0.15 + Math.random() * 0.1
    this.playBreathLayer(now, dur, volume * 0.3, 600, output)
    setTimeout(cleanupPanner, dur * 1000 + 100)
  }

  /** Reusable breathy noise layer — shaped noise through resonant filter */
  private playBreathLayer(startTime: number, duration: number, volume: number, filterFreq: number, output: AudioNode) {
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * duration)
    const buf = this.ctx.createBuffer(1, len, sr)
    const data = buf.getChannelData(0)

    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.04 * white) / 1.04
      const t = i / sr
      const env = Math.min(1, t / 0.02) * Math.exp(-t / (duration * 0.5))
      data[i] = last * 4 * env
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buf

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 2

    const gain = this.ctx.createGain()
    gain.gain.value = volume

    source.connect(filter).connect(gain).connect(output)
    source.start(startTime)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }
}
