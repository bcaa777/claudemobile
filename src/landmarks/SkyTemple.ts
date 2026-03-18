import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class SkyTemple {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private shimmerParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const marbleMat  = new THREE.MeshLambertMaterial({ color: 0xe8e0d8, map: texGen.getTexture('stone', 0xe8e0d8).map })
    const goldMat    = new THREE.MeshLambertMaterial({ color: 0xdaa520, map: texGen.getTexture('stone', 0xdaa520).map })
    const crystalMat = new THREE.MeshLambertMaterial({ color: 0xaaccff, map: texGen.getTexture('stone', 0xaaccff).map, transparent: true, opacity: 0.8 })

    // ── Central Platform ────────────────────────────────────────────────────
    const platform = box(160, 6, 160, marbleMat)
    platform.position.set(0, -3, 0)
    group.add(platform)
    this.addWalkable(px, py, pz, 0, 0, 160, 160, 0)

    // ── 4 Floating Islands ──────────────────────────────────────────────────
    const islandOffsets: [number, number][] = [[120, 0], [-120, 0], [0, 120], [0, -120]]
    for (const [ix, iz] of islandOffsets) {
      const island = box(50, 6, 50, marbleMat)
      island.position.set(ix, -3, iz)
      group.add(island)
      this.addWalkable(px, py, pz, ix * 0.25, iz * 0.25, 50 * 0.25, 50 * 0.25, 0)
    }

    // ── Bridges connecting islands to center ────────────────────────────────
    // East bridge
    const bridgeE = box(40, 2, 12, marbleMat)
    bridgeE.position.set(95, -1, 0)
    group.add(bridgeE)
    this.addWalkable(px, py, pz, 95 * 0.25, 0, 40 * 0.25, 12 * 0.25, 0)

    // West bridge
    const bridgeW = box(40, 2, 12, marbleMat)
    bridgeW.position.set(-95, -1, 0)
    group.add(bridgeW)
    this.addWalkable(px, py, pz, -95 * 0.25, 0, 40 * 0.25, 12 * 0.25, 0)

    // North bridge
    const bridgeN = box(12, 2, 40, marbleMat)
    bridgeN.position.set(0, -1, -95)
    group.add(bridgeN)
    this.addWalkable(px, py, pz, 0, -95 * 0.25, 12 * 0.25, 40 * 0.25, 0)

    // South bridge
    const bridgeS = box(12, 2, 40, marbleMat)
    bridgeS.position.set(0, -1, 95)
    group.add(bridgeS)
    this.addWalkable(px, py, pz, 0, 95 * 0.25, 12 * 0.25, 40 * 0.25, 0)

    // ── Central Spire ───────────────────────────────────────────────────────
    const spire = box(20, 80, 20, marbleMat)
    spire.position.set(0, 40, 0)
    group.add(spire)

    const goldAccent = box(22, 6, 22, goldMat)
    goldAccent.position.set(0, 76, 0)
    group.add(goldAccent)

    // ── 4 Pillars in a ring (radius 60) ─────────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI * 2 / 4) + Math.PI / 4
      const pillar = box(10, 50, 10, marbleMat)
      pillar.position.set(Math.cos(angle) * 60, 25, Math.sin(angle) * 60)
      group.add(pillar)

      const pillarCap = box(14, 3, 14, goldMat)
      pillarCap.position.set(Math.cos(angle) * 60, 51.5, Math.sin(angle) * 60)
      group.add(pillarCap)
    }

    // ── Glowing Crystal at apex ─────────────────────────────────────────────
    const crystal = box(8, 12, 8, crystalMat)
    crystal.position.set(0, 88, 0)
    crystal.rotation.y = Math.PI / 4
    group.add(crystal)

    // ── Lights ──────────────────────────────────────────────────────────────
    this.addPointLight(group, 0, 90, 0, 0xaaccff, 1.5, 50)
    this.addPointLight(group, 0, 20, 0, 0xe8e0d8, 1.0, 35)

    // ── Particles — 50 shimmer particles (white-blue) ───────────────────────
    const count = 50
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xccddff, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    })
    this.shimmerParticles = new THREE.Points(geo, mat)
    this.shimmerParticles.position.set(px, py, pz)
    scene.add(this.shimmerParticles)
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
    if (this.shimmerParticles) {
      const pos = this.shimmerParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.5 + i * 2.1) * delta * 0.5)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.4 + i * 1.7) * delta * 0.25)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.6 + i * 1.3) * delta * 0.5)
        const y = pos.getY(i)
        if (y < 0 || y > 50) pos.setY(i, Math.random() * 50)
        const x = pos.getX(i), z = pos.getZ(i)
        if (Math.abs(x) > 80) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(z) > 80) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
