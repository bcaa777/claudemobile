import * as THREE from 'three'
import { JournalState } from './JournalState'
import { TOTAL_ENTRIES } from './JournalData'
import { BiomeType } from '../biomes/types'
import { WeatherType } from '../systems/WeatherSystem'
import { Creature } from '../creatures/Creature'
import { SPECIES } from '../creatures/Species'

export class JournalSystem {
  readonly state: JournalState
  private hudEl: HTMLElement | null
  private popupEl: HTMLElement | null
  private popupTimer = 0
  private lastBiome: BiomeType | null = null

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
          0:'Forest',1:'Desert',2:'Volcanic',3:'Snow',4:'Swamp',5:'Tundra',
          6:'Mushroom',7:'Ash Wastes',8:'Crystal',9:'Savanna',10:'Heaven',
          11:'Hell',12:'Alpine',13:'Cliffs',14:'Floating Islands',15:'Jungle',
          16:'Mesa',17:'Coral Reef',18:'Bog',19:'Badlands',20:'Taiga',21:'Oasis',
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
            0:'Druid Ring',1:'Great Pyramid',2:'Obsidian Citadel',3:'Ice Palace',
            4:'Swamp Ziggurat',5:'Ancestor Field',6:'Mycelium Cathedral',
            7:'Ash Colosseum',8:'Crystal Cathedral',9:'Savanna Obelisk',
            10:'Cloud Temple',11:'Infernal Citadel',12:'Alpine Monastery',
            13:'Cliff Fortress',14:'Sky Temple',15:'Jungle Pyramid',
            16:'Mesa Citadel',17:'Coral Palace',18:'Bog Shrine',
            19:'Badlands Monolith',20:'Taiga Longhouse',21:'Oasis Minaret',
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
