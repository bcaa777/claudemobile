import * as THREE from 'three'
import type { CastleWalkable } from '../castle/Castle'
import { mergeStaticMeshes } from '../utils/mergeStaticMeshes'
import { HEAVEN_ALTITUDE } from '../world/TerrainGenerator'
import { texGen } from '../utils/PixelTextureGenerator'

function box(
  w: number, h: number, d: number,
  mat: THREE.Material
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

export class GrandStaircase {
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

    const stoneMat     = new THREE.MeshLambertMaterial({ color: 0x888888, map: texGen.getTexture('stone', 0x888888).map })
    const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x666666, map: texGen.getTexture('darkStone', 0x666666).map })
    const goldMat      = new THREE.MeshLambertMaterial({ color: 0xdaa520, map: texGen.getTexture('gold', 0xdaa520).map })
    const beaconMat    = new THREE.MeshBasicMaterial({ color: 0xffdd44, map: texGen.getTexture('beaconGlow', 0xffdd44).map })

    // Tower must reach from ground (py) to heaven (HEAVEN_ALTITUDE)
    // Group scale is 0.25, so local units * 0.25 = world units
    const worldHeight = HEAVEN_ALTITUDE - py
    const towerHeight = worldHeight / 0.25  // local units
    const pillarSize = 20    // 5 world units

    // ── Central pillar ──────────────────────────────────────────────────
    const pillar = box(pillarSize, towerHeight, pillarSize, darkStoneMat)
    pillar.position.set(0, towerHeight / 2, 0)
    group.add(pillar)

    // ── Spiral stairs ───────────────────────────────────────────────────
    const totalSteps = 103
    const stepRise = towerHeight / totalSteps   // ~3.18 local units = ~0.8 world units
    const stepWidth = 12      // ~3 world units
    const stepDepth = 10      // ~2.5 world units
    const outerRadius = 32    // ~8 world units from center
    const degreesPerStep = 12 * (Math.PI / 180)  // 12° per step

    for (let i = 0; i < totalSteps; i++) {
      const angle = i * degreesPerStep
      const y = (i + 1) * stepRise
      const cx = Math.cos(angle) * outerRadius
      const cz = Math.sin(angle) * outerRadius

      const step = box(stepWidth, 2, stepDepth, stoneMat)
      step.position.set(cx, y, cz)
      step.rotation.y = -angle + Math.PI / 2
      group.add(step)

      // Register walkable (world-space)
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
    const platformSize = 32   // 8 world units
    const platformCount = Math.floor(towerHeight / platformInterval)

    for (let p = 1; p <= platformCount; p++) {
      const platformY = p * platformInterval
      const platform = box(platformSize, 4, platformSize, stoneMat)
      platform.position.set(0, platformY, 0)
      group.add(platform)

      // Walkable
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
          darkStoneMat
        )
        railing.position.set(
          rx * (platformSize / 2 + 1),
          platformY + 6,
          rz * (platformSize / 2 + 1)
        )
        group.add(railing)
      }

      // Torch lights on platforms (golden glow)
      for (const [tx, tz] of [[-12, -12], [12, 12]]) {
        this.addPointLight(group, tx, platformY + 10, tz, 0xffcc66, 1.2, 30)
      }
    }

    // ── Top platform (opening to Heaven) ────────────────────────────────
    const topSize = 40   // 10 world units
    const topPlatform = box(topSize, 4, topSize, goldMat)
    topPlatform.position.set(0, towerHeight, 0)
    group.add(topPlatform)

    this.walkables.push({
      minX: px - topSize / 2 * 0.25,
      maxX: px + topSize / 2 * 0.25,
      minZ: pz - topSize / 2 * 0.25,
      maxZ: pz + topSize / 2 * 0.25,
      y: py + (towerHeight + 2) * 0.25,
    })

    // ── Base entrance ───────────────────────────────────────────────────
    // Arch at ground level
    const archH = 16
    for (const side of [-8, 8]) {
      const archPillar = box(6, archH, 6, darkStoneMat)
      archPillar.position.set(side, archH / 2, outerRadius + 6)
      group.add(archPillar)
    }
    const archLintel = box(22, 4, 6, goldMat)
    archLintel.position.set(0, archH + 2, outerRadius + 6)
    group.add(archLintel)

    // Foundation ring
    const foundationRing = box(outerRadius * 2 + 24, 4, outerRadius * 2 + 24, darkStoneMat)
    foundationRing.position.set(0, -2, 0)
    group.add(foundationRing)
    this.walkables.push({
      minX: px - (outerRadius + 12) * 0.25,
      maxX: px + (outerRadius + 12) * 0.25,
      minZ: pz - (outerRadius + 12) * 0.25,
      maxZ: pz + (outerRadius + 12) * 0.25,
      y: py,
    })

    // ── Beacon at top ───────────────────────────────────────────────────
    const beaconGeo = new THREE.SphereGeometry(6, 8, 8)
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat)
    this.beacon.position.set(0, towerHeight + 12, 0)
    group.add(this.beacon)

    this.addPointLight(group, 0, towerHeight + 12, 0, 0xffdd44, 3.0, 80)

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
    // Torch flicker
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = this.torchIntensities[i]
      this.torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 7 + i * 1.3))
    }
  }
}
