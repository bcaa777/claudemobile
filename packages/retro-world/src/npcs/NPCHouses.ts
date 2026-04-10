import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { sampleWorldHeight } from '../world/TerrainGenerator'
import type { BiomeMap } from '../world/BiomeMap'

interface NPCHouse {
  npcId: string
  group: THREE.Group
  homePos: THREE.Vector3
  workPos: THREE.Vector3
  wanderPos: THREE.Vector3
}

/**
 * NPC home offset from their landmark (first location offset from NPCData).
 * Houses are placed 5 units away from the NPC spawn.
 */
const NPC_HOME_CONFIG: {
  id: string
  biome: BiomeType
  offset: { x: number; z: number }
}[] = [
  { id: 'finch', biome: BiomeType.Forest, offset: { x: 20, z: 18 } },
  { id: 'vesper', biome: BiomeType.Snow, offset: { x: -18, z: 20 } },
  { id: 'bramble', biome: BiomeType.Swamp, offset: { x: 22, z: -20 } },
  { id: 'plume', biome: BiomeType.Swamp, offset: { x: -20, z: 16 } },
  { id: 'cinder', biome: BiomeType.Volcanic, offset: { x: 18, z: 22 } },
  { id: 'pearl', biome: BiomeType.CoralReef, offset: { x: 16, z: -18 } },
  { id: 'thornwick', biome: BiomeType.Snow, offset: { x: -16, z: -20 } },
]

function box(w: number, h: number, d: number, color: number, emissive?: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshBasicMaterial({ color })
  if (emissive !== undefined) {
    // MeshBasicMaterial doesn't support emissive, but we can brighten the color
    mat.color.set(emissive)
  }
  const mesh = new THREE.Mesh(geo, mat)
  return mesh
}

export class NPCHouses {
  private houses: NPCHouse[] = []

  constructor(
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
  ) {
    for (const cfg of NPC_HOME_CONFIG) {
      const lmPos = landmarkPositions.get(cfg.biome)
      if (!lmPos) continue

      // Place house further from landmark to avoid overlap with landmark structure
      // NPC offset is ~20 units from landmark; push house 15 units further outward
      const npcX = lmPos.x + cfg.offset.x
      const npcZ = lmPos.z + cfg.offset.z
      const dirX = cfg.offset.x / Math.sqrt(cfg.offset.x ** 2 + cfg.offset.z ** 2 + 0.01)
      const dirZ = cfg.offset.z / Math.sqrt(cfg.offset.x ** 2 + cfg.offset.z ** 2 + 0.01)
      const houseX = npcX + dirX * 15
      const houseZ = npcZ + dirZ * 15
      const groundY = sampleWorldHeight(houseX, houseZ, biomeMap)

      let group: THREE.Group
      let homePos: THREE.Vector3
      let workPos: THREE.Vector3
      let wanderPos: THREE.Vector3

      switch (cfg.id) {
        case 'finch':
          group = this.buildFinchHouse(groundY)
          homePos = new THREE.Vector3(houseX + 1, groundY, houseZ + 1)
          workPos = new THREE.Vector3(houseX + 3, groundY, houseZ + 2)
          wanderPos = new THREE.Vector3(houseX - 4, groundY, houseZ + 6)
          break
        case 'vesper':
          group = this.buildVesperHouse(groundY)
          homePos = new THREE.Vector3(houseX, groundY, houseZ + 1)
          workPos = new THREE.Vector3(houseX + 2, groundY, houseZ - 2)
          wanderPos = new THREE.Vector3(houseX - 5, groundY, houseZ + 5)
          break
        case 'bramble':
          group = this.buildBrambleHouse(groundY)
          homePos = new THREE.Vector3(houseX, groundY, houseZ)
          workPos = new THREE.Vector3(houseX + 2, groundY, houseZ + 1)
          wanderPos = new THREE.Vector3(houseX - 6, groundY, houseZ - 4)
          break
        case 'plume':
          group = this.buildPlumeHouse(groundY)
          homePos = new THREE.Vector3(houseX, groundY, houseZ + 1)
          workPos = new THREE.Vector3(houseX - 1, groundY, houseZ)
          wanderPos = new THREE.Vector3(houseX + 5, groundY, houseZ - 5)
          break
        case 'cinder':
          group = this.buildCinderHouse(groundY)
          homePos = new THREE.Vector3(houseX + 1, groundY, houseZ)
          workPos = new THREE.Vector3(houseX + 2, groundY, houseZ + 1.5)
          wanderPos = new THREE.Vector3(houseX - 5, groundY, houseZ + 4)
          break
        case 'pearl':
          group = this.buildPearlHouse(groundY)
          homePos = new THREE.Vector3(houseX, groundY, houseZ)
          workPos = new THREE.Vector3(houseX + 2, groundY, houseZ - 1)
          wanderPos = new THREE.Vector3(houseX - 4, groundY, houseZ + 6)
          break
        case 'thornwick':
          group = this.buildThornwickHouse(groundY)
          homePos = new THREE.Vector3(houseX + 1, groundY, houseZ)
          workPos = new THREE.Vector3(houseX + 3, groundY, houseZ + 1)
          wanderPos = new THREE.Vector3(houseX - 5, groundY, houseZ - 5)
          break
        default:
          continue
      }

      group.position.set(houseX, 0, houseZ)
      scene.add(group)

      this.houses.push({ npcId: cfg.id, group, homePos, workPos, wanderPos })
    }
  }

  getHousePositions(): THREE.Vector3[] {
    return this.houses.map(h => h.homePos.clone())
  }

  /** Returns the target position for an NPC based on time of day */
  getRoutinePosition(npcId: string, timeOfDay: number): THREE.Vector3 | null {
    const house = this.houses.find(h => h.npcId === npcId)
    if (!house) return null
    if (timeOfDay > 0.8 || timeOfDay < 0.2) return house.homePos
    if (timeOfDay > 0.3 && timeOfDay < 0.7) return house.workPos
    return house.wanderPos
  }

  // ── Finch (Cartographer) — Cozy Map Cottage ──────────────────────────

  private buildFinchHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Floor
    const floor = box(4, 0.1, 3, 0x886644)
    floor.position.set(0, groundY + 0.05, 0)
    g.add(floor)

    // Walls (4 walls with a gap for door)
    const wallBack = box(4, 3, 0.15, 0x886644)
    wallBack.position.set(0, groundY + 1.5, -1.425)
    g.add(wallBack)

    const wallLeft = box(0.15, 3, 3, 0x886644)
    wallLeft.position.set(-1.925, groundY + 1.5, 0)
    g.add(wallLeft)

    const wallRight = box(0.15, 3, 3, 0x886644)
    wallRight.position.set(1.925, groundY + 1.5, 0)
    g.add(wallRight)

    // Roof — angled (two slabs)
    const roofL = box(2.2, 0.12, 3.4, 0x553322)
    roofL.position.set(-1, groundY + 3.3, 0)
    roofL.rotation.z = 0.4
    g.add(roofL)

    const roofR = box(2.2, 0.12, 3.4, 0x553322)
    roofR.position.set(1, groundY + 3.3, 0)
    roofR.rotation.z = -0.4
    g.add(roofR)

    // Table outside
    const table = box(1.5, 0.05, 0.8, 0x886644)
    table.position.set(3, groundY + 0.8, 2)
    g.add(table)

    // Map on table
    const map = box(1.2, 0.02, 0.6, 0xddcc88)
    map.position.set(3, groundY + 0.85, 2)
    g.add(map)

    // Lantern post
    const pole = box(0.08, 2, 0.08, 0x664433)
    pole.position.set(3.5, groundY + 1, 0)
    g.add(pole)

    const lantern = box(0.2, 0.2, 0.2, 0xffcc44)
    lantern.position.set(3.5, groundY + 2.1, 0)
    g.add(lantern)

    // Bushes
    const bush1 = box(0.6, 0.5, 0.6, 0x336633)
    bush1.position.set(-2.5, groundY + 0.25, 1.5)
    g.add(bush1)

    const bush2 = box(0.5, 0.4, 0.5, 0x336633)
    bush2.position.set(-2.8, groundY + 0.2, -1)
    g.add(bush2)

    return g
  }

  // ── Vesper (Astronomer) — Observatory Tower ──────────────────────────

  private buildVesperHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Tower base
    const tower = box(2, 5, 2, 0x778899)
    tower.position.set(0, groundY + 2.5, 0)
    g.add(tower)

    // Dome on top
    const dome = box(2.5, 1, 2.5, 0x556688)
    dome.position.set(0, groundY + 5.5, 0)
    g.add(dome)

    // Telescope — angled
    const telescope = box(0.06, 1.5, 0.06, 0x444444)
    telescope.position.set(0.5, groundY + 5.8, 0.5)
    telescope.rotation.x = -0.6
    g.add(telescope)

    // Star chart on wall
    const chart = box(0.8, 0.6, 0.02, 0x223355)
    chart.position.set(0, groundY + 3, -1.02)
    g.add(chart)

    // Door area marker (small step)
    const step = box(1, 0.15, 0.5, 0x667788)
    step.position.set(0, groundY + 0.075, 1.2)
    g.add(step)

    return g
  }

  // ── Bramble (Cursed Knight) — Ruined Campsite ────────────────────────

  private buildBrambleHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Broken tent — tilted flat box
    const tent = box(2, 0.02, 2, 0x556644)
    tent.position.set(0, groundY + 0.8, 0)
    tent.rotation.z = 0.3
    tent.rotation.x = 0.15
    g.add(tent)

    // Tent support pole
    const tentPole = box(0.06, 1.2, 0.06, 0x664433)
    tentPole.position.set(0, groundY + 0.6, 0)
    tentPole.rotation.z = 0.1
    g.add(tentPole)

    // Campfire ring — 4 stones
    const stonePositions = [
      [1.5, 0.5], [-1.5, 0.5], [1.5, -0.5], [-1.5, -0.5],
    ] as const
    for (const [sx, sz] of stonePositions) {
      const stone = box(0.35, 0.2, 0.35, 0x888888)
      stone.position.set(2 + sx * 0.4, groundY + 0.1, 2 + sz * 0.4)
      g.add(stone)
    }

    // Broken sword in ground
    const sword = box(0.04, 0.8, 0.02, 0x999999)
    sword.position.set(-1.5, groundY + 0.4, 1)
    sword.rotation.z = 0.15
    g.add(sword)

    // Dead tree stump
    const stump = box(0.4, 0.5, 0.4, 0x443322)
    stump.position.set(2.5, groundY + 0.25, -1.5)
    g.add(stump)

    return g
  }

  // ── Plume (Trickster Merchant) — Market Stall ────────────────────────

  private buildPlumeHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Rug on ground
    const rug = box(3, 0.02, 2, 0x993366)
    rug.position.set(0, groundY + 0.01, 0)
    g.add(rug)

    // Stall posts (4 corners)
    const postPositions = [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]] as const
    for (const [px, pz] of postPositions) {
      const post = box(0.08, 2.2, 0.08, 0x886644)
      post.position.set(px, groundY + 1.1, pz)
      g.add(post)
    }

    // Colorful awning top
    const awning = box(3, 0.05, 2, 0xcc4488)
    awning.position.set(0, groundY + 2.2, 0)
    g.add(awning)

    // Counter
    const counter = box(2, 0.8, 0.5, 0x886644)
    counter.position.set(0, groundY + 0.4, -0.7)
    g.add(counter)

    // Hanging goods — 3 small colored boxes
    const goods: [number, number, number][] = [
      [-0.6, 0xff4488], [0, 0x44ff88], [0.6, 0xffcc44],
    ] as unknown as [number, number, number][]
    for (let i = 0; i < 3; i++) {
      const gx = [-0.6, 0, 0.6][i]
      const gc = [0xff4488, 0x44ff88, 0xffcc44][i]
      const good = box(0.2, 0.2, 0.2, gc)
      good.position.set(gx, groundY + 1.8, 0)
      g.add(good)

      // String
      const str = box(0.02, 0.3, 0.02, 0x664433)
      str.position.set(gx, groundY + 2.0, 0)
      g.add(str)
    }

    return g
  }

  // ── Cinder (Forgemaster) — Smithy ────────────────────────────────────

  private buildCinderHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Forge building
    const forge = box(3, 2.5, 3, 0x554433)
    forge.position.set(0, groundY + 1.25, 0)
    g.add(forge)

    // Chimney
    const chimney = box(0.6, 2.5, 0.6, 0x443333)
    chimney.position.set(0.8, groundY + 3.75, -0.8)
    g.add(chimney)

    // Anvil
    const anvil = box(0.5, 0.4, 0.3, 0x333344)
    anvil.position.set(2.5, groundY + 0.2, 1.5)
    g.add(anvil)

    // Embers near anvil
    const embers = box(0.3, 0.1, 0.3, 0xff4400)
    embers.position.set(2.5, groundY + 0.05, 1)
    g.add(embers)

    // Water trough
    const trough = box(1.5, 0.3, 0.4, 0x334466)
    trough.position.set(-2, groundY + 0.15, 1)
    g.add(trough)

    // Door opening marker
    const step = box(1, 0.1, 0.5, 0x665544)
    step.position.set(0, groundY + 0.05, 1.6)
    g.add(step)

    return g
  }

  // ── Pearl (Healer) — Crystal Garden ──────────────────────────────────

  private buildPearlHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // 4 pillars for gazebo
    const pillarPos = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const
    for (const [px, pz] of pillarPos) {
      const pillar = box(0.08, 2.5, 0.08, 0xccccdd)
      pillar.position.set(px, groundY + 1.25, pz)
      g.add(pillar)
    }

    // Gazebo roof
    const roof = box(2.4, 0.08, 2.4, 0xccccdd)
    roof.position.set(0, groundY + 2.5, 0)
    g.add(roof)

    // Herb planters
    const planterPositions = [[2, 0], [2, 1.5], [2, -1.5]] as const
    for (const [px, pz] of planterPositions) {
      const planter = box(0.6, 0.3, 0.6, 0x886644)
      planter.position.set(px, groundY + 0.15, pz)
      g.add(planter)

      const herb = box(0.5, 0.25, 0.5, 0x448844)
      herb.position.set(px, groundY + 0.4, pz)
      g.add(herb)
    }

    // Crystal formations
    const crystal1 = box(0.15, 0.8, 0.15, 0x88aadd)
    crystal1.position.set(-2, groundY + 0.4, 0.5)
    crystal1.rotation.z = 0.2
    g.add(crystal1)

    const crystal2 = box(0.12, 0.6, 0.12, 0x88aadd)
    crystal2.position.set(-2.3, groundY + 0.3, -0.3)
    crystal2.rotation.z = -0.15
    g.add(crystal2)

    // Water basin
    const basin = box(1, 0.15, 1, 0x5588aa)
    basin.position.set(0, groundY + 0.075, 0)
    g.add(basin)

    return g
  }

  // ── Thornwick (Librarian) — Crooked Study ────────────────────────────

  private buildThornwickHouse(groundY: number): THREE.Group {
    const g = new THREE.Group()

    // Main leaning house
    const house = box(3, 3, 3, 0x556633)
    house.position.set(0, groundY + 1.5, 0)
    house.rotation.z = 0.05
    g.add(house)

    // Roof
    const roof = box(3.4, 0.15, 3.4, 0x443322)
    roof.position.set(0, groundY + 3.1, 0)
    roof.rotation.z = 0.05
    g.add(roof)

    // Stacked books outside
    const bookColors = [0xcc4444, 0x4444cc, 0x44cc44, 0xcccc44]
    for (let i = 0; i < bookColors.length; i++) {
      const book = box(0.4, 0.1, 0.3, bookColors[i])
      book.position.set(2.5, groundY + 0.05 + i * 0.11, 1)
      book.rotation.y = i * 0.2
      g.add(book)
    }

    // Desk
    const desk = box(1.2, 0.7, 0.6, 0x664433)
    desk.position.set(2.5, groundY + 0.35, -1)
    g.add(desk)

    // Candle on desk
    const candleStick = box(0.04, 0.25, 0.04, 0xeeeecc)
    candleStick.position.set(2.5, groundY + 0.82, -1)
    g.add(candleStick)

    const candleFlame = box(0.08, 0.08, 0.08, 0xffee44)
    candleFlame.position.set(2.5, groundY + 0.98, -1)
    g.add(candleFlame)

    return g
  }
}
