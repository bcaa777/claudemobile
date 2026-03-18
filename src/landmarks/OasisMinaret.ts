import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class OasisMinaret {
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

    const sandstoneMat = new THREE.MeshLambertMaterial({ color: 0xd4aa66, map: texGen.getTexture('sandstone', 0xd4aa66).map })
    const goldMat      = new THREE.MeshLambertMaterial({ color: 0xdaa520, map: texGen.getTexture('gold', 0xdaa520).map })
    const marbleMat    = new THREE.MeshLambertMaterial({ color: 0xf0e8dd, map: texGen.getTexture('marble', 0xf0e8dd).map })
    const goldGlow     = new THREE.MeshBasicMaterial({ color: 0xffdd88 })
    const trunkMat     = new THREE.MeshLambertMaterial({ color: 0x6b4226 })
    const leafMat      = new THREE.MeshLambertMaterial({ color: 0x2d8a4e })
    const waterMat     = new THREE.MeshBasicMaterial({
      color: 0x4488cc, transparent: true, opacity: 0.6,
    })

    // ── Foundation ──────────────────────────────────────────────────────
    const foundation = box(160, 4, 160, sandstoneMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 160, 160, 0)

    // ── Central tower ───────────────────────────────────────────────────
    const tower = box(30, 120, 30, sandstoneMat)
    tower.position.set(0, 60, 0)
    group.add(tower)

    // Decorative trim bands
    for (let ty = 30; ty <= 100; ty += 35) {
      const trim = box(34, 2, 34, marbleMat)
      trim.position.set(0, ty, 0)
      group.add(trim)
    }

    // ── 3 balcony rings at intervals ────────────────────────────────────
    const balconyHeights = [40, 70, 100]
    for (const bh of balconyHeights) {
      const balcony = box(45, 6, 45, marbleMat)
      balcony.position.set(0, bh, 0)
      group.add(balcony)

      // Railing posts
      for (const rx of [-20, 20]) {
        for (const rz of [-20, 20]) {
          const post = box(2, 8, 2, sandstoneMat)
          post.position.set(rx, bh + 7, rz)
          group.add(post)
        }
      }

      this.addWalkable(px, py, pz, 0, 0, 45, 45, bh + 3)
    }

    // ── Golden dome on top ──────────────────────────────────────────────
    const dome = box(25, 15, 25, goldMat)
    dome.position.set(0, 127.5, 0)
    group.add(dome)

    // Dome taper
    const domeTip = box(16, 8, 16, goldMat)
    domeTip.position.set(0, 139, 0)
    group.add(domeTip)

    // ── Crescent finial ─────────────────────────────────────────────────
    const finial = box(4, 10, 2, goldGlow)
    finial.position.set(0, 148, 0)
    group.add(finial)

    const crescentBody = box(6, 6, 2, goldGlow)
    crescentBody.position.set(2, 152, 0)
    group.add(crescentBody)

    // ── Courtyard walkable area ─────────────────────────────────────────
    const courtyard = box(140, 1, 140, marbleMat)
    courtyard.position.set(0, 0.5, 0)
    group.add(courtyard)

    // ── 4 palm tree clusters ────────────────────────────────────────────
    const palmPositions: [number, number][] = [
      [-55, -55], [55, -55], [-55, 55], [55, 55],
    ]
    for (const [ptx, ptz] of palmPositions) {
      // Trunk
      const trunk = box(4, 30, 4, trunkMat)
      trunk.position.set(ptx, 15, ptz)
      trunk.rotation.x = (Math.random() - 0.5) * 0.15
      trunk.rotation.z = (Math.random() - 0.5) * 0.15
      group.add(trunk)

      // Canopy (wider green box)
      const canopy = box(18, 6, 18, leafMat)
      canopy.position.set(ptx, 33, ptz)
      group.add(canopy)

      // Secondary canopy layer
      const canopy2 = box(12, 4, 12, leafMat)
      canopy2.position.set(ptx, 38, ptz)
      group.add(canopy2)
    }

    // ── Decorative fountain in courtyard ────────────────────────────────
    // Stone ring
    const fountainRing = box(24, 6, 24, marbleMat)
    fountainRing.position.set(0, 3, 50)
    group.add(fountainRing)

    // Inner water
    const fountainWater = box(18, 1, 18, waterMat)
    fountainWater.position.set(0, 6.5, 50)
    group.add(fountainWater)

    // Central spout
    const spout = box(3, 10, 3, marbleMat)
    spout.position.set(0, 11, 50)
    group.add(spout)

    // ── Lights (golden) ─────────────────────────────────────────────────
    this.addPointLight(group, 0, 105, 0, 0xffdd88, 1.0, 60)
    this.addPointLight(group, 0, 6, 50, 0xffdd88, 0.7, 40)

    // ── Shimmer particles ───────────────────────────────────────────────
    const count = 25
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffdd88, size: 0.15, sizeAttenuation: true,
      transparent: true, opacity: 0.65, depthWrite: false,
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
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = this.torchIntensities[i]
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 7 + i * 1.3))
    }
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.5 + i * 2.1) * delta * 0.5)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.4 + i * 1.7) * delta * 0.25)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.6 + i * 1.3) * delta * 0.5)
        if (pos.getY(i) < 0 || pos.getY(i) > 50) pos.setY(i, Math.random() * 50)
        if (Math.abs(pos.getX(i)) > 80) pos.setX(i, (Math.random() - 0.5) * 160)
        if (Math.abs(pos.getZ(i)) > 80) pos.setZ(i, (Math.random() - 0.5) * 160)
      }
      pos.needsUpdate = true
    }
  }
}
