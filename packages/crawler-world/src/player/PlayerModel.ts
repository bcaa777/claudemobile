import * as THREE from 'three'

/**
 * Humanoid player mesh visible in third-person and top-down modes.
 * Torso (box), head (sphere), arms and legs (cylinders).
 * Walk animation: legs swing alternating, arms swing opposite.
 */
export class PlayerModel {
  readonly group: THREE.Group

  private torso: THREE.Mesh
  private head: THREE.Mesh
  private legL: THREE.Mesh
  private legR: THREE.Mesh
  private armL: THREE.Mesh
  private armR: THREE.Mesh
  private weapon: THREE.Mesh

  // Walk animation state
  private walkPhase = 0
  private static readonly WALK_SPEED = 9     // rad/s
  private static readonly LEG_SWING = 0.55   // max rotation.x (radians)
  private static readonly ARM_SWING = 0.35

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()

    const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x3377ff, emissive: 0x1133aa, emissiveIntensity: 0.3 })
    const skinMat  = new THREE.MeshStandardMaterial({ color: 0xf0c080, emissive: 0xf0c080, emissiveIntensity: 0.15 })
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x112244, emissiveIntensity: 0.2 })
    const weapMat  = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x888888, emissiveIntensity: 0.3 })

    // Torso (box)
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), bodyMat)
    this.torso.position.y = 0.95
    this.group.add(this.torso)

    // Head (sphere)
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat)
    this.head.position.y = 1.6
    this.group.add(this.head)

    // Legs — pivot from hip so rotation swings them
    const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.65, 6)

    this.legL = new THREE.Mesh(legGeo, darkMat)
    this.legL.position.set(-0.16, 0.35, 0)
    this.group.add(this.legL)

    this.legR = new THREE.Mesh(legGeo, darkMat)
    this.legR.position.set(0.16, 0.35, 0)
    this.group.add(this.legR)

    // Arms — pivot at shoulder height
    const armGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.58, 6)

    this.armL = new THREE.Mesh(armGeo, bodyMat)
    this.armL.position.set(-0.38, 0.95, 0)
    this.armL.rotation.z = 0.25
    this.group.add(this.armL)

    this.armR = new THREE.Mesh(armGeo, bodyMat)
    this.armR.position.set(0.38, 0.95, 0)
    this.armR.rotation.z = -0.25
    this.group.add(this.armR)

    // Weapon: small grey box held in the right hand region
    this.weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.06), weapMat)
    this.weapon.position.set(0.5, 0.72, 0.1)
    this.weapon.rotation.z = -0.25
    this.group.add(this.weapon)

    // Add dark outline for visibility
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    const meshes: THREE.Mesh[] = []
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child)
    })
    for (const mesh of meshes) {
      const outline = new THREE.Mesh(mesh.geometry, outlineMat)
      outline.position.copy(mesh.position)
      outline.rotation.copy(mesh.rotation)
      outline.scale.copy(mesh.scale).multiplyScalar(1.15)
      outline.renderOrder = -1
      this.group.add(outline)
    }

    scene.add(this.group)
    this.group.visible = false
  }

  show(): void { this.group.visible = true }
  hide(): void { this.group.visible = false }

  /**
   * @param position   World-space foot position (terrain Y + base)
   * @param yaw        Facing direction in radians
   * @param isMoving   Whether the player is moving (drives walk animation)
   * @param delta      Frame delta in seconds
   * @param weaponType Optional weapon type string to tint the weapon mesh
   */
  update(
    position: THREE.Vector3,
    yaw: number,
    isMoving: boolean,
    delta: number,
    weaponType?: string,
  ): void {
    this.group.position.copy(position)
    this.group.rotation.y = yaw

    // Walk animation
    if (isMoving) {
      this.walkPhase += PlayerModel.WALK_SPEED * delta
    } else {
      // Decay back to neutral
      this.walkPhase *= Math.max(0, 1 - 12 * delta)
    }

    const swing = Math.sin(this.walkPhase)
    const legSwing = swing * PlayerModel.LEG_SWING
    const armSwing = swing * PlayerModel.ARM_SWING

    this.legL.rotation.x = legSwing
    this.legR.rotation.x = -legSwing
    this.armL.rotation.x = -armSwing
    this.armR.rotation.x = armSwing

    // Tint weapon by type
    if (weaponType) {
      const mat = this.weapon.material as THREE.MeshLambertMaterial
      if (weaponType === 'fire') mat.color.setHex(0xff4400)
      else if (weaponType === 'ice') mat.color.setHex(0x44aaff)
      else if (weaponType === 'lightning') mat.color.setHex(0xffee00)
      else mat.color.setHex(0xaaaaaa)
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })
  }
}
