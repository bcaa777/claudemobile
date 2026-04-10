import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { mergeStaticMeshes } from '../utils/mergeStaticMeshes'
import { HELL_DEPTH } from '../world/TerrainGenerator'
import { texGen } from '../utils/PixelTextureGenerator'
import { box, updateTorches } from './landmarkUtils'

export class InfernalStaircase {
  readonly position: THREE.Vector3
  readonly walkables: CastleWalkable[] = []
  readonly torchLights: THREE.PointLight[] = []
  private torchIntensities: number[] = []
  private beacon: THREE.Mesh | null = null

  constructor(pos: THREE.Vector3, scene: THREE.Scene, _seed: number) {
    this.position = pos.clone()
    const group = new THREE.Group()
    group.position.copy(this.position)
    group.scale.setScalar(0.25)
    scene.add(group)

    const px = this.position.x
    const py = this.position.y
    const pz = this.position.z

    const obsidianMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a22, map: texGen.getTexture('obsidian', 0x1a1a22).map })
    const darkMat      = new THREE.MeshLambertMaterial({ color: 0x0d0508, map: texGen.getTexture('darkStone', 0x0d0508).map })
    const lavaMat      = new THREE.MeshBasicMaterial({ color: 0xff3300, map: texGen.getTexture('lava', 0xff3300).map })
    const beaconMat    = new THREE.MeshBasicMaterial({ color: 0xff4400, map: texGen.getTexture('lava', 0xff4400).map })

    // Tower descends from ground (py) to hell (HELL_DEPTH)
    const worldHeight = py - HELL_DEPTH
    const towerHeight = worldHeight / 0.25  // local units
    const pillarSize = 20

    // ── Central pillar ──────────────────────────────────────────────────
    const pillar = box(pillarSize, towerHeight, pillarSize, darkMat)
    pillar.position.set(0, -towerHeight / 2, 0)
    group.add(pillar)

    // ── Spiral stairs (descending) ────────────────────────────────────
    const totalSteps = 103
    const stepRise = towerHeight / totalSteps
    const stepWidth = 12
    const stepDepth = 10
    const outerRadius = 32
    const degreesPerStep = 12 * (Math.PI / 180)

    for (let i = 0; i < totalSteps; i++) {
      const angle = i * degreesPerStep
      const y = -(i + 1) * stepRise
      const cx = Math.cos(angle) * outerRadius
      const cz = Math.sin(angle) * outerRadius

      const step = box(stepWidth, 2, stepDepth, obsidianMat)
      step.position.set(cx, y, cz)
      step.rotation.y = -angle + Math.PI / 2
      group.add(step)

      this.walkables.push({
        minX: px + (cx - stepWidth / 2) * 0.25,
        maxX: px + (cx + stepWidth / 2) * 0.25,
        minZ: pz + (cz - stepDepth / 2) * 0.25,
        maxZ: pz + (cz + stepDepth / 2) * 0.25,
        y: py + y * 0.25,
      })
    }

    // ── Platforms every ~20 world units (80 local units) ────────────────
    const platformInterval = 80
    const platformSize = 32
    const platformCount = Math.floor(towerHeight / platformInterval)

    for (let p = 1; p <= platformCount; p++) {
      const platformY = -p * platformInterval
      const platform = box(platformSize, 4, platformSize, obsidianMat)
      platform.position.set(0, platformY, 0)
      group.add(platform)

      this.walkables.push({
        minX: px - platformSize / 2 * 0.25,
        maxX: px + platformSize / 2 * 0.25,
        minZ: pz - platformSize / 2 * 0.25,
        maxZ: pz + platformSize / 2 * 0.25,
        y: py + (platformY + 2) * 0.25,
      })

      // Railings on each edge
      for (const [rx, rz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const railing = box(
          rx === 0 ? platformSize : 2,
          8,
          rz === 0 ? platformSize : 2,
          darkMat
        )
        railing.position.set(
          rx * (platformSize / 2 + 1),
          platformY + 6,
          rz * (platformSize / 2 + 1)
        )
        group.add(railing)
      }

      // Lava torch lights on platforms
      for (const [tx, tz] of [[-12, -12], [12, 12]]) {
        this.addPointLight(group, tx, platformY + 10, tz, 0xff4400, 1.2, 30)
      }
    }

    // ── Top platform (obsidian rim around pit entrance) ────────────────
    const topSize = 40
    const topPlatform = box(topSize, 4, topSize, obsidianMat)
    topPlatform.position.set(0, 0, 0)
    group.add(topPlatform)

    this.walkables.push({
      minX: px - topSize / 2 * 0.25,
      maxX: px + topSize / 2 * 0.25,
      minZ: pz - topSize / 2 * 0.25,
      maxZ: pz + topSize / 2 * 0.25,
      y: py + 2 * 0.25,
    })

    // ── Bottom arrival platform ───────────────────────────────────────
    const botY = -towerHeight
    const botPlatform = box(platformSize, 4, platformSize, lavaMat)
    botPlatform.position.set(0, botY, 0)
    group.add(botPlatform)

    this.walkables.push({
      minX: px - platformSize / 2 * 0.25,
      maxX: px + platformSize / 2 * 0.25,
      minZ: pz - platformSize / 2 * 0.25,
      maxZ: pz + platformSize / 2 * 0.25,
      y: py + (botY + 2) * 0.25,
    })

    // ── Base entrance arch ────────────────────────────────────────────
    const archH = 16
    for (const side of [-8, 8]) {
      const archPillar = box(6, archH, 6, darkMat)
      archPillar.position.set(side, archH / 2, outerRadius + 6)
      group.add(archPillar)
    }
    const archLintel = box(22, 4, 6, lavaMat)
    archLintel.position.set(0, archH + 2, outerRadius + 6)
    group.add(archLintel)

    // Foundation ring
    const foundationRing = box(outerRadius * 2 + 24, 4, outerRadius * 2 + 24, darkMat)
    foundationRing.position.set(0, -2, 0)
    group.add(foundationRing)
    this.walkables.push({
      minX: px - (outerRadius + 12) * 0.25,
      maxX: px + (outerRadius + 12) * 0.25,
      minZ: pz - (outerRadius + 12) * 0.25,
      maxZ: pz + (outerRadius + 12) * 0.25,
      y: py,
    })

    // ── Tall hell beacon tower (visible from far away) ────────────────
    // Rises ~50 world units above ground = 200 local units
    const spireHeight = 200
    const spireBase = 10
    const spireTop = 4

    // Main spire shaft — obsidian, tapers upward
    const spireShaft = box(spireBase, spireHeight, spireBase, obsidianMat)
    spireShaft.position.set(0, spireHeight / 2, 0)
    group.add(spireShaft)

    // Lava ring accents every ~40 local units
    for (let r = 0; r < 5; r++) {
      const ringY = 40 + r * 40
      const ringW = spireBase + 4 - r * 1
      const ring = box(ringW, 4, ringW, lavaMat)
      ring.position.set(0, ringY, 0)
      group.add(ring)
    }

    // Top crown — wider obsidian cap with lava glow
    const crownW = 16
    const crown = box(crownW, 8, crownW, obsidianMat)
    crown.position.set(0, spireHeight + 4, 0)
    group.add(crown)

    // Lava beacon orb at very top
    const beaconGeo = new THREE.SphereGeometry(8, 8, 8)
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat)
    this.beacon.position.set(0, spireHeight + 16, 0)
    group.add(this.beacon)

    // 4 small corner spikes on crown
    for (const [sx, sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const spike = box(3, 20, 3, obsidianMat)
      spike.position.set(sx * 7, spireHeight + 18, sz * 7)
      group.add(spike)
    }

    // Bright point light at top — visible from distance
    this.addPointLight(group, 0, spireHeight + 16, 0, 0xff4400, 5.0, 150)

    mergeStaticMeshes(group)
  }

  private addPointLight(group: THREE.Group, lx: number, ly: number, lz: number,
    color: number, intensity: number, distance: number) {
    const light = new THREE.PointLight(color, intensity, distance)
    light.position.set(lx, ly, lz)
    group.add(light)
    this.torchLights.push(light)
    this.torchIntensities.push(intensity)
  }

  update(delta: number, time: number) {
    updateTorches(this.torchLights, this.torchIntensities, time)
  }
}
