import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { NPC_DEFINITIONS, ALL_NPC_IDS, type NPCId, type NPCDef, type DialogueLine, type TimeCondition } from './NPCData'
import { loadNPCStates, saveNPCStates, type NPCStateData } from './NPCState'
import { NPCMesh } from './NPCMesh'
import { NPCBeacon } from './NPCBeacon'
import { DialogueSystem } from './DialogueSystem'
import { Artefact } from './Artefact'
import { sampleWorldHeight } from '../world/TerrainGenerator'
import type { BiomeMap } from '../world/BiomeMap'
import type { InputManager } from '../engine/InputManager'
import { RENDER_CONFIG } from '../config'
import type { WorldState } from '../systems/WorldState'
import type { NPCHouses } from './NPCHouses'
import type { SpatialTTS } from '../audio/SpatialTTS'

const INTERACT_DIST_SQ = 5 * 5
const RELOCATE_DIST_SQ = 60 * 60

interface ActiveNPC {
  def: NPCDef
  state: NPCStateData
  mesh: NPCMesh
  beacon: NPCBeacon
  worldPos: THREE.Vector3
  awaitingRelocate: boolean
}

export class NPCManager {
  private npcs: Map<NPCId, ActiveNPC> = new Map()
  private states: Map<NPCId, NPCStateData>
  private dialogue: DialogueSystem
  private artefacts: Artefact[] = []
  private scene: THREE.Scene
  private biomeMap: BiomeMap
  private landmarkPositions: Map<BiomeType, THREE.Vector3>
  private artefactHud: HTMLElement | null
  artefactsCollected = 0
  npcHouses: NPCHouses | null = null
  spatialTTS: SpatialTTS | null = null

  /** Set to the NPC's name when the player first enters dialogue range — consumed by Engine for intro chime. */
  pendingFirstMeetingName: string | null = null
  /** Screen-space position hint for floating name label (NPC world position, Engine projects it). */
  pendingFirstMeetingPos: THREE.Vector3 | null = null
  private metNPCs: Set<NPCId> = new Set()

  constructor(
    biomeMap: BiomeMap,
    scene: THREE.Scene,
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
  ) {
    this.scene = scene
    this.biomeMap = biomeMap
    this.landmarkPositions = landmarkPositions
    this.dialogue = new DialogueSystem()
    this.states = loadNPCStates()
    this.artefactHud = document.getElementById('artefact-hud')

    // Create all NPCs
    for (const id of ALL_NPC_IDS) {
      const def = NPC_DEFINITIONS[id]
      const state = this.states.get(id)!
      const mesh = new NPCMesh(def.visual)
      const beacon = new NPCBeacon(id)
      const worldPos = this.computePosition(def, state.currentLocationIndex)

      mesh.group.position.copy(worldPos)
      scene.add(mesh.group)
      mesh.group.visible = false // start hidden, update will cull

      // Place beacon offset ~4 units beside the NPC
      beacon.group.position.set(worldPos.x + 3, worldPos.y, worldPos.z + 2)
      scene.add(beacon.group)
      beacon.group.visible = false

      this.npcs.set(id, { def, state, mesh, beacon, worldPos, awaitingRelocate: false })
    }

    // Create artefacts
    for (const id of ALL_NPC_IDS) {
      const def = NPC_DEFINITIONS[id]
      const state = this.states.get(id)!
      const lmPos = landmarkPositions.get(def.artefact.nearBiome)
      if (lmPos) {
        // Place 15-20 units from landmark
        const offset = new THREE.Vector3(17, 2, 15)
        const artPos = lmPos.clone().add(offset)
        artPos.y = sampleWorldHeight(artPos.x, artPos.z, biomeMap) + 1.5
        const artefact = new Artefact(artPos, scene, def.artefact.color, def.artefact.name)
        if (state.artefactCollected) {
          artefact.setPreCollected()
        } else {
          // Don't show artefact until NPC has been spoken to at first location
          // Actually, artefacts are always available near the first location
        }
        this.artefacts.push(artefact)
      }
    }

    // Count pre-collected
    this.artefactsCollected = this.artefacts.filter(a => a.collected).length
    this.updateArtefactHud()
  }

  private computePosition(def: NPCDef, locationIndex: number): THREE.Vector3 {
    const loc = def.locations[Math.min(locationIndex, def.locations.length - 1)]
    const lmPos = this.landmarkPositions.get(loc.biome)
    if (!lmPos) {
      // Fallback: use biome seed position
      const seed = this.biomeMap.getClosestSeedOf(loc.biome)
      const y = sampleWorldHeight(seed.x + loc.offset.x, seed.z + loc.offset.z, this.biomeMap)
      return new THREE.Vector3(seed.x + loc.offset.x, y, seed.z + loc.offset.z)
    }
    const x = lmPos.x + loc.offset.x
    const z = lmPos.z + loc.offset.z
    const y = sampleWorldHeight(x, z, this.biomeMap)
    return new THREE.Vector3(x, y, z)
  }

  update(delta: number, playerPos: THREE.Vector3, time: number, input: InputManager, timeOfDay = 0.5, worldState?: WorldState, companionSpecies?: string | null, loreFound = 0) {
    // Clear pending first-meeting from previous frame
    this.pendingFirstMeetingName = null
    this.pendingFirstMeetingPos = null

    let nearestNPC: ActiveNPC | null = null
    let nearestDistSq = Infinity

    for (const [id, npc] of this.npcs) {
      // Daily routine: lerp NPC toward routine target when at home location
      if (this.npcHouses && npc.state.currentLocationIndex === 0) {
        const routinePos = this.npcHouses.getRoutinePosition(id, timeOfDay)
        if (routinePos) {
          npc.worldPos.lerp(routinePos, Math.min(1, delta * 0.5))
          npc.mesh.group.position.copy(npc.worldPos)
          npc.beacon.group.position.set(npc.worldPos.x + 3, npc.worldPos.y, npc.worldPos.z + 2)
        }
      }

      const dx = playerPos.x - npc.worldPos.x
      const dy = playerPos.y - npc.worldPos.y
      const dz = playerPos.z - npc.worldPos.z
      const distSq = dx * dx + dy * dy + dz * dz

      // Distance cull — NPC mesh (creature draw distance)
      const cullDistSq = RENDER_CONFIG.drawCreatures ** 2
      npc.mesh.group.visible = distSq < cullDistSq
      if (npc.mesh.group.visible) {
        npc.mesh.setLOD(distSq)
        npc.mesh.update(delta, time)

        // Face player when close
        if (distSq < INTERACT_DIST_SQ * 4) {
          const angle = Math.atan2(dx, dz)
          npc.mesh.group.rotation.y = angle
        }
      }

      // Beacon — uses particle draw distance
      const beaconCullDistSq = RENDER_CONFIG.drawParticles ** 2
      npc.beacon.group.visible = distSq < beaconCullDistSq
      if (npc.beacon.group.visible) {
        npc.beacon.update(time)
      }

      // Track nearest for interaction
      if (distSq < INTERACT_DIST_SQ && distSq < nearestDistSq) {
        nearestNPC = npc
        nearestDistSq = distSq
      }

      // First-meeting detection: NPC just entered interact range for the first time
      if (distSq < INTERACT_DIST_SQ && !this.metNPCs.has(npc.def.id)) {
        this.metNPCs.add(npc.def.id)
        this.pendingFirstMeetingName = npc.def.name
        this.pendingFirstMeetingPos = npc.worldPos.clone()
      }


      // Relocate check: all lines delivered at current stage, player moved away
      if (npc.awaitingRelocate && distSq > RELOCATE_DIST_SQ) {
        this.relocateNPC(npc)
      }
    }

    // Interaction prompt
    if (nearestNPC && !this.dialogue.isActive()) {
      this.dialogue.showInteractPrompt()
      if (input.consumeInteract()) {
        this.startNPCDialogue(nearestNPC, timeOfDay, worldState, companionSpecies ?? null, loreFound)
      }
    } else if (!this.dialogue.isActive()) {
      this.dialogue.hideInteractPrompt()
    }

    // Handle dialogue E press
    if (this.dialogue.isActive() && input.consumeInteract()) {
      this.dialogue.handleInteract()
    }

    // Dialogue typewriter
    this.dialogue.update(delta)

    // Artefact updates + pickup
    for (let i = 0; i < this.artefacts.length; i++) {
      const art = this.artefacts[i]
      art.update(delta, time)
      if (art.tryCollect(playerPos)) {
        this.artefactsCollected++
        // Mark corresponding NPC state
        const npcId = ALL_NPC_IDS[i]
        if (npcId) {
          const state = this.states.get(npcId)
          if (state) {
            state.artefactCollected = true
            saveNPCStates(this.states)
          }
        }
        this.updateArtefactHud()
      }
    }
  }

  private startNPCDialogue(npc: ActiveNPC, timeOfDay = 0.5, worldState?: WorldState, companionSpecies: string | null = null, loreFound = 0) {
    const stageIndex = npc.state.currentLocationIndex
    const stages = npc.def.dialogue
    if (stageIndex >= stages.length) return

    // Resolve current time condition from timeOfDay (0-1)
    const currentTimeCondition: TimeCondition = (
      (timeOfDay >= 0.23 && timeOfDay <= 0.27) ? 'dawn' :
      (timeOfDay >= 0.73 && timeOfDay <= 0.77) ? 'dusk' :
      (timeOfDay >= 0.8 || timeOfDay <= 0.2)   ? 'night' :
      'day'
    )

    // Filter dialogue lines based on all conditions
    const dialogueLines = stages[stageIndex]
    const filteredTexts = dialogueLines
      .filter(line => this.linePassesConditions(line, currentTimeCondition, worldState, companionSpecies, loreFound))
      .map(line => line.text)

    if (filteredTexts.length === 0) return

    this.dialogue.startDialogue(npc.def.name, npc.def.title, filteredTexts)
    const npcPos = npc.worldPos
    const npcBiome = this.biomeMap.getBiomeAt(npcPos.x, npcPos.z)
    this.dialogue.setOnSpeak((text) => {
      this.spatialTTS?.speak(text, npcPos, npcBiome)
    })

    // Mark all lines as delivered for this stage
    npc.state.allLinesDelivered = true
    npc.awaitingRelocate = true
    saveNPCStates(this.states)
  }

  /** Check whether a dialogue line's conditions are all met. */
  private linePassesConditions(
    line: DialogueLine,
    currentTime: TimeCondition,
    worldState?: WorldState,
    companionSpecies: string | null = null,
    loreFound = 0,
  ): boolean {
    // Time condition
    if (line.timeCondition && line.timeCondition !== currentTime) return false

    // Minimum lore stones found
    if (line.minLoreFound !== undefined && loreFound < line.minLoreFound) return false

    // Companion species requirement
    if (line.companionSpecies && line.companionSpecies !== companionSpecies) return false

    // Requires specific biome site(s) activated — any match passes
    if (line.requiresSiteActivated && line.requiresSiteActivated.length > 0) {
      if (!worldState) return false
      const hasAny = line.requiresSiteActivated.some(biome => worldState.activatedSites.has(biome))
      if (!hasAny) return false
    }

    return true
  }

  private relocateNPC(npc: ActiveNPC) {
    npc.awaitingRelocate = false
    const maxIndex = npc.def.locations.length - 1
    if (npc.state.currentLocationIndex < maxIndex) {
      npc.state.currentLocationIndex++
      npc.state.allLinesDelivered = false
      const newPos = this.computePosition(npc.def, npc.state.currentLocationIndex)
      npc.worldPos.copy(newPos)
      npc.mesh.group.position.copy(newPos)
      npc.beacon.group.position.set(newPos.x + 3, newPos.y, newPos.z + 2)
      saveNPCStates(this.states)
    }
    // If at last location, stay there
  }

  private updateArtefactHud() {
    if (this.artefactHud) {
      this.artefactHud.textContent = `\u2726 ${this.artefactsCollected} / 7`
      if (this.artefactsCollected > 0) {
        this.artefactHud.style.display = 'block'
      }
    }
  }

  isDialogueActive(): boolean {
    return this.dialogue.isActive()
  }

  getMapMarkers(): { id: string; pos: THREE.Vector3; color: string; label: string }[] {
    const markers: { id: string; pos: THREE.Vector3; color: string; label: string }[] = []
    for (const [id, npc] of this.npcs) {
      markers.push({
        id,
        pos: npc.worldPos,
        color: npc.def.mapColor,
        label: npc.def.mapLabel,
      })
    }
    return markers
  }
}
