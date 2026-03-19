import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateParticles, updateTorches } from './landmarkUtils'

export class CoralPalace {
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

    const coralMat   = new THREE.MeshLambertMaterial({ color: 0xff6688, map: texGen.getTexture('coral', 0xff6688).map })
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x44ddcc, map: texGen.getTexture('crystalGlow', 0x44ddcc).map })
    const marbleMat  = new THREE.MeshLambertMaterial({ color: 0xeeddcc, map: texGen.getTexture('marble', 0xeeddcc).map })

    // ── Foundation ───────────────────────────────────────────────────────
    const foundation = box(180, 4, 180, coralMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 180, 180, 0)

    // ── 4 coral towers at corners ───────────────────────────────────────
    const towerPos: [number, number][] = [
      [-70, -70], [70, -70], [-70, 70], [70, 70],
    ]
    for (const [tx, tz] of towerPos) {
      const tower = box(30, 60, 30, coralMat)
      tower.position.set(tx, 30, tz)
      group.add(tower)

      // Tapered top
      const taper = box(22, 16, 22, coralMat)
      taper.position.set(tx, 68, tz)
      group.add(taper)

      const tip = box(14, 10, 14, crystalMat)
      tip.position.set(tx, 81, tz)
      group.add(tip)
    }

    // ── Central dome palace ─────────────────────────────────────────────
    const dome = box(80, 40, 80, marbleMat)
    dome.position.set(0, 20, 0)
    group.add(dome)

    // Dome cap
    const domeCap = box(60, 12, 60, coralMat)
    domeCap.position.set(0, 46, 0)
    group.add(domeCap)

    const domeTop = box(40, 8, 40, crystalMat)
    domeTop.position.set(0, 54, 0)
    group.add(domeTop)

    // ── Interior hall floor ─────────────────────────────────────────────
    const hallFloor = box(60, 1, 60, marbleMat)
    hallFloor.position.set(0, 1.5, 0)
    group.add(hallFloor)
    this.addWalkable(px, py, pz, 0, 0, 60, 60, 2)

    // ── Arched entrances on 4 sides (pillars framing open gaps) ────────
    const entrances: [number, number, number, number][] = [
      [0, 15, -40, 0],   // north
      [0, 15, 40, 0],    // south
      [-40, 15, 0, 90],  // west
      [40, 15, 0, 90],   // east
    ]
    for (const [ex, ey, ez, rot] of entrances) {
      const pillarL = box(6, 30, 6, marbleMat)
      const pillarR = box(6, 30, 6, marbleMat)
      const lintel = box(20, 4, 6, coralMat)

      const rRad = (rot * Math.PI) / 180
      const offsetX = Math.cos(rRad) * 10
      const offsetZ = Math.sin(rRad) * 10

      pillarL.position.set(ex - offsetX, ey, ez - offsetZ)
      pillarR.position.set(ex + offsetX, ey, ez + offsetZ)
      lintel.position.set(ex, 32, ez)
      lintel.rotation.y = rRad

      group.add(pillarL)
      group.add(pillarR)
      group.add(lintel)
    }

    // ── Bioluminescent crystals inside ──────────────────────────────────
    const crystalPositions: [number, number, number][] = [
      [-18, 8, -18], [18, 8, -18], [-18, 8, 18], [18, 8, 18],
      [0, 12, 0], [-10, 6, 10], [10, 6, -10],
    ]
    for (const [cx, cy, cz] of crystalPositions) {
      const crystal = box(3, 6, 3, crystalMat)
      crystal.position.set(cx, cy, cz)
      crystal.rotation.z = Math.random() * 0.3 - 0.15
      crystal.rotation.x = Math.random() * 0.3 - 0.15
      group.add(crystal)
    }

    // ── Lights ──────────────────────────────────────────────────────────
    this.addPointLight(group, 0, 14, 0, 0x44ddcc, 1.0, 60)
    this.addPointLight(group, 0, 50, 0, 0x44ddcc, 0.8, 50)

    // ── Bubble particles ────────────────────────────────────────────────
    const count = 40
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x88ddff, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.7, depthWrite: false,
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
