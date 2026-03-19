import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateParticles, updateTorches } from './landmarkUtils'

export class CliffFortress {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private windParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x445566, map: texGen.getTexture('darkStone', 0x445566).map })
    const stoneMat     = new THREE.MeshLambertMaterial({ color: 0x556677, map: texGen.getTexture('stone', 0x556677).map })
    const woodMat      = new THREE.MeshLambertMaterial({ color: 0x4a2810, map: texGen.getTexture('wood', 0x4a2810).map })

    // ── Foundation ──────────────────────────────────────────────────────────
    const foundation = box(220, 4, 180, stoneMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 220, 180, 0)

    // ── Tier 1 (bottom) ─────────────────────────────────────────────────────
    const tier1 = box(180, 30, 160, darkStoneMat)
    tier1.position.set(0, 15, 0)
    group.add(tier1)
    // Tier 1 top walkable
    this.addWalkable(px, py, pz, 0, 0, 180, 160, 30)

    // Tier 1 battlements
    for (let i = -80; i <= 80; i += 20) {
      const merlon = box(8, 8, 4, stoneMat)
      merlon.position.set(i, 34, -80)
      group.add(merlon)
      const merlon2 = box(8, 8, 4, stoneMat)
      merlon2.position.set(i, 34, 80)
      group.add(merlon2)
    }

    // ── Tier 2 (middle) ─────────────────────────────────────────────────────
    const tier2 = box(140, 30, 120, darkStoneMat)
    tier2.position.set(0, 45, 0)
    group.add(tier2)
    this.addWalkable(px, py, pz, 0, 0, 140, 120, 60)

    // Tier 2 battlements
    for (let i = -60; i <= 60; i += 20) {
      const merlon = box(8, 8, 4, stoneMat)
      merlon.position.set(i, 64, -60)
      group.add(merlon)
      const merlon2 = box(8, 8, 4, stoneMat)
      merlon2.position.set(i, 64, 60)
      group.add(merlon2)
    }

    // ── Tier 3 (top) ────────────────────────────────────────────────────────
    const tier3 = box(100, 30, 80, darkStoneMat)
    tier3.position.set(0, 75, 0)
    group.add(tier3)
    this.addWalkable(px, py, pz, 0, 0, 100, 80, 90)

    // Tier 3 battlements
    for (let i = -40; i <= 40; i += 20) {
      const merlon = box(8, 8, 4, stoneMat)
      merlon.position.set(i, 94, -40)
      group.add(merlon)
      const merlon2 = box(8, 8, 4, stoneMat)
      merlon2.position.set(i, 94, 40)
      group.add(merlon2)
    }

    // ── Central Keep ────────────────────────────────────────────────────────
    const keep = box(50, 60, 50, stoneMat)
    keep.position.set(0, 120, 0)
    group.add(keep)

    const keepRoof = box(54, 4, 54, woodMat)
    keepRoof.position.set(0, 152, 0)
    group.add(keepRoof)

    // ── Stairways between tiers ─────────────────────────────────────────────
    // Tier 1 → Tier 2 stairway (right side)
    for (let i = 0; i < 8; i++) {
      const stepY = 30 + (i + 1) * (30 / 8)
      const s = box(10, 1, 4, stoneMat)
      s.position.set(80, stepY - 0.5, -50 + i * 6)
      group.add(s)
      this.addWalkable(px, py, pz, 80, -50 + i * 6, 10, 4, stepY)
    }

    // Tier 2 → Tier 3 stairway (left side)
    for (let i = 0; i < 8; i++) {
      const stepY = 60 + (i + 1) * (30 / 8)
      const s = box(10, 1, 4, stoneMat)
      s.position.set(-60, stepY - 0.5, -40 + i * 6)
      group.add(s)
      this.addWalkable(px, py, pz, -60, -40 + i * 6, 10, 4, stepY)
    }

    // ── Lights ──────────────────────────────────────────────────────────────
    this.addPointLight(group, 0, 100, 0, 0x8899aa, 1.3, 40)
    this.addPointLight(group, 0,  40, 0, 0x778899, 1.0, 30)

    // ── Particles — 30 wind particles (grey) ────────────────────────────────
    const count = 30
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0x999999, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.7, depthWrite: false,
    })
    this.windParticles = new THREE.Points(geo, mat)
    this.windParticles.position.set(px, py, pz)
    scene.add(this.windParticles)
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
    updateTorches(this.torchLights, this.torchIntensities, time)
    updateParticles(this.windParticles, delta, time)
  }
}
