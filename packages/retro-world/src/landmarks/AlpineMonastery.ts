import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateParticles, updateTorches } from './landmarkUtils'

export class AlpineMonastery {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private snowParticles: THREE.Points | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const slateMat = new THREE.MeshLambertMaterial({ color: 0x778899, map: texGen.getTexture('stone', 0x778899).map })
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x5a3210, map: texGen.getTexture('wood', 0x5a3210).map })
    const iceMat   = new THREE.MeshLambertMaterial({ color: 0xaabbcc, map: texGen.getTexture('stone', 0xaabbcc).map })

    // ── Foundation ──────────────────────────────────────────────────────────
    const foundation = box(200, 4, 200, slateMat)
    foundation.position.set(0, -2, 0)
    group.add(foundation)
    this.addWalkable(px, py, pz, 0, 0, 200, 200, 0)

    // ── Main Hall ───────────────────────────────────────────────────────────
    // Walls
    const hallBack = box(120, 50, 4, slateMat)
    hallBack.position.set(0, 25, -40)
    group.add(hallBack)

    const hallFront = box(120, 50, 4, slateMat)
    hallFront.position.set(0, 25, 40)
    group.add(hallFront)

    const hallLeft = box(4, 50, 80, slateMat)
    hallLeft.position.set(-60, 25, 0)
    group.add(hallLeft)

    const hallRight = box(4, 50, 80, slateMat)
    hallRight.position.set(60, 25, 0)
    group.add(hallRight)

    // Roof
    const roof = box(124, 4, 84, woodMat)
    roof.position.set(0, 52, 0)
    group.add(roof)

    // Floor (interior walkable)
    const hallFloor = box(116, 2, 76, slateMat)
    hallFloor.position.set(0, 1, 0)
    group.add(hallFloor)
    this.addWalkable(px, py, pz, 0, 0, 116, 76, 2)

    // ── Bell Tower ──────────────────────────────────────────────────────────
    const towerBase = box(30, 80, 30, slateMat)
    towerBase.position.set(-60, 40, -60)
    group.add(towerBase)

    const towerRoof = box(34, 4, 34, iceMat)
    towerRoof.position.set(-60, 82, -60)
    group.add(towerRoof)

    // Bell
    const bell = box(8, 8, 8, new THREE.MeshLambertMaterial({ color: 0xdaa520 }))
    bell.position.set(-60, 72, -60)
    group.add(bell)

    // ── Altar at center ─────────────────────────────────────────────────────
    const altar = box(20, 8, 12, slateMat)
    altar.position.set(0, 6, 0)
    group.add(altar)

    const altarTop = box(18, 2, 10, iceMat)
    altarTop.position.set(0, 11, 0)
    group.add(altarTop)

    // ── 4 Stone Columns inside ──────────────────────────────────────────────
    for (const [cx, cz] of [[-35, -25], [35, -25], [-35, 25], [35, 25]] as [number, number][]) {
      const col = box(6, 48, 6, slateMat)
      col.position.set(cx, 26, cz)
      group.add(col)
    }

    // ── Entrance Steps (6 steps) ────────────────────────────────────────────
    for (let i = 0; i < 6; i++) {
      const stepY = (i + 1) * (2 / 6)
      const s = box(20, 0.5, 3, slateMat)
      s.position.set(0, stepY - 0.25, 42 + i * 3)
      group.add(s)
      this.addWalkable(px, py, pz, 0, 42 + i * 3, 20, 3, stepY)
    }

    // ── Lights ──────────────────────────────────────────────────────────────
    this.addPointLight(group, -30, 30, 0, 0xffcc88, 1.2, 35)
    this.addPointLight(group,  30, 30, 0, 0xffcc88, 1.2, 35)

    // ── Particles — 40 snowflakes ───────────────────────────────────────────
    const count = 40
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 160
      positions[i * 3 + 1] = Math.random() * 50
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.3, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    })
    this.snowParticles = new THREE.Points(geo, mat)
    this.snowParticles.position.set(px, py, pz)
    scene.add(this.snowParticles)
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
    updateParticles(this.snowParticles, delta, time)
  }
}
