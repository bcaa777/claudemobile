import * as THREE from 'three'
import { BiomeMap } from '../world/BiomeMap'
import { BiomeType } from '../biomes/types'
import { sampleWorldHeight } from '../world/TerrainGenerator'
import { AudioSystem } from '../audio/AudioSystem'
import { LoreStoneManager } from '../journal/LoreStone'
import { WorldState } from './WorldState'

const MOTE_COUNT = 7
const MOTE_SPACING = 35
const MOTE_TRIGGER_DIST = 8
const STONE_TRIGGER_DIST = 4
const THRESHOLD_TRIGGER_DIST = 5
const MOTE_FREQUENCIES = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9]

interface Mote {
  mesh: THREE.Mesh
  position: THREE.Vector3
  chimed: boolean
  index: number
}

export class AwakeningSystem {
  private scene: THREE.Scene
  private audioSystem: AudioSystem
  private worldState: WorldState

  // Stage 1: Castle stone
  private castleStone: THREE.Mesh | null = null
  private castleStoneActivated = false

  // Stage 2: Luminous path
  private motes: Mote[] = []
  private pathVisible = false

  // Stage 3: Threshold circle
  private thresholdCenter: THREE.Vector3
  private thresholdStones: THREE.Mesh[] = []
  private thresholdRing: THREE.Mesh | null = null
  private thresholdActivated = false
  private thresholdSequenceTimer = -1
  private thresholdStonesLit = 0

  constructor(
    castlePosition: THREE.Vector3,
    forestLandmarkPosition: THREE.Vector3,
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    audioSystem: AudioSystem,
    loreStones: LoreStoneManager,
    worldState: WorldState,
  ) {
    this.scene = scene
    this.audioSystem = audioSystem
    this.worldState = worldState

    // Direction from castle to forest landmark
    const dir = new THREE.Vector3()
      .subVectors(forestLandmarkPosition, castlePosition)
      .normalize()

    // Perpendicular direction (on XZ plane) for lore stone offset
    const perp = new THREE.Vector3(-dir.z, 0, dir.x)

    // Threshold center: 50 units before the forest landmark
    this.thresholdCenter = new THREE.Vector3()
      .copy(forestLandmarkPosition)
      .addScaledVector(dir, -50)
    this.thresholdCenter.y = sampleWorldHeight(this.thresholdCenter.x, this.thresholdCenter.z, biomeMap)

    // ── Stage 1: Castle Stone ──
    if (worldState.awakeningStage < 1) {
      const stonePos = new THREE.Vector3(
        castlePosition.x,
        castlePosition.y,
        castlePosition.z + 15,
      )
      stonePos.y = sampleWorldHeight(stonePos.x, stonePos.z, biomeMap) + 0.05

      const geo = new THREE.RingGeometry(0.8, 1.5, 32)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      this.castleStone = new THREE.Mesh(geo, mat)
      this.castleStone.position.copy(stonePos)
      this.castleStone.rotation.x = -Math.PI / 2
      scene.add(this.castleStone)
    }

    // ── Always create path + threshold meshes ──
    this.createPath(castlePosition, dir, perp, biomeMap, loreStones)
    this.createThreshold(biomeMap)

    // Show/hide based on saved stage
    if (worldState.awakeningStage >= 1) {
      this.showPath(true)
    } else {
      this.showPath(false)
    }

    // If already completed stage 2, show everything but inert (dim glow)
    if (worldState.awakeningStage >= 2) {
      this.thresholdActivated = true
      for (const mote of this.motes) {
        mote.chimed = true
        ;(mote.mesh.material as THREE.MeshBasicMaterial).opacity = 0.05
      }
      for (const stone of this.thresholdStones) {
        ;(stone.material as THREE.MeshLambertMaterial).emissive.setHex(0x443311)
      }
    }
  }

  private createPath(
    castlePosition: THREE.Vector3,
    dir: THREE.Vector3,
    perp: THREE.Vector3,
    biomeMap: BiomeMap,
    loreStones: LoreStoneManager,
  ) {
    for (let i = 0; i < MOTE_COUNT; i++) {
      const pos = new THREE.Vector3()
        .copy(castlePosition)
        .addScaledVector(dir, 30 + i * MOTE_SPACING)
      pos.y = sampleWorldHeight(pos.x, pos.z, biomeMap) + 0.3

      const geo = new THREE.PlaneGeometry(0.5, 0.5)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      mesh.rotation.x = -Math.PI / 2
      this.scene.add(mesh)

      this.motes.push({ mesh, position: pos, chimed: false, index: i })

      // At mote index 3, place a guaranteed lore stone nearby
      if (i === 3) {
        const stonePos = new THREE.Vector3().copy(pos).addScaledVector(perp, 10)
        stonePos.y = sampleWorldHeight(stonePos.x, stonePos.z, biomeMap) + 0.4
        loreStones.placeGuaranteedStone(stonePos, BiomeType.Forest, 0)
      }
    }
  }

  private createThreshold(biomeMap: BiomeMap) {
    const center = this.thresholdCenter

    // 3 stone pillars in a triangle
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2
      const sx = center.x + Math.cos(angle) * 4
      const sz = center.z + Math.sin(angle) * 4
      const sy = sampleWorldHeight(sx, sz, biomeMap)

      const geo = new THREE.BoxGeometry(0.5, 2, 0.5)
      const mat = new THREE.MeshLambertMaterial({ color: 0x888877 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(sx, sy + 1, sz)
      this.scene.add(mesh)
      this.thresholdStones.push(mesh)
    }

    // Ground ring
    const ringGeo = new THREE.RingGeometry(3, 4.5, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.thresholdRing = new THREE.Mesh(ringGeo, ringMat)
    this.thresholdRing.position.copy(center)
    this.thresholdRing.position.y += 0.05
    this.thresholdRing.rotation.x = -Math.PI / 2
    this.scene.add(this.thresholdRing)
  }

  private showPath(visible: boolean) {
    this.pathVisible = visible
    for (const mote of this.motes) {
      mote.mesh.visible = visible
    }
    for (const stone of this.thresholdStones) {
      stone.visible = visible
    }
    if (this.thresholdRing) {
      this.thresholdRing.visible = visible
    }
  }

  update(dt: number, playerPos: THREE.Vector3, elapsedTime: number) {
    // ── Stage 1: Castle Stone pulse & activation ──
    if (this.castleStone && !this.castleStoneActivated) {
      const mat = this.castleStone.material as THREE.MeshBasicMaterial
      mat.opacity = 0.275 + Math.sin(elapsedTime * 0.3 * Math.PI * 2) * 0.125

      const dx = playerPos.x - this.castleStone.position.x
      const dz = playerPos.z - this.castleStone.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < STONE_TRIGGER_DIST) {
        this.castleStoneActivated = true
        mat.opacity = 1.0

        // Remove the castle stone
        this.scene.remove(this.castleStone)
        this.castleStone = null

        this.worldState.activationMessage = 'The chord is broken. Walk where the light leads.'
        this.worldState.activationMessageTimer = 6
        this.worldState.awakeningStage = 1
        this.worldState.saveToStorage()

        // Reveal path and threshold
        this.showPath(true)
      }
    }

    // ── Stage 2: Mote interactions ──
    if (!this.pathVisible) return

    for (const mote of this.motes) {
      if (mote.chimed) continue

      // Pulse
      const mat = mote.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + Math.sin(elapsedTime * 1.5 + mote.index * 0.7) * 0.1

      const dx = playerPos.x - mote.position.x
      const dz = playerPos.z - mote.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < MOTE_TRIGGER_DIST) {
        mote.chimed = true
        mat.opacity = 0.6
        // Fade to dim after chiming
        setTimeout(() => { mat.opacity = 0.05 }, 800)

        // Play chime
        try {
          this.audioSystem.chime?.playLoreChime(MOTE_FREQUENCIES[mote.index])
        } catch { /* audio not ready */ }
      }
    }

    // ── Stage 3: Threshold circle activation ──
    if (this.thresholdStones.length > 0 && !this.thresholdActivated && this.worldState.awakeningStage >= 1) {
      // Pulse ring
      if (this.thresholdRing) {
        const rMat = this.thresholdRing.material as THREE.MeshBasicMaterial
        rMat.opacity = 0.1 + Math.sin(elapsedTime * 0.5) * 0.05
      }

      const dx = playerPos.x - this.thresholdCenter.x
      const dz = playerPos.z - this.thresholdCenter.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < THRESHOLD_TRIGGER_DIST && this.thresholdSequenceTimer < 0) {
        this.thresholdSequenceTimer = 0
      }

      if (this.thresholdSequenceTimer >= 0) {
        this.thresholdSequenceTimer += dt

        // Light stones in sequence (1 second apart)
        const stoneToLight = Math.floor(this.thresholdSequenceTimer)
        if (stoneToLight > this.thresholdStonesLit && this.thresholdStonesLit < 3) {
          const stone = this.thresholdStones[this.thresholdStonesLit]
          ;(stone.material as THREE.MeshLambertMaterial).emissive.setHex(0xffcc44)

          // Play ascending note: C4, E4, G4
          const notes = [261.6, 329.6, 392]
          try {
            this.audioSystem.chime?.playLoreChime(notes[this.thresholdStonesLit])
          } catch { /* audio not ready */ }

          this.thresholdStonesLit++
        }

        // After 3 seconds: complete
        if (this.thresholdSequenceTimer >= 3 && !this.thresholdActivated) {
          this.thresholdActivated = true
          this.worldState.activationMessage = 'A fragment of the old harmony stirs. The grove ahead remembers more.'
          this.worldState.activationMessageTimer = 6
          this.worldState.awakeningStage = 2
          this.worldState.forestFogBoost = 60
          this.worldState.saveToStorage()
        }
      }
    }
  }
}
