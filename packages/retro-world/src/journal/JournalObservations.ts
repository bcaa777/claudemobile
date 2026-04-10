import { BiomeType } from '../biomes/types'
import { JournalState } from './JournalState'
import { JournalSystem } from './JournalSystem'
import { NarrativeProgression } from '../lore/NarrativeProgression'
import { WorldState } from '../systems/WorldState'
import { LORE_CONTENT } from '../lore/LoreContent'

const BIOME_NAMES: Record<number, string> = {
  [BiomeType.Forest]:    'Verdant Forest',
  [BiomeType.Desert]:    'Scorching Desert',
  [BiomeType.Swamp]:     'Murky Swamp',
  [BiomeType.Snow]:      'Frozen Highlands',
  [BiomeType.Volcanic]:  'Volcanic Wastes',
  [BiomeType.Crystal]:   'Crystal Fields',
  [BiomeType.Jungle]:    'Dense Jungle',
  [BiomeType.Mesa]:      'Red Mesa',
  [BiomeType.CoralReef]: 'Coral Reef',
  [BiomeType.Heaven]:    'Celestial Realm',
  [BiomeType.Hell]:      'The Inferno',
}

const SIDEBAR_WIDTH = 160
const LINE_HEIGHT = 16
const TEXT_COLOR = '#d4a574'
const DIM_COLOR = '#665544'
const BRIGHT_COLOR = '#e8d0a0'
const GLOW_COLOR = '#ffe090'

export class JournalObservations {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private selectedBiome: BiomeType = BiomeType.Forest
  private scrollOffset = 0
  private hoveredBiomeIndex = -1

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 600
    this.canvas.height = 500
    this.ctx = this.canvas.getContext('2d')!

    // Handle click on sidebar
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = this.canvas.width / rect.width
      const x = (e.clientX - rect.left) * scaleX
      const scaleY = this.canvas.height / rect.height
      const y = (e.clientY - rect.top) * scaleY

      if (x < SIDEBAR_WIDTH) {
        const idx = Math.floor(y / 38)
        if (idx >= 0 && idx <= 10) {
          this.selectedBiome = idx as BiomeType
          this.scrollOffset = 0
        }
      }
    })
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  scrollDown(): void {
    this.scrollOffset += 3
  }

  scrollUp(): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - 3)
  }

  render(
    journalState: JournalState,
    journalSystem: JournalSystem,
    narrative: NarrativeProgression,
    worldState: WorldState,
  ): void {
    const W = this.canvas.width
    const H = this.canvas.height
    const c = this.ctx

    c.clearRect(0, 0, W, H)

    // Discovered biomes
    const discoveredBiomes = new Set<BiomeType>()
    for (let i = 0; i <= 10; i++) {
      if (journalState.isDiscovered(`biome_${i}`)) {
        discoveredBiomes.add(i as BiomeType)
      }
    }

    // --- Sidebar ---
    c.fillStyle = 'rgba(20, 18, 12, 0.6)'
    c.fillRect(0, 0, SIDEBAR_WIDTH, H)

    for (let i = 0; i <= 10; i++) {
      const biome = i as BiomeType
      const discovered = discoveredBiomes.has(biome)
      const isSelected = biome === this.selectedBiome
      const y = i * 38

      // Selection highlight
      if (isSelected) {
        c.fillStyle = 'rgba(100, 80, 40, 0.3)'
        c.fillRect(0, y, SIDEBAR_WIDTH, 38)
        c.fillStyle = TEXT_COLOR
        c.fillRect(SIDEBAR_WIDTH - 2, y + 4, 2, 30)
      }

      // Ritual completed glow
      if (worldState.activatedSites.has(biome)) {
        const pulse = 0.3 + Math.sin(Date.now() * 0.002 + i) * 0.15
        c.fillStyle = `rgba(255, 224, 144, ${pulse})`
        c.fillRect(2, y + 2, 4, 34)
      }

      c.font = '10px "Courier New", monospace'
      c.textAlign = 'left'

      if (discovered) {
        c.fillStyle = isSelected ? BRIGHT_COLOR : TEXT_COLOR
        c.fillText(BIOME_NAMES[biome] || '???', 12, y + 22)
      } else {
        c.fillStyle = '#444'
        c.fillText('???', 12, y + 22)
      }
    }

    // --- Separator line ---
    c.strokeStyle = '#665533'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(SIDEBAR_WIDTH, 0)
    c.lineTo(SIDEBAR_WIDTH, H)
    c.stroke()

    // --- Main content area ---
    const contentX = SIDEBAR_WIDTH + 16
    const contentW = W - SIDEBAR_WIDTH - 32
    let y = 20

    const biome = this.selectedBiome
    const discovered = discoveredBiomes.has(biome)

    if (!discovered) {
      c.fillStyle = DIM_COLOR
      c.font = '11px "Courier New", monospace'
      c.textAlign = 'left'
      c.fillText('This region has not yet been explored.', contentX, y + 20)
      return
    }

    // Biome name header
    c.fillStyle = BRIGHT_COLOR
    c.font = '14px "Courier New", monospace'
    c.textAlign = 'left'
    c.fillText(BIOME_NAMES[biome] || '???', contentX, y)
    y += 8

    // Separator
    c.strokeStyle = '#554433'
    c.beginPath()
    c.moveTo(contentX, y)
    c.lineTo(contentX + contentW, y)
    c.stroke()
    y += 16

    // ---- Lore fragments ----
    const fragments = LORE_CONTENT.get(biome) || []
    if (fragments.length > 0) {
      c.fillStyle = TEXT_COLOR
      c.font = '10px "Courier New", monospace'
      c.fillText('RESONANCE FRAGMENTS', contentX, y)
      y += 14

      for (let i = 0; i < fragments.length; i++) {
        if (y > H - 40) break
        const frag = fragments[i]
        const isCollected = journalState.isDiscovered(`lore_${frag.id}`)

        c.font = '9px "Courier New", monospace'
        if (isCollected) {
          c.fillStyle = '#b0a080'
          // Wrap text
          const lines = this.wrapText(c, `${i + 1}. ${frag.text}`, contentW)
          for (const line of lines) {
            if (y > H - 40) break
            c.fillText(line, contentX + 4, y)
            y += 12
          }
        } else {
          c.fillStyle = '#555'
          c.fillText(`${i + 1}. ???`, contentX + 4, y)
          y += 12
        }
        y += 4
      }
      y += 8
    }

    // ---- Narrative logs ----
    const logs = journalSystem.narrativeLogs.filter(l => l.biome === biome)
    if (logs.length > 0) {
      c.fillStyle = TEXT_COLOR
      c.font = '10px "Courier New", monospace'
      c.fillText('OBSERVATIONS', contentX, y)
      y += 14

      for (const log of logs) {
        if (y > H - 40) break
        c.fillStyle = '#a09070'
        c.font = '9px "Courier New", monospace'
        const lines = this.wrapText(c, `- ${log.text}`, contentW)
        for (const line of lines) {
          if (y > H - 40) break
          c.fillText(line, contentX + 4, y)
          y += 12
        }
        y += 4
      }
      y += 8
    }

    // ---- Weather events ----
    const weatherReveals = worldState.weatherReveals.get(biome)
    if (weatherReveals && weatherReveals.size > 0) {
      c.fillStyle = TEXT_COLOR
      c.font = '10px "Courier New", monospace'
      c.fillText('WEATHER EVENTS', contentX, y)
      y += 14

      for (const key of weatherReveals) {
        if (y > H - 40) break
        c.fillStyle = '#8090a0'
        c.font = '9px "Courier New", monospace'
        c.fillText(`- ${key.replace(/_/g, ' ')}`, contentX + 4, y)
        y += 14
      }
      y += 8
    }

    // ---- NPC quotes ----
    // We check if NPC was spoken to in this biome via narrative observations
    const obs = narrative.getObservation(biome)
    if (obs.npcSpokenTo) {
      c.fillStyle = TEXT_COLOR
      c.font = '10px "Courier New", monospace'
      c.fillText('NPC ENCOUNTERED', contentX, y)
      y += 14

      c.fillStyle = '#80aab0'
      c.font = '9px "Courier New", monospace'
      c.fillText('- A traveler shared wisdom here.', contentX + 4, y)
      y += 20
    }

    // ---- Hypothesis ----
    const hypothesis = journalSystem.hypotheses.get(biome)
    if (hypothesis) {
      c.fillStyle = GLOW_COLOR
      c.font = 'italic 10px "Courier New", monospace'
      c.fillText('HYPOTHESIS', contentX, y)
      y += 14

      c.fillStyle = '#c8b080'
      c.font = 'italic 9px "Courier New", monospace'
      const lines = this.wrapText(c, hypothesis, contentW)
      for (const line of lines) {
        if (y > H - 10) break
        c.fillText(line, contentX + 4, y)
        y += 12
      }
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }
}
