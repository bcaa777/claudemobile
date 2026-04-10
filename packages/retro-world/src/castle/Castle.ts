import * as THREE from 'three'
import { SeededRandom } from '../utils/SeededRandom'
import { mergeStaticMeshes } from '../utils/mergeStaticMeshes'
import { WATER_LEVEL, HEAVEN_ALTITUDE } from '../world/TerrainGenerator'
import { texGen } from '../utils/PixelTextureGenerator'

export interface CastleWalkable {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  y: number
}

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class Castle {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private fireEmbers: THREE.Points | null = null
  private chapelParticles: THREE.Points | null = null
  private mirrorShimmer: THREE.Points | null = null

  constructor(seed: number, scene: THREE.Scene) {
    const rng = new SeededRandom(seed + 7777)
    const angle = rng.range(0, Math.PI * 2)
    const dist = 420 + rng.range(0, 180)
    this.position = new THREE.Vector3(
      Math.cos(angle) * dist,
      HEAVEN_ALTITUDE,
      Math.sin(angle) * dist
    )

    const group = new THREE.Group()
    group.position.copy(this.position)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const stoneMat     = new THREE.MeshLambertMaterial({ color: 0x888888, map: texGen.getTexture('stone', 0x888888).map })
    const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x666666, map: texGen.getTexture('darkStone', 0x666666).map })
    const floorMat     = new THREE.MeshLambertMaterial({ color: 0x777777, map: texGen.getTexture('stone', 0x777777).map })
    const woodMat      = new THREE.MeshLambertMaterial({ color: 0x8B6914, map: texGen.getTexture('wood', 0x8B6914).map })
    const ironMat      = new THREE.MeshLambertMaterial({ color: 0x445544, map: texGen.getTexture('darkStone', 0x445544).map })

    this.buildFoundation(group, floorMat, px, py, pz)
    this.buildOuterWalls(group, stoneMat, px, py, pz)
    this.buildTowers(group, darkStoneMat, px, py, pz)
    this.buildBattlements(group, stoneMat, px, py, pz)
    this.buildGate(group, darkStoneMat, ironMat, px, py, pz)
    this.buildBeacon(group, px, py, pz)

    this.buildFloor0(group, stoneMat, floorMat, woodMat, scene, px, py, pz)
    this.buildFloor1(group, stoneMat, floorMat, woodMat, ironMat, scene, px, py, pz)
    this.buildFloor2(group, stoneMat, floorMat, woodMat, ironMat, scene, px, py, pz)
    this.buildFloor3(group, stoneMat, floorMat, px, py, pz)
    this.buildStairs(group, stoneMat, px, py, pz)

    // Merge all static meshes by material to reduce draw calls (~168 → ~5)
    mergeStaticMeshes(group)
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

  private buildFoundation(group: THREE.Group, mat: THREE.Material,
    px: number, py: number, pz: number) {
    const slab = box(100, 6, 100, mat)
    slab.position.set(0, -3, 0)
    group.add(slab)
    this.addWalkable(px, py, pz, 0, 0, 100, 100, 0)
  }

  private buildOuterWalls(group: THREE.Group, mat: THREE.Material,
    px: number, py: number, pz: number) {
    const h = 24
    const thick = 5
    const half = 44
    const wallY = h / 2

    // North wall
    const north = box(88, h, thick, mat)
    north.position.set(0, wallY, -half)
    group.add(north)

    // South wall — split for gate gap (6 units)
    const southW = (88 - 6) / 2
    const southL = box(southW, h, thick, mat)
    southL.position.set(-half + southW / 2, wallY, half)
    group.add(southL)
    const southR = box(southW, h, thick, mat)
    southR.position.set(half - southW / 2, wallY, half)
    group.add(southR)

    // East wall
    const east = box(thick, h, 88, mat)
    east.position.set(half, wallY, 0)
    group.add(east)

    // West wall
    const west = box(thick, h, 88, mat)
    west.position.set(-half, wallY, 0)
    group.add(west)
  }

  private buildTowers(group: THREE.Group, mat: THREE.Material,
    px: number, py: number, pz: number) {
    const towerH = 44
    const towerW = 14
    const corners = [
      [-44, -44], [44, -44], [-44, 44], [44, 44]
    ] as [number, number][]

    for (const [tx, tz] of corners) {
      const tower = box(towerW, towerH, towerW, mat)
      tower.position.set(tx, towerH / 2, tz)
      group.add(tower)
    }
  }

  private buildBattlements(group: THREE.Group, mat: THREE.Material,
    px: number, py: number, pz: number) {
    const merlonW = 3.6
    const merlonH = 3.6
    const merlonD = 5
    const wallTop = 24

    // Battlments along north / south walls
    const nsPositions = [-40, -28, -16, -4, 4, 16, 28, 40]
    for (const x of nsPositions) {
      const n = box(merlonW, merlonH, merlonD, mat)
      n.position.set(x, wallTop + merlonH / 2, -44)
      group.add(n)
      const s = box(merlonW, merlonH, merlonD, mat)
      s.position.set(x, wallTop + merlonH / 2, 44)
      group.add(s)
    }

    // Battlments along east / west walls
    const ewPositions = [-40, -28, -16, -4, 4, 16, 28, 40]
    for (const z of ewPositions) {
      const e = box(merlonD, merlonH, merlonW, mat)
      e.position.set(44, wallTop + merlonH / 2, z)
      group.add(e)
      const w = box(merlonD, merlonH, merlonW, mat)
      w.position.set(-44, wallTop + merlonH / 2, z)
      group.add(w)
    }

    // Tower battlements
    const towerTop = 44
    const tcorners = [[-44, -44], [44, -44], [-44, 44], [44, 44]] as [number, number][]
    for (const [tx, tz] of tcorners) {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2
        const m = box(2.8, 3.2, 14, mat)
        m.position.set(tx + Math.cos(a) * 5.6, towerTop + 1.6, tz + Math.sin(a) * 5.6)
        m.rotation.y = a
        group.add(m)
      }
    }
  }

  private buildGate(group: THREE.Group, mat: THREE.Material, ironMat: THREE.Material,
    px: number, py: number, pz: number) {
    const pillarH = 26
    const gateZ = 44
    const pillarL = box(4, pillarH, 6, mat)
    pillarL.position.set(-3, pillarH / 2, gateZ)
    group.add(pillarL)
    const pillarR = box(4, pillarH, 6, mat)
    pillarR.position.set(3, pillarH / 2, gateZ)
    group.add(pillarR)

    // Portcullis bars
    for (let i = -1; i <= 1; i++) {
      const bar = box(0.4, 20, 0.4, ironMat)
      bar.position.set(i * 1.6, 10, gateZ + 0.1)
      group.add(bar)
    }
    // Horizontal crossbar
    const crossbar = box(6, 0.4, 0.4, ironMat)
    crossbar.position.set(0, 20, gateZ + 0.1)
    group.add(crossbar)
  }

  private buildBeacon(group: THREE.Group, px: number, py: number, pz: number) {
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x88aaff, map: texGen.getTexture('beaconGlow', 0x88aaff).map })
    const beacon = box(3, 3, 3, beaconMat)
    beacon.position.set(44, 48, -44)
    group.add(beacon)
  }

  private addPointLight(group: THREE.Group, lx: number, ly: number, lz: number,
    color: number, intensity: number, distance: number): THREE.PointLight {
    if (this.torchLights.length >= 3) return null!
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(lx, ly, lz)
    group.add(light)
    this.torchLights.push(light)
    this.torchIntensities.push(intensity)
    return light
  }

  private buildFloor0(group: THREE.Group, stoneMat: THREE.Material, floorMat: THREE.Material,
    woodMat: THREE.Material, scene: THREE.Scene,
    px: number, py: number, pz: number) {
    const floorY = 0
    const floorThick = 0.5

    // Great Hall floor slab
    const floor = box(80, floorThick, 80, floorMat)
    floor.position.set(0, floorY + floorThick / 2, 0)
    group.add(floor)
    this.addWalkable(px, py, pz, 0, 0, 80, 80, floorY + floorThick)

    // Two flanking antechambers walls (partition)
    const partW = box(5, 14, 16, stoneMat)
    partW.position.set(-24, 7, 0)
    group.add(partW)
    const partE = box(5, 14, 16, stoneMat)
    partE.position.set(24, 7, 0)
    group.add(partE)

    // Two stone columns in nave
    const col1 = box(3, 20, 3, stoneMat)
    col1.position.set(-12, 10, -12)
    group.add(col1)
    const col2 = box(3, 20, 3, stoneMat)
    col2.position.set(12, 10, -12)
    group.add(col2)

    // Fireplace niche
    const fireplaceBack = box(10, 8, 2, stoneMat)
    fireplaceBack.position.set(0, 4, -36)
    group.add(fireplaceBack)
    const fireplaceL = box(2, 8, 4, stoneMat)
    fireplaceL.position.set(-5, 4, -35)
    group.add(fireplaceL)
    const fireplaceR = box(2, 8, 4, stoneMat)
    fireplaceR.position.set(5, 4, -35)
    group.add(fireplaceR)

    // Embers particles above fireplace
    this.fireEmbers = this.makeFireEmbers()
    this.fireEmbers.position.set(px, py + 7, pz - 36)
    scene.add(this.fireEmbers)

    // Warm orange ceiling lights
    this.addPointLight(group, -12, 18, -12, 0xff8833, 1.2, 36)
    this.addPointLight(group,  12, 18,  12, 0xff7722, 1.0, 32)
  }

  private buildFloor1(group: THREE.Group, stoneMat: THREE.Material, floorMat: THREE.Material,
    woodMat: THREE.Material, ironMat: THREE.Material, scene: THREE.Scene,
    px: number, py: number, pz: number) {
    const floorY = 7
    const floorThick = 0.5

    // Floor slab
    const floor = box(80, floorThick, 80, floorMat)
    floor.position.set(0, floorY + floorThick / 2, 0)
    group.add(floor)
    this.addWalkable(px, py, pz, 0, 0, 80, 80, floorY + floorThick)

    // Partition walls creating 4 rooms
    const partV = box(5, 6, 32, stoneMat)
    partV.position.set(0, floorY + 4, 8)
    group.add(partV)
    const partH = box(32, 6, 5, stoneMat)
    partH.position.set(0, floorY + 4, -8)
    group.add(partH)

    // Armory props — weapon rack
    const rackBar = box(10, 0.6, 0.6, woodMat)
    rackBar.position.set(-28, floorY + 5, -28)
    group.add(rackBar)
    for (let i = 0; i < 4; i++) {
      const strip = box(0.3, 4, 0.3, ironMat)
      strip.position.set(-31 + i * 2.4, floorY + 3, -28)
      group.add(strip)
    }
    this.addPointLight(group, -28, floorY + 5.6, -28, 0x8899cc, 0.9, 20)

    // Library props — bookshelf
    for (let s = 0; s < 3; s++) {
      const shelf = box(8, 0.4, 1.6, woodMat)
      shelf.position.set(28, floorY + 2.0 + s * 1.6, -28)
      group.add(shelf)
    }
    const shelfSideL = box(0.4, 5, 1.6, woodMat)
    shelfSideL.position.set(24, floorY + 2.5, -28)
    group.add(shelfSideL)
    const shelfSideR = box(0.4, 5, 1.6, woodMat)
    shelfSideR.position.set(32, floorY + 2.5, -28)
    group.add(shelfSideR)
    this.addPointLight(group, 28, floorY + 5.6, -20, 0xffbb44, 0.8, 20)

    // Mirror Room — 4 mirrors + silver-blue light
    const mirrorMat = new THREE.MeshBasicMaterial({
      color: 0x8899cc, transparent: true, opacity: 0.68,
    })
    const mirrorPositions: [number, number, number, number][] = [
      [-28, floorY + 4,  20, 0],
      [ 28, floorY + 4,  20, 0],
      [-20, floorY + 4,  28, Math.PI / 2],
      [-20, floorY + 4,  12, Math.PI / 2],
    ]
    for (const [mx, my, mz, ry] of mirrorPositions) {
      const mirror = box(8, 6, 0.16, mirrorMat)
      mirror.position.set(mx, my, mz)
      mirror.rotation.y = ry
      group.add(mirror)
    }
    this.addPointLight(group, -20, floorY + 5, 20, 0xaabbee, 0.75, 24)

    // Mirror shimmer particle
    this.mirrorShimmer = this.makeShimmerParticles(0xaabbee)
    this.mirrorShimmer.position.set(px - 20, py + floorY + 5, pz + 20)
    scene.add(this.mirrorShimmer)

    // Storage — crates
    for (let c = 0; c < 3; c++) {
      const crate = box(2.4 + c * 0.6, 2.0 + c * 0.4, 2.0, woodMat)
      crate.position.set(20 + c * 3.6, floorY + 1.2, 28)
      group.add(crate)
    }
    this.addPointLight(group, 28, floorY + 5.6, 28, 0xbb9944, 0.5, 16)
  }

  private buildFloor2(group: THREE.Group, stoneMat: THREE.Material, floorMat: THREE.Material,
    woodMat: THREE.Material, ironMat: THREE.Material, scene: THREE.Scene,
    px: number, py: number, pz: number) {
    const floorY = 14
    const floorThick = 0.5

    // Floor slab
    const floor = box(80, floorThick, 80, floorMat)
    floor.position.set(0, floorY + floorThick / 2, 0)
    group.add(floor)
    this.addWalkable(px, py, pz, 0, 0, 80, 80, floorY + floorThick)

    const h = 6.0

    // Maze walls — asymmetric layout (scaled ×2)
    const mazeWalls: [number, number, number, number][] = [
      [0,   0,  5, 40],
      [-20, -16, 30,  5],
      [ 16, -16,  5, 24],
      [-20,  12,  5, 28],
      [  8,  12, 20,  5],
      [-10, -28, 16,  5],
      [ 16,   4, 16,  5],
    ]

    for (const [wx, wz, ww, wd] of mazeWalls) {
      const wall = box(ww, h, wd, stoneMat)
      wall.position.set(wx, floorY + h / 2, wz)
      group.add(wall)
    }

    // Dead-end corridor
    const deadEnd = box(8, h, 5, stoneMat)
    deadEnd.position.set(-32, floorY + h / 2, -12)
    group.add(deadEnd)
    const deadEndSide = box(5, h, 12, stoneMat)
    deadEndSide.position.set(-36, floorY + h / 2, -6)
    group.add(deadEndSide)

    // Chapel — violet/purple light + firefly particles
    this.addPointLight(group, -28, floorY + 5, 28, 0x8844cc, 1.1, 28)
    this.chapelParticles = this.makeFireflyParticles(0x8866ff)
    this.chapelParticles.position.set(px - 28, py + floorY + 3, pz + 28)
    scene.add(this.chapelParticles)

    // Tall inner wall for chapel nave
    const chapelNave = box(1, 10, 16, stoneMat)
    chapelNave.position.set(-24, floorY + 5, 24)
    group.add(chapelNave)

    // Crypt — tomb boxes + deep red light
    const tombBase = box(8, 1.2, 3.2, stoneMat)
    tombBase.position.set(24, floorY + 0.6, -28)
    group.add(tombBase)
    const tombLid = box(7.6, 0.5, 3.0, stoneMat)
    tombLid.position.set(24, floorY + 1.44, -28)
    tombLid.rotation.z = 0.04
    group.add(tombLid)
    this.addPointLight(group, 24, floorY + 5, -28, 0xcc1122, 0.9, 20)

    // Dungeon cell — iron bars
    for (let b = 0; b < 5; b++) {
      const bar = box(0.3, 6, 0.3, ironMat)
      bar.position.set(-32 + b * 1.6, floorY + 3, 0)
      group.add(bar)
    }
    this.addPointLight(group, -28, floorY + 4, 0, 0x447755, 0.6, 16)

    // Hidden alcove — column hiding gap
    const alcoveCol = box(2.4, 6, 2.4, stoneMat)
    alcoveCol.position.set(30, floorY + 3, 12)
    group.add(alcoveCol)
  }

  private buildFloor3(group: THREE.Group, stoneMat: THREE.Material, floorMat: THREE.Material,
    px: number, py: number, pz: number) {
    const floorY = 21
    const floorThick = 0.5

    // Battlements walkway — ring of floor along tower tops (no ceiling)
    const walkwayParts: [number, number, number, number][] = [
      [ 0, -40, 60, 8],
      [ 0,  40, 60, 8],
      [-40,  0,  8, 60],
      [ 40,  0,  8, 60],
    ]
    for (const [wx, wz, ww, wd] of walkwayParts) {
      const walk = box(ww, floorThick, wd, floorMat)
      walk.position.set(wx, floorY + floorThick / 2, wz)
      group.add(walk)
      this.addWalkable(px, py, pz, wx, wz, ww, wd, floorY + floorThick)
    }

    // Point lights at each tower top for night
    const tcorners = [[-44, -44], [44, -44], [-44, 44], [44, 44]] as [number, number][]
    for (const [tx, tz] of tcorners) {
      this.addPointLight(group, tx, floorY + 4, tz, 0xffcc88, 0.7, 28)
    }
  }

  private buildStairs(group: THREE.Group, mat: THREE.Material,
    px: number, py: number, pz: number) {
    // One staircase in each corner tower connecting each floor
    const towerData: [number, number, number][] = [
      [-44, -44, 1],
      [ 44, -44, 1],
      [-44,  44, -1],
      [ 44,  44, -1],
    ]

    const floors = [0, 7.0, 14.0] as const
    for (let floorIdx = 0; floorIdx < floors.length; floorIdx++) {
      const baseFloorY = floors[floorIdx]
      const [tx, tz, dir] = towerData[floorIdx % 4]

      for (let step = 0; step < 10; step++) {
        const slab = box(4.8, 1.0, 2.0, mat)
        const stepX = tx
        const stepY = baseFloorY + step * 0.7 + 0.5
        const stepZ = tz + step * dir * 2.0
        slab.position.set(stepX, stepY, stepZ)
        group.add(slab)
        this.addWalkable(px, py, pz, stepX, stepZ, 4.8, 2.0, baseFloorY + step * 0.7 + 1.0)
      }
    }

    // Additional staircases so all towers provide vertical access
    const floors2 = [7.0, 14.0] as const
    for (let floorIdx = 0; floorIdx < floors2.length; floorIdx++) {
      const baseFloorY = floors2[floorIdx]
      const tIdx = (floorIdx + 1) % 4
      const [tx, tz, dir] = towerData[tIdx]

      for (let step = 0; step < 10; step++) {
        const slab = box(4.8, 1.0, 2.0, mat)
        const stepX = tx
        const stepY = baseFloorY + step * 0.7 + 0.5
        const stepZ = tz + step * dir * 2.0
        slab.position.set(stepX, stepY, stepZ)
        group.add(slab)
        this.addWalkable(px, py, pz, stepX, stepZ, 4.8, 2.0, baseFloorY + step * 0.7 + 1.0)
      }
    }
  }

  private makeFireEmbers(): THREE.Points {
    const count = 30
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 5.0
      positions[i * 3 + 1] = Math.random() * 4.0
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xff6622, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.85, depthWrite: false,
    })
    return new THREE.Points(geo, mat)
  }

  private makeFireflyParticles(color: number): THREE.Points {
    const count = 24
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 12
      positions[i * 3 + 1] = Math.random() * 7.0
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color, size: 0.2, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false,
    })
    return new THREE.Points(geo, mat)
  }

  private makeShimmerParticles(color: number): THREE.Points {
    const count = 16
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = Math.random() * 5.0
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color, size: 0.15, sizeAttenuation: true,
      transparent: true, opacity: 0.7, depthWrite: false,
    })
    return new THREE.Points(geo, mat)
  }

  update(delta: number, time: number) {
    // Torch flicker
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = this.torchIntensities[i]
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 7 + i * 1.3))
    }

    // Ember particles drift upward
    if (this.fireEmbers) {
      const pos = this.fireEmbers.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + delta * (0.4 + Math.random() * 0.3))
        if (pos.getY(i) > 5.0) pos.setY(i, 0)
      }
      pos.needsUpdate = true
    }

    // Firefly drift
    if (this.chapelParticles) {
      const pos = this.chapelParticles.geometry.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(time * 0.7 + i * 2.1) * delta * 0.3)
        pos.setY(i, pos.getY(i) + Math.cos(time * 0.5 + i * 1.7) * delta * 0.2)
        pos.setZ(i, pos.getZ(i) + Math.sin(time * 0.9 + i * 1.3) * delta * 0.3)
        const y = pos.getY(i)
        if (y < 0 || y > 7.0) pos.setY(i, Math.random() * 7.0)
      }
      pos.needsUpdate = true
    }

    // Mirror shimmer pulse
    if (this.mirrorShimmer) {
      const mat = this.mirrorShimmer.material as THREE.PointsMaterial
      mat.opacity = 0.5 + 0.3 * Math.sin(time * 2.3)
    }
  }
}
