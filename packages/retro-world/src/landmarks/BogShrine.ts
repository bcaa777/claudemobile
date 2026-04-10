import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateParticles, updateTorches } from './landmarkUtils'

export class BogShrine {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private particles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const mossMat      = new THREE.MeshLambertMaterial({ color: 0x2a3a1a, map: texGen.getTexture('moss', 0x2a3a1a).map })
    const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x1e2e1e, map: texGen.getTexture('stone', 0x1e2e1e).map })
    const woodMat      = new THREE.MeshLambertMaterial({ color: 0x3a2810, map: texGen.getTexture('wood', 0x3a2810).map })
    const lanternGlow  = new THREE.MeshBasicMaterial({ color: 0x88ff66 })
    const waterMat     = new THREE.MeshBasicMaterial({
      color: 0x1a3a1a, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
    })

    // ── Foundation (half-sunken) ────────────────────────────────────────
    const foundation = box(120, 3, 120, darkStoneMat)
    foundation.position.set(0, -1.5, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 120, 120, 0)

    // ── Murky water pool ────────────────────────────────────────────────
    const waterPool = box(110, 0.5, 110, waterMat)
    waterPool.position.set(0, 0.5, 0)
    group.add(waterPool)

    // ── Central stone altar ─────────────────────────────────────────────
    const altar = box(40, 20, 40, mossMat)
    altar.position.set(0, 10, 0)
    group.add(altar)

    // Altar top slab
    const altarTop = box(44, 2, 44, darkStoneMat)
    altarTop.position.set(0, 21, 0)
    group.add(altarTop)
    this.addWalkable(px, py, pz, 0, 0, 44, 44, 22)

    // ── 8 standing stones in ring ───────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const sx = Math.cos(angle) * 50
      const sz = Math.sin(angle) * 50
      const stone = box(8, 28 + (i % 3) * 4, 6, darkStoneMat)
      stone.position.set(sx, 14 + (i % 3) * 2, sz)
      stone.rotation.x = (Math.random() - 0.5) * 0.12
      stone.rotation.z = (Math.random() - 0.5) * 0.12
      stone.rotation.y = angle
      group.add(stone)
    }

    // ── 4 lantern posts ─────────────────────────────────────────────────
    const lanternPos: [number, number][] = [
      [-30, -30], [30, -30], [-30, 30], [30, 30],
    ]
    for (const [lx, lz] of lanternPos) {
      // Tall wood pole
      const pole = box(3, 36, 3, woodMat)
      pole.position.set(lx, 18, lz)
      group.add(pole)

      // Glowing lantern box on top
      const lantern = box(5, 5, 5, lanternGlow)
      lantern.position.set(lx, 38, lz)
      group.add(lantern)
    }

    // ── Sunken walkway approaching from south ───────────────────────────
    for (let i = 0; i < 6; i++) {
      const plank = box(14, 1, 6, woodMat)
      plank.position.set(0, 0.5, 60 + i * 10)
      plank.rotation.y = (Math.random() - 0.5) * 0.08
      group.add(plank)
    }
    this.addWalkable(px, py, pz, 0, 90, 14, 60, 1)

    // ── Lights (dim green) ──────────────────────────────────────────────
    this.addPointLight(group, 0, 24, 0, 0x66ff44, 0.6, 45)
    this.addPointLight(group, 30, 38, 30, 0x66ff44, 0.4, 30)

    // ── Will-o-wisp particles ───────────────────────────────────────────
    const count = 35
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x66ff44, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.75, depthWrite: false,
    }))
    this.particles.position.set(px, py, pz)
    scene.add(this.particles)
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
    updateParticles(this.particles, delta, time)
  }
}
