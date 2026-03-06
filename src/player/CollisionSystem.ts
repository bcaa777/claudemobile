import * as THREE from 'three'
import { World } from '../world/World'

const PLAYER_HEIGHT = 1.8
const TERRAIN_OFFSET = 0.1  // slight float above ground

export class CollisionSystem {
  private world: World

  constructor(world: World) {
    this.world = world
  }

  update(camera: THREE.Camera) {
    const pos = camera.position
    const terrainY = this.world.getHeightAt(pos.x, pos.z)
    if (terrainY !== null) {
      const minY = terrainY + PLAYER_HEIGHT + TERRAIN_OFFSET
      if (pos.y < minY) {
        pos.y = minY
      }
    }
  }
}
