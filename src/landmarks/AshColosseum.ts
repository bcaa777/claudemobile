import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class AshColosseum {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private ashParticles: THREE.Points | null = null
  private embers: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const ashStone = new THREE.MeshLambertMaterial({ color: 0x3a3830 })
    const darkAsh  = new THREE.MeshLambertMaterial({ color: 0x252320 })
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xff3300 })

    // ── Arena floor ───────────────────────────────────────────────────────
    const arenaFloor = box(160, 2, 160, ashStone)
    arenaFloor.position.set(0, 1, 0)
    group.add(arenaFloor)
    this.addWalkable(px, py, pz, 0, 0, 160, 160, 2)

    // 8 radial extensions
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const ext = box(60, 2, 40, ashStone)
      ext.position.set(Math.cos(angle) * 100, 1, Math.sin(angle) * 100)
      ext.rotation.y = angle + Math.PI / 2
      group.add(ext)
      this.addWalkable(px, py, pz, Math.cos(angle) * 100, Math.sin(angle) * 100, 40, 60, 2)
    }

    // ── Outer ring — 40 wall segments ─────────────────────────────────────
    for (let i = 0; i < 40; i++) {
      const angle = i * (Math.PI * 2 / 40)
      const isGate = i % 5 === 0 && i % 8 === 0  // will handle gates separately
      let wallH = 30
      let tilt = 0
      let yOff = 0

      if (i % 5 === 0) {
        // ruined — dropped + tilted
        wallH = 22; tilt = 0.15; yOff = -8
      } else if (i % 3 === 0) {
        // damaged — shorter + slightly tilted
        wallH = 20; tilt = 0.1
      }

      // Skip gate positions (every 5th of the 8 arches = i divisible by (40/8)=5)
      const isGatePos = i % (40 / 8) < 1
      if (isGatePos) {
        // Gate arch: two pillars + lintel
        const angleOff = Math.PI * 2 / 40 * 0.4
        for (const side of [-1, 1]) {
          const pa = angle + side * angleOff
          const pillar = box(6, 28, 6, darkAsh)
          pillar.position.set(Math.cos(pa) * 130, 14, Math.sin(pa) * 130)
          group.add(pillar)
        }
        const lintel = box(20, 4, 6, darkAsh)
        lintel.position.set(Math.cos(angle) * 130, 28, Math.sin(angle) * 130)
        lintel.rotation.y = angle + Math.PI / 2
        group.add(lintel)
        continue
      }

      const seg = box(12, wallH, 8, ashStone)
      seg.position.set(Math.cos(angle) * 130, wallH / 2 + yOff, Math.sin(angle) * 130)
      seg.rotation.y = angle + Math.PI / 2
      seg.rotation.z = tilt * (i % 2 === 0 ? 1 : -1)
      group.add(seg)

      // Emissive crack on some walls
      if (i % 7 === 0) {
        const crack = box(1, wallH * 0.6, 0.5, crackMat)
        crack.position.set(Math.cos(angle) * 130, wallH * 0.3 + yOff, Math.sin(angle) * 130)
        group.add(crack)
      }
    }

    // ── Inner ring — 20 segments ──────────────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const angle = i * (Math.PI * 2 / 20)
      const seg = box(8, 18, 6, darkAsh)
      seg.position.set(Math.cos(angle) * 85, 9, Math.sin(angle) * 85)
      seg.rotation.y = angle + Math.PI / 2
      group.add(seg)
    }

    // ── 4 spectator boxes at N/S/E/W ──────────────────────────────────────
    for (const [sx, sz] of [[0,-85],[0,85],[-85,0],[85,0]] as [number,number][]) {
      const specBox = box(30, 8, 20, darkAsh)
      specBox.position.set(sx, 6, sz)
      group.add(specBox)
      this.addWalkable(px, py, pz, sx, sz, 30, 20, 10)

      // Stairs to spectator boxes (5 steps)
      const inX = sx === 0 ? 0 : -sx / Math.abs(sx)
      const inZ = sz === 0 ? 0 : -sz / Math.abs(sz)
      for (let step = 0; step < 5; step++) {
        const s = box(8, 1, 3, ashStone)
        s.position.set(sx + inX * (8 + step * 2), step * 2 + 0.5, sz + inZ * (8 + step * 2))
        group.add(s)
        this.addWalkable(px, py, pz, sx + inX * (8 + step * 2), sz + inZ * (8 + step * 2), 8, 3, step * 2 + 1)
      }
    }

    // ── Underground fighter tunnel (N-S) ──────────────────────────────────
    const tunnelFloor = box(12, 1, 180, darkAsh)
    tunnelFloor.position.set(0, -7.5, 0)
    group.add(tunnelFloor)
    this.addWalkable(px, py, pz, 0, 0, 12, 180, -7)

    const tunnelCeil = box(12, 1, 180, darkAsh)
    tunnelCeil.position.set(0, -1.5, 0)
    group.add(tunnelCeil)

    // ── Rubble piles at 3 ruined wall sites ───────────────────────────────
    for (const [rx, rz] of [[110,-60],[-100,70],[130,30]] as [number,number][]) {
      for (let r = 0; r < 5; r++) {
        const rw = 3 + Math.random() * 5
        const rh = 2 + Math.random() * 4
        const rd = 3 + Math.random() * 3
        const rubble = box(rw, rh, rd, ashStone)
        rubble.position.set(rx + (Math.random() - 0.5) * 12,
          rh / 2, rz + (Math.random() - 0.5) * 12)
        rubble.rotation.y = Math.random() * Math.PI
        group.add(rubble)
      }
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,   0, 4,  0, 0xff3300, 1.5, 60)
    this.addPointLight(group,  80, 4,  0, 0xcc4422, 1.0, 30)
    this.addPointLight(group, -80, 4,  0, 0xcc4422, 1.0, 30)
    this.addPointLight(group,   0, 4, 80, 0xff3300, 1.0, 30)
    this.addPointLight(group,   0, 4,-80, 0xff3300, 1.0, 30)
    this.addPointLight(group,   0, 8,-85, 0xcc4422, 0.8, 20)
    this.addPointLight(group,   0, 8, 85, 0xcc4422, 0.8, 20)
    this.addPointLight(group,   0,-5,  0, 0xff3300, 0.6, 25)

    // ── Particles — 60 ash + 20 embers ────────────────────────────────────
    const ashCount = 60
    const ashPos = new Float32Array(ashCount * 3)
    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3 + 0] = (Math.random() - 0.5) * 280
      ashPos[i * 3 + 1] = Math.random() * 40
      ashPos[i * 3 + 2] = (Math.random() - 0.5) * 280
    }
    const ageo = new THREE.BufferGeometry()
    ageo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3))
    this.ashParticles = new THREE.Points(ageo, new THREE.PointsMaterial({
      color: 0x888880, size: 0.15, sizeAttenuation: true,
      transparent: true, opacity: 0.55, depthWrite: false,
    }))
    this.ashParticles.position.set(px, py, pz)
    scene.add(this.ashParticles)

    const emberCount = 20
    const emberPos = new Float32Array(emberCount * 3)
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3 + 0] = (Math.random() - 0.5) * 160
      emberPos[i * 3 + 1] = Math.random() * 20
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const egeo = new THREE.BufferGeometry()
    egeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3))
    this.embers = new THREE.Points(egeo, new THREE.PointsMaterial({
      color: 0xff5500, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.8, depthWrite: false,
    }))
    this.embers.position.set(px, py + 2, pz)
    scene.add(this.embers)
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
    if (this.ashParticles) {
      const pos = this.ashParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.2 + i * 0.7) * delta * 0.5)
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.2 + i * 0.9) * delta * 0.5)
        pos.setY(i, pos.getY(i) + delta * 0.08)
        if (pos.getY(i) > 40) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
    if (this.embers) {
      const pos = this.embers.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + delta * (0.5 + Math.random() * 0.3))
        if (pos.getY(i) > 20) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
  }
}
