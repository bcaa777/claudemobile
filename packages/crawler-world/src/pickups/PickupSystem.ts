import * as THREE from 'three'
import { GAME_CONFIG } from '../config'
import type { GameState } from '../state/GameState'
import type { EventBus } from '@engine/core'

interface Pickup {
  type: 'xp' | 'gold'
  mesh: THREE.Mesh
  position: THREE.Vector3
  value: number
}

const XP_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x00ff44 })
const GOLD_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffcc00 })
const PICKUP_GEOMETRY = new THREE.SphereGeometry(0.2, 6, 6)
const MAGNET_SPEED = 15 // units per second
const COLLECT_DIST = 0.5

export class PickupSystem {
  private pickups: Pickup[] = []
  private scene: THREE.Scene
  private eventBus: EventBus

  constructor(scene: THREE.Scene, eventBus: EventBus) {
    this.scene = scene
    this.eventBus = eventBus

    eventBus.on('enemyDied', (data: { position: THREE.Vector3 }) => {
      this.spawnPickup(data.position, 'xp', GAME_CONFIG.xpPerKillBase)
      if (Math.random() < GAME_CONFIG.goldDropRate) {
        this.spawnPickup(data.position, 'gold', 5)
      }
    })
  }

  spawnPickup(position: THREE.Vector3, type: 'xp' | 'gold', value: number): void {
    const material = type === 'xp' ? XP_MATERIAL : GOLD_MATERIAL
    const mesh = new THREE.Mesh(PICKUP_GEOMETRY, material)

    // Slight random offset so overlapping pickups don't stack exactly
    const px = position.x + (Math.random() - 0.5) * 0.8
    const pz = position.z + (Math.random() - 0.5) * 0.8
    mesh.position.set(px, position.y + 0.3, pz)
    this.scene.add(mesh)

    this.pickups.push({ type, mesh, position: mesh.position, value })
  }

  /** Returns true if any XP pickup triggered a level-up this frame */
  update(delta: number, playerPos: THREE.Vector3, gameState: GameState): boolean {
    let leveledUp = false
    const rangeSq = gameState.pickupRange * gameState.pickupRange

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]
      const dx = playerPos.x - pickup.position.x
      const dy = playerPos.y - pickup.position.y
      const dz = playerPos.z - pickup.position.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= rangeSq) {
        // Move toward player
        const dist = Math.sqrt(distSq)
        if (dist < COLLECT_DIST) {
          // Collect
          this.scene.remove(pickup.mesh)
          this.pickups.splice(i, 1)

          if (pickup.type === 'xp') {
            const didLevelUp = gameState.addXp(pickup.value)
            if (didLevelUp) leveledUp = true
          } else {
            gameState.addGold(pickup.value)
          }
          this.eventBus.emit('pickupCollected', { type: pickup.type })
        } else {
          // Magnetism: slide toward player
          const speed = MAGNET_SPEED * delta
          const ratio = Math.min(speed / dist, 1)
          pickup.position.x += dx * ratio
          pickup.position.y += dy * ratio
          pickup.position.z += dz * ratio
        }
      }
    }

    return leveledUp
  }

  clear(): void {
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.mesh)
    }
    this.pickups = []
  }
}
