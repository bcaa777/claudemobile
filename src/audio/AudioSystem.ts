import * as THREE from 'three'
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
import { updateListener } from './SpatialAudioHelper'

const MUTE_KEY = 'audio_muted'

export class AudioSystem {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null

  // ── Per-layer gain nodes ──────────────────────────────
  // Master gain: 1.0
  // ├── Ambience:        0.6
  // ├── Music:           0.35
  // ├── Creatures:       0.4
  // ├── SFX:             0.5  (footsteps, weather, interactions)
  // ├── Harmonic tones:  0.15
  // └── UI chimes:       0.6
  private ambienceGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private creaturesGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private harmonicGain: GainNode | null = null
  private uiChimesGain: GainNode | null = null

  private wind: WindSound | null = null
  private footstep: FootstepSound | null = null
  private weather: WeatherSound | null = null
  private creatureSound: CreatureSound | null = null
  chime: ChimeSound | null = null
  private music: BiomeMusic | null = null
  private spatialMelody: SpatialMelody | null = null
  private environmentReverb: EnvironmentReverb | null = null
  private ambience: AmbienceSound | null = null
  private initialized = false
  private muted = false
  private muteEl: HTMLElement | null

  /** Debug volume multipliers (0–1, default 1) */
  public musicVolume = 1
  public ambientVolume = 1

  /** Expose AudioContext and master gain for external tone systems (e.g., HarmonicTone) */
  getContext(): AudioContext | null { return this.ctx }
  getMasterGain(): GainNode | null { return this.masterGain }
  /** Expose the harmonic-tone layer gain so HarmonicTone routes through it */
  getHarmonicGain(): GainNode | null { return this.harmonicGain }

  constructor() {
    this.muteEl = document.getElementById('mute-hud')
    this.muted = localStorage.getItem(MUTE_KEY) === '1'
    this.updateMuteDisplay()
  }

  /** Must be called from a user gesture (e.g., overlay click) */
  init() {
    if (this.initialized) return
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.muted ? 0 : 1
      this.masterGain.connect(this.ctx.destination)

      // ── Create per-layer gain nodes and connect to master ──
      const makeLayer = (gain: number): GainNode => {
        const node = this.ctx!.createGain()
        node.gain.value = gain
        node.connect(this.masterGain!)
        return node
      }
      this.ambienceGain  = makeLayer(0.6)
      this.musicGain     = makeLayer(0.35)
      this.creaturesGain = makeLayer(0.4)
      this.sfxGain       = makeLayer(0.5)
      this.harmonicGain  = makeLayer(0.15)
      this.uiChimesGain  = makeLayer(0.6)

      // Environment reverb routes through master directly (it's a send bus)
      this.environmentReverb = new EnvironmentReverb(this.ctx, this.masterGain)

      // SFX layer: wind, footsteps, weather
      this.wind     = new WindSound(this.ctx, this.sfxGain)
      this.footstep = new FootstepSound(this.ctx, this.sfxGain, this.environmentReverb)
      this.weather  = new WeatherSound(this.ctx, this.sfxGain)

      // Creatures layer
      this.creatureSound = new CreatureSound(this.ctx, this.creaturesGain, this.environmentReverb)

      // UI chimes layer
      this.chime = new ChimeSound(this.ctx, this.uiChimesGain)

      // Music layer (BiomeMusic manages its own internal gain on top of musicGain)
      this.music = new BiomeMusic(this.ctx, this.musicGain)

      // SpatialMelody — discovery/landmark melodies, part of ambience layer
      this.spatialMelody = new SpatialMelody(this.ctx, this.ambienceGain, this.environmentReverb)

      // Ambience layer
      this.ambience = new AmbienceSound(this.ctx, this.ambienceGain, this.environmentReverb)

      this.initialized = true
    } catch {
      // Web Audio not available
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

  private updateMuteDisplay() {
    if (this.muteEl) {
      this.muteEl.textContent = this.muted ? '🔇 MUTED' : ''
      this.muteEl.style.display = this.muted ? 'block' : 'none'
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
    if (!this.initialized || !this.ctx) return
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    // Update listener position/orientation for HRTF spatial audio
    updateListener(this.ctx, camera)

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
    if (this.musicGain) this.musicGain.gain.value = 0.35 * this.musicVolume
    if (this.ambienceGain) this.ambienceGain.gain.value = 0.6 * this.ambientVolume
    this.music?.update(delta, biome, musicContext)
    this.ambience?.update(delta, biome)
    if (landmarks) {
      this.spatialMelody?.update(delta, playerPos, landmarks, runePositions ?? [])
    }
  }
}
