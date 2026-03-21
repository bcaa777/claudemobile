import { JournalState } from './JournalState'
import { buildJournalEntries, JournalCategory, JournalEntry } from './JournalData'

const WIDTH = 400
const HEIGHT = 500
const TABS: { label: string; category: JournalCategory }[] = [
  { label: 'Creatures', category: 'creature' },
  { label: 'Biomes', category: 'biome' },
  { label: 'Landmarks', category: 'landmark' },
  { label: 'Weather', category: 'weather' },
  { label: 'Lore', category: 'lore' },
]

export class JournalOverlay {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: JournalState
  private entries: JournalEntry[]
  private visible = false
  private activeTab = 0
  private scrollOffset = 0

  constructor(state: JournalState) {
    this.state = state
    this.entries = buildJournalEntries()

    this.canvas = document.createElement('canvas')
    this.canvas.width = WIDTH
    this.canvas.height = HEIGHT
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'none',
      borderRadius: '4px',
      imageRendering: 'pixelated',
      zIndex: '110',
    })
    document.getElementById('app')?.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') {
        this.visible = !this.visible
        this.canvas.style.display = this.visible ? 'block' : 'none'
        if (this.visible) this.render()
      }
      if (!this.visible) return
      if (e.code === 'ArrowRight' || e.code === 'Tab') {
        e.preventDefault()
        this.activeTab = (this.activeTab + 1) % TABS.length
        this.scrollOffset = 0
        this.render()
      }
      if (e.code === 'ArrowLeft') {
        this.activeTab = (this.activeTab - 1 + TABS.length) % TABS.length
        this.scrollOffset = 0
        this.render()
      }
      if (e.code === 'ArrowDown') {
        this.scrollOffset += 3
        this.render()
      }
      if (e.code === 'ArrowUp') {
        this.scrollOffset = Math.max(0, this.scrollOffset - 3)
        this.render()
      }
    })
  }

  isOpen(): boolean { return this.visible }

  private render() {
    const c = this.ctx
    c.clearRect(0, 0, WIDTH, HEIGHT)

    // Background
    c.fillStyle = 'rgba(5, 5, 10, 0.95)'
    c.fillRect(0, 0, WIDTH, HEIGHT)
    c.strokeStyle = '#665533'
    c.lineWidth = 2
    c.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2)

    // Title
    c.fillStyle = '#e8c060'
    c.font = '13px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('[ J ] DISCOVERY JOURNAL', WIDTH / 2, 22)

    // Tabs
    const tabW = WIDTH / TABS.length
    for (let i = 0; i < TABS.length; i++) {
      const active = i === this.activeTab
      c.fillStyle = active ? 'rgba(100,80,40,0.4)' : 'transparent'
      c.fillRect(i * tabW, 30, tabW, 22)
      c.fillStyle = active ? '#e8c060' : '#888'
      c.font = '10px "Courier New", monospace'
      c.textAlign = 'center'
      c.fillText(TABS[i].label, i * tabW + tabW / 2, 45)
    }

    // Separator
    c.strokeStyle = '#665533'
    c.lineWidth = 1
    c.beginPath(); c.moveTo(0, 54); c.lineTo(WIDTH, 54); c.stroke()

    // Filter entries
    const cat = TABS[this.activeTab].category
    const filtered = this.entries.filter(e => e.category === cat)
    const discovered = this.state.getDiscoveredKeys()

    // Count
    const found = filtered.filter(e => discovered.has(e.key)).length
    c.fillStyle = '#aaa'
    c.font = '10px "Courier New", monospace'
    c.textAlign = 'left'
    c.fillText(`${found} / ${filtered.length} discovered`, 10, 70)

    // Entries list
    let y = 85
    const maxY = HEIGHT - 20
    const startIdx = this.scrollOffset
    for (let i = startIdx; i < filtered.length && y < maxY; i++) {
      const entry = filtered[i]
      const isFound = discovered.has(entry.key)

      if (isFound) {
        c.fillStyle = '#ccc'
        c.font = '10px "Courier New", monospace'
        c.fillText(`● ${entry.name}`, 14, y)
        y += 14

        // Show description (wrap if needed)
        c.fillStyle = '#888'
        c.font = '9px "Courier New", monospace'
        const desc = entry.description
        if (desc.length > 50) {
          c.fillText(desc.substring(0, 50), 24, y)
          y += 12
          c.fillText(desc.substring(50, 100), 24, y)
        } else {
          c.fillText(desc, 24, y)
        }
        y += 16
      } else {
        c.fillStyle = '#555'
        c.font = '10px "Courier New", monospace'
        c.fillText('○ ???', 14, y)
        y += 30
      }
    }

    // Scroll hint
    if (filtered.length > 12) {
      c.fillStyle = '#555'
      c.font = '9px "Courier New", monospace'
      c.textAlign = 'center'
      c.fillText('↑↓ Scroll  ←→ Tabs', WIDTH / 2, HEIGHT - 6)
    }
  }
}
