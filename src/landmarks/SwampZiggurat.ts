import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class SwampZiggurat {
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

    const mossy   = new THREE.MeshLambertMaterial({ color: 0x2a3a20 })
    const darkMoss = new THREE.MeshLambertMaterial({ color: 0x1a2a18 })
    const wetWood  = new THREE.MeshLambertMaterial({ color: 0x3a2814 })

    // ── 4 tiers ───────────────────────────────────────────────────────────
    const tierTops = [15, 30, 45, 60]
    for (let i = 0; i < 4; i++) {
      const size = 200 - i * 40
      const tier = box(size, 15, size, mossy)
      tier.position.set(0, 7.5 + i * 15, 0)
      group.add(tier)
      this.addWalkable(px, py, pz, 0, 0, size - 4, size - 4, tierTops[i])
    }

    // ── Summit temple ─────────────────────────────────────────────────────
    const temple = box(40, 20, 40, darkMoss)
    temple.position.set(0, 70, 0)
    group.add(temple)
    const roof = box(44, 6, 44, mossy)
    roof.position.set(0, 83, 0)
    group.add(roof)

    // Temple interior floor
    const templeFloor = box(36, 1, 36, darkMoss)
    templeFloor.position.set(0, 60.5, 0)
    group.add(templeFloor)
    this.addWalkable(px, py, pz, 0, 0, 36, 36, 61)

    // Altar + 4 pillars
    const altar = box(12, 4, 10, mossy)
    altar.position.set(0, 64, 0)
    group.add(altar)
    for (const [cx, cz] of [[-14,-14],[14,-14],[-14,14],[14,14]] as [number,number][]) {
      const pillar = box(4, 16, 4, darkMoss)
      pillar.position.set(cx, 68, cz)
      group.add(pillar)
    }

    // ── South exterior stairs (6 steps per tier) ──────────────────────────
    for (let tier = 0; tier < 4; tier++) {
      const baseY = tier * 15
      const halfSize = (200 - tier * 40) / 2
      for (let step = 0; step < 6; step++) {
        const s = box(16, 2, 8, mossy)
        s.position.set(0, baseY + step * 2.5 + 1, halfSize + step * 5)
        group.add(s)
        this.addWalkable(px, py, pz, 0, halfSize + step * 5, 16, 8, baseY + step * 2.5 + 2)
      }
    }

    // ── Boardwalk south ───────────────────────────────────────────────────
    const boardS = box(8, 1, 80, wetWood)
    boardS.position.set(0, 0.5, 140)
    group.add(boardS)
    this.addWalkable(px, py, pz, 0, 140, 8, 80, 1)
    for (let i = 0; i < 6; i++) {
      const post = box(1.5, 12, 1.5, wetWood)
      post.position.set(0, -6, 110 + i * 14)
      group.add(post)
    }

    // Boardwalk east
    const boardE = box(60, 1, 8, wetWood)
    boardE.position.set(120, 0.5, 0)
    group.add(boardE)
    this.addWalkable(px, py, pz, 120, 0, 60, 8, 1)
    for (let i = 0; i < 5; i++) {
      const post = box(1.5, 12, 1.5, wetWood)
      post.position.set(96 + i * 12, -6, 0)
      group.add(post)
    }

    // ── Interior Tier 0 corridor (N-S) ────────────────────────────────────
    const corrFloor = box(12, 1, 180, darkMoss)
    corrFloor.position.set(0, 0.5, 0)
    group.add(corrFloor)
    this.addWalkable(px, py, pz, 0, 0, 12, 180, 1)

    // ── Exterior ledges on tier 1 ─────────────────────────────────────────
    for (const [lx, lz, lw, ld] of [
      [0, -80, 160, 10], [0, 80, 160, 10],
      [-80, 0, 10, 160], [80, 0, 10, 160],
    ] as [number,number,number,number][]) {
      const ledge = box(lw, 1, ld, darkMoss)
      ledge.position.set(lx, 15.5, lz)
      group.add(ledge)
      this.addWalkable(px, py, pz, lx, lz, lw, ld, 16)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0, 8,  0, 0x446622, 1.0, 40)
    this.addPointLight(group, 80, 8,  0, 0x338833, 0.7, 25)
    this.addPointLight(group,-80, 8,  0, 0x338833, 0.7, 25)
    this.addPointLight(group,  0, 8, 80, 0x446622, 0.5, 20)
    this.addPointLight(group,  0, 64, 0, 0x338833, 0.8, 30)
    this.addPointLight(group,  0, 2,140, 0x446622, 0.6, 20)

    // ── Particles — 50 swamp fireflies ────────────────────────────────────
    const count = 50
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 180
      positions[i * 3 + 1] = Math.random() * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 180
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.fireflies = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaaff44, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    }))
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
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 5 + i * 1.3))
    }
    if (this.fireflies) {
      const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.3 + i * 2.1) * delta * 0.35)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.25 + i * 1.7) * delta * 0.15)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.35 + i * 1.3) * delta * 0.35)
        const y = pos.getY(i)
        if (y < 0 || y > 20) pos.setY(i, Math.random() * 20)
      }
      pos.needsUpdate = true
    }
  }
}
