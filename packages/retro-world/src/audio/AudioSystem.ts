import * as THREE from 'three'
import { AudioSystem as EngineAudioSystem, updateListener } from '@engine/core'
import type { AudioLayerConfig } from '@engine/core'
import { BiomeType } from '../biomes/types'
import { WeatherType } from '../systems/WeatherSystem'
import { Creature } from '../creatures/Creature'
import { WorldState } from '../systems/WorldState'
import { WindSound } from './WindSound'
import { FootstepSound } from './FootstepSound'
import { WeatherSound } from './WeatherSound'
import { CreatureSound } from './CreatureSound'
import { ChimeSound } from './ChimeSound'
import { BiomeMusic, MusicContext } from './BiomeMusic'
import { SpatialMelody } from './SpatialMelody'
import { EnvironmentReverb } from './EnvironmentReverb'
import { AmbienceSound } from './AmbienceSound'

const MUTE_KEY = 'audio_muted'

const AUDIO_LAYERS: AudioLayerConfig[] = [
  { name: 'ambience', gain: 1.0 },
  { name: 'music', gain: 0.7 },
  { name: 'creatures', gain: 0.8 },
  { name: 'sfx', gain: 0.8 },
  { name: 'harmonic', gain: 0.3 },
  { name: 'uiChimes', gain: 0.8 },
]

export class AudioSystem {
  private engine = new EngineAudioSystem()

  private wind: WindSound | null = null
  private footstep: FootstepSound | null = null
  private weather: WeatherSound | null = null
  private creatureSound: CreatureSound | null = null
  chime: ChimeSound | null = null
  private music: BiomeMusic | null = null
  private spatialMelody: SpatialMelody | null = null
  private environmentReverb: EnvironmentReverb | null = null
  private ambience: AmbienceSound | null = null
  private muteEl: HTMLElement | null

  /** Debug volume multipliers (0–1, default 1) */
  public musicVolume = 1
  public ambientVolume = 1

  /** Expose AudioContext and master gain for external tone systems (e.g., HarmonicTone) */
  getContext(): AudioContext | null { return this.engine.getContext() }
  getMasterGain(): GainNode | null { return this.engine.getMasterGain() }
  /** Expose the harmonic-tone layer gain so HarmonicTone routes through it */
  getHarmonicGain(): GainNode | null { return this.engine.getLayer('harmonic') }

  constructor() {
    this.muteEl = document.getElementById('mute-hud')
    const wasMuted = localStorage.getItem(MUTE_KEY) === '1'
    if (wasMuted) this.engine.setMuted(true)
    this.updateMuteDisplay()
  }

  /** Must be called from a user gesture (e.g., overlay click) */
  init() {
    if (this.engine.initialized) return
    this.engine.init(AUDIO_LAYERS)

    const ctx = this.engine.getContext()
    const masterGain = this.engine.getMasterGain()
    if (!ctx || !masterGain) return

    const sfxGain = this.engine.getLayer('sfx')!
    const creaturesGain = this.engine.getLayer('creatures')!
    const musicGain = this.engine.getLayer('music')!
    const ambienceGain = this.engine.getLayer('ambience')!
    const uiChimesGain = this.engine.getLayer('uiChimes')!

    // Environment reverb routes through master directly (it's a send bus)
    this.environmentReverb = new EnvironmentReverb(ctx, masterGain)

    // SFX layer: wind, footsteps, weather
    this.wind = new WindSound(ctx, sfxGain)
    this.footstep = new FootstepSound(ctx, sfxGain, this.environmentReverb)
    this.weather = new WeatherSound(ctx, sfxGain)

    // Creatures layer
    this.creatureSound = new CreatureSound(ctx, creaturesGain, this.environmentReverb)

    // UI chimes layer
    this.chime = new ChimeSound(ctx, uiChimesGain)

    // Music layer
    this.music = new BiomeMusic(ctx, musicGain)

    // SpatialMelody — discovery/landmark melodies, part of ambience layer
    this.spatialMelody = new SpatialMelody(ctx, ambienceGain, this.environmentReverb)

    // Ambience layer
    this.ambience = new AmbienceSound(ctx, ambienceGain, this.environmentReverb)
  }

  toggleMute() {
    this.engine.toggleMute()
    localStorage.setItem(MUTE_KEY, this.engine.muted ? '1' : '0')
    this.updateMuteDisplay()
  }

  private updateMuteDisplay() {
    if (this.muteEl) {
      this.muteEl.textContent = this.engine.muted ? '🔇 MUTED' : ''
      this.muteEl.style.display = this.engine.muted ? 'block' : 'none'
    }
  }

  update(
    delta: number,
    biome: BiomeType,
    weatherType: WeatherType,
    altitude: number,
    speed: number,
    grounded: boolean,
    playerPos: THREE.Vector3,
    creatures: Map<string, Creature>,
    camera: THREE.Camera,
    verticalVelocity: number,
    landmarks?: Map<BiomeType, THREE.Vector3>,
    runePositions?: THREE.Vector3[],
    worldState?: WorldState,
  ) {
    if (!this.engine.initialized) return
    const ctx = this.engine.getContext()
    if (!ctx) return
    this.engine.resume()

    // Update listener position/orientation for HRTF spatial audio
    updateListener(ctx, camera)

    // Update biome-specific reverb
    this.environmentReverb?.update(biome)

    const isBlizzard = weatherType === WeatherType.Blizzard
    const weatherIntensity =
      weatherType === WeatherType.Clear ? 0 :
      weatherType === WeatherType.Fog ? 0.1 :
      weatherType === WeatherType.Snow ? 0.3 :
      weatherType === WeatherType.Rain ? 0.4 :
      weatherType === WeatherType.HeavyRain ? 0.7 :
      weatherType === WeatherType.Blizzard ? 0.9 :
      weatherType === WeatherType.Sandstorm ? 0.6 :
      0.3

    this.wind?.update(altitude, weatherIntensity, isBlizzard)
    this.footstep?.update(delta, speed, grounded, verticalVelocity, biome)
    this.weather?.update(delta, weatherType)
    this.creatureSound?.update(delta, playerPos, creatures, worldState)
    const musicContext: MusicContext = {
      weatherSeverity: weatherIntensity,
      playerSpeed: speed,
      playerPos,
      creatures,
    }
    // Apply debug volume multipliers to layer gain nodes
    this.engine.setLayerGain('music', 0.7 * this.musicVolume)
    this.engine.setLayerGain('ambience', 1.0 * this.ambientVolume)
    this.music?.update(delta, biome, musicContext)
    this.ambience?.update(delta, biome)
    if (landmarks) {
      this.spatialMelody?.update(delta, playerPos, landmarks, runePositions ?? [])
    }
  }
}
