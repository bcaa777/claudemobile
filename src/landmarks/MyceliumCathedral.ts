import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class MyceliumCathedral {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private spores: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const capMat   = new THREE.MeshLambertMaterial({ color: 0x6622aa, map: texGen.getTexture('mushroom', 0x6622aa).map })
    const stemMat  = new THREE.MeshLambertMaterial({ color: 0x3a1a60, map: texGen.getTexture('mushroom', 0x3a1a60).map })
    const glowMat  = new THREE.MeshBasicMaterial({ color: 0xff88ff, map: texGen.getTexture('mushroomGlow', 0xff88ff).map })
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x331a44, map: texGen.getTexture('mushroom', 0x331a44).map })
    const dimGlow  = new THREE.MeshBasicMaterial({ color: 0xaa44bb, map: texGen.getTexture('mushroomGlow', 0xaa44bb).map })

    // ── Ground slab ───────────────────────────────────────────────────────
    const ground = box(240, 2, 240, groundMat)
    ground.position.set(0, 1, 0)
    group.add(ground)
    this.addWalkable(px, py, pz, 0, 0, 240, 240, 2)

    // ── Central stem ─────────────────────────────────────────────────────
    const stem = box(40, 100, 40, stemMat)
    stem.position.set(0, 50, 0)
    group.add(stem)

    // ── Central cap ──────────────────────────────────────────────────────
    const cap = box(200, 12, 200, capMat)
    cap.position.set(0, 106, 0)
    group.add(cap)

    // Cap underside glow
    const capGlow = box(196, 2, 196, glowMat)
    capGlow.position.set(0, 102, 0)
    group.add(capGlow)

    // Cap top surface — massive walkable platform
    const capTop = box(190, 1, 190, groundMat)
    capTop.position.set(0, 112.5, 0)
    group.add(capTop)
    this.addWalkable(px, py, pz, 0, 0, 190, 190, 113)

    // ── 8 medium mushrooms ────────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const mx = Math.cos(angle) * 80
      const mz = Math.sin(angle) * 80

      const mStem = box(16, 50, 16, stemMat)
      mStem.position.set(mx, 25, mz)
      group.add(mStem)

      const mCap = box(80, 6, 80, capMat)
      mCap.position.set(mx, 53, mz)
      group.add(mCap)

      const mGlow = box(76, 2, 76, glowMat)
      mGlow.position.set(mx, 50, mz)
      group.add(mGlow)
    }

    // ── 16 small mushrooms ────────────────────────────────────────────────
    for (let i = 0; i < 16; i++) {
      const angle = i * (Math.PI * 2 / 16)
      const sx = Math.cos(angle) * 140
      const sz = Math.sin(angle) * 140

      const sStem = box(6, 18, 6, stemMat)
      sStem.position.set(sx, 9, sz)
      group.add(sStem)

      const sCap = box(24, 4, 24, capMat)
      sCap.position.set(sx, 20, sz)
      group.add(sCap)
    }

    // ── Base room ─────────────────────────────────────────────────────────
    const baseFloor = box(34, 1, 34, groundMat)
    baseFloor.position.set(0, 2.5, 0)
    group.add(baseFloor)
    this.addWalkable(px, py, pz, 0, 0, 34, 34, 3)

    // 4 bioluminescent pillars inside base
    for (const [bx, bz] of [[-12,-12],[12,-12],[-12,12],[12,12]] as [number,number][]) {
      const pillar = box(3, 12, 3, dimGlow)
      pillar.position.set(bx, 8, bz)
      group.add(pillar)
    }

    // ── Spiral stairs from base to cap top ───────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI * 2 / 8)
      const stepY = 2 + i * (110 / 7)
      const step = box(8, 1, 5, stemMat)
      step.position.set(Math.cos(angle) * 24, stepY + 0.5, Math.sin(angle) * 24)
      step.rotation.y = angle
      group.add(step)
      this.addWalkable(px, py, pz, Math.cos(angle) * 24, Math.sin(angle) * 24, 8, 5, stepY + 1)
    }

    // ── Lights ────────────────────────────────────────────────────────────
    this.addPointLight(group,  0,  4,   0, 0x8833cc, 1.2, 40)
    this.addPointLight(group, 80,  20,  0, 0x33aaaa, 0.8, 30)
    this.addPointLight(group,-80,  20,  0, 0x33aaaa, 0.8, 30)
    this.addPointLight(group,  0,  20, 80, 0xff44cc, 0.7, 30)
    this.addPointLight(group,  0,  20,-80, 0xff44cc, 0.7, 30)
    this.addPointLight(group,  0, 108,  0, 0x8833cc, 1.5, 80)
    this.addPointLight(group, 60, 108,  0, 0x33aaaa, 0.9, 40)
    this.addPointLight(group,-60, 108,  0, 0xff44cc, 0.9, 40)
    this.addPointLight(group,  0, 108, 60, 0x8833cc, 0.9, 40)
    this.addPointLight(group,  0, 108,-60, 0x33aaaa, 0.9, 40)

    // ── Particles — 80 spores ────────────────────────────────────────────
    const count = 80
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Start from cap rim area
      const angle = Math.random() * Math.PI * 2
      const r = 40 + Math.random() * 10
      positions[i * 3 + 0] = Math.cos(angle) * r
      positions[i * 3 + 1] = 56 + Math.random() * 15
      positions[i * 3 + 2] = Math.sin(angle) * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.spores = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcc66ff, size: 0.22, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    }))
    this.spores.position.set(px, py, pz)
    scene.add(this.spores)
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
      this.torchLights[i].intensity = base * (0.75 + 0.4 * Math.sin(time * 3 + i * 1.9))
    }
    if (this.spores) {
      const pos = this.spores.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.4 + i * 1.2) * delta * 0.3)
        pos.setY(i, pos.getY(i) + delta * (0.3 + (i % 5) * 0.05))
        pos.setZ(i, pos.getZ(i) + Math.cos(time * 0.3 + i * 1.4) * delta * 0.3)
        if (pos.getY(i) > 75) pos.setY(i, 56)
        const r = Math.sqrt(pos.getX(i) ** 2 + pos.getZ(i) ** 2)
        if (r > 60) {
          const angle = Math.random() * Math.PI * 2
          const nr = 40 + Math.random() * 10
          pos.setX(i, Math.cos(angle) * nr)
          pos.setZ(i, Math.sin(angle) * nr)
        }
      }
      pos.needsUpdate = true
    }
  }
}
