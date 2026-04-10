import * as THREE from 'three'
import type { WeaponDef } from './WeaponDefs'
import type { EnemyManager } from '../enemies/EnemyFactory'
import type { DamageSystem } from './DamageSystem'
import type { EventBus } from '@engine/core'

interface OrbitalEntry {
  def: WeaponDef
  meshes: THREE.Mesh[]
  angle: number            // current base angle in radians
  damageTimer: number      // cooldown between damage ticks per orbital
}

export class OrbitalSystem {
  private orbitals: OrbitalEntry[] = []
  /** 0-1 damage reduction applied while a shield_ring orbital is active */
  shieldReduction = 0

  constructor(private scene: THREE.Scene) {}

  addOrbital(def: WeaponDef): void {
    if (def.category !== 'orbital') return

    const count = def.orbitCount ?? 1
    const meshes: THREE.Mesh[] = []

    for (let i = 0; i < count; i++) {
      const mesh = this.createMesh(def)
      this.scene.add(mesh)
      meshes.push(mesh)
    }

    this.orbitals.push({ def, meshes, angle: 0, damageTimer: 0 })

    if (def.shieldReduction) {
      this.shieldReduction = Math.min(1, this.shieldReduction + def.shieldReduction)
    }
  }

  update(
    delta: number,
    playerPosition: THREE.Vector3,
    enemyManager: EnemyManager,
    damageSystem: DamageSystem,
    eventBus: EventBus,
    sampleHeight: (x: number, z: number) => number,
  ): void {
    for (const orbital of this.orbitals) {
      const { def, meshes } = orbital
      const radius = def.orbitRadius ?? 3.5
      const speed = def.orbitSpeed ?? 2.0

      orbital.angle += speed * delta
      orbital.damageTimer -= delta

      const angleStep = (Math.PI * 2) / meshes.length

      for (let i = 0; i < meshes.length; i++) {
        const a = orbital.angle + angleStep * i
        const ox = Math.cos(a) * radius
        const oz = Math.sin(a) * radius
        const wx = playerPosition.x + ox
        const wz = playerPosition.z + oz
        const wy = sampleHeight(wx, wz) + 0.8

        meshes[i].position.set(wx, wy, wz)
        meshes[i].rotation.y = a
      }

      // Damage tick
      if (orbital.damageTimer <= 0) {
        orbital.damageTimer = def.cooldown
        this.applyOrbitalDamage(orbital, enemyManager, damageSystem, eventBus)
      }
    }
  }

  private applyOrbitalDamage(
    orbital: OrbitalEntry,
    enemyManager: EnemyManager,
    damageSystem: DamageSystem,
    eventBus: EventBus,
  ): void {
    const { def, meshes } = orbital
    const hitRadius = (def.orbitRadius ?? 3.5) * 0.6 + 1.0

    for (const mesh of meshes) {
      // Work backward to safely remove dying enemies
      for (let i = enemyManager.enemies.length - 1; i >= 0; i--) {
        const enemy = enemyManager.enemies[i]
        const dx = mesh.position.x - enemy.mesh.position.x
        const dz = mesh.position.z - enemy.mesh.position.z
        const distSq = dx * dx + dz * dz
        if (distSq < hitRadius * hitRadius) {
          damageSystem.applyDamage(enemyManager, i, def.damage, eventBus)
        }
      }
    }
  }

  removeOrbital(defId: string): void {
    const idx = this.orbitals.findIndex((o) => o.def.id === defId)
    if (idx === -1) return
    const orbital = this.orbitals[idx]

    if (orbital.def.shieldReduction) {
      this.shieldReduction = Math.max(0, this.shieldReduction - orbital.def.shieldReduction)
    }

    for (const mesh of orbital.meshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.orbitals.splice(idx, 1)
  }

  dispose(): void {
    for (const orbital of this.orbitals) {
      for (const mesh of orbital.meshes) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
    }
    this.orbitals.length = 0
    this.shieldReduction = 0
  }

  private createMesh(def: WeaponDef): THREE.Mesh {
    if (def.id === 'blade_orbit') {
      const geo = new THREE.BoxGeometry(0.8, 0.12, 0.25)
      const mat = new THREE.MeshBasicMaterial({ color: 0x88ccff })
      return new THREE.Mesh(geo, mat)
    }
    // shield_ring — flat torus segment
    const geo = new THREE.TorusGeometry(def.orbitRadius ?? 4.5, 0.15, 6, 32)
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.7 })
    return new THREE.Mesh(geo, mat)
  }
}
