import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class AncestorField {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private sparks: THREE.Points | null = null
  private ashParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const granite  = new THREE.MeshLambertMaterial({ color: 0x3a3a45 })
    const runeStone = new THREE.MeshLambertMaterial({ color: 0x4a4a58 })
    const central  = new THREE.MeshLambertMaterial({ color: 0x2a2a38 })
    const runeMat  = new THREE.MeshBasicMaterial({ color: 0x225555 })
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5500 })

    // ── Ground slab ───────────────────────────────────────────────────────
    const ground = box(260, 2, 260, granite)
    ground.position.set(0, 1, 0)
    group.add(ground)
    this.addWalkable(px, py, pz, 0, 0, 260, 260, 2)

    // ── Outer ring — 16 standing stones ──────────────────────────────────
    for (let i = 0; i < 16; i++) {
      const angle = i * (Math.PI * 2 / 16)
      const stone = box(8, 50, 8, runeStone)
      stone.position.set(Math.cos(angle) * 110, 25, Math.sin(angle) * 110)
      stone.rotation.y = i * 0.15
      group.add(stone)

      // Rune panel on each stone
      const rune = box(0.5, 30, 10, runeMat)
      rune.position.set(Math.cos(angle) * 110, 25, Math.sin(angle) * 110)
      rune.rotation.y = i * 0.15
      group.add(rune)
    }

    // ── Inner ring — 8 markers ────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const marker = box(5, 30, 5, granite)
      marker.position.set(Math.cos(angle) * 55, 15, Math.sin(angle) * 55)
      group.add(marker)
    }

    // ── Central column ────────────────────────────────────────────────────
    const column = box(16, 80, 16, central)
    column.position.set(0, 40, 0)
    group.add(column)
    const cap = box(20, 6, 20, central)
    cap.position.set(0, 83, 0)
    group.add(cap)

    // ── Fire pit ──────────────────────────────────────────────────────────
    const pitBase = box(10, 3, 10, central)
    pitBase.position.set(0, 3.5, 0)
    group.add(pitBase)
    const pitEmber = box(8, 1, 8, emberMat)
    pitEmber.position.set(0, 2.5, 0)
    group.add(pitEmber)

    // ── 4 stone benches ───────────────────────────────────────────────────
    for (const [bx, bz] of [[0,-30],[0,30],[-30,0],[30,0]] as [number,number][]) {
      const bench = box(12, 2, 4, granite)
      bench.position.set(bx, 3, bz)
      group.add(bench)
    }

    // ── 4 approach paths ──────────────────────────────────────────────────
    for (const [apx, apz, apw, apd] of [
      [0, -100, 12, 6],
      [0,  100, 12, 6],
      [-100, 0, 6, 12],
      [ 100, 0, 6, 12],
    ] as [number,number,number,number][]) {
      const step = box(apw, 1, apd, granite)
      step.position.set(apx, 2.5, apz)
      group.add(step)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0, 5,  0, 0xffaa44, 1.0, 30)
    this.addPointLight(group, 55, 4,  0, 0xaabbcc, 0.7, 25)
    this.addPointLight(group,-55, 4,  0, 0xaabbcc, 0.7, 25)
    this.addPointLight(group,  0, 4, 55, 0xffaa44, 0.6, 20)

    // ── Particles — 40 fire sparks + 20 ash ──────────────────────────────
    const sparkCount = 40
    const sparkPos = new Float32Array(sparkCount * 3)
    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3 + 0] = (Math.random() - 0.5) * 10
      sparkPos[i * 3 + 1] = Math.random() * 15
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    const sgeo = new THREE.BufferGeometry()
    sgeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
    this.sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({
      color: 0xff8822, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    }))
    this.sparks.position.set(px, py + 2, pz)
    scene.add(this.sparks)

    const ashCount = 20
    const ashPos = new Float32Array(ashCount * 3)
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3 + 0] = (Math.random() - 0.5) * 220
      ashPos[i * 3 + 1] = Math.random() * 30
      ashPos[i * 3 + 2] = (Math.random() - 0.5) * 220
    }
    const ageo = new THREE.BufferGeometry()
    ageo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3))
    this.ashParticles = new THREE.Points(ageo, new THREE.PointsMaterial({
      color: 0x888888, size: 0.15, sizeAttenuation: true,
      transparent: true, opacity: 0.5, depthWrite: false,
    }))
    this.ashParticles.position.set(px, py, pz)
    scene.add(this.ashParticles)
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
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 6 + i * 1.3))
    }
    if (this.sparks) {
      const pos = this.sparks.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * delta * 0.3)
        pos.setY(i, pos.getY(i) + delta * (0.8 + Math.random() * 0.5))
        if (pos.getY(i) > 15) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
    if (this.ashParticles) {
      const pos = this.ashParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.2 + i * 0.9) * delta * 0.4)
        pos.setY(i, pos.getY(i) + delta * 0.1)
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.2 + i * 1.1) * delta * 0.4)
        if (pos.getY(i) > 30) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
  }
}
