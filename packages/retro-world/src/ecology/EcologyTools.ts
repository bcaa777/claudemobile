import * as THREE from 'three'
import { InputManager } from '@engine/core'
import { FieldGuide } from '../fieldguide/FieldGuide'
import { BiomeType } from '../biomes/types'

export type ToolType = 'food' | 'nest' | 'water' | 'predator_scent' | 'fire_pit' | 'resonance_amp' | 'biome_essence'
export type ToolCategory = 'attractor' | 'repeller' | 'catalyst'

export interface PlacedTool {
  id: string
  type: ToolType
  category: ToolCategory
  position: THREE.Vector3
  radius: number
  biomeEssence?: BiomeType
  placedAt: number
}

interface ToolDef {
  category: ToolCategory
  radius: number
  color: number
  label: string
}

export const TOOL_DEFS: Record<ToolType, ToolDef> = {
  food:           { category: 'attractor', radius: 20, color: 0x8bc34a, label: 'Food Source' },
  nest:           { category: 'attractor', radius: 15, color: 0x795548, label: 'Nesting Site' },
  water:          { category: 'attractor', radius: 20, color: 0x42a5f5, label: 'Water Feature' },
  predator_scent: { category: 'repeller',  radius: 25, color: 0xf44336, label: 'Predator Scent' },
  fire_pit:       { category: 'repeller',  radius: 20, color: 0xff9800, label: 'Fire Pit' },
  resonance_amp:  { category: 'catalyst',  radius: 30, color: 0x9c27b0, label: 'Resonance Amplifier' },
  biome_essence:  { category: 'catalyst',  radius: 25, color: 0x00bcd4, label: 'Biome Essence' },
}

const MAX_ATTRACTORS = 5
const MAX_REPELLERS = 3
const MAX_CATALYSTS = 2

const STORAGE_KEY = 'ecology_tools'
const ESSENCE_INTERVAL = 300 // 5 minutes in seconds

const ALL_TOOL_TYPES: ToolType[] = [
  'food', 'nest', 'water', 'predator_scent', 'fire_pit', 'resonance_amp', 'biome_essence',
]

const DIGIT_CODES: string[] = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
]

interface SerializedTool {
  id: string
  type: ToolType
  category: ToolCategory
  x: number
  y: number
  z: number
  radius: number
  biomeEssence?: BiomeType
  placedAt: number
}

interface SerializedData {
  placed: SerializedTool[]
  essence: [BiomeType, number][]
}

export class EcologyTools {
  readonly placed: Map<string, PlacedTool> = new Map()
  private meshes: Map<string, THREE.Mesh> = new Map()
  readonly essenceInventory: Map<BiomeType, number> = new Map()
  private essenceTimers: Map<BiomeType, number> = new Map()
  menuOpen = false

  private scene: THREE.Scene
  private input: InputManager
  private fieldGuide: FieldGuide
  private nextId = 0
  private menuEl: HTMLElement | null = null

  constructor(scene: THREE.Scene, input: InputManager, fieldGuide: FieldGuide) {
    this.scene = scene
    this.input = input
    this.fieldGuide = fieldGuide
    this.load()
  }

  accumulateEssence(delta: number, currentBiome: BiomeType): void {
    const prev = this.essenceTimers.get(currentBiome) ?? 0
    const next = prev + delta
    this.essenceTimers.set(currentBiome, next % ESSENCE_INTERVAL)

    if (next >= ESSENCE_INTERVAL) {
      const current = this.essenceInventory.get(currentBiome) ?? 0
      if (current < 3) {
        this.essenceInventory.set(currentBiome, current + 1)
        this.save()
      }
    }
  }

  update(delta: number, playerPos: THREE.Vector3, currentBiome: BiomeType): void {
    this.accumulateEssence(delta, currentBiome)

    if (this.input.consumeToolMenu()) {
      this.menuOpen = !this.menuOpen
      if (this.menuOpen) {
        this.renderMenu(playerPos)
      } else {
        this.closeMenu()
      }
    }

    if (this.menuOpen) {
      for (let i = 0; i < DIGIT_CODES.length; i++) {
        if (this.input.isDown(DIGIT_CODES[i])) {
          this.tryPlace(i, playerPos, currentBiome)
          this.menuOpen = false
          this.closeMenu()
          break
        }
      }
    }
  }

  private getAvailableTools(): ToolType[] {
    const mastered = this.fieldGuide.getMasteredCount()
    const available: ToolType[] = []

    if (mastered > 0) {
      available.push('food', 'nest', 'water', 'predator_scent', 'fire_pit')
    }

    if (mastered >= 3) {
      available.push('resonance_amp')
    }

    const hasEssence = Array.from(this.essenceInventory.values()).some(v => v > 0)
    if (hasEssence) {
      available.push('biome_essence')
    }

    return available
  }

  private renderMenu(playerPos: THREE.Vector3): void {
    this.closeMenu()

    const available = this.getAvailableTools()

    const attractorCount = this.countCategory('attractor')
    const repellerCount = this.countCategory('repeller')
    const catalystCount = this.countCategory('catalyst')

    const el = document.createElement('div')
    el.id = 'ecology-tool-menu'
    el.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(0,0,0,0.85)',
      'border:1px solid #445',
      'border-radius:8px',
      'padding:16px 20px',
      'color:#ddd',
      'font-family:monospace',
      'font-size:0.75rem',
      'z-index:1000',
      'min-width:260px',
    ].join(';')

    let html = '<div style="color:#acd;font-size:0.8rem;margin-bottom:10px;letter-spacing:0.12em">ECOLOGY TOOLS [B]</div>'
    html += `<div style="color:#888;font-size:0.65rem;margin-bottom:8px">`
    html += `Attractors: ${attractorCount}/${MAX_ATTRACTORS} &nbsp; Repellers: ${repellerCount}/${MAX_REPELLERS} &nbsp; Catalysts: ${catalystCount}/${MAX_CATALYSTS}`
    html += '</div>'

    for (let i = 0; i < ALL_TOOL_TYPES.length; i++) {
      const type = ALL_TOOL_TYPES[i]
      const def = TOOL_DEFS[type]
      const isAvailable = available.includes(type)
      const isFull = this.isCategoryFull(def.category)
      const colorHex = '#' + def.color.toString(16).padStart(6, '0')

      let label = `[${i + 1}] ${def.label}`
      if (!isAvailable) {
        label += ' (locked)'
      } else if (isFull) {
        label += ' (FULL)'
      }

      const opacity = isAvailable ? '1' : '0.4'
      const color = isAvailable ? colorHex : '#666'

      html += `<div style="padding:3px 0;color:${color};opacity:${opacity}">${label}</div>`
    }

    html += '<div style="color:#555;font-size:0.6rem;margin-top:8px">Press number to place, B to close</div>'
    el.innerHTML = html
    document.body.appendChild(el)
    this.menuEl = el
  }

  private closeMenu(): void {
    if (this.menuEl) {
      this.menuEl.remove()
      this.menuEl = null
    }
  }

  private isCategoryFull(category: ToolCategory): boolean {
    const count = this.countCategory(category)
    if (category === 'attractor') return count >= MAX_ATTRACTORS
    if (category === 'repeller') return count >= MAX_REPELLERS
    if (category === 'catalyst') return count >= MAX_CATALYSTS
    return false
  }

  private countCategory(category: ToolCategory): number {
    let count = 0
    for (const tool of this.placed.values()) {
      if (tool.category === category) count++
    }
    return count
  }

  private tryPlace(index: number, playerPos: THREE.Vector3, currentBiome: BiomeType): void {
    const type = ALL_TOOL_TYPES[index]
    if (!type) return

    const available = this.getAvailableTools()
    if (!available.includes(type)) return

    const def = TOOL_DEFS[type]

    if (this.isCategoryFull(def.category)) return

    // Consume biome essence if applicable
    let biomeEssenceUsed: BiomeType | undefined
    if (type === 'biome_essence') {
      const current = this.essenceInventory.get(currentBiome) ?? 0
      if (current <= 0) return
      this.essenceInventory.set(currentBiome, current - 1)
      biomeEssenceUsed = currentBiome
    }

    const id = `tool_${this.nextId++}`
    const tool: PlacedTool = {
      id,
      type,
      category: def.category,
      position: playerPos.clone(),
      radius: def.radius,
      biomeEssence: biomeEssenceUsed,
      placedAt: Date.now(),
    }

    this.placed.set(id, tool)
    this.createMesh(tool)
    this.save()
  }

  private createMesh(tool: PlacedTool): void {
    const geo = new THREE.BoxGeometry(0.4, 0.6, 0.4)
    const mat = new THREE.MeshLambertMaterial({ color: TOOL_DEFS[tool.type].color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(tool.position)
    mesh.position.y += 0.3
    this.scene.add(mesh)
    this.meshes.set(tool.id, mesh)
  }

  pickupNearest(playerPos: THREE.Vector3): boolean {
    let nearest: PlacedTool | null = null
    let nearestDist = Infinity

    for (const tool of this.placed.values()) {
      const dist = playerPos.distanceTo(tool.position)
      if (dist < 3 && dist < nearestDist) {
        nearestDist = dist
        nearest = tool
      }
    }

    if (!nearest) return false

    this.placed.delete(nearest.id)

    const mesh = this.meshes.get(nearest.id)
    if (mesh) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
      this.meshes.delete(nearest.id)
    }

    this.save()
    return true
  }

  getMutationMultiplierAt(pos: THREE.Vector3): number {
    let multiplier = 1.0

    for (const tool of this.placed.values()) {
      if (tool.category !== 'catalyst') continue
      const dist = pos.distanceTo(tool.position)
      if (dist > tool.radius) continue

      if (tool.type === 'resonance_amp') {
        multiplier += 0.5
      } else if (tool.type === 'biome_essence') {
        multiplier += 0.25
      }
    }

    return multiplier
  }

  hasAttractorNear(pos: THREE.Vector3, type?: ToolType): THREE.Vector3 | null {
    for (const tool of this.placed.values()) {
      if (tool.category !== 'attractor') continue
      if (type !== undefined && tool.type !== type) continue
      const dist = pos.distanceTo(tool.position)
      if (dist <= tool.radius) {
        return tool.position.clone()
      }
    }
    return null
  }

  hasRepellerNear(pos: THREE.Vector3): THREE.Vector3 | null {
    for (const tool of this.placed.values()) {
      if (tool.category !== 'repeller') continue
      const dist = pos.distanceTo(tool.position)
      if (dist <= tool.radius) {
        return tool.position.clone()
      }
    }
    return null
  }

  restoreMeshes(): void {
    for (const tool of this.placed.values()) {
      if (!this.meshes.has(tool.id)) {
        this.createMesh(tool)
      }
    }
  }

  private save(): void {
    try {
      const data: SerializedData = {
        placed: Array.from(this.placed.values()).map(t => ({
          id: t.id,
          type: t.type,
          category: t.category,
          x: t.position.x,
          y: t.position.y,
          z: t.position.z,
          radius: t.radius,
          biomeEssence: t.biomeEssence,
          placedAt: t.placedAt,
        })),
        essence: Array.from(this.essenceInventory.entries()),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as SerializedData

      for (const s of data.placed) {
        const tool: PlacedTool = {
          id: s.id,
          type: s.type,
          category: s.category,
          position: new THREE.Vector3(s.x, s.y, s.z),
          radius: s.radius,
          biomeEssence: s.biomeEssence,
          placedAt: s.placedAt,
        }
        this.placed.set(tool.id, tool)

        // Recover nextId to avoid collisions
        const num = parseInt(tool.id.replace('tool_', ''), 10)
        if (!isNaN(num) && num >= this.nextId) {
          this.nextId = num + 1
        }
      }

      for (const [biome, count] of data.essence) {
        this.essenceInventory.set(biome, count)
      }
    } catch { /* ignore */ }
  }

  dispose(): void {
    this.closeMenu()
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }
    this.meshes.clear()
  }
}
