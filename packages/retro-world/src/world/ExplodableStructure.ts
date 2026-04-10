import * as THREE from 'three'
import { SeededRandom } from '../utils/SeededRandom'

interface Fragment {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  rotVel: THREE.Vector3
}

export class ExplodableStructure {
  public group: THREE.Group
  public worldPos: THREE.Vector3
  public radius: number

  private fragments: Fragment[] = []
  private state: 'idle' | 'countdown' | 'exploding' | 'done' = 'idle'
  private timer = 0
  public isRumbling = false

  constructor(group: THREE.Group, worldPos: THREE.Vector3, radius = 6) {
    this.group = group
    this.worldPos = worldPos.clone()
    this.radius = radius

    // Collect all Mesh children as fragments
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        this.fragments.push({
          mesh: child,
          vel: new THREE.Vector3(),
          rotVel: new THREE.Vector3(),
        })
      }
    })
  }

  trigger() {
    if (this.state !== 'idle') return
    this.state = 'countdown'
    this.timer = 0
    this.isRumbling = true
  }

  update(delta: number, rng: SeededRandom): void {
    if (this.state === 'idle' || this.state === 'done') return

    this.timer += delta

    if (this.state === 'countdown') {
      // Rumble: tiny random offset
      this.group.position.x = this.worldPos.x + rng.range(-0.08, 0.08)
      this.group.position.z = this.worldPos.z + rng.range(-0.08, 0.08)

      if (this.timer >= 1.0) {
        this.isRumbling = false
        this.state = 'exploding'
        this.timer = 0
        // Assign explosion velocities
        const center = new THREE.Vector3()
        for (const frag of this.fragments) {
          frag.mesh.getWorldPosition(center)
          // Random outward + upward
          frag.vel.set(
            rng.range(-18, 18),
            rng.range(8, 28),
            rng.range(-18, 18),
          )
          frag.rotVel.set(
            rng.range(-4, 4),
            rng.range(-4, 4),
            rng.range(-4, 4),
          )
          // Make materials transparent-capable
          const mat = frag.mesh.material as THREE.MeshLambertMaterial
          if (!mat.transparent) {
            mat.transparent = true
            mat.opacity = 1.0
            mat.needsUpdate = true
          }
        }
        // Detach group from scene parent — fragments will move in world space
        // by updating positions directly
      }
      return
    }

    if (this.state === 'exploding') {
      const fadeStart = 0.5
      const fadeDuration = 2.0
      let allDone = true

      for (const frag of this.fragments) {
        // Apply gravity
        frag.vel.y -= 22 * delta

        // Move in world space: mesh.position is local to group
        frag.mesh.position.x += frag.vel.x * delta
        frag.mesh.position.y += frag.vel.y * delta
        frag.mesh.position.z += frag.vel.z * delta

        // Spin
        frag.mesh.rotation.x += frag.rotVel.x * delta
        frag.mesh.rotation.y += frag.rotVel.y * delta
        frag.mesh.rotation.z += frag.rotVel.z * delta

        // Fade
        if (this.timer > fadeStart) {
          const t = Math.min(1, (this.timer - fadeStart) / fadeDuration)
          ;(frag.mesh.material as THREE.MeshLambertMaterial).opacity = 1 - t
          if (t < 1) allDone = false
        } else {
          allDone = false
        }
      }

      if (allDone) {
        this.state = 'done'
      }
    }
  }

  isDone() { return this.state === 'done' }
}
