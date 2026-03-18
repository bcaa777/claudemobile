import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class TaigaLonghouse {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private particles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const woodMat      = new THREE.MeshLambertMaterial({ color: 0x5a3a18, map: texGen.getTexture('wood', 0x5a3a18).map })
    const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a, map: texGen.getTexture('stone', 0x3a3a3a).map })
    const stoneMat     = new THREE.MeshLambertMaterial({ color: 0x555555, map: texGen.getTexture('stone', 0x555555).map })
    const fireGlow     = new THREE.MeshBasicMaterial({ color: 0xff6622 })

    // ── Foundation ──────────────────────────────────────────────────────
    const foundation = box(180, 3, 100, stoneMat)
    foundation.position.set(0, -1.5, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 180, 100, 0)

    // ── Main hall walls ─────────────────────────────────────────────────
    // Left wall
    const wallL = box(160, 30, 4, woodMat)
    wallL.position.set(0, 15, -38)
    group.add(wallL)

    // Right wall
    const wallR = box(160, 30, 4, woodMat)
    wallR.position.set(0, 15, 38)
    group.add(wallR)

    // Back wall
    const wallBack = box(4, 30, 76, woodMat)
    wallBack.position.set(-78, 15, 0)
    group.add(wallBack)

    // Front wall (left side of doorway)
    const wallFrontL = box(4, 30, 26, woodMat)
    wallFrontL.position.set(78, 15, -25)
    group.add(wallFrontL)

    // Front wall (right side of doorway)
    const wallFrontR = box(4, 30, 26, woodMat)
    wallFrontR.position.set(78, 15, 25)
    group.add(wallFrontR)

    // Lintel above doorway
    const lintel = box(4, 8, 24, woodMat)
    lintel.position.set(78, 34, 0)
    group.add(lintel)

    // ── A-frame roof ────────────────────────────────────────────────────
    // Left roof slope
    const roofL = box(164, 2, 48, woodMat)
    roofL.position.set(0, 36, -20)
    roofL.rotation.x = -0.45
    group.add(roofL)

    // Right roof slope
    const roofR = box(164, 2, 48, woodMat)
    roofR.position.set(0, 36, 20)
    roofR.rotation.x = 0.45
    group.add(roofR)

    // Ridge beam
    const ridge = box(164, 3, 3, woodMat)
    ridge.position.set(0, 44, 0)
    group.add(ridge)

    // ── Interior walkable floor ─────────────────────────────────────────
    const floor = box(150, 1, 70, darkStoneMat)
    floor.position.set(0, 0.5, 0)
    group.add(floor)
    this.addWalkable(px, py, pz, 0, 0, 150, 70, 1)

    // ── Central firepit ─────────────────────────────────────────────────
    const firepitRing = box(20, 4, 20, stoneMat)
    firepitRing.position.set(0, 2, 0)
    group.add(firepitRing)

    // Fire embers inside
    const fireInner = box(14, 2, 14, fireGlow)
    fireInner.position.set(0, 3, 0)
    group.add(fireInner)

    // ── 6 support pillars inside ────────────────────────────────────────
    const pillarXPositions = [-50, 0, 50]
    for (const cx of pillarXPositions) {
      for (const cz of [-24, 24]) {
        const pillar = box(5, 40, 5, woodMat)
        pillar.position.set(cx, 20, cz)
        group.add(pillar)
      }
    }

    // ── Log benches along walls ─────────────────────────────────────────
    const benchPositions: [number, number][] = [
      [-50, -30], [0, -30], [50, -30],
      [-50, 30],  [0, 30],  [50, 30],
    ]
    for (const [bx, bz] of benchPositions) {
      const bench = box(30, 4, 6, woodMat)
      bench.position.set(bx, 2, bz)
      group.add(bench)

      // Bench legs
      const legL = box(2, 4, 2, woodMat)
      legL.position.set(bx - 12, 2, bz)
      group.add(legL)

      const legR = box(2, 4, 2, woodMat)
      legR.position.set(bx + 12, 2, bz)
      group.add(legR)
    }

    // ── Lights (warm) ───────────────────────────────────────────────────
    this.addPointLight(group, 0, 8, 0, 0xff8833, 1.0, 55)
    this.addPointLight(group, 50, 6, 0, 0xff9944, 0.6, 35)

    // ── Smoke particles ─────────────────────────────────────────────────
    const count = 30
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x888888, size: 0.3, sizeAttenuation: true,
      transparent: true, opacity: 0.5, depthWrite: false,
    }))
    this.particles.position.set(px, py, pz)
    scene.add(this.particles)
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
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.5 + i * 2.1) * delta * 0.5)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.4 + i * 1.7) * delta * 0.25)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.6 + i * 1.3) * delta * 0.5)
        if (pos.getY(i) < 0 || pos.getY(i) > 50) pos.setY(i, Math.random() * 50)
        if (Math.abs(pos.getX(i)) > 80) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(pos.getZ(i)) > 80) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
