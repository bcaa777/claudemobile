import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class GreatPyramid {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private heatShimmer: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const sandMat  = new THREE.MeshLambertMaterial({ color: 0xd4952a, map: texGen.getTexture('sand', 0xd4952a).map })
    const darkMat  = new THREE.MeshLambertMaterial({ color: 0xaa7020, map: texGen.getTexture('sand', 0xaa7020).map })
    const goldMat  = new THREE.MeshLambertMaterial({ color: 0xffcc44, map: texGen.getTexture('gold', 0xffcc44).map })
    const innerMat = new THREE.MeshLambertMaterial({ color: 0x8a5c18, map: texGen.getTexture('darkStone', 0x8a5c18).map })

    // ── 5 pyramid tiers ──────────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const size = 200 - i * 40
      const tier = box(size, 20, size, sandMat)
      tier.position.set(0, 10 + i * 20, 0)
      group.add(tier)
    }

    // Capstone
    const capstone = box(12, 12, 12, goldMat)
    capstone.position.set(0, 106, 0)
    group.add(capstone)

    // ── South ramp — 5 angled slabs + landings ───────────────────────────
    for (let i = 0; i < 5; i++) {
      const ramp = box(12, 4, 22, sandMat)
      ramp.position.set(0, 22 + i * 20, 100 - i * 40 + 11)
      ramp.rotation.x = -Math.atan2(20, 22)
      group.add(ramp)
      // flat landing between tiers
      if (i < 4) {
        const landing = box(14, 1, 8, sandMat)
        landing.position.set(0, 20 + i * 20, 100 - i * 40 - 4)
        group.add(landing)
        this.addWalkable(px, py, pz, 0, 100 - i * 40 - 4, 14, 8, 20 + i * 20 + 0.5)
      }
    }

    // Summit walkable
    const summit = box(38, 1, 38, innerMat)
    summit.position.set(0, 100.5, 0)
    group.add(summit)
    this.addWalkable(px, py, pz, 0, 0, 38, 38, 101)

    // ── Sphinx ────────────────────────────────────────────────────────────
    const sphinxBody = box(60, 20, 15, sandMat)
    sphinxBody.position.set(0, 10, 130)
    group.add(sphinxBody)
    const sphinxHead = box(12, 20, 10, sandMat)
    sphinxHead.position.set(0, 28, 120)
    group.add(sphinxHead)
    const pawL = box(8, 4, 18, sandMat)
    pawL.position.set(-16, 2, 130)
    group.add(pawL)
    const pawR = box(8, 4, 18, sandMat)
    pawR.position.set(16, 2, 130)
    group.add(pawR)

    // ── Interior burial corridor (N-S through Tier 0) ─────────────────────
    const corrWallL = box(2, 12, 180, innerMat)
    corrWallL.position.set(-7, 6, 0)
    group.add(corrWallL)
    const corrWallR = box(2, 12, 180, innerMat)
    corrWallR.position.set(7, 6, 0)
    group.add(corrWallR)
    const corrFloor = box(12, 1, 180, innerMat)
    corrFloor.position.set(0, 0.5, 0)
    group.add(corrFloor)

    // Burial chamber floor (40×40 at y=2.5 walkable)
    const chamberFloor = box(40, 1, 40, innerMat)
    chamberFloor.position.set(0, 2.5, 0)
    group.add(chamberFloor)
    this.addWalkable(px, py, pz, 0, 0, 40, 40, 3)

    // Sarcophagus
    const sarc = box(10, 4, 22, darkMat)
    sarc.position.set(0, 4, 0)
    group.add(sarc)
    const sarcLid = box(9.5, 1, 21.5, darkMat)
    sarcLid.position.set(0, 6.5, 0)
    sarcLid.rotation.z = 0.03
    group.add(sarcLid)

    // ── Mid-chamber at y=40 ───────────────────────────────────────────────
    const midFloor = box(70, 1, 70, innerMat)
    midFloor.position.set(0, 40.5, 0)
    group.add(midFloor)
    this.addWalkable(px, py, pz, 0, 0, 70, 70, 41)

    for (const [cx, cz] of [[-20,-20],[20,-20],[-20,20],[20,20]] as [number,number][]) {
      const col = box(6, 16, 6, darkMat)
      col.position.set(cx, 48, cz)
      group.add(col)
    }

    // ── Summit platform ───────────────────────────────────────────────────
    // 4 corner torch pillars
    for (const [cx, cz] of [[-16,-16],[16,-16],[-16,16],[16,16]] as [number,number][]) {
      const pillar = box(2, 8, 2, darkMat)
      pillar.position.set(cx, 104, cz)
      group.add(pillar)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0, 8,  0, 0xffcc44, 1.2, 40)
    this.addPointLight(group,  0, 8, 80, 0xffaa22, 0.8, 30)
    this.addPointLight(group,  0, 8,-80, 0xffaa22, 0.8, 30)
    this.addPointLight(group,  0, 44, 0, 0xffcc44, 1.0, 40)
    this.addPointLight(group,  0, 102,0, 0xffcc44, 1.4, 50)
    this.addPointLight(group, 80, 30, 0, 0xffaa22, 0.7, 20)

    // ── Particles — 30 heat shimmer at capstone ───────────────────────────
    const count = 30
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 20
      positions[i * 3 + 1] = Math.random() * 20
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pMat = new THREE.PointsMaterial({
      color: 0xffaa44, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.7, depthWrite: false,
    })
    this.heatShimmer = new THREE.Points(geo, pMat)
    this.heatShimmer.position.set(px, py + 53, pz)
    scene.add(this.heatShimmer)
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
    if (this.heatShimmer) {
      const pos = this.heatShimmer.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 1.2 + i * 0.8) * delta * 0.3)
        pos.setY(i, pos.getY(i) + delta * (0.6 + Math.random() * 0.4))
        if (pos.getY(i) > 20) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }
  }
}
