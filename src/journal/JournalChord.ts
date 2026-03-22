import { BiomeType } from '../biomes/types'
import { WorldState } from '../systems/WorldState'

const BIOME_COLORS: Record<number, string> = {
  [BiomeType.Forest]:    '#3a7d44',
  [BiomeType.Desert]:    '#c2a04e',
  [BiomeType.Swamp]:     '#5a6e3a',
  [BiomeType.Snow]:      '#b8d0e8',
  [BiomeType.Volcanic]:  '#8b3a3a',
  [BiomeType.Crystal]:   '#9a6ccd',
  [BiomeType.Jungle]:    '#2d8040',
  [BiomeType.Mesa]:      '#b06040',
  [BiomeType.CoralReef]: '#3aa0a0',
  [BiomeType.Heaven]:    '#e0d8c0',
  [BiomeType.Hell]:      '#6b1a1a',
}

const BIOME_NAMES: Record<number, string> = {
  [BiomeType.Forest]:    'Forest',
  [BiomeType.Desert]:    'Desert',
  [BiomeType.Swamp]:     'Swamp',
  [BiomeType.Snow]:      'Snow',
  [BiomeType.Volcanic]:  'Volcanic',
  [BiomeType.Crystal]:   'Crystal',
  [BiomeType.Jungle]:    'Jungle',
  [BiomeType.Mesa]:      'Mesa',
  [BiomeType.CoralReef]: 'Coral Reef',
  [BiomeType.Heaven]:    'Heaven',
  [BiomeType.Hell]:      'Hell',
}

// Pentatonic-ish frequencies for each biome (A2 to C5 range)
const BIOME_FREQUENCIES: Record<number, number> = {
  [BiomeType.Forest]:    220.0,   // A3
  [BiomeType.Desert]:    246.94,  // B3
  [BiomeType.Swamp]:     261.63,  // C4
  [BiomeType.Snow]:      293.66,  // D4
  [BiomeType.Volcanic]:  329.63,  // E4
  [BiomeType.Crystal]:   349.23,  // F4
  [BiomeType.Jungle]:    392.00,  // G4
  [BiomeType.Mesa]:      440.00,  // A4
  [BiomeType.CoralReef]: 493.88,  // B4
  [BiomeType.Heaven]:    523.25,  // C5
  [BiomeType.Hell]:      164.81,  // E3 (deep dissonant)
}

export class JournalChord {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private chordPlayed = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 600
    this.canvas.height = 500
    this.ctx = this.canvas.getContext('2d')!
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /** Reset so chord plays again on next tab open */
  resetChordPlayed(): void {
    this.chordPlayed = false
  }

  render(worldState: WorldState, audioCtx: AudioContext | null, masterGain: GainNode | null): void {
    const W = this.canvas.width
    const H = this.canvas.height
    const c = this.ctx

    c.clearRect(0, 0, W, H)

    const activated = worldState.activatedSites
    const hasAnyActivation = activated.size > 0

    if (!hasAnyActivation) {
      // Tab locked
      c.fillStyle = '#665544'
      c.font = '12px "Courier New", monospace'
      c.textAlign = 'center'
      c.fillText('The Chord remains silent.', W / 2, H / 2 - 20)
      c.fillStyle = '#554433'
      c.font = '10px "Courier New", monospace'
      c.fillText('Complete a ritual to begin hearing the harmony.', W / 2, H / 2 + 10)
      return
    }

    // Title
    c.fillStyle = '#d4a574'
    c.font = '13px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('THE CHORD', W / 2, 30)

    // Draw 11 circles in an arc
    const arcCenterX = W / 2
    const arcCenterY = H / 2 + 40
    const arcRadius = 180
    const startAngle = Math.PI + 0.3   // ~210 degrees
    const endAngle = 2 * Math.PI - 0.3 // ~330 degrees
    const circleRadius = 28

    for (let i = 0; i <= 10; i++) {
      const biome = i as BiomeType
      const isActivated = activated.has(biome)
      const t = i / 10
      const angle = startAngle + t * (endAngle - startAngle)
      const cx = arcCenterX + Math.cos(angle) * arcRadius
      const cy = arcCenterY + Math.sin(angle) * arcRadius

      if (isActivated) {
        // Gentle pulse
        const pulse = 0.7 + Math.sin(Date.now() * 0.002 + i * 0.5) * 0.3
        const color = BIOME_COLORS[biome] || '#666'

        // Outer glow
        c.beginPath()
        c.arc(cx, cy, circleRadius + 4, 0, Math.PI * 2)
        c.fillStyle = color
        c.globalAlpha = pulse * 0.2
        c.fill()
        c.globalAlpha = 1

        // Filled circle
        c.beginPath()
        c.arc(cx, cy, circleRadius, 0, Math.PI * 2)
        c.fillStyle = color
        c.globalAlpha = 0.7
        c.fill()
        c.globalAlpha = 1
        c.strokeStyle = color
        c.lineWidth = 2
        c.stroke()

        // Label
        c.fillStyle = '#e8d0a0'
        c.font = '9px "Courier New", monospace'
        c.textAlign = 'center'
        c.fillText(BIOME_NAMES[biome] || '???', cx, cy + 3)
      } else {
        // Empty outline
        c.beginPath()
        c.arc(cx, cy, circleRadius, 0, Math.PI * 2)
        c.strokeStyle = '#443322'
        c.lineWidth = 1.5
        c.stroke()

        // ??? label
        c.fillStyle = '#554433'
        c.font = '9px "Courier New", monospace'
        c.textAlign = 'center'
        c.fillText('???', cx, cy + 3)
      }
    }

    // Global harmony percentage
    const harmonyPct = Math.round(worldState.globalHarmony * 100)
    c.fillStyle = '#d4a574'
    c.font = '12px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText(`Global Harmony: ${harmonyPct}%`, W / 2, H - 50)

    // Activated count
    c.fillStyle = '#887755'
    c.font = '10px "Courier New", monospace'
    c.fillText(`${activated.size} / 11 resonance sites activated`, W / 2, H - 30)

    // Chord complete message
    if (worldState.chordComplete) {
      c.fillStyle = '#ffe090'
      c.font = 'italic 11px "Courier New", monospace'
      c.fillText('The world remembers its song.', W / 2, H - 10)
    }

    // Play chord sound once when tab opens
    if (!this.chordPlayed && audioCtx && masterGain) {
      this.playChord(audioCtx, masterGain, activated)
      this.chordPlayed = true
    }
  }

  private playChord(ctx: AudioContext, masterGain: GainNode, activated: Set<BiomeType>): void {
    if (ctx.state === 'suspended') return
    const now = ctx.currentTime

    for (const biome of activated) {
      const freq = BIOME_FREQUENCIES[biome]
      if (!freq) continue

      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.04, now + 0.3)
      gain.gain.linearRampToValueAtTime(0, now + 2.5)

      osc.connect(gain)
      gain.connect(masterGain)

      osc.start(now)
      osc.stop(now + 2.8)
    }
  }
}
