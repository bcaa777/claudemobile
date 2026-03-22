import { JournalState } from './JournalState'
import { JournalSystem } from './JournalSystem'
import { JournalMap, MapSeed, MapMarker } from './JournalMap'
import { JournalObservations } from './JournalObservations'
import { JournalChord } from './JournalChord'
import { WorldState } from '../systems/WorldState'
import { NarrativeProgression } from '../lore/NarrativeProgression'

type TabId = 'map' | 'observations' | 'chord'

const TABS: { id: TabId; label: string; key: string }[] = [
  { id: 'map', label: 'Map', key: '1' },
  { id: 'observations', label: 'Observations', key: '2' },
  { id: 'chord', label: 'The Chord', key: '3' },
]

const BG_COLOR = 'rgba(10, 10, 15, 0.92)'
const TEXT_COLOR = '#d4a574'
const TAB_HEIGHT = 36

export class JournalOverlay {
  private container: HTMLDivElement
  private tabBar: HTMLDivElement
  private contentArea: HTMLDivElement
  private visible = false
  private activeTab: TabId = 'map'

  // Tab components
  private mapTab: JournalMap
  private obsTab: JournalObservations
  private chordTab: JournalChord

  // Data references (set via setData)
  private journalState: JournalState
  private journalSystem: JournalSystem | null = null
  private worldState: WorldState | null = null
  private narrative: NarrativeProgression | null = null
  private seeds: ReadonlyArray<MapSeed> = []
  private campfirePositions: { x: number; z: number }[] = []
  private npcMarkers: MapMarker[] = []
  private audioCtx: AudioContext | null = null
  private masterGain: GainNode | null = null

  constructor(state: JournalState) {
    this.journalState = state

    // Create tab components
    this.mapTab = new JournalMap()
    this.obsTab = new JournalObservations()
    this.chordTab = new JournalChord()

    // Container — full-screen overlay
    this.container = document.createElement('div')
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: BG_COLOR,
      display: 'none',
      zIndex: '200',
      fontFamily: '"Courier New", monospace',
      color: TEXT_COLOR,
      overflow: 'hidden',
    })

    // Tab bar
    this.tabBar = document.createElement('div')
    Object.assign(this.tabBar.style, {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: `${TAB_HEIGHT}px`,
      borderBottom: '1px solid #443322',
      userSelect: 'none',
    })

    for (const tab of TABS) {
      const btn = document.createElement('div')
      btn.dataset.tabId = tab.id
      btn.textContent = `[${tab.key}] ${tab.label}`
      Object.assign(btn.style, {
        padding: '8px 24px',
        cursor: 'pointer',
        fontSize: '12px',
        letterSpacing: '0.1em',
        transition: 'color 0.2s, border-bottom-color 0.2s',
        borderBottom: '2px solid transparent',
      })
      btn.addEventListener('click', () => {
        this.switchTab(tab.id)
        this.render()
      })
      this.tabBar.appendChild(btn)
    }

    this.container.appendChild(this.tabBar)

    // Content area — centered canvas container
    this.contentArea = document.createElement('div')
    Object.assign(this.contentArea.style, {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: `calc(100vh - ${TAB_HEIGHT}px)`,
      overflow: 'hidden',
    })
    this.container.appendChild(this.contentArea)

    document.getElementById('app')?.appendChild(this.container)

    // Key handler
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') {
        this.visible = !this.visible
        this.container.style.display = this.visible ? 'flex' : 'none'
        this.container.style.flexDirection = 'column'
        if (this.visible) {
          this.render()
        }
      }
      if (!this.visible) return

      // Tab switching via 1/2/3
      if (e.code === 'Digit1') { this.switchTab('map'); this.render() }
      if (e.code === 'Digit2') { this.switchTab('observations'); this.render() }
      if (e.code === 'Digit3') { this.switchTab('chord'); this.render() }

      // Scroll for observations
      if (e.code === 'ArrowDown' && this.activeTab === 'observations') {
        this.obsTab.scrollDown()
        this.render()
      }
      if (e.code === 'ArrowUp' && this.activeTab === 'observations') {
        this.obsTab.scrollUp()
        this.render()
      }

      // Arrow keys for tab switching
      if (e.code === 'ArrowRight' || e.code === 'Tab') {
        e.preventDefault()
        const idx = TABS.findIndex(t => t.id === this.activeTab)
        this.switchTab(TABS[(idx + 1) % TABS.length].id)
        this.render()
      }
      if (e.code === 'ArrowLeft') {
        const idx = TABS.findIndex(t => t.id === this.activeTab)
        this.switchTab(TABS[(idx - 1 + TABS.length) % TABS.length].id)
        this.render()
      }
    })
  }

  isOpen(): boolean {
    return this.visible
  }

  /** Provide data references from Engine. Call once after construction. */
  setData(opts: {
    journalSystem: JournalSystem
    worldState: WorldState
    narrative: NarrativeProgression
    seeds: ReadonlyArray<MapSeed>
    audioCtx: AudioContext | null
    masterGain: GainNode | null
  }): void {
    this.journalSystem = opts.journalSystem
    this.worldState = opts.worldState
    this.narrative = opts.narrative
    this.seeds = opts.seeds
    this.audioCtx = opts.audioCtx
    this.masterGain = opts.masterGain
  }

  /** Update live data each frame (campfire & NPC positions change). */
  updateLiveData(
    campfirePositions: { x: number; z: number }[],
    npcMarkers: MapMarker[],
  ): void {
    this.campfirePositions = campfirePositions
    this.npcMarkers = npcMarkers
  }

  private switchTab(id: TabId): void {
    this.activeTab = id
    // Reset chord sound flag when switching to chord tab
    if (id === 'chord') {
      this.chordTab.resetChordPlayed()
    }
    this.updateTabStyles()
  }

  private updateTabStyles(): void {
    const buttons = this.tabBar.children
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i] as HTMLElement
      const isActive = btn.dataset.tabId === this.activeTab
      btn.style.color = isActive ? '#e8d0a0' : '#665544'
      btn.style.borderBottomColor = isActive ? '#d4a574' : 'transparent'
    }
  }

  private render(): void {
    this.updateTabStyles()

    // Clear content area
    while (this.contentArea.firstChild) {
      this.contentArea.removeChild(this.contentArea.firstChild)
    }

    switch (this.activeTab) {
      case 'map':
        this.renderMap()
        break
      case 'observations':
        this.renderObservations()
        break
      case 'chord':
        this.renderChord()
        break
    }
  }

  private renderMap(): void {
    if (!this.worldState) return
    this.mapTab.render(
      this.seeds,
      this.journalState,
      this.worldState,
      this.campfirePositions,
      this.npcMarkers,
    )
    const canvas = this.mapTab.getCanvas()
    this.styleTabCanvas(canvas)
    this.contentArea.appendChild(canvas)
  }

  private renderObservations(): void {
    if (!this.journalSystem || !this.narrative || !this.worldState) return
    this.obsTab.render(
      this.journalState,
      this.journalSystem,
      this.narrative,
      this.worldState,
    )
    const canvas = this.obsTab.getCanvas()
    this.styleTabCanvas(canvas)
    this.contentArea.appendChild(canvas)
  }

  private renderChord(): void {
    if (!this.worldState) return
    this.chordTab.render(this.worldState, this.audioCtx, this.masterGain)
    const canvas = this.chordTab.getCanvas()
    this.styleTabCanvas(canvas)
    this.contentArea.appendChild(canvas)
  }

  private styleTabCanvas(canvas: HTMLCanvasElement): void {
    Object.assign(canvas.style, {
      maxWidth: '90vw',
      maxHeight: `calc(100vh - ${TAB_HEIGHT + 20}px)`,
      objectFit: 'contain',
      imageRendering: 'pixelated',
    })
  }
}
