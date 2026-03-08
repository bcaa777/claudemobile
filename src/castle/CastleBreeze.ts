import * as THREE from 'three'

const SPAWN_RADIUS = 35
const MAX_PARTICLES = 128
const HIDDEN_Y = -9999

export class CastleBreeze {
  private points: THREE.Points
  private positions: Float32Array
  private speeds: Float32Array
  private phases: Float32Array
  private castlePos: THREE.Vector3

  constructor(castlePos: THREE.Vector3, scene: THREE.Scene) {
    this.castlePos = castlePos.clone()

    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.speeds = new Float32Array(MAX_PARTICLES)
    this.phases = new Float32Array(MAX_PARTICLES)

    // Hide all particles initially
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = HIDDEN_Y
      this.speeds[i] = 4 + Math.random() * 2
      this.phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(0x99ccff),
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })

    this.points = new THREE.Points(geo, mat)
    scene.add(this.points)
  }

  private spawnParticle(i: number, playerPos: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * SPAWN_RADIUS
    this.positions[i * 3 + 0] = playerPos.x + Math.cos(angle) * r
    this.positions[i * 3 + 1] = playerPos.y + Math.random() * 6
    this.positions[i * 3 + 2] = playerPos.z + Math.sin(angle) * r
  }

  update(delta: number, playerPos: THREE.Vector3) {
    const dist = playerPos.distanceTo(this.castlePos)
    const t = Math.max(0, Math.min(1, 1 - (dist - 30) / 550))
    const activeCount = Math.floor(4 + t * t * 120)
    const clampedActive = Math.min(activeCount, MAX_PARTICLES)

    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute
    const time = performance.now() / 1000

    // Direction from player to castle in XZ
    const dirX = this.castlePos.x - playerPos.x
    const dirZ = this.castlePos.z - playerPos.z
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ)
    const ndx = dirLen > 0.001 ? dirX / dirLen : 0
    const ndz = dirLen > 0.001 ? dirZ / dirLen : 0

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i >= clampedActive) {
        // Hide inactive particles
        if (this.positions[i * 3 + 1] !== HIDDEN_Y) {
          this.positions[i * 3 + 1] = HIDDEN_Y
        }
        continue
      }

      const px = this.positions[i * 3 + 0]
      const py = this.positions[i * 3 + 1]
      const pz = this.positions[i * 3 + 2]

      // Spawn if hidden
      if (py === HIDDEN_Y) {
        this.spawnParticle(i, playerPos)
        continue
      }

      // Perpendicular wobble (organic lateral drift)
      const wobble = Math.sin(time * 1.4 + this.phases[i]) * 0.15
      const perpX = -ndz * wobble
      const perpZ = ndx * wobble

      const speed = this.speeds[i]
      this.positions[i * 3 + 0] = px + (ndx * 0.85 + perpX) * speed * delta
      this.positions[i * 3 + 1] = py
      this.positions[i * 3 + 2] = pz + (ndz * 0.85 + perpZ) * speed * delta

      // Respawn if too far from player
      const dxP = this.positions[i * 3 + 0] - playerPos.x
      const dzP = this.positions[i * 3 + 2] - playerPos.z
      const distFromPlayer = Math.sqrt(dxP * dxP + dzP * dzP)

      const dxC = this.positions[i * 3 + 0] - this.castlePos.x
      const dzC = this.positions[i * 3 + 2] - this.castlePos.z
      const distFromCastle = Math.sqrt(dxC * dxC + dzC * dzC)

      if (distFromPlayer > 60 || distFromCastle < 5) {
        this.spawnParticle(i, playerPos)
      }
    }

    pos.needsUpdate = true
  }
}
