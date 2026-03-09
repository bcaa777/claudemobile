import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class IcePalace {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private snow: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.5)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const iceMat      = new THREE.MeshLambertMaterial({ color: 0x8ab8d0 })
    const blueWhite   = new THREE.MeshLambertMaterial({ color: 0xaaccee })
    const darkIce     = new THREE.MeshLambertMaterial({ color: 0x5580a0 })
    const crystalGlow = new THREE.MeshBasicMaterial({ color: 0xddeeff })

    // ── Grand foundation ──────────────────────────────────────────────────
    const foundation = box(200, 4, 160, iceMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 200, 160, 0)

    // ── Main tower ────────────────────────────────────────────────────────
    const mainTower = box(40, 100, 40, iceMat)
    mainTower.position.set(0, 50, 0)
    group.add(mainTower)

    // ── 4 corner spires ───────────────────────────────────────────────────
    const spirePos: [number, number, number][] = [
      [-80, 35, -60],
      [ 80, 35, -60],
      [-80, 35,  60],
      [ 80, 35,  60],
    ]
    for (let i = 0; i < 4; i++) {
      const [sx, sy, sz] = spirePos[i]
      const spire = box(14, 70, 14, blueWhite)
      spire.position.set(sx, sy, sz)
      spire.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.04
      spire.rotation.z = (i < 2 ? -1 : 1) * 0.04
      group.add(spire)
    }

    // ── Grand hall ────────────────────────────────────────────────────────
    const grandHall = box(120, 28, 80, iceMat)
    grandHall.position.set(0, 14, 0)
    group.add(grandHall)

    // 4 arched buttresses
    const buttressPos: [number, number][] = [
      [-60, -40], [-60, 40], [60, -40], [60, 40],
    ]
    for (const [bx, bz] of buttressPos) {
      const butt = box(6, 20, 50, blueWhite)
      butt.position.set(bx, 10, bz)
      group.add(butt)
    }

    // ── Grand entrance ────────────────────────────────────────────────────
    const entPillarL = box(8, 30, 8, iceMat)
    entPillarL.position.set(-16, 15, 40)
    group.add(entPillarL)
    const entPillarR = box(8, 30, 8, iceMat)
    entPillarR.position.set(16, 15, 40)
    group.add(entPillarR)
    const entLintel = box(38, 4, 8, iceMat)
    entLintel.position.set(0, 32, 40)
    group.add(entLintel)

    // Grand entrance stairs (5 wide steps)
    for (let i = 0; i < 5; i++) {
      const s = box(36, 1, 4, iceMat)
      s.position.set(0, i + 0.5, 40 + (4 - i) * 3)
      group.add(s)
      this.addWalkable(px, py, pz, 0, 40 + (4 - i) * 3, 36, 4, i + 1)
    }

    // ── Interior hall floor ───────────────────────────────────────────────
    const hallFloor = box(110, 1, 70, darkIce)
    hallFloor.position.set(0, 2.5, 0)
    group.add(hallFloor)
    this.addWalkable(px, py, pz, 0, 0, 110, 70, 3)

    // 6 columns in 2 rows
    for (const cx of [-30, 0, 30]) {
      for (const cz of [-20, 20]) {
        const col = box(5, 24, 5, iceMat)
        col.position.set(cx, 15, cz)
        group.add(col)
      }
    }

    // Throne dais
    const dais = box(20, 4, 16, iceMat)
    dais.position.set(0, 2, -32)
    group.add(dais)
    this.addWalkable(px, py, pz, 0, -32, 20, 16, 4)
    const throne = box(10, 14, 4, darkIce)
    throne.position.set(0, 11, -34)
    group.add(throne)

    // ── Mid-balcony at y=28 ───────────────────────────────────────────────
    for (const [bx2, bz2, bw, bd] of [
      [0, -40, 110, 12], [0, 40, 110, 12],
      [-56, 0, 12, 56],  [56, 0, 12, 56],
    ] as [number, number, number, number][]) {
      const balc = box(bw, 1, bd, blueWhite)
      balc.position.set(bx2, 28.5, bz2)
      group.add(balc)
      this.addWalkable(px, py, pz, bx2, bz2, bw, bd, 29)
    }

    // Tower interior stairs (8 steps up to mid-floor at y=60)
    for (let step = 0; step < 8; step++) {
      const s = box(6, 1, 3, iceMat)
      s.position.set(-8, step * 7.5 + 3.5 + 0.5, step * 2 - 14)
      group.add(s)
      this.addWalkable(px, py, pz, -8, step * 2 - 14, 6, 3, step * 7.5 + 4)
    }

    // Tower mid-floor at y=60
    const towerMid = box(36, 1, 36, blueWhite)
    towerMid.position.set(0, 60.5, 0)
    group.add(towerMid)
    this.addWalkable(px, py, pz, 0, 0, 36, 36, 61)

    // ── Crystal accent ────────────────────────────────────────────────────
    const glowTop = box(36, 2, 36, crystalGlow)
    glowTop.position.set(0, 101.5, 0)
    group.add(glowTop)
    this.addWalkable(px, py, pz, 0, 0, 36, 36, 102)

    // 4 spire summit platforms
    for (let i = 0; i < 4; i++) {
      const [sx, , sz] = spirePos[i]
      const plat = box(12, 1, 12, crystalGlow)
      plat.position.set(sx, 68.5, sz)
      group.add(plat)
      this.addWalkable(px, py, pz, sx, sz, 12, 12, 69)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0,  6,  0, 0xaaddff, 0.8, 50)
    this.addPointLight(group, 40,  6, 20, 0xddeeff, 0.6, 30)
    this.addPointLight(group,-40,  6, 20, 0xddeeff, 0.6, 30)
    this.addPointLight(group,  0,  6,-30, 0xaaddff, 0.7, 40)
    this.addPointLight(group,  0, 32,  0, 0xddeeff, 0.9, 60)
    this.addPointLight(group,  0, 62,  0, 0xaaddff, 1.2, 60)
    this.addPointLight(group,-80, 40,-60, 0xddeeff, 0.6, 30)
    this.addPointLight(group, 80, 40, 60, 0xddeeff, 0.6, 30)

    // ── Particles — 80 snow ───────────────────────────────────────────────
    const count = 80
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 200
      positions[i * 3 + 1] = Math.random() * 120
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xddeeff, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.8, depthWrite: false,
    }))
    this.snow.position.set(px, py, pz)
    scene.add(this.snow)
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
      this.torchLights[i].intensity = base * (0.85 + 0.2 * Math.sin(time * 4 + i * 1.7))
    }
    if (this.snow) {
      const pos = this.snow.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.3 + i * 1.1) * delta * 0.3)
        pos.setY(i, pos.getY(i) - delta * (0.5 + (i % 7) * 0.05))
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.2 + i * 0.8) * delta * 0.2)
        if (pos.getY(i) < 0) pos.setY(i, 120 + Math.random() * 20)
      }
      pos.needsUpdate = true
    }
  }
}
