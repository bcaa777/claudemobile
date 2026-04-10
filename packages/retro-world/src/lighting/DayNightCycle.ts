import * as THREE from 'three'
import { TIME_CONFIG } from '../config'

// Time-of-day color keyframes
const AMBIENT_KEYS = [
  { t: 0.00, color: new THREE.Color(0x1a1a30) },  // midnight — visible, blue-tinted
  { t: 0.20, color: new THREE.Color(0x252040) },  // pre-dawn
  { t: 0.25, color: new THREE.Color(0x7a4020) },  // dawn
  { t: 0.30, color: new THREE.Color(0xb07848) },  // sunrise
  { t: 0.40, color: new THREE.Color(0x506878) },  // morning
  { t: 0.50, color: new THREE.Color(0x607888) },  // midday (bright retro)
  { t: 0.65, color: new THREE.Color(0x607888) },  // afternoon
  { t: 0.70, color: new THREE.Color(0x9a5030) },  // sunset
  { t: 0.75, color: new THREE.Color(0x502020) },  // dusk
  { t: 0.80, color: new THREE.Color(0x252040) },  // evening
  { t: 1.00, color: new THREE.Color(0x1a1a30) },  // back to midnight
]

const SUN_KEYS = [
  { t: 0.00, color: new THREE.Color(0x304060) },
  { t: 0.25, color: new THREE.Color(0xff8844) },
  { t: 0.30, color: new THREE.Color(0xffcc88) },
  { t: 0.50, color: new THREE.Color(0xffe8c0) },
  { t: 0.70, color: new THREE.Color(0xffcc88) },
  { t: 0.75, color: new THREE.Color(0xff6622) },
  { t: 0.80, color: new THREE.Color(0x304060) },
  { t: 1.00, color: new THREE.Color(0x304060) },
]

// Reusable Color to avoid per-frame allocations (Phase 5e)
const _tmpColor = new THREE.Color()

function sampleColorKeys(keys: { t: number; color: THREE.Color }[], t: number, out: THREE.Color): THREE.Color {
  t = ((t % 1) + 1) % 1
  let a = keys[keys.length - 1]
  let b = keys[0]
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t < keys[i+1].t) {
      a = keys[i]; b = keys[i+1]; break
    }
  }
  const local = a.t === b.t ? 0 : (t - a.t) / (b.t - a.t)
  return out.lerpColors(a.color, b.color, local)
}

export class DayNightCycle {
  private sun: THREE.DirectionalLight
  private moon: THREE.DirectionalLight
  private ambient: THREE.AmbientLight
  private hemi: THREE.HemisphereLight
  public timeOfDay = TIME_CONFIG.startTime
  private elapsed = TIME_CONFIG.startTime * TIME_CONFIG.dayDuration

  // Debug multipliers — adjust via DebugPanel
  public ambientMult = 1.0
  public sunMult = 1.0
  public hemiMult = 1.0

  /** External time multiplier (e.g. onboarding system can set 1.3 to hasten dusk) */
  public timeMultiplier = 1.0

  constructor(scene: THREE.Scene) {
    this.sun = new THREE.DirectionalLight(0xffe8c0, 4.5)
    this.sun.position.set(100, 100, 0)
    scene.add(this.sun)

    this.moon = new THREE.DirectionalLight(0x6080cc, 1.2)
    this.moon.position.set(-100, 80, 0)
    scene.add(this.moon)

    this.ambient = new THREE.AmbientLight(0x607888, 8.0)
    scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(0x607888, 0x201810, 3.0)
    scene.add(this.hemi)
  }

  update(delta: number) {
    this.elapsed += delta * this.timeMultiplier
    this.timeOfDay = (this.elapsed / TIME_CONFIG.dayDuration) % 1

    const t = this.timeOfDay
    const sunAngle = t * Math.PI * 2
    const moonAngle = sunAngle + Math.PI

    this.sun.position.set(
      Math.cos(sunAngle) * 150,
      Math.sin(sunAngle) * 150,
      50
    )
    this.moon.position.set(
      Math.cos(moonAngle) * 150,
      Math.sin(moonAngle) * 150,
      -50
    )

    // Night intensity for sun (below horizon)
    const sunY = Math.sin(sunAngle)
    this.sun.intensity  = Math.max(0, sunY) * 4.5 * this.sunMult
    this.moon.intensity = Math.max(0, -sunY) * 1.2 * this.sunMult
    // Ambient never drops below 30% — night should be moody, not blind
    const dayFactor = Math.max(0, sunY)
    this.ambient.intensity = (5.0 + dayFactor * 3.0) * this.ambientMult
    this.hemi.intensity    = (1.5 + dayFactor * 1.5) * this.hemiMult

    sampleColorKeys(AMBIENT_KEYS, t, this.ambient.color)
    sampleColorKeys(SUN_KEYS, t, this.sun.color)
    sampleColorKeys(SUN_KEYS, t, _tmpColor)
    this.hemi.color.copy(_tmpColor).multiplyScalar(0.5)
  }

  getTime(): number {
    return this.timeOfDay
  }

  getTimeString(): string {
    const hours = Math.floor(this.timeOfDay * 24)
    const mins = Math.floor((this.timeOfDay * 24 * 60) % 60)
    return `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`
  }

  getSunIntensity(): number {
    return this.sun.intensity
  }

  getSunDirection(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.sun.position).normalize()
  }

  getSunColor(out: THREE.Color): THREE.Color {
    return out.copy(this.sun.color)
  }
}
