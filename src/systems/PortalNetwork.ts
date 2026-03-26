import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { sampleWorldHeight } from '../world/TerrainGenerator'

interface Portal {
  biome: BiomeType
  worldPos: THREE.Vector3
  destinationBiome: BiomeType
  ringMesh: THREE.Mesh
  particlePoints: THREE.Points
  active: boolean
}

interface VoidCorridor {
  group: THREE.Group
  platforms: THREE.Mesh[]
  starField: THREE.Points
  particles: THREE.Points
  exitPortalRing: THREE.Mesh
  startPos: THREE.Vector3
  endPos: THREE.Vector3
  destinationWorldPos: THREE.Vector3
}

export class PortalNetwork {
  private portals: Portal[] = []
  private activeCorridor: VoidCorridor | null = null
  private exitCooldown = 0 // seconds remaining before portals can trigger again
  private scene: THREE.Scene
  private biomeMap: BiomeMap

  private static BIOME_COLORS: Record<number, number> = {
    [BiomeType.Forest]: 0x44ff88,
    [BiomeType.Desert]: 0xffaa44,
    [BiomeType.Swamp]: 0x66ff66,
    [BiomeType.Snow]: 0xaaddff,
    [BiomeType.Volcanic]: 0xff6622,
    [BiomeType.Crystal]: 0x8888ff,
    [BiomeType.Jungle]: 0x22ff66,
    [BiomeType.Mesa]: 0xffaa66,
    [BiomeType.CoralReef]: 0x44dddd,
    [BiomeType.Heaven]: 0xffffff,
    [BiomeType.Hell]: 0xff2244,
  }

  constructor(
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
    seed: number,
  ) {
    this.scene = scene
    this.biomeMap = biomeMap

    // Generate portal network connections (ring topology)
    const biomes = Array.from(landmarkPositions.keys())
    // Shuffle using seed
    const rng = seedRandom(seed + 12345)
    for (let i = biomes.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[biomes[i], biomes[j]] = [biomes[j], biomes[i]]
    }

    // Create portals — each biome's portal leads to the next in the shuffled list
    for (let i = 0; i < biomes.length; i++) {
      const biome = biomes[i]
      const destBiome = biomes[(i + 1) % biomes.length]
      const landmarkPos = landmarkPositions.get(biome)
      if (!landmarkPos) continue

      // Offset portal 30 units from landmark in a seeded direction
      const angle = rng() * Math.PI * 2
      const portalX = landmarkPos.x + Math.cos(angle) * 30
      const portalZ = landmarkPos.z + Math.sin(angle) * 30
      const portalY = sampleWorldHeight(portalX, portalZ, biomeMap) + 1.5

      const worldPos = new THREE.Vector3(portalX, portalY, portalZ)

      // Create ring mesh
      const color = PortalNetwork.BIOME_COLORS[biome] ?? 0x88ccff
      const ringGeo = new THREE.RingGeometry(1.5, 2.2, 24)
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.position.copy(worldPos)
      ringMesh.position.y += 1.5 // center of ring above ground
      // Rotate to stand vertical
      ringMesh.rotation.x = Math.PI / 2
      scene.add(ringMesh)

      // Orbiting particles
      const particleCount = 25
      const particleGeo = new THREE.BufferGeometry()
      const particlePositions = new Float32Array(particleCount * 3)
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
      const particleMat = new THREE.PointsMaterial({
        color,
        size: 3,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: false,
        depthWrite: false,
      })
      const particlePoints = new THREE.Points(particleGeo, particleMat)
      scene.add(particlePoints)

      this.portals.push({
        biome,
        worldPos,
        destinationBiome: destBiome,
        ringMesh,
        particlePoints,
        active: true,
      })
    }
  }

  /** Returns true if player is currently in a void corridor */
  isInCorridor(): boolean {
    return this.activeCorridor !== null
  }

  /** Get spawn position for the corridor (for Engine to position camera) */
  getCorridorSpawnPos(): THREE.Vector3 | null {
    return this.activeCorridor?.startPos ?? null
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    elapsedTime: number,
    worldState: { activationMessage: string | null; activationMessageTimer: number },
  ): {
    enterCorridor: boolean
    exitCorridor: boolean
    exitPosition: THREE.Vector3 | null
  } {
    const result = {
      enterCorridor: false,
      exitCorridor: false,
      exitPosition: null as THREE.Vector3 | null,
    }

    // === In void corridor ===
    if (this.activeCorridor) {
      // Check if player reached exit portal
      const exitDist = playerPos.distanceTo(this.activeCorridor.endPos)
      if (exitDist < 3) {
        result.exitCorridor = true
        // Offset exit 10 units away from the destination portal to avoid re-triggering
        const destPos = this.activeCorridor.destinationWorldPos.clone()
        const awayDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
        result.exitPosition = destPos.clone().addScaledVector(awayDir, 10)
        result.exitPosition.y = destPos.y + 2 // eye height
        this.exitCooldown = 3 // 3 seconds before portals can trigger again
        // Dispose corridor
        this.scene.remove(this.activeCorridor.group)
        this.activeCorridor.group.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
            obj.geometry.dispose()
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach((m) => m.dispose())
          }
        })
        this.activeCorridor = null
      }
      return result
    }

    // Tick exit cooldown
    if (this.exitCooldown > 0) {
      this.exitCooldown -= dt
    }

    // === In normal world — update portal visuals and check proximity ===
    for (const portal of this.portals) {
      if (!portal.active) continue

      // Pulse ring opacity
      const pulse = 0.4 + Math.sin(elapsedTime * 2 + portal.biome) * 0.2
      ;(portal.ringMesh.material as THREE.MeshBasicMaterial).opacity = pulse

      // Slowly rotate ring
      portal.ringMesh.rotation.z += dt * 0.5

      // Update orbiting particles
      const pAttr = portal.particlePoints.geometry.attributes
        .position as THREE.BufferAttribute
      const pArr = pAttr.array as Float32Array
      const cx = portal.worldPos.x
      const cy = portal.worldPos.y + 1.5
      const cz = portal.worldPos.z
      for (let i = 0; i < pArr.length / 3; i++) {
        const a = elapsedTime * 1.5 + (i / (pArr.length / 3)) * Math.PI * 2
        const r = 2.0 + Math.sin(elapsedTime * 0.7 + i * 0.5) * 0.5
        const h = Math.sin(elapsedTime * 0.5 + i * 0.8) * 1.5
        pArr[i * 3] = cx + Math.cos(a) * r
        pArr[i * 3 + 1] = cy + h
        pArr[i * 3 + 2] = cz + Math.sin(a) * r
      }
      pAttr.needsUpdate = true

      // Check player proximity
      const dist = playerPos.distanceTo(portal.worldPos)
      if (dist < 8 && dist > 2) {
        // Show destination name
        const destName = this.getBiomeName(portal.destinationBiome)
        worldState.activationMessage = `Portal to ${destName}`
        worldState.activationMessageTimer = 0.5
      }

      if (dist < 2 && this.exitCooldown <= 0) {
        // Enter the void corridor!
        result.enterCorridor = true
        this.createCorridor(portal)
        return result
      }
    }

    return result
  }

  /** Get all portal positions for the beacon system */
  getPortalPositions(): { position: THREE.Vector3; biome: BiomeType }[] {
    return this.portals
      .filter((p) => p.active)
      .map((p) => ({ position: p.worldPos, biome: p.biome }))
  }

  private createCorridor(portal: Portal): void {
    const group = new THREE.Group()
    const destColor = PortalNetwork.BIOME_COLORS[portal.destinationBiome] ?? 0x88ccff

    // Corridor starts at an arbitrary void position (far from world)
    const startPos = new THREE.Vector3(0, 500, 0) // high up, away from terrain
    const direction = new THREE.Vector3(1, 0, 0) // arbitrary direction
    const platformCount = 15
    const spacing = 3

    // Ambient light
    group.add(new THREE.AmbientLight(0x445566, 0.6))

    // Star field
    const starCount = 300
    const starGeo = new THREE.BufferGeometry()
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = startPos.x + (Math.random() - 0.5) * 120
      starPositions[i * 3 + 1] = startPos.y + (Math.random() - 0.5) * 60
      starPositions[i * 3 + 2] = startPos.z + (Math.random() - 0.5) * 80
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0x8899cc,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
    })
    const starField = new THREE.Points(starGeo, starMat)
    group.add(starField)

    // Platforms
    const platformGeo = new THREE.BoxGeometry(2.5, 0.3, 2.5)
    const platforms: THREE.Mesh[] = []
    for (let i = 0; i < platformCount; i++) {
      const litColor = i < 3 ? destColor : 0x1a2233
      const mat = new THREE.MeshBasicMaterial({ color: litColor })
      const mesh = new THREE.Mesh(platformGeo, mat)
      mesh.position.copy(startPos).addScaledVector(direction, i * spacing)
      group.add(mesh)
      platforms.push(mesh)
    }

    // Destination portal ring at end
    const endPos = startPos
      .clone()
      .addScaledVector(direction, (platformCount - 1) * spacing)
    const exitGeo = new THREE.RingGeometry(1.5, 2.2, 24)
    const exitMat = new THREE.MeshBasicMaterial({
      color: destColor,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    const exitRing = new THREE.Mesh(exitGeo, exitMat)
    exitRing.position.copy(endPos)
    exitRing.position.y += 1.5
    exitRing.rotation.y = Math.PI / 2
    group.add(exitRing)

    // Floating particles
    const fpCount = 100
    const fpGeo = new THREE.BufferGeometry()
    const fpPos = new Float32Array(fpCount * 3)
    for (let i = 0; i < fpCount; i++) {
      fpPos[i * 3] = startPos.x + Math.random() * platformCount * spacing
      fpPos[i * 3 + 1] = startPos.y + (Math.random() - 0.5) * 10
      fpPos[i * 3 + 2] = startPos.z + (Math.random() - 0.5) * 15
    }
    fpGeo.setAttribute('position', new THREE.BufferAttribute(fpPos, 3))
    const fpMat = new THREE.PointsMaterial({
      color: destColor,
      size: 0.12,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
    const fpPoints = new THREE.Points(fpGeo, fpMat)
    group.add(fpPoints)

    this.scene.add(group)

    // Find destination portal's world position
    const destPortal = this.portals.find(
      (p) => p.biome === portal.destinationBiome,
    )
    const destWorldPos = destPortal
      ? destPortal.worldPos.clone()
      : portal.worldPos.clone()

    this.activeCorridor = {
      group,
      platforms,
      starField,
      particles: fpPoints,
      exitPortalRing: exitRing,
      startPos: new THREE.Vector3(startPos.x, startPos.y + 1.5, startPos.z),
      endPos,
      destinationWorldPos: destWorldPos,
    }
  }

  private getBiomeName(biome: BiomeType): string {
    const names: Partial<Record<BiomeType, string>> = {
      [BiomeType.Forest]: 'Ancient Forest',
      [BiomeType.Desert]: 'Desert',
      [BiomeType.Swamp]: 'Swamp',
      [BiomeType.Snow]: 'Snow',
      [BiomeType.Volcanic]: 'Volcanic',
      [BiomeType.Crystal]: 'Crystal Caverns',
      [BiomeType.Jungle]: 'Jungle',
      [BiomeType.Mesa]: 'Mesa',
      [BiomeType.CoralReef]: 'Coral Coast',
      [BiomeType.Heaven]: 'Heaven',
      [BiomeType.Hell]: 'The Depths',
    }
    return names[biome] ?? 'Unknown'
  }

  dispose(): void {
    for (const portal of this.portals) {
      this.scene.remove(portal.ringMesh)
      this.scene.remove(portal.particlePoints)
      portal.ringMesh.geometry.dispose()
      ;(portal.ringMesh.material as THREE.Material).dispose()
      portal.particlePoints.geometry.dispose()
      ;(portal.particlePoints.material as THREE.Material).dispose()
    }
    if (this.activeCorridor) {
      this.scene.remove(this.activeCorridor.group)
    }
  }
}

// Simple seeded random
function seedRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}
