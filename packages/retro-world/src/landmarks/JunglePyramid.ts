import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateParticles, updateTorches } from './landmarkUtils'

export class JunglePyramid {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private fireflyParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const mossMat  = new THREE.MeshLambertMaterial({ color: 0x2a4a1a, map: texGen.getTexture('moss', 0x2a4a1a).map })
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x3a3a2a, map: texGen.getTexture('stone', 0x3a3a2a).map })
    const vineMat  = new THREE.MeshLambertMaterial({ color: 0x226622, map: texGen.getTexture('moss', 0x226622).map })

    // ── 5 Pyramid Tiers ─────────────────────────────────────────────────────
    const tierWidths = [200, 160, 120, 80, 40]
    const tierHeight = 16
    for (let t = 0; t < 5; t++) {
      const w = tierWidths[t]
      const tier = box(w, tierHeight, w, stoneMat)
      tier.position.set(0, t * tierHeight + tierHeight / 2, 0)
      group.add(tier)
      this.addWalkable(px, py, pz, 0, 0, w, w, (t + 1) * tierHeight)
    }

    // ── Vine Panels on sides ────────────────────────────────────────────────
    for (let t = 0; t < 4; t++) {
      const w = tierWidths[t]
      // Front vine
      const vineF = box(w * 0.6, tierHeight * 0.8, 1, vineMat)
      vineF.position.set(0, t * tierHeight + tierHeight / 2, w / 2 + 0.5)
      group.add(vineF)
      // Back vine
      const vineB = box(w * 0.6, tierHeight * 0.8, 1, vineMat)
      vineB.position.set(0, t * tierHeight + tierHeight / 2, -w / 2 - 0.5)
      group.add(vineB)
      // Left vine
      const vineL = box(1, tierHeight * 0.8, w * 0.6, vineMat)
      vineL.position.set(-w / 2 - 0.5, t * tierHeight + tierHeight / 2, 0)
      group.add(vineL)
      // Right vine
      const vineR = box(1, tierHeight * 0.8, w * 0.6, vineMat)
      vineR.position.set(w / 2 + 0.5, t * tierHeight + tierHeight / 2, 0)
      group.add(vineR)
    }

    // ── Interior Corridor through base (6 wide, 12 tall, 160 long) ─────────
    // Left wall
    const corrLeft = box(1, 12, 160, mossMat)
    corrLeft.position.set(-3, 6, 0)
    group.add(corrLeft)
    // Right wall
    const corrRight = box(1, 12, 160, mossMat)
    corrRight.position.set(3, 6, 0)
    group.add(corrRight)
    // Ceiling
    const corrCeil = box(6, 1, 160, stoneMat)
    corrCeil.position.set(0, 12, 0)
    group.add(corrCeil)
    // Floor
    const corrFloor = box(6, 1, 160, stoneMat)
    corrFloor.position.set(0, 0.5, 0)
    group.add(corrFloor)
    this.addWalkable(px, py, pz, 0, 0, 6, 160, 1)

    // ── Burial Chamber at center (40x40 floor) ─────────────────────────────
    const chamberFloor = box(40, 2, 40, mossMat)
    chamberFloor.position.set(0, 1, 0)
    group.add(chamberFloor)
    this.addWalkable(px, py, pz, 0, 0, 40, 40, 2)

    // Sarcophagus
    const sarcophagus = box(12, 6, 20, stoneMat)
    sarcophagus.position.set(0, 5, 0)
    group.add(sarcophagus)

    const sarcLid = box(14, 2, 22, mossMat)
    sarcLid.position.set(0, 9, 0)
    group.add(sarcLid)

    // ── Ramp on south face ──────────────────────────────────────────────────
    for (let i = 0; i < 10; i++) {
      const stepY = (i + 1) * (16 / 10)
      const s = box(20, 1, 5, stoneMat)
      s.position.set(0, stepY - 0.5, 100 + i * 5)
      group.add(s)
      this.addWalkable(px, py, pz, 0, 100 + i * 5, 20, 5, stepY)
    }

    // ── Lights (green) ──────────────────────────────────────────────────────
    this.addPointLight(group, 0,  8, 0, 0x225522, 1.0, 30)
    this.addPointLight(group, 0, 50, 0, 0x336633, 1.2, 40)

    // ── Particles — 50 fireflies ────────────────────────────────────────────
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
      color: 0x66ff44, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    })
    this.fireflyParticles = new THREE.Points(geo, mat)
    this.fireflyParticles.position.set(px, py, pz)
    scene.add(this.fireflyParticles)
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
    updateParticles(this.fireflyParticles, delta, time)
  }
}
