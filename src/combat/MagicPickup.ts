import * as THREE from 'three'
import { WorldState } from '../systems/WorldState'

export class MagicPickup {
  private group: THREE.Group
  private collected = false
  private position: THREE.Vector3
  private light: THREE.PointLight
  private crystal: THREE.Mesh

  constructor(position: THREE.Vector3, scene: THREE.Scene) {
    this.position = position.clone()
    this.group = new THREE.Group()
    this.group.position.copy(position)

    // Floating rotating crystal shard
    const geo = new THREE.BoxGeometry(0.3, 0.8, 0.3)
    const mat = new THREE.MeshLambertMaterial({
      color: 0xddaa44,
      emissive: 0xcc66ff,
      emissiveIntensity: 0.8,
    })
    this.crystal = new THREE.Mesh(geo, mat)
    this.crystal.rotation.set(0, 0, Math.PI / 4) // rotated 45 degrees
    this.group.add(this.crystal)

    // Small point light nearby
    this.light = new THREE.PointLight(0xcc66ff, 2, 8)
    this.light.position.set(0, 0.5, 0)
    this.group.add(this.light)

    scene.add(this.group)
  }

  /**
   * Update the pickup. Returns true if just collected this frame.
   * @param interactPressed Whether the player pressed E this frame
   */
  update(
    dt: number,
    playerPos: THREE.Vector3,
    worldState: WorldState,
    elapsedTime: number,
    interactPressed: boolean
  ): boolean {
    if (this.collected) return false

    // Already have it
    if (worldState.hasGun) {
      this.collected = true
      this.group.visible = false
      return false
    }

    // Rotate + bob
    this.crystal.rotation.y += dt * 2.0
    this.group.position.y = this.position.y + Math.sin(elapsedTime * 2.0) * 0.3

    // Pulse light
    this.light.intensity = 1.5 + Math.sin(elapsedTime * 3.0) * 0.5

    // Check proximity and E key
    const dist = playerPos.distanceTo(this.position)
    if (dist < 3 && interactPressed) {
      this.collected = true
      worldState.hasGun = true
      this.group.visible = false
      return true
    }

    return false
  }

  isCollected(): boolean {
    return this.collected
  }

  getPosition(): THREE.Vector3 {
    return this.position
  }

  dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group)
    }
    this.crystal.geometry.dispose()
    ;(this.crystal.material as THREE.Material).dispose()
    this.light.dispose()
  }
}
