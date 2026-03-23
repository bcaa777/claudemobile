import * as THREE from 'three'

interface Projectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  lifetime: number
  damage: number
}

export class ProjectileManager {
  private projectiles: Projectile[] = []
  private scene: THREE.Scene
  private projectileGeo: THREE.SphereGeometry
  private projectileMat: THREE.MeshBasicMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.projectileGeo = new THREE.SphereGeometry(0.15, 6, 6)
    this.projectileMat = new THREE.MeshBasicMaterial({
      color: 0xff44cc,
      transparent: true,
      opacity: 0.8,
    })
  }

  /** Called by CombatSystem when a spitter fires */
  spawn(origin: THREE.Vector3, target: THREE.Vector3, damage: number): void {
    const dir = new THREE.Vector3().subVectors(target, origin).normalize()
    const mesh = new THREE.Mesh(this.projectileGeo, this.projectileMat.clone())
    mesh.position.copy(origin)
    this.scene.add(mesh)
    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(15),
      lifetime: 3,
      damage,
    })
  }

  /** Returns total damage dealt to the player this frame */
  update(dt: number, playerPos: THREE.Vector3): number {
    let playerDamage = 0
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.mesh.position.addScaledVector(p.velocity, dt)
      p.lifetime -= dt

      // Check player hit (within 1 unit)
      if (p.mesh.position.distanceTo(playerPos) < 1.0) {
        playerDamage += p.damage
        this.removeProjectile(i)
        continue
      }

      if (p.lifetime <= 0) {
        this.removeProjectile(i)
      }
    }
    return playerDamage
  }

  private removeProjectile(index: number): void {
    const p = this.projectiles[index]
    this.scene.remove(p.mesh)
    ;(p.mesh.material as THREE.Material).dispose()
    this.projectiles.splice(index, 1)
  }

  dispose(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectile(i)
    }
    this.projectileGeo.dispose()
    this.projectileMat.dispose()
  }
}
