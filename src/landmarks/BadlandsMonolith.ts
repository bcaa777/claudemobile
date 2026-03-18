import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class BadlandsMonolith {
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

    const sandstoneMat = new THREE.MeshLambertMaterial({ color: 0xaa6633, map: texGen.getTexture('sandstone', 0xaa6633).map })
    const adobeMat     = new THREE.MeshLambertMaterial({ color: 0x884422, map: texGen.getTexture('sandstone', 0x884422).map })
    const stoneMat     = new THREE.MeshLambertMaterial({ color: 0x775533, map: texGen.getTexture('stone', 0x775533).map })
    const runeMat      = new THREE.MeshBasicMaterial({ color: 0xffcc66 })

    // ── Foundation ──────────────────────────────────────────────────────
    const foundation = box(200, 4, 160, sandstoneMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 200, 160, 0)

    // ── 2 massive pillars ───────────────────────────────────────────────
    const pillarL = box(30, 80, 30, sandstoneMat)
    pillarL.position.set(-40, 40, 0)
    group.add(pillarL)

    const pillarR = box(30, 80, 30, sandstoneMat)
    pillarR.position.set(40, 40, 0)
    group.add(pillarR)

    // ── Arch connecting tops (segmented curve) ──────────────────────────
    const archSegments = 7
    for (let i = 0; i < archSegments; i++) {
      const t = i / (archSegments - 1)
      const ax = -40 + t * 80
      const ay = 80 + Math.sin(t * Math.PI) * 16
      const seg = box(14, 8, 24, adobeMat)
      seg.position.set(ax, ay, 0)
      seg.rotation.z = (t - 0.5) * -0.2
      group.add(seg)
    }

    // ── Carved rune panels on pillar faces ──────────────────────────────
    const runePanelPositions: [number, number, number][] = [
      [-40, 30, 16], [-40, 50, 16], [-40, 30, -16], [-40, 50, -16],
      [40, 30, 16],  [40, 50, 16],  [40, 30, -16],  [40, 50, -16],
    ]
    for (const [rx, ry, rz] of runePanelPositions) {
      const rune = box(1, 8, 8, runeMat)
      rune.position.set(rx + (rx > 0 ? 16 : -16), ry, rz > 0 ? rz - 1 : rz + 1)
      group.add(rune)
    }

    // ── Scattered erosion blocks at base ────────────────────────────────
    const erosionPositions: [number, number, number, number, number, number][] = [
      [-65, 3, -30, 12, 6, 10],
      [70, 2.5, 25, 10, 5, 8],
      [-30, 2, 55, 8, 4, 12],
      [55, 3.5, -45, 14, 7, 9],
      [-80, 2, 40, 9, 4, 11],
      [20, 2.5, -60, 11, 5, 7],
    ]
    for (const [ex, ey, ez, ew, eh, ed] of erosionPositions) {
      const erosion = box(ew, eh, ed, stoneMat)
      erosion.position.set(ex, ey, ez)
      erosion.rotation.y = Math.random() * Math.PI
      group.add(erosion)
    }

    // ── Small altar between pillars (walkable) ──────────────────────────
    const altar = box(30, 6, 20, stoneMat)
    altar.position.set(0, 3, 0)
    group.add(altar)
    this.addWalkable(px, py, pz, 0, 0, 30, 20, 6)

    // Altar top slab
    const altarSlab = box(34, 1, 24, adobeMat)
    altarSlab.position.set(0, 6.5, 0)
    group.add(altarSlab)

    // ── Steps leading up to altar ───────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      const step = box(30 + i * 4, 2, 6, sandstoneMat)
      step.position.set(0, i + 1, 14 + i * 6)
      group.add(step)
      this.addWalkable(px, py, pz, 0, 14 + i * 6, 30 + i * 4, 6, i * 2 + 2)
    }

    // ── Lights (amber) ─────────────────────────────────────────────────
    this.addPointLight(group, 0, 10, 0, 0xffaa44, 0.9, 50)
    this.addPointLight(group, 0, 88, 0, 0xffaa44, 0.7, 45)

    // ── Dust particles ──────────────────────────────────────────────────
    const count = 20
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xccaa88, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.6, depthWrite: false,
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
