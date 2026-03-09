import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class SavannaObelisk {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private heatShimmer: THREE.Points | null = null
  private dust: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const sandMat  = new THREE.MeshLambertMaterial({ color: 0xc87832 })
    const carvedMat = new THREE.MeshLambertMaterial({ color: 0xa06020 })
    const goldMat  = new THREE.MeshBasicMaterial({ color: 0xffc840 })

    // ── Ceremonial plaza ──────────────────────────────────────────────────
    const plaza = box(220, 2, 220, sandMat)
    plaza.position.set(0, 1, 0)
    group.add(plaza)
    this.addWalkable(px, py, pz, 0, 0, 220, 220, 2)

    // ── Perimeter wall (8 sections) ───────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const wall = box(50, 8, 4, carvedMat)
      wall.position.set(Math.cos(angle) * 100, 4, Math.sin(angle) * 100)
      wall.rotation.y = angle + Math.PI / 2
      group.add(wall)
    }

    // ── 8 perimeter obelisks ──────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const ox = Math.cos(angle) * 95
      const oz = Math.sin(angle) * 95

      const shaft = box(8, 60, 8, sandMat)
      shaft.position.set(ox, 30, oz)
      group.add(shaft)

      const oCap = box(10, 12, 10, carvedMat)
      oCap.position.set(ox, 66, oz)
      group.add(oCap)
    }

    // ── Central obelisk ───────────────────────────────────────────────────
    const centralShaft = box(20, 200, 20, sandMat)
    centralShaft.position.set(0, 100, 0)
    group.add(centralShaft)

    const centralCap = box(26, 20, 26, carvedMat)
    centralCap.position.set(0, 210, 0)
    group.add(centralCap)

    // Gold hieroglyph panels on central obelisk (4 sides)
    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI / 2)
      const panel = box(0.5, 80, 8, goldMat)
      panel.position.set(Math.cos(angle) * 10, 100, Math.sin(angle) * 10)
      panel.rotation.y = angle
      group.add(panel)
    }

    // ── Central dais ──────────────────────────────────────────────────────
    const daisBase = box(40, 6, 40, carvedMat)
    daisBase.position.set(0, 3, 0)
    group.add(daisBase)
    const daisTop = box(36, 3, 36, carvedMat)
    daisTop.position.set(0, 7.5, 0)
    group.add(daisTop)
    this.addWalkable(px, py, pz, 0, 0, 36, 36, 9)

    // Altar stone on dais
    const altar = box(10, 3, 8, sandMat)
    altar.position.set(0, 10.5, -10)
    group.add(altar)
    // Offering bowl
    const bowl = box(4, 1.5, 4, goldMat)
    bowl.position.set(0, 12, -10)
    group.add(bowl)

    // ── Dais approach steps ───────────────────────────────────────────────
    for (const [ax, az, dir] of [
      [0, 20, [0, 1]], [0,-20, [0,-1]], [20, 0, [1, 0]], [-20, 0, [-1, 0]],
    ] as [number, number, [number, number]][]) {
      for (let step = 0; step < 4; step++) {
        const s = box(14, 1, 6, sandMat)
        s.position.set(ax + dir[0] * step * 4, step + 0.5, az + dir[1] * step * 4)
        group.add(s)
        this.addWalkable(px, py, pz, ax + dir[0] * step * 4, az + dir[1] * step * 4, 14, 6, step + 1)
      }
    }

    // ── 4 causeways ───────────────────────────────────────────────────────
    for (const [cx, cz, cw, cd] of [
      [0, 60, 8, 80], [0,-60, 8, 80], [60, 0, 80, 8], [-60, 0, 80, 8],
    ] as [number,number,number,number][]) {
      const causeway = box(cw, 1, cd, sandMat)
      causeway.position.set(cx, 2.5, cz)
      group.add(causeway)
      this.addWalkable(px, py, pz, cx, cz, cw, cd, 3)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,   0, 10,  0, 0xffcc22, 2.0, 50)
    this.addPointLight(group,  80, 4,   0, 0xff9933, 1.5, 40)
    this.addPointLight(group, -80, 4,   0, 0xff9933, 1.5, 40)
    this.addPointLight(group,   0, 4,  80, 0xffcc22, 1.5, 40)
    this.addPointLight(group,   0, 4, -80, 0xffcc22, 1.5, 40)
    this.addPointLight(group,   0,200,  0, 0xff9933, 2.0, 60)

    // ── Particles — 30 heat shimmer + 20 dust ────────────────────────────
    const shimmerCount = 30
    const shimmerPos = new Float32Array(shimmerCount * 3)
    for (let i = 0; i < shimmerCount; i++) {
      shimmerPos[i * 3 + 0] = (Math.random() - 0.5) * 30
      shimmerPos[i * 3 + 1] = Math.random() * 30
      shimmerPos[i * 3 + 2] = (Math.random() - 0.5) * 30
    }
    const sgeo = new THREE.BufferGeometry()
    sgeo.setAttribute('position', new THREE.BufferAttribute(shimmerPos, 3))
    this.heatShimmer = new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0xffcc88, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.6, depthWrite: false,
    }))
    this.heatShimmer.position.set(px, py + 100, pz)
    scene.add(this.heatShimmer)

    const dustCount = 20
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3 + 0] = (Math.random() - 0.5) * 200
      dustPos[i * 3 + 1] = Math.random() * 15
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    const dgeo = new THREE.BufferGeometry()
    dgeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
      color: 0xbbaa88, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.4, depthWrite: false,
    }))
    this.dust.position.set(px, py, pz)
    scene.add(this.dust)
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
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 5 + i * 1.3))
    }
    if (this.heatShimmer) {
      const pos = this.heatShimmer.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 1.0 + i * 0.8) * delta * 0.3)
        pos.setY(i, pos.getY(i) + delta * (0.5 + Math.random() * 0.3))
        if (pos.getY(i) > 30) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.2 + i * 1.1) * delta * 0.4)
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.2 + i * 0.7) * delta * 0.4)
        pos.setY(i, pos.getY(i) + delta * 0.05)
        if (pos.getY(i) > 15) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
  }
}
