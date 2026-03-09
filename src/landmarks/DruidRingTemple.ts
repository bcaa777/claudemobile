import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class DruidRingTemple {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private fireflies: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const foundMat  = new THREE.MeshLambertMaterial({ color: 0x2a3a1a })
    const uprightMat = new THREE.MeshLambertMaterial({ color: 0x334433 })
    const lintelMat  = new THREE.MeshLambertMaterial({ color: 0x2e3d2e })
    const altarMat   = new THREE.MeshLambertMaterial({ color: 0x1e2e1e })
    const runeMat    = new THREE.MeshBasicMaterial({ color: 0x225555 })

    // ── Foundation ──────────────────────────────────────────────────────────
    const foundation = box(240, 4, 240, foundMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 240, 240, 0)

    // ── Outer ring — 12 uprights ─────────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const angle = i * (Math.PI * 2 / 12)
      const upright = box(10, 40, 10, uprightMat)
      upright.position.set(Math.cos(angle) * 100, 20, Math.sin(angle) * 100)
      upright.rotation.y = angle
      group.add(upright)
    }

    // 6 lintels bridging alternate upright pairs
    for (let i = 0; i < 6; i++) {
      const a1 = (i * 2) * (Math.PI * 2 / 12)
      const a2 = (i * 2 + 1) * (Math.PI * 2 / 12)
      const midAngle = (a1 + a2) / 2
      const lintel = box(20, 6, 10, lintelMat)
      lintel.position.set(Math.cos(midAngle) * 100, 44, Math.sin(midAngle) * 100)
      lintel.rotation.y = midAngle + Math.PI / 2
      group.add(lintel)
    }

    // ── Inner ring — 8 smaller uprights ──────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const stone = box(6, 24, 6, uprightMat)
      stone.position.set(Math.cos(angle) * 55, 12, Math.sin(angle) * 55)
      group.add(stone)
    }

    // ── Altar ────────────────────────────────────────────────────────────
    const altarBase = box(30, 6, 30, altarMat)
    altarBase.position.set(0, 3, 0)
    group.add(altarBase)

    const altarTop = box(28, 3, 28, altarMat)
    altarTop.position.set(0, 7.5, 0)
    group.add(altarTop)
    this.addWalkable(px, py, pz, 0, 0, 28, 28, 9)

    // Altar uprights + capstone
    const uprightL = box(8, 30, 8, uprightMat)
    uprightL.position.set(-12, 24, 0)
    group.add(uprightL)
    const uprightR = box(8, 30, 8, uprightMat)
    uprightR.position.set(12, 24, 0)
    group.add(uprightR)
    const capstone = box(30, 5, 8, lintelMat)
    capstone.position.set(0, 41.5, 0)
    group.add(capstone)

    // Altar south face stairs (8 steps, y=0→9)
    for (let i = 0; i < 8; i++) {
      const stepTop = (i + 1) * (9 / 8)
      const s = box(4, 0.75, 2, altarMat)
      s.position.set(0, stepTop - 0.375, 15 + (i + 0.5) * 2)
      group.add(s)
      this.addWalkable(px, py, pz, 0, 15 + (i + 0.5) * 2, 4, 2, stepTop)
    }

    // ── Underground chamber ───────────────────────────────────────────────
    const chamberFloor = box(50, 2, 50, foundMat)
    chamberFloor.position.set(0, -9, 0)
    group.add(chamberFloor)
    this.addWalkable(px, py, pz, 0, 0, 50, 50, -8)

    // Chamber ceiling (hollow visual effect)
    const chamberCeil = box(50, 1, 50, foundMat)
    chamberCeil.position.set(0, -3, 0)
    group.add(chamberCeil)

    // 4 chamber pillars
    for (const [cx2, cz2] of [[-14,-14],[14,-14],[-14,14],[14,14]] as [number,number][]) {
      const p = box(4, 6, 4, uprightMat)
      p.position.set(cx2, -6, cz2)
      group.add(p)
    }

    // Moonwell
    const moonwell = box(14, 2, 14, new THREE.MeshLambertMaterial({ color: 0x0a1520 }))
    moonwell.position.set(0, -10, 0)
    group.add(moonwell)

    // 10 descending stairs from altar north side to underground
    for (let i = 0; i < 10; i++) {
      const stepTop = 9 - i * 1.7
      const s = box(3, 0.5, 1.5, altarMat)
      s.position.set(0, stepTop - 0.25, -(15 + i * 1.8))
      group.add(s)
      this.addWalkable(px, py, pz, 0, -(15 + i * 1.8), 3, 1.5, stepTop)
    }

    // Rune panels on outer stones
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const rune = box(0.5, 30, 10, runeMat)
      rune.position.set(Math.cos(angle) * 100, 20, Math.sin(angle) * 100)
      rune.rotation.y = angle
      group.add(rune)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,   0, 12,   0, 0x334422, 1.4, 40)
    this.addPointLight(group,  80,  8,   0, 0x225522, 0.7, 18)
    this.addPointLight(group, -80,  8,   0, 0x225522, 0.7, 18)
    this.addPointLight(group,   0,  8,  80, 0x334422, 0.8, 20)
    this.addPointLight(group,   0,  8, -80, 0x334422, 0.8, 20)
    this.addPointLight(group,   0, -6,   0, 0x112211, 0.6, 24)

    // ── Particles — 60 fireflies ─────────────────────────────────────────
    const count = 60
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 45
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0x44ff88, size: 0.22, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    })
    this.fireflies = new THREE.Points(geo, mat)
    this.fireflies.position.set(px, py, pz)
    scene.add(this.fireflies)
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
    if (this.fireflies) {
      const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.5 + i * 2.1) * delta * 0.5)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.4 + i * 1.7) * delta * 0.25)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.6 + i * 1.3) * delta * 0.5)
        const y = pos.getY(i)
        if (y < 0 || y > 45) pos.setY(i, Math.random() * 45)
        const x = pos.getX(i), z = pos.getZ(i)
        if (Math.abs(x) > 80) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(z) > 80) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
