import * as THREE from 'three'

const DAY_DURATION = 600  // seconds for a full day

// Time-of-day color keyframes
const AMBIENT_KEYS = [
  { t: 0.00, color: new THREE.Color(0x0a0a18) },  // midnight
  { t: 0.20, color: new THREE.Color(0x151025) },  // pre-dawn
  { t: 0.25, color: new THREE.Color(0x5c2a18) },  // dawn
  { t: 0.30, color: new THREE.Color(0x8a5530) },  // sunrise
  { t: 0.40, color: new THREE.Color(0x203040) },  // morning
  { t: 0.50, color: new THREE.Color(0x304050) },  // midday (overcast retro)
  { t: 0.65, color: new THREE.Color(0x304050) },  // afternoon
  { t: 0.70, color: new THREE.Color(0x7a3820) },  // sunset
  { t: 0.75, color: new THREE.Color(0x502010) },  // dusk
  { t: 0.80, color: new THREE.Color(0x151025) },  // evening
  { t: 1.00, color: new THREE.Color(0x0a0a18) },  // back to midnight
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

function sampleColorKeys(keys: { t: number; color: THREE.Color }[], t: number): THREE.Color {
  t = ((t % 1) + 1) % 1
  let a = keys[keys.length - 1]
  let b = keys[0]
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t < keys[i+1].t) {
      a = keys[i]; b = keys[i+1]; break
    }
  }
  const local = a.t === b.t ? 0 : (t - a.t) / (b.t - a.t)
  return new THREE.Color().lerpColors(a.color, b.color, local)
}

export class DayNightCycle {
  private sun: THREE.DirectionalLight
  private moon: THREE.DirectionalLight
  private ambient: THREE.AmbientLight
  private hemi: THREE.HemisphereLight
  public timeOfDay = 0.4  // start at midday (0=midnight, 1=midnight)
  private elapsed = 0

  constructor(scene: THREE.Scene) {
    this.sun = new THREE.DirectionalLight(0xffe8c0, 1.2)
    this.sun.position.set(100, 100, 0)
    scene.add(this.sun)

    this.moon = new THREE.DirectionalLight(0x3050a0, 0.15)
    this.moon.position.set(-100, 80, 0)
    scene.add(this.moon)

    this.ambient = new THREE.AmbientLight(0x304050, 1.0)
    scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(0x304050, 0x101010, 0.3)
    scene.add(this.hemi)
  }

  update(delta: number) {
    this.elapsed += delta
    this.timeOfDay = (this.elapsed / DAY_DURATION) % 1

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
    this.sun.intensity = Math.max(0, sunY) * 1.5
    this.moon.intensity = Math.max(0, -sunY) * 0.2

    this.ambient.color.copy(sampleColorKeys(AMBIENT_KEYS, t))
    this.sun.color.copy(sampleColorKeys(SUN_KEYS, t))
    this.hemi.color.copy(sampleColorKeys(SUN_KEYS, t)).multiplyScalar(0.5)
  }

  getTimeString(): string {
    const hours = Math.floor(this.timeOfDay * 24)
    const mins = Math.floor((this.timeOfDay * 24 * 60) % 60)
    return `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`
  }

  getSunIntensity(): number {
    return this.sun.intensity
  }
}
