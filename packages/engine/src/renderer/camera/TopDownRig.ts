import * as THREE from 'three'
import type { InputManager } from '../../input'
import type { CameraRig, CameraMode } from './CameraRig'

export class TopDownRig implements CameraRig {
  readonly mode: CameraMode = 'top-down'

  private height = 30
  private readonly minHeight = 20
  private readonly maxHeight = 50
  private readonly zoomSpeed = 5

  // Slight forward tilt so the camera is not perfectly vertical (75 deg from horizontal)
  private static readonly TILT_ANGLE = THREE.MathUtils.degToRad(75)

  // Ground cursor for aiming (world-space XZ)
  readonly groundCursor = new THREE.Vector2()

  private currentPosition = new THREE.Vector3()
  private static readonly LERP_FACTOR = 10

  activate(camera: THREE.Camera): void {
    this.currentPosition.copy(camera.position)
  }

  update(delta: number, camera: THREE.Camera, input: InputManager, targetPosition?: THREE.Vector3): void {
    // Zoom via scroll wheel
    const scroll = input.consumeScrollDelta()
    this.height = Math.max(this.minHeight, Math.min(this.maxHeight, this.height - scroll * this.zoomSpeed))

    const target = targetPosition ?? new THREE.Vector3()

    // Tilt: camera is above and slightly behind the target along world -Z
    const tiltBack = this.height / Math.tan(TopDownRig.TILT_ANGLE)
    const idealPosition = new THREE.Vector3(
      target.x,
      target.y + this.height,
      target.z + tiltBack,
    )

    const t = Math.min(1, TopDownRig.LERP_FACTOR * delta)
    this.currentPosition.lerp(idealPosition, t)

    camera.position.copy(this.currentPosition)
    camera.lookAt(target.x, target.y, target.z)
  }
}
