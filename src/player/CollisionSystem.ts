import * as THREE from 'three'
import { World } from '../world/World'
import { FirstPersonController } from './FirstPersonController'

const PLAYER_HEIGHT = 1.8
const TERRAIN_OFFSET = 0.05

export class CollisionSystem {
  private world: World

  constructor(world: World) {
    this.world = world
  }

  update(camera: THREE.Camera, controller: FirstPersonController) {
    const pos = camera.position
    const terrainY = this.world.getHeightAt(pos.x, pos.z)
    const objectY  = this.world.getObjectFloorAt(pos.x, pos.z)

    const groundY = Math.max(
      terrainY !== null ? terrainY : -Infinity,
      objectY  !== null ? objectY  : -Infinity,
    )

    if (groundY > -Infinity) {
      const minY = groundY + PLAYER_HEIGHT + TERRAIN_OFFSET
      if (pos.y <= minY) {
        pos.y = minY
        controller.isGrounded = true
        if (controller.verticalVelocity < 0) controller.verticalVelocity = 0
      } else {
        controller.isGrounded = false
      }
    }
  }
}
