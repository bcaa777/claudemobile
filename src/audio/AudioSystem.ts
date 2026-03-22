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

      // Environment reverb first — other systems route through it
      this.environmentReverb = new EnvironmentReverb(this.ctx, this.masterGain)

      this.wind = new WindSound(this.ctx, this.masterGain)
      this.footstep = new FootstepSound(this.ctx, this.masterGain, this.environmentReverb)
      this.weather = new WeatherSound(this.ctx, this.masterGain)
      this.creatureSound = new CreatureSound(this.ctx, this.masterGain, this.environmentReverb)
      this.chime = new ChimeSound(this.ctx, this.masterGain)
      this.music = new BiomeMusic(this.ctx, this.masterGain)
      this.spatialMelody = new SpatialMelody(this.ctx, this.masterGain, this.environmentReverb)
      this.ambience = new AmbienceSound(this.ctx, this.masterGain, this.environmentReverb)

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
    this.music?.setVolume(this.musicVolume)
    this.music?.update(delta, biome, musicContext)
    this.ambience?.setVolume(this.ambientVolume)
    this.ambience?.update(delta, biome)
    if (landmarks) {
      this.spatialMelody?.update(delta, playerPos, landmarks, runePositions ?? [])
    }
  }
}
