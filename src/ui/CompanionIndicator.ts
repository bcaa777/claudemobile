import type { CompanionMood } from '../player/CompanionSystem'
import type { SpeciesId } from '../creatures/Species'

const MOOD_COLORS: Record<CompanionMood, string> = {
  normal: 'rgba(80,200,80,0.8)',
  alert: 'rgba(220,200,60,0.8)',
  resonating: 'rgba(80,140,255,0.8)',
  distressed: 'rgba(220,60,60,0.8)',
}

const SPECIES_COLORS: Partial<Record<SpeciesId, string>> = {
  deer: '#c8a060',
  rabbit: '#c8a878',
  bird: '#7090b0',
  parrot: '#60b860',
  fox: '#d89040',
  goat: '#a0a0a0',
  bat: '#605070',
  crab: '#c06040',
}

const SPECIES_INITIALS: Partial<Record<SpeciesId, string>> = {
  deer: 'D',
  rabbit: 'R',
  bird: 'B',
  parrot: 'P',
  fox: 'F',
  goat: 'G',
  bat: 'T',
  crab: 'C',
}

export interface CompanionData {
  bonded: boolean
  species: SpeciesId | null
  mood: CompanionMood
  name: string
}

/**
 * Bottom-left indicator showing companion species, initial letter, and mood ring.
 */
export class CompanionIndicator {
  private container: HTMLDivElement
  private circle: HTMLDivElement
  private letter: HTMLDivElement
  private moodRing: HTMLDivElement

  constructor() {
    this.container = document.createElement('div')
    Object.assign(this.container.style, {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      display: 'none',
      alignItems: 'center',
      gap: '0',
      pointerEvents: 'none',
      zIndex: '20',
    })

    // Mood ring (outer circle)
    this.moodRing = document.createElement('div')
    Object.assign(this.moodRing.style, {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      border: '2px solid rgba(80,200,80,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'border-color 0.5s',
    })

    // Species circle (inner)
    this.circle = document.createElement('div')
    Object.assign(this.circle.style, {
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: '#c8a060',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })

    // Species initial letter
    this.letter = document.createElement('div')
    Object.assign(this.letter.style, {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      color: 'rgba(0,0,0,0.7)',
      lineHeight: '1',
    })

    this.circle.appendChild(this.letter)
    this.moodRing.appendChild(this.circle)
    this.container.appendChild(this.moodRing)
  }

  getElement(): HTMLDivElement {
    return this.container
  }

  update(data: CompanionData): void {
    if (!data.bonded || !data.species) {
      this.container.style.display = 'none'
      return
    }

    this.container.style.display = 'flex'

    // Species color and letter
    const speciesColor = SPECIES_COLORS[data.species] || '#888'
    this.circle.style.background = speciesColor

    const initial = SPECIES_INITIALS[data.species] || data.species.charAt(0).toUpperCase()
    this.letter.textContent = initial

    // Mood ring color
    const moodColor = MOOD_COLORS[data.mood] || MOOD_COLORS.normal
    this.moodRing.style.borderColor = moodColor
  }
}
