import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class CrystalCathedral {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private crystalShards: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const crystalMat = new THREE.MeshLambertMaterial({
      color: 0x4466bb, transparent: true, opacity: 0.85,
    })
    const darkMat  = new THREE.MeshLambertMaterial({ color: 0x2233aa })
    const glowMat  = new THREE.MeshBasicMaterial({ color: 0x88aaff })
    const baseMat  = new THREE.MeshLambertMaterial({ color: 0x334466 })

    // ── Foundation ────────────────────────────────────────────────────────
    const foundation = box(180, 4, 180, baseMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 180, 180, 0)

    // ── Central spire ─────────────────────────────────────────────────────
    const centralSpire = box(18, 140, 18, crystalMat)
    centralSpire.position.set(0, 70, 0)
    group.add(centralSpire)

    // ── 6 flanking spires ─────────────────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const angle = i * (Math.PI * 2 / 6)
      const sx = Math.cos(angle) * 60
      const sz = Math.sin(angle) * 60
      const spire = box(12, 90, 12, crystalMat)
      spire.position.set(sx, 45, sz)
      spire.rotation.x = Math.sin(i) * 0.06
      spire.rotation.z = Math.cos(i) * 0.04
      group.add(spire)

      // Shard clusters at base
      for (let s = 0; s < 3; s++) {
        const shard = box(4, 8, 4, glowMat)
        shard.position.set(sx + Math.cos(i + s) * 8, 4, sz + Math.sin(i + s) * 8)
        shard.rotation.z = (Math.random() - 0.5) * 0.4
        group.add(shard)
      }
    }

    // ── Crystal wall panels between spires ────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const a1 = i * (Math.PI * 2 / 6)
      const a2 = (i + 1) * (Math.PI * 2 / 6)
      const midAngle = (a1 + a2) / 2
      const panel = box(3, 60, 55, new THREE.MeshLambertMaterial({
        color: 0x3355bb, transparent: true, opacity: 0.5,
      }))
      panel.position.set(Math.cos(midAngle) * 50, 30, Math.sin(midAngle) * 50)
      panel.rotation.y = midAngle + Math.PI / 2
      group.add(panel)
    }

    // ── Grand entrance south ──────────────────────────────────────────────
    const entPillarL = box(6, 40, 6, baseMat)
    entPillarL.position.set(-12, 20, 90)
    group.add(entPillarL)
    const entPillarR = box(6, 40, 6, baseMat)
    entPillarR.position.set(12, 20, 90)
    group.add(entPillarR)
    const entLintel = box(30, 5, 4, baseMat)
    entLintel.position.set(0, 36, 90)
    group.add(entLintel)

    // ── Interior nave floor ───────────────────────────────────────────────
    const nave = box(100, 1, 60, baseMat)
    nave.position.set(0, 2.5, 0)
    group.add(nave)
    this.addWalkable(px, py, pz, 0, 0, 100, 60, 3)

    // 6 nave columns in 2 rows
    for (const cx of [-30, 0, 30]) {
      for (const cz of [-18, 18]) {
        const col = box(6, 30, 6, darkMat)
        col.position.set(cx, 17, cz)
        group.add(col)
      }
    }

    // Crystal altar
    const altarBase = box(14, 4, 10, baseMat)
    altarBase.position.set(0, 4, -25)
    group.add(altarBase)
    const altarGlow = box(12, 1, 8, glowMat)
    altarGlow.position.set(0, 6.5, -25)
    group.add(altarGlow)
    this.addWalkable(px, py, pz, 0, -25, 14, 10, 6.5)

    // ── Mid-gallery at y=40 ───────────────────────────────────────────────
    for (const [gx, gz, gw, gd] of [
      [-50, 0, 16, 100], [50, 0, 16, 100],
    ] as [number,number,number,number][]) {
      const gallery = box(gw, 1, gd, baseMat)
      gallery.position.set(gx, 40.5, gz)
      group.add(gallery)
      this.addWalkable(px, py, pz, gx, gz, gw, gd, 41)
    }

    // Gallery stairs (8 steps on W wall)
    for (let step = 0; step < 8; step++) {
      const s = box(6, 1, 3, baseMat)
      s.position.set(-46, step * 5 + 2.5, -30 + step * 2)
      group.add(s)
      this.addWalkable(px, py, pz, -46, -30 + step * 2, 6, 3, step * 5 + 3)
    }

    // Spiral stairs around central spire (12 steps)
    for (let i = 0; i < 12; i++) {
      const angle = i * (Math.PI * 2 / 12)
      const stepY = 2 + i * (136 / 11)
      const step = box(8, 1, 4, baseMat)
      step.position.set(Math.cos(angle) * 14, stepY + 0.5, Math.sin(angle) * 14)
      step.rotation.y = angle
      group.add(step)
      this.addWalkable(px, py, pz, Math.cos(angle) * 14, Math.sin(angle) * 14, 8, 4, stepY + 1)
    }

    // Central spire summit
    const summit = box(16, 1, 16, glowMat)
    summit.position.set(0, 138.5, 0)
    group.add(summit)
    this.addWalkable(px, py, pz, 0, 0, 16, 16, 139)

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0,  5,  0, 0x6688ff, 1.0, 60)
    this.addPointLight(group, 50,  5,  0, 0xaa66ff, 0.8, 40)
    this.addPointLight(group,-50,  5,  0, 0xaa66ff, 0.8, 40)
    this.addPointLight(group,  0,  5, 50, 0x6688ff, 0.8, 40)
    this.addPointLight(group,  0,  5,-50, 0x6688ff, 0.8, 40)
    this.addPointLight(group,  0, 42,  0, 0xeeeeff, 1.2, 60)
    this.addPointLight(group,  0,140,  0, 0x6688ff, 1.5, 80)
    this.addPointLight(group,  0, 80,  0, 0xaa66ff, 0.9, 50)

    // ── Particles — 50 crystal shards ─────────────────────────────────────
    const count = 50
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 140
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.crystalShards = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x88aaff, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.8, depthWrite: false,
    }))
    this.crystalShards.position.set(px, py, pz)
    scene.add(this.crystalShards)
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
      this.torchLights[i].intensity = base * (0.85 + 0.22 * Math.sin(time * 3 + i * 1.6))
    }
    if (this.crystalShards) {
      const pos = this.crystalShards.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.6 + i * 1.2) * delta * 0.25)
        pos.setY(i, pos.getY(i) + delta * 0.15)
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.5 + i * 0.9) * delta * 0.25)
        if (pos.getY(i) > 145) pos.setY(i, 0)
        if (Math.abs(pos.getX(i)) > 90) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(pos.getZ(i)) > 90) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
