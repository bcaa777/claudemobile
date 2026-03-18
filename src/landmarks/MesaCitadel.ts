import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class MesaCitadel {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private dustParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const adobeMat     = new THREE.MeshLambertMaterial({ color: 0xb86840, map: texGen.getTexture('stone', 0xb86840).map })
    const sandstoneMat = new THREE.MeshLambertMaterial({ color: 0xc8a060, map: texGen.getTexture('stone', 0xc8a060).map })
    const woodMat      = new THREE.MeshLambertMaterial({ color: 0x5a3210, map: texGen.getTexture('wood', 0x5a3210).map })

    // ── Foundation ──────────────────────────────────────────────────────────
    const foundation = box(220, 6, 180, adobeMat)
    foundation.position.set(0, -3, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 220, 180, 0)

    // ── Outer Walls (4 walls, 8 thick, 30 tall) ────────────────────────────
    // North wall
    const wallN = box(220, 30, 8, sandstoneMat)
    wallN.position.set(0, 15, -86)
    group.add(wallN)

    // South wall (with gate opening - split into two parts)
    const wallSL = box(90, 30, 8, sandstoneMat)
    wallSL.position.set(-65, 15, 86)
    group.add(wallSL)
    const wallSR = box(90, 30, 8, sandstoneMat)
    wallSR.position.set(65, 15, 86)
    group.add(wallSR)
    // Gate lintel above opening
    const gateLint = box(40, 8, 8, woodMat)
    gateLint.position.set(0, 26, 86)
    group.add(gateLint)

    // West wall
    const wallW = box(8, 30, 180, sandstoneMat)
    wallW.position.set(-106, 15, 0)
    group.add(wallW)

    // East wall
    const wallE = box(8, 30, 180, sandstoneMat)
    wallE.position.set(106, 15, 0)
    group.add(wallE)

    // ── Central Courtyard (walkable) ────────────────────────────────────────
    const courtyard = box(200, 2, 160, adobeMat)
    courtyard.position.set(0, 1, 0)
    group.add(courtyard)
    this.addWalkable(px, py, pz, 0, 0, 200, 160, 2)

    // ── 4 Corner Watchtowers (25x50x25) ─────────────────────────────────────
    for (const [tx, tz] of [[-100, -80], [100, -80], [-100, 80], [100, 80]] as [number, number][]) {
      const tower = box(25, 50, 25, sandstoneMat)
      tower.position.set(tx, 25, tz)
      group.add(tower)

      const towerRoof = box(28, 3, 28, woodMat)
      towerRoof.position.set(tx, 51.5, tz)
      group.add(towerRoof)

      // Battlement top
      for (let b = -1; b <= 1; b += 2) {
        const merlon = box(8, 6, 4, sandstoneMat)
        merlon.position.set(tx + b * 8, 56, tz)
        group.add(merlon)
        const merlon2 = box(4, 6, 8, sandstoneMat)
        merlon2.position.set(tx, 56, tz + b * 8)
        group.add(merlon2)
      }
    }

    // ── Main Building inside (80x35x60) ─────────────────────────────────────
    const mainBldg = box(80, 35, 60, adobeMat)
    mainBldg.position.set(0, 17.5, -20)
    group.add(mainBldg)

    const mainRoof = box(84, 3, 64, woodMat)
    mainRoof.position.set(0, 36.5, -20)
    group.add(mainRoof)

    // Entrance to main building
    const doorFrame = box(16, 20, 2, woodMat)
    doorFrame.position.set(0, 10, 10)
    group.add(doorFrame)

    // ── Lights (warm orange) ────────────────────────────────────────────────
    this.addPointLight(group,  0, 20,  30, 0xff8844, 1.3, 40)
    this.addPointLight(group,  0, 20, -20, 0xffaa55, 1.0, 30)

    // ── Particles — 25 dust particles ───────────────────────────────────────
    const count = 25
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xccaa77, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.7, depthWrite: false,
    })
    this.dustParticles = new THREE.Points(geo, mat)
    this.dustParticles.position.set(px, py, pz)
    scene.add(this.dustParticles)
  }

  private addWalkable(px: number, py: number, pz: number,
    lx: number, lz: number, w: number, d: number, topY: number) {
    this.walkables.push({
      minX: px + lx - w / 2,
      maxX: px + lx + w / 2,
      minZ: pz + lz - d / 2,
      maxZ: pz + lz + d / 2,
      y: py + topY,
    })
  }

  private addPointLight(group: THREE.Group, lx: number, ly: number, lz: number,
    color: number, intensity: number, distance: number): THREE.PointLight {
    if (this.torchLights.length >= 2) return null!
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(lx, ly, lz)
    group.add(light)
    this.torchLights.push(light)
    this.torchIntensities.push(intensity)
    return light
  }

  update(delta: number, time: number) {
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = this.torchIntensities[i]
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 7 + i * 1.3))
    }
    if (this.dustParticles) {
      const pos = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.5 + i * 2.1) * delta * 0.5)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.4 + i * 1.7) * delta * 0.25)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.6 + i * 1.3) * delta * 0.5)
        const y = pos.getY(i)
        if (y < 0 || y > 50) pos.setY(i, Math.random() * 50)
        const x = pos.getX(i), z = pos.getZ(i)
        if (Math.abs(x) > 80) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(z) > 80) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
