import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class ObsidianCitadel {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private embers: THREE.Points | null = null
  private ashParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.5)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const obsidian  = new THREE.MeshLambertMaterial({ color: 0x0d0508 })
    const darkRock  = new THREE.MeshLambertMaterial({ color: 0x1a0808 })
    const lavaMat   = new THREE.MeshBasicMaterial({ color: 0xff2200 })

    // ── Base platform ─────────────────────────────────────────────────────
    const platform = box(240, 10, 240, obsidian)
    platform.position.set(0, 5, 0)
    group.add(platform)
    this.addWalkable(px, py, pz, 0, 0, 240, 240, 10)

    // ── Central spire ─────────────────────────────────────────────────────
    const spire = box(30, 120, 30, obsidian)
    spire.position.set(0, 60, 0)
    group.add(spire)

    // Lava cracks on spire
    for (let i = 0; i < 6; i++) {
      const angle = i * (Math.PI * 2 / 6)
      const crack = box(2, 80, 1, lavaMat)
      crack.position.set(Math.cos(angle) * 14, 60, Math.sin(angle) * 14)
      crack.rotation.y = angle
      group.add(crack)
    }

    // Spire base room floor
    const spireFloor = box(28, 1, 28, darkRock)
    spireFloor.position.set(0, 10.5, 0)
    group.add(spireFloor)
    this.addWalkable(px, py, pz, 0, 0, 28, 28, 11)

    // Lava pool
    const lavaPool = box(60, 1, 60, lavaMat)
    lavaPool.position.set(0, 10.5, 0)
    group.add(lavaPool)

    // Spire mid-platform
    const midPlat = box(28, 1, 28, darkRock)
    midPlat.position.set(0, 70.5, 0)
    group.add(midPlat)
    this.addWalkable(px, py, pz, 0, 0, 28, 28, 71)

    // Spire summit
    const summit = box(28, 1, 28, darkRock)
    summit.position.set(0, 120.5, 0)
    group.add(summit)
    this.addWalkable(px, py, pz, 0, 0, 28, 28, 121)

    // ── 4 flanking towers ─────────────────────────────────────────────────
    const towerPositions: [number, number][] = [
      [70, 0], [-70, 0], [0, 70], [0, -70],
    ]
    for (const [tx, tz] of towerPositions) {
      const tower = box(20, 80, 20, darkRock)
      tower.position.set(tx, 40, tz)
      group.add(tower)
      // Tower top platform
      const tTop = box(18, 1, 18, darkRock)
      tTop.position.set(tx, 80.5, tz)
      group.add(tTop)
      this.addWalkable(px, py, pz, tx, tz, 18, 18, 81)
    }

    // ── 4 buttress walls ──────────────────────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + Math.PI / 4
      const buttress = box(60, 20, 8, obsidian)
      buttress.position.set(Math.cos(angle) * 45, 10, Math.sin(angle) * 45)
      buttress.rotation.y = angle
      group.add(buttress)
    }

    // ── Outer ring — 8 wall panels ────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const panel = box(50, 30, 6, obsidian)
      panel.position.set(Math.cos(angle) * 100, 15, Math.sin(angle) * 100)
      panel.rotation.y = angle + Math.PI / 2
      group.add(panel)
    }

    // ── Spiral stairs around spire (8 steps y=10→70) ──────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const stepY = 10 + i * (60 / 7)
      const step = box(6, 1, 4, darkRock)
      step.position.set(Math.cos(angle) * 20, stepY + 0.5, Math.sin(angle) * 20)
      step.rotation.y = angle
      group.add(step)
      this.addWalkable(px, py, pz, Math.cos(angle) * 20, Math.sin(angle) * 20, 6, 4, stepY + 1)
    }

    // ── Tower inner face stairs (each tower, 6 steps to y=30) ─────────────
    for (const [tx, tz] of towerPositions) {
      const normX = -tx / 70, normZ = -tz / 70
      for (let step = 0; step < 6; step++) {
        const s = box(6, 1, 2, darkRock)
        const stepY = 10 + step * 5
        s.position.set(tx + normX * (8 - step), stepY + 0.5, tz + normZ * (8 - step))
        group.add(s)
        this.addWalkable(px, py, pz, tx + normX * (8 - step), tz + normZ * (8 - step), 6, 2, stepY + 1)
      }
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,   0, 12,  0, 0xff3300, 2.0, 40)
    this.addPointLight(group,  70, 12,  0, 0xcc2200, 1.2, 30)
    this.addPointLight(group, -70, 12,  0, 0xcc2200, 1.2, 30)
    this.addPointLight(group,   0, 12, 70, 0xcc2200, 1.2, 30)
    this.addPointLight(group,   0, 12,-70, 0xcc2200, 1.2, 30)
    this.addPointLight(group,   0, 72,  0, 0xff3300, 1.8, 50)
    this.addPointLight(group,   0,122,  0, 0xff3300, 1.5, 40)
    this.addPointLight(group,   0, 40,  0, 0xcc2200, 1.0, 30)

    // ── Particles — 50 embers + 30 ash ────────────────────────────────────
    const emberCount = 50
    const emberPos = new Float32Array(emberCount * 3)
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3 + 0] = (Math.random() - 0.5) * 60
      emberPos[i * 3 + 1] = Math.random() * 30
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 60
    }
    const egeo = new THREE.BufferGeometry()
    egeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
    this.embers = new THREE.Points(egeo, new THREE.PointsMaterial({
      color: 0xff4400, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    }))
    this.embers.position.set(px, py + 10, pz)
    scene.add(this.embers)

    const ashCount = 30
    const ashPos = new Float32Array(ashCount * 3)
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3 + 0] = (Math.random() - 0.5) * 200
      ashPos[i * 3 + 1] = Math.random() * 60
      ashPos[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    const ageo = new THREE.BufferGeometry()
    ageo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3))
    this.ashParticles = new THREE.Points(ageo, new THREE.PointsMaterial({
      color: 0x444444, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.6, depthWrite: false,
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
    if (this.embers) {
      const pos = this.embers.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + delta * (1.0 + Math.random() * 0.5))
        if (pos.getY(i) > 80) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
    if (this.ashParticles) {
      const pos = this.ashParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.3 + i * 1.4) * delta * 0.4)
        pos.setY(i, pos.getY(i) + delta * 0.15)
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.3 + i * 0.9) * delta * 0.4)
        if (pos.getY(i) > 60) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
  }
}
