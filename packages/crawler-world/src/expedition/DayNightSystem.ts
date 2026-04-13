import * as THREE from 'three'
import type { GodRayPass } from '@engine/core'

// Colour stops for sky/fog
const SKY_NIGHT   = new THREE.Color(0x101828)
const SKY_DAWN    = new THREE.Color(0xe05020)
const SKY_DAY     = new THREE.Color(0x4488cc)
const SKY_DUSK    = new THREE.Color(0xd04010)

// Sun light colours
const SUN_NOON   = new THREE.Color(0xfff8e0)
const SUN_DAWN   = new THREE.Color(0xff9040)
const SUN_NIGHT  = new THREE.Color(0x2030aa)

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, t)
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

export class DayNightSystem {
  private sun: THREE.DirectionalLight | null = null
  private ambient: THREE.AmbientLight | null = null
  private godRayPass: GodRayPass | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private scene: THREE.Scene | null = null

  /** Fixed time-of-day per biome (0-1). null = use cycling. */
  private fixedTime: number | null = null
  /** Biome-specific god ray intensity multiplier */
  private _biomeGodRayIntensity = 1.0

  private _sunDirection = new THREE.Vector3(0, 1, 0)
  private _sunColor = new THREE.Color(0xfff8e0)

  get sunDirection(): THREE.Vector3 { return this._sunDirection }
  get sunColor(): THREE.Color { return this._sunColor }

  setBiomeGodRayIntensity(value: number): void {
    this._biomeGodRayIntensity = value
  }

  /** Set a fixed time-of-day. 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk. null=cycling. */
  setFixedTime(t: number | null): void {
    this.fixedTime = t
  }

  getDayFraction(): number {
    return this.fixedTime ?? 0.5
  }

  init(
    sun: THREE.DirectionalLight,
    ambient: THREE.AmbientLight,
    godRayPass: GodRayPass,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
  ) {
    this.sun = sun
    this.ambient = ambient
    this.godRayPass = godRayPass
    this.camera = camera
    this.scene = scene
  }

  update(_delta: number) {
    if (!this.sun || !this.ambient || !this.godRayPass || !this.camera || !this.scene) return

    const t = this.fixedTime ?? 0.5

    // --- Sun orbit
    const angle = t * Math.PI * 2
    const sunX = -Math.cos(angle) * 200
    const sunY = Math.sin(angle) * 200
    const sunZ = 60
    this.sun.position.set(sunX, sunY, sunZ)
    this._sunDirection.set(sunX, sunY, sunZ).normalize()

    // --- Sun intensity
    const dayFraction = Math.max(0, Math.sin(angle))
    const sunIntensity = 0.05 + dayFraction * dayFraction * 1.15
    this.sun.intensity = sunIntensity

    // --- Sun colour
    let sunColor: THREE.Color
    if (dayFraction < 0.2) {
      sunColor = lerpColor(SUN_NIGHT, SUN_DAWN, smoothstep(dayFraction / 0.2))
    } else if (dayFraction < 0.5) {
      sunColor = lerpColor(SUN_DAWN, SUN_NOON, smoothstep((dayFraction - 0.2) / 0.3))
    } else {
      sunColor = SUN_NOON.clone()
    }
    this.sun.color.set(sunColor)
    this._sunColor.copy(sunColor)

    // --- Ambient
    const ambientIntensity = 0.20 + dayFraction * 0.45
    this.ambient.intensity = ambientIntensity
    this.ambient.color.set(lerpColor(SKY_NIGHT, new THREE.Color(0xaaccff), dayFraction))

    // --- Sky/fog colour
    let skyColor: THREE.Color
    if (dayFraction < 0.15) {
      skyColor = lerpColor(SKY_NIGHT, SKY_DAWN, smoothstep(dayFraction / 0.15))
    } else if (dayFraction < 0.35) {
      skyColor = lerpColor(SKY_DAWN, SKY_DAY, smoothstep((dayFraction - 0.15) / 0.2))
    } else if (dayFraction < 0.7) {
      skyColor = SKY_DAY.clone()
    } else if (dayFraction < 0.85) {
      skyColor = lerpColor(SKY_DAY, SKY_DUSK, smoothstep((dayFraction - 0.7) / 0.15))
    } else {
      skyColor = lerpColor(SKY_DUSK, SKY_NIGHT, smoothstep((dayFraction - 0.85) / 0.15))
    }
    this.scene.background = skyColor

    if (this.scene.fog) {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set(skyColor)
      } else if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set(skyColor)
      }
    }

    // --- God rays
    const godRayIntensity = dayFraction > 0.05 ? dayFraction * 0.9 * this._biomeGodRayIntensity : 0
    this.godRayPass.setIntensity(godRayIntensity)

    if (godRayIntensity > 0) {
      const sunWorld = this.sun.position.clone()
      const proj = sunWorld.project(this.camera)
      const screenX = (proj.x + 1) * 0.5
      const screenY = (proj.y + 1) * 0.5
      this.godRayPass.setSunPosition(screenX, screenY)
    }
  }
}
