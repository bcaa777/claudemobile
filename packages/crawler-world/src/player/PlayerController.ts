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

  /** The horizontal direction the player is facing (unit XZ vector). Updated every frame. */
  private _facingDir = new THREE.Vector3(0, 0, -1)

  constructor(
    private camera: THREE.Camera,
    private input: InputManager,
    private sampleHeight: (x: number, z: number) => number,
    scene?: THREE.Scene,
  ) {
    this.firstPersonRig = new FirstPersonRig()
    this.thirdPersonRig = new ThirdPersonRig({ distance: 8, height: 4 }, sampleHeight)
    this.topDownRig = new TopDownRig()

    // Spawn on terrain surface
    const spawnY = sampleHeight(0, 0) + GAME_CONFIG.playerHeight
    this.position = new THREE.Vector3(0, spawnY, 0)
    this.camera.position.copy(this.position)

    if (scene) {
      this.playerModel = new PlayerModel(scene)
    }

    this._applyMode()
  }

  private _applyMode(): void {
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

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (len > 1) {
      moveX /= len
      moveZ /= len
    }

    const isMoving = (moveX !== 0 || moveZ !== 0)

    // ── Movement direction per camera mode ──────────────────────────────────
    //
    // Top-down: camera looks along -Z (with slight tilt).
    //   "screen up" = -Z, "screen right" = +X
    //   W (moveZ=-1) should move -Z, D (moveX=+1) should move +X
    //   → forward=(0,0,-1), right=(1,0,0), use raw moveX/moveZ directly
    //
    // Third-person: camera orbits behind player.
    //   forward = direction from camera toward player = (sin(yaw), 0, cos(yaw))
    //   right = perpendicular = (cos(yaw), 0, -sin(yaw))
    //
    // First-person: forward = camera look direction on XZ plane
    //   forward = (-sin(yaw), 0, -cos(yaw))
    //   W (moveZ=-1) → addScaledVector(forward, +1) = forward direction ✓

    let forward: THREE.Vector3
    let right: THREE.Vector3

    if (this.currentMode === 'top-down') {
      // Screen-aligned: W=north(-Z), D=east(+X)
      forward = new THREE.Vector3(0, 0, -1)
      right = new THREE.Vector3(1, 0, 0)
      this.position.addScaledVector(forward, -moveZ * speed * delta)
      this.position.addScaledVector(right, moveX * speed * delta)
    } else if (this.currentMode === 'third-person') {
      // Camera-relative: forward = from camera toward target
      const yaw = this.thirdPersonRig.getYaw()
      forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
      right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw))
      this.position.addScaledVector(forward, -moveZ * speed * delta)
      this.position.addScaledVector(right, moveX * speed * delta)
    } else {
      // First-person: camera-look-direction aligned
      const yaw = this.firstPersonRig.getYaw()
      forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
      right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
      this.position.addScaledVector(forward, -moveZ * speed * delta)
      this.position.addScaledVector(right, moveX * speed * delta)
    }

    // Update facing direction (for weapon aiming)
    if (isMoving) {
      this._facingDir.set(0, 0, 0)
        .addScaledVector(forward, -moveZ)
        .addScaledVector(right, moveX)
      this._facingDir.y = 0
      if (this._facingDir.lengthSq() > 0.001) this._facingDir.normalize()
    }

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
      const facingYaw = isMoving
        ? Math.atan2(this._facingDir.x, this._facingDir.z)
        : (this.currentMode === 'third-person' ? this.thirdPersonRig.getYaw() : 0)
      this.playerModel.update(footPos, facingYaw, isMoving, delta)
    }
  }

  /** Expose position so Game can pass it to the chunk manager. */
  getPosition(): THREE.Vector3 {
    return this.position
  }

  /** Get the horizontal direction the player is facing (for weapon aiming in third-person/top-down). */
  getFacingDirection(): THREE.Vector3 {
    return this._facingDir
  }

  /** Get current camera mode. */
  getMode(): CameraRigMode {
    return this.currentMode
  }

  dispose(scene: THREE.Scene): void {
    this.playerModel?.dispose(scene)
  }
}
