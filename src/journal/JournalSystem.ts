import * as THREE from 'three'
import { JournalState } from './JournalState'
import { TOTAL_ENTRIES } from './JournalData'
import { BiomeType } from '../biomes/types'
import { WeatherType } from '../systems/WeatherSystem'
import { Creature } from '../creatures/Creature'
import { SPECIES } from '../creatures/Species'
import { NarrativeProgression, NarrativeLogEntry } from '../lore/NarrativeProgression'

export class JournalSystem {
  readonly state: JournalState
  private hudEl: HTMLElement | null
  private popupEl: HTMLElement | null
  private popupTimer = 0
  private lastBiome: BiomeType | null = null

  /** Auto-logged narrative observations (shown in the journal overlay). */
  readonly narrativeLogs: NarrativeLogEntry[] = []

  /** Per-biome hypotheses available (populated each frame by NarrativeProgression). */
  readonly hypotheses: Map<BiomeType, string> = new Map()

  constructor() {
    this.state = new JournalState()
    this.hudEl = document.getElementById('journal-hud')
    this.popupEl = document.getElementById('discovery-popup')
    this.updateHud()
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    currentBiome: BiomeType,
    currentWeather: WeatherType,
    creatures: Map<string, Creature>,
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
  ) {
    // Biome discovery
    if (currentBiome !== this.lastBiome) {
      this.lastBiome = currentBiome
      if (this.state.discover(`biome_${currentBiome}`)) {
        const names: Record<number, string> = {
          0:'Forest',1:'Desert',2:'Swamp',3:'Snow',4:'Volcanic',
          5:'Crystal',6:'Jungle',7:'Mesa',8:'Coral Reef',9:'Heaven',10:'Hell',
        }
        this.showPopup(`New Biome: ${names[currentBiome] || 'Unknown'}`)
      }
    }

    // Weather discovery
    this.state.discover(`weather_${currentWeather}`)

    // Creature discovery — check within 15 units
    const px = playerPos.x, pz = playerPos.z
    for (const c of creatures.values()) {
      if (c.state === 'dead') continue
      const sp = SPECIES[c.species]
      if (sp.isGiant) continue
      const dx = c.position.x - px
      const dz = c.position.z - pz
      if (dx * dx + dz * dz < 225) { // 15^2
        const key = `creature_${c.species}`
        if (this.state.discover(key)) {
          const names: Record<string, string> = {
            rabbit:'Rabbit',deer:'Deer',bird:'Bluebird',dragon:'Dragon',
            fish:'Fish',wolf:'Grey Wolf',croc:'Crocodile',bear:'Brown Bear',
            camel:'Camel',fox:'Arctic Fox',bat:'Cave Bat',scorpion:'Scorpion',
            lion:'Lion',mammoth:'Mammoth',toad:'Toad',eagle:'Golden Eagle',
            parrot:'Parrot',crab:'Crab',goat:'Mountain Goat',
            imp:'Imp',hellhound:'Hellhound',
          }
          this.showPopup(`New Creature: ${names[c.species] || c.species}`)
        }
      }
    }

    // Landmark discovery — check within 30 units
    for (const [biome, pos] of landmarkPositions) {
      const ldx = pos.x - px
      const ldz = pos.z - pz
      if (ldx * ldx + ldz * ldz < 900) { // 30^2
        const key = `landmark_${biome}`
        if (this.state.discover(key)) {
          const names: Record<number, string> = {
            0:'Druid Ring Temple',1:'Great Pyramid',2:'Swamp Ziggurat',3:'Ice Palace',
            4:'Obsidian Citadel',5:'Crystal Cathedral',6:'Jungle Pyramid',
            7:'Mesa Citadel',8:'Coral Palace',9:'Cloud Temple',10:'Infernal Citadel',
          }
          this.showPopup(`New Landmark: ${names[biome] || 'Unknown'}`)
        }
      }
    }

    // Popup fade
    if (this.popupTimer > 0) {
      this.popupTimer -= delta
      if (this.popupTimer <= 0 && this.popupEl) {
        this.popupEl.style.opacity = '0'
      }
    }
  }

  discoverLore(index: number): boolean {
    const key = `lore_${index}`
    if (this.state.discover(key)) {
      this.showPopup(`Lore Fragment #${index + 1}`)
      return true
    }
    return false
  }

  /** Consume pending auto-log entries from NarrativeProgression and update hypotheses. */
  consumeNarrativeUpdates(narrative: NarrativeProgression): void {
    // Consume pending auto-log entries
    for (const entry of narrative.pendingLogs) {
      this.narrativeLogs.push(entry)
      // Also register as a journal discovery so it counts toward total
      const key = `narrative_${entry.type}_${entry.biome}`
      if (this.state.discover(key)) {
        this.showPopup(entry.text)
      }
    }

    // Refresh hypotheses map
    this.hypotheses.clear()
    const allH = narrative.getAllHypotheses()
    for (const [biome, text] of allH) {
      this.hypotheses.set(biome, text)
    }
  }

  discoverRune(biome: BiomeType): boolean {
    const key = `rune_${biome}`
    if (this.state.discover(key)) {
      this.showPopup('Rune Challenge Complete!')
      return true
    }
    return false
  }

  private showPopup(text: string) {
    this.updateHud()
    if (this.popupEl) {
      this.popupEl.textContent = text
      this.popupEl.style.opacity = '1'
      this.popupTimer = 2.5
    }
  }

  private updateHud() {
    if (this.hudEl) {
      this.hudEl.textContent = `DISCOVERED ${this.state.getDiscoveredCount()} / ${TOTAL_ENTRIES}`
    }
  }
}
