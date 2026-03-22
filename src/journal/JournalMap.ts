import { BiomeType } from '../biomes/types'
import { WorldState, ResonanceSite } from '../systems/WorldState'
import { JournalState } from './JournalState'

/** Biome color palette for the traveler's map */
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

export interface MapSeed {
  x: number
  z: number
  biome: BiomeType
}

export interface MapMarker {
  x: number
  z: number
  type: 'campfire' | 'npc'
  label?: string
}

export class JournalMap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 600
    this.canvas.height = 500
    this.ctx = this.canvas.getContext('2d')!
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  render(
    seeds: ReadonlyArray<MapSeed>,
    journalState: JournalState,
    worldState: WorldState,
    campfirePositions: { x: number; z: number }[],
    npcMarkers: MapMarker[],
  ): void {
    const W = this.canvas.width
    const H = this.canvas.height
    const c = this.ctx

    c.clearRect(0, 0, W, H)

    // Determine map bounds centered on player
    const px = worldState.playerPosition.x
    const pz = worldState.playerPosition.z
    const mapRadius = 1200 // world units visible from center
    const scale = Math.min(W, H) / (mapRadius * 2)

    // Transform world coords to canvas
    const toCanvasX = (wx: number) => (wx - px) * scale + W / 2
    const toCanvasY = (wz: number) => (wz - pz) * scale + H / 2

    // Draw biome seeds as rough circles
    const discoveredBiomes = new Set<BiomeType>()
    for (let i = 0; i <= 10; i++) {
      if (journalState.isDiscovered(`biome_${i}`)) {
        discoveredBiomes.add(i as BiomeType)
      }
    }

    // Draw seeds — only those visible on screen
    const seedRadius = 80 * scale
    for (const seed of seeds) {
      const sx = toCanvasX(seed.x)
      const sy = toCanvasY(seed.z)
      if (sx < -seedRadius || sx > W + seedRadius || sy < -seedRadius || sy > H + seedRadius) continue

      const discovered = discoveredBiomes.has(seed.biome)
      c.beginPath()
      c.arc(sx, sy, seedRadius, 0, Math.PI * 2)

      if (discovered) {
        c.fillStyle = BIOME_COLORS[seed.biome] || '#444'
        c.globalAlpha = 0.35
        c.fill()
        c.globalAlpha = 1
        c.strokeStyle = BIOME_COLORS[seed.biome] || '#444'
        c.lineWidth = 1
        c.stroke()
      } else {
        c.fillStyle = '#1a1a1f'
        c.globalAlpha = 0.3
        c.fill()
        c.globalAlpha = 1
      }
    }

    // Draw activated resonance sites (bright glowing dots)
    for (const [, site] of worldState.resonanceSites) {
      if (!site.activated) continue
      const sx = toCanvasX(site.position.x)
      const sy = toCanvasY(site.position.z)
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue

      // Glow
      const pulse = 0.6 + Math.sin(Date.now() * 0.003) * 0.4
      c.beginPath()
      c.arc(sx, sy, 6, 0, Math.PI * 2)
      c.fillStyle = `rgba(255, 220, 120, ${pulse})`
      c.fill()
      c.beginPath()
      c.arc(sx, sy, 3, 0, Math.PI * 2)
      c.fillStyle = '#fff'
      c.fill()
    }

    // Draw non-activated resonance sites as dim dots
    for (const [, site] of worldState.resonanceSites) {
      if (site.activated) continue
      const discovered = discoveredBiomes.has(site.biome)
      if (!discovered) continue
      const sx = toCanvasX(site.position.x)
      const sy = toCanvasY(site.position.z)
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue

      c.beginPath()
      c.arc(sx, sy, 3, 0, Math.PI * 2)
      c.fillStyle = 'rgba(180, 160, 120, 0.5)'
      c.fill()
    }

    // Campfire positions (orange dots)
    for (const cf of campfirePositions) {
      const sx = toCanvasX(cf.x)
      const sy = toCanvasY(cf.z)
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue

      c.beginPath()
      c.arc(sx, sy, 3, 0, Math.PI * 2)
      c.fillStyle = '#ff8833'
      c.fill()
    }

    // NPC positions (cyan dots — only if met)
    for (const npc of npcMarkers) {
      const sx = toCanvasX(npc.x)
      const sy = toCanvasY(npc.z)
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue

      c.beginPath()
      c.arc(sx, sy, 3, 0, Math.PI * 2)
      c.fillStyle = '#66dddd'
      c.fill()
    }

    // Player position (white marker)
    const playerSx = W / 2
    const playerSy = H / 2
    c.beginPath()
    c.arc(playerSx, playerSy, 4, 0, Math.PI * 2)
    c.fillStyle = '#ffffff'
    c.fill()
    c.strokeStyle = '#d4a574'
    c.lineWidth = 1.5
    c.stroke()

    // Compass indicator
    c.fillStyle = '#d4a574'
    c.font = '10px "Courier New", monospace'
    c.textAlign = 'center'
    c.fillText('N', W / 2, 14)
    c.fillText('S', W / 2, H - 6)
    c.fillText('W', 8, H / 2 + 3)
    c.fillText('E', W - 8, H / 2 + 3)

    // Legend in bottom left
    c.textAlign = 'left'
    c.font = '9px "Courier New", monospace'
    const legendY = H - 55
    c.fillStyle = '#d4a574'
    c.fillText('--- traveler\'s sketch ---', 10, legendY)

    c.fillStyle = '#fff'
    c.fillRect(10, legendY + 8, 6, 6)
    c.fillStyle = '#887755'
    c.fillText('You', 20, legendY + 14)

    c.fillStyle = '#ff8833'
    c.fillRect(10, legendY + 20, 6, 6)
    c.fillStyle = '#887755'
    c.fillText('Campfire', 20, legendY + 26)

    c.fillStyle = '#66dddd'
    c.fillRect(10, legendY + 32, 6, 6)
    c.fillStyle = '#887755'
    c.fillText('Traveler', 20, legendY + 38)
  }
}
