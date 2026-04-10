import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box } from './landmarkUtils'

export class CloudTemple {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private motes: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const marbleMat = new THREE.MeshLambertMaterial({ color: 0xfff8f0, map: texGen.getTexture('marble', 0xfff8f0).map })
    const goldMat   = new THREE.MeshLambertMaterial({ color: 0xdaa520, map: texGen.getTexture('gold', 0xdaa520).map })
    const glowMat   = new THREE.MeshBasicMaterial({ color: 0xffeedd, map: texGen.getTexture('beaconGlow', 0xffeedd).map })

    // ── Foundation ──────────────────────────────────────────────────────
    const foundation = box(200, 4, 200, marbleMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 200, 200, 0)

    // ── Ring of 12 tall pillars ────────────────────────────────────────
    const pillarRadius = 60  // ~15 world units
    for (let i = 0; i < 12; i++) {
      const angle = i * (Math.PI * 2 / 12)
      const pillar = box(8, 60, 8, marbleMat)
      pillar.position.set(Math.cos(angle) * pillarRadius, 30, Math.sin(angle) * pillarRadius)
      group.add(pillar)
    }

    // ── Golden arches connecting pillars ────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const a1 = i * (Math.PI * 2 / 12)
      const a2 = (i + 1) * (Math.PI * 2 / 12)
      const midAngle = (a1 + a2) / 2
      const arch = box(18, 6, 8, goldMat)
      arch.position.set(Math.cos(midAngle) * pillarRadius, 62, Math.sin(midAngle) * pillarRadius)
      arch.rotation.y = midAngle + Math.PI / 2
      group.add(arch)
    }

    // ── Central altar platform (walkable) ──────────────────────────────
    const altarBase = box(24, 6, 24, marbleMat)
    altarBase.position.set(0, 3, 0)
    group.add(altarBase)
    this.addWalkable(px, py, pz, 0, 0, 24, 24, 6)

    // ── Golden crystal column at center ────────────────────────────────
    const crystal = box(6, 40, 6, glowMat)
    crystal.position.set(0, 26, 0)
    group.add(crystal)

    // Crystal cap
    const cap = box(10, 4, 10, goldMat)
    cap.position.set(0, 48, 0)
    group.add(cap)

    // ── Upper platform (accessed via small stairs) ─────────────────────
    const upperPlatformY = 32  // +8 world units above ground
    const upperPlatform = box(16, 4, 16, goldMat)
    upperPlatform.position.set(0, upperPlatformY, 0)
    group.add(upperPlatform)
    this.addWalkable(px, py, pz, 0, 0, 16, 16, upperPlatformY + 2)

    // Internal stairs from altar to upper platform (8 steps)
    for (let i = 0; i < 8; i++) {
      const stepY = 6 + (i + 1) * ((upperPlatformY - 6) / 8)
      const s = box(6, 1.5, 3, marbleMat)
      s.position.set(12 + i * 1.5, stepY, 0)
      group.add(s)
      this.addWalkable(px, py, pz, 12 + i * 1.5, 0, 6, 3, stepY + 0.75)
    }

    // ── Golden railings ────────────────────────────────────────────────
    for (const [rx, rz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const railing = box(
        rx === 0 ? 16 : 1.5,
        6,
        rz === 0 ? 16 : 1.5,
        goldMat
      )
      railing.position.set(
        rx * 9,
        upperPlatformY + 5,
        rz * 9
      )
      group.add(railing)
    }

    // ── Lights ──────────────────────────────────────────────────────────
    this.addPointLight(group, 0, 50, 0, 0xffeedd, 2.0, 50)
    this.addPointLight(group, 40, 10, 0, 0xffcc66, 0.8, 25)
    this.addPointLight(group, -40, 10, 0, 0xffcc66, 0.8, 25)
    this.addPointLight(group, 0, 10, 40, 0xffcc66, 0.8, 25)
    this.addPointLight(group, 0, 10, -40, 0xffcc66, 0.8, 25)

    // ── Floating golden motes ──────────────────────────────────────────
    const count = 40
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 120
      positions[i * 3 + 1] = Math.random() * 60
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffeedd, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    })
    this.motes = new THREE.Points(geo, mat)
    this.motes.position.set(px, py, pz)
    scene.add(this.motes)
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
    color: number, intensity: number, distance: number) {
    if (this.torchLights.length >= 2) return
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(lx, ly, lz)
    group.add(light)
    this.torchLights.push(light)
    this.torchIntensities.push(intensity)
  }

  update(delta: number, time: number) {
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = this.torchIntensities[i]
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 5 + i * 1.7))
    }
    if (this.motes) {
      const pos = this.motes.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.3 + i * 2.1) * delta * 0.4)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.25 + i * 1.5) * delta * 0.2)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.35 + i * 1.8) * delta * 0.4)
        const y = pos.getY(i)
        if (y < 0 || y > 60) pos.setY(i, Math.random() * 60)
        if (Math.abs(pos.getX(i)) > 60) pos.setX(i, (Math.random() - 0.5) * 120)
        if (Math.abs(pos.getZ(i)) > 60) pos.setZ(i, (Math.random() - 0.5) * 120)
      }
      pos.needsUpdate = true
    }
  }
}
