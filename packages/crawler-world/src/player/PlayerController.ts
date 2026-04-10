import * as THREE from 'three'
import { InputManager, FirstPersonRig, ThirdPersonRig, TopDownRig } from '@engine/core'
import { GAME_CONFIG } from '../config'
import { PlayerModel } from './PlayerModel'

type CameraRigMode = 'first-person' | 'third-person' | 'top-down'

export class PlayerController {
  private firstPersonRig: FirstPersonRig
  private thirdPersonRig: ThirdPersonRig
  private topDownRig: TopDownRig

  private currentMode: CameraRigMode = 'first-person'

  private position: THREE.Vector3
  private playerModel: PlayerModel | null = null

  constructor(
    private camera: THREE.Camera,
    private input: InputManager,
    private sampleHeight: (x: number, z: number) => number,
    scene?: THREE.Scene,
  ) {
    this.firstPersonRig = new FirstPersonRig()
    this.thirdPersonRig = new ThirdPersonRig({ distance: 8, height: 4 }, sampleHeight)
    this.topDownRig = new TopDownRig()

    // Start at a modest height so we don't clip before first terrain sample
    this.position = new THREE.Vector3(0, 5, 0)
    this.camera.position.copy(this.position)

    if (scene) {
      this.playerModel = new PlayerModel(scene)
    }

    this._applyMode()
  }

  private _applyMode(): void {
    // Sync third-person rig yaw with first-person yaw so there's no jump
    if (this.currentMode === 'third-person') {
      this.thirdPersonRig.setYaw(this.firstPersonRig.getYaw())
      this.thirdPersonRig.activate?.(this.camera)
    } else if (this.currentMode === 'top-down') {
      this.topDownRig.activate?.(this.camera)
    }

    if (this.playerModel) {
      if (this.currentMode === 'first-person') {
        this.playerModel.hide()
      } else {
        this.playerModel.show()
      }
    }
  }

  update(delta: number): void {
    this.input.pollGamepad()

    // Camera cycle: V key
    if (this.input.consumeCameraCycle()) {
      if (this.currentMode === 'first-person') {
        this.currentMode = 'third-person'
      } else if (this.currentMode === 'third-person') {
        this.currentMode = 'top-down'
      } else {
        this.currentMode = 'first-person'
      }
      this._applyMode()
    }

    // Update the active rig
    const targetPos = new THREE.Vector3(
      this.position.x,
      this.position.y - GAME_CONFIG.playerHeight, // foot position Y
      this.position.z,
    )
    // playerHeight is eye offset; for third/top-down target at foot level + half height
    const bodyCenter = new THREE.Vector3(
      this.position.x,
      this.position.y - GAME_CONFIG.playerHeight * 0.5,
      this.position.z,
    )

    if (this.currentMode === 'first-person') {
      this.firstPersonRig.update(delta, this.camera, this.input)
    } else if (this.currentMode === 'third-person') {
      this.thirdPersonRig.update(delta, this.camera, this.input, bodyCenter)
    } else {
      this.topDownRig.update(delta, this.camera, this.input, bodyCenter)
    }

    // Determine speed
    const sprinting =
      this.input.isDown('ShiftLeft') ||
      this.input.isDown('ShiftRight') ||
      this.input.gamepadSprint
    const speed = sprinting
      ? GAME_CONFIG.playerSprintSpeed
      : GAME_CONFIG.playerSpeed

    // Build move vector from WASD or left gamepad stick
    let moveX = 0
    let moveZ = 0

    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) moveZ -= 1
    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) moveZ += 1
    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) moveX -= 1
    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) moveX += 1

    moveX += this.input.gamepadLeftX
    moveZ += this.input.gamepadLeftY

    // Clamp to unit length so diagonal isn't faster
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (len > 1) {
      moveX /= len
      moveZ /= len
    }

    const isMoving = (moveX !== 0 || moveZ !== 0)

    // Yaw used for movement direction depends on mode
    let moveYaw: number
    if (this.currentMode === 'first-person') {
      moveYaw = this.firstPersonRig.getYaw()
    } else if (this.currentMode === 'third-person') {
      moveYaw = this.thirdPersonRig.getYaw()
    } else {
      // Top-down: camera looks straight down along -Z, no rotation
      moveYaw = 0
    }

    // Project movement along yaw direction (ignore pitch for walking)
    const forward = new THREE.Vector3(-Math.sin(moveYaw), 0, -Math.cos(moveYaw))
    const right = new THREE.Vector3(Math.cos(moveYaw), 0, -Math.sin(moveYaw))

    this.position.addScaledVector(forward, -moveZ * speed * delta)
    this.position.addScaledVector(right, moveX * speed * delta)

    // Snap Y to terrain height + eye level
    const terrainY = this.sampleHeight(this.position.x, this.position.z)
    this.position.y = terrainY + GAME_CONFIG.playerHeight

    // In first-person, camera tracks eye position
    if (this.currentMode === 'first-person') {
      this.camera.position.copy(this.position)
    }

    // Update player model
    if (this.playerModel && this.currentMode !== 'first-person') {
      const footPos = new THREE.Vector3(this.position.x, terrainY, this.position.z)
      // Face movement direction if moving, otherwise keep current yaw.
      // moveZ<0 = forward (W key), moveX>0 = strafe right (D key).
      // atan2(moveX, -moveZ) maps (0,-1)→0, (1,0)→PI/2, etc., matching our yaw convention.
      const facingYaw = isMoving ? (moveYaw + Math.atan2(moveX, -moveZ)) : moveYaw
      this.playerModel.update(footPos, facingYaw, isMoving, delta)
    }
  }

  /** Expose position so Game can pass it to the chunk manager. */
  getPosition(): THREE.Vector3 {
    return this.position
  }

  dispose(scene: THREE.Scene): void {
    this.playerModel?.dispose(scene)
  }
}
