import * as THREE from 'three'
import type { GodRayPass } from '@engine/core'

// Full day cycle in seconds (10 minutes)
const DAY_DURATION = 600

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
  private elapsed = 0
  private sun: THREE.DirectionalLight | null = null
  private ambient: THREE.AmbientLight | null = null
  private godRayPass: GodRayPass | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private scene: THREE.Scene | null = null

  /** normalised time-of-day [0..1], 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk */
  get timeOfDay(): number {
    return (this.elapsed % DAY_DURATION) / DAY_DURATION
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
    // Start at mid-morning so god rays are immediately visible
    this.elapsed = DAY_DURATION * 0.3
  }

  update(delta: number) {
    if (!this.sun || !this.ambient || !this.godRayPass || !this.camera || !this.scene) return
    this.elapsed += delta

    const t = this.timeOfDay // 0..1

    // --- Sun orbit: rises in east (negative X), sets in west (positive X)
    // angle = 0 at midnight (below horizon), π at noon (top)
    const angle = t * Math.PI * 2
    const sunX = -Math.cos(angle) * 200
    const sunY = Math.sin(angle) * 200
    const sunZ = 60
    this.sun.position.set(sunX, sunY, sunZ)

    // --- Sun intensity: bright at noon, dim at dawn/dusk, dark at night
    const dayFraction = Math.max(0, Math.sin(angle)) // 0 at night, 1 at noon
    const sunIntensity = 0.05 + dayFraction * dayFraction * 1.15
    this.sun.intensity = sunIntensity

    // --- Sun colour blends dawn/dusk/noon
    let sunColor: THREE.Color
    if (dayFraction < 0.2) {
      sunColor = lerpColor(SUN_NIGHT, SUN_DAWN, smoothstep(dayFraction / 0.2))
    } else if (dayFraction < 0.5) {
      sunColor = lerpColor(SUN_DAWN, SUN_NOON, smoothstep((dayFraction - 0.2) / 0.3))
    } else {
      sunColor = SUN_NOON.clone()
    }
    this.sun.color.set(sunColor)

    // --- Ambient: dim at night, bright at noon — never below 0.2
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

    // Keep fog in sync if present
    if (this.scene.fog) {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set(skyColor)
      } else if (this.scene.fog instanceof THREE.Fog) {
        this.scene.fog.color.set(skyColor)
      }
    }

    // --- God rays: project sun world-position to screen UV
    const godRayIntensity = dayFraction > 0.05 ? dayFraction * 0.9 : 0
    this.godRayPass.setIntensity(godRayIntensity)

    if (godRayIntensity > 0) {
      const sunWorld = this.sun.position.clone()
      const proj = sunWorld.project(this.camera)
      // NDC [-1,1] → UV [0,1]
      const screenX = (proj.x + 1) * 0.5
      const screenY = (proj.y + 1) * 0.5
      this.godRayPass.setSunPosition(screenX, screenY)
    }
  }
}
