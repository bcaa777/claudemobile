import * as THREE from 'three'
import { InputManager } from '../engine/InputManager'

const MOVE_SPEED = 8
const MOUSE_SENSITIVITY = 0.002

export class FirstPersonController {
  private camera: THREE.Camera
  private input: InputManager
  private yaw = 0
  private pitch = 0
  private velocity = new THREE.Vector3()

  constructor(camera: THREE.Camera, input: InputManager) {
    this.camera = camera
    this.input = input
  }

  update(delta: number) {
    const { dx, dy } = this.input.consumeMouseDelta()

    if (this.input.isPointerLocked()) {
      this.yaw   -= dx * MOUSE_SENSITIVITY
      this.pitch -= dy * MOUSE_SENSITIVITY
      this.pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.pitch))
    }

    // Build euler from yaw + pitch
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)

    // Movement in camera-local XZ plane
    const forward = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(0, this.yaw, 0))
    const right = new THREE.Vector3(1, 0, 0)
      .applyEuler(new THREE.Euler(0, this.yaw, 0))

    const move = new THREE.Vector3()
    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp'))    move.add(forward)
    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown'))  move.sub(forward)
    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.add(right)
    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft'))  move.sub(right)

    if (move.lengthSq() > 0) move.normalize()

    // Apply velocity with friction
    this.velocity.lerp(move.multiplyScalar(MOVE_SPEED), delta * 10)
    this.camera.position.addScaledVector(this.velocity, delta)
  }
}
