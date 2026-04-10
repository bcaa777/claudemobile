import { BiomeType } from '@engine/core'
import type { MetaState } from '../state/MetaState'
import { UNDERGROUND_BIOMES, type UndergroundConfig } from '../expedition/UndergroundBiomes'

interface BiomeInfo {
  type: BiomeType
  name: string
  difficulty: number
  unlockCondition: BiomeType[]
}

// Branching unlock tree:
//   Forest (root)
//   ├── Desert → Snow → Crystal → Heaven
//   └── Swamp  → Volcanic → Jungle → Mesa → CoralReef → Hell
//
// Difficulty: Forest=1, Desert/Swamp=2, Snow/Volcanic=3,
//             Crystal/Jungle=4, Mesa/CoralReef=5, Heaven/Hell=6
const BIOMES: BiomeInfo[] = [
  { type: BiomeType.Forest,    name: 'Forest',     difficulty: 1, unlockCondition: [] },
  // Desert branch
  { type: BiomeType.Desert,    name: 'Desert',     difficulty: 2, unlockCondition: [BiomeType.Forest] },
  { type: BiomeType.Snow,      name: 'Snow',       difficulty: 3, unlockCondition: [BiomeType.Desert] },
  { type: BiomeType.Crystal,   name: 'Crystal',    difficulty: 4, unlockCondition: [BiomeType.Snow] },
  { type: BiomeType.Heaven,    name: 'Heaven',     difficulty: 6, unlockCondition: [BiomeType.Crystal] },
  // Swamp branch
  { type: BiomeType.Swamp,     name: 'Swamp',      difficulty: 2, unlockCondition: [BiomeType.Forest] },
  { type: BiomeType.Volcanic,  name: 'Volcanic',   difficulty: 3, unlockCondition: [BiomeType.Swamp] },
  { type: BiomeType.Jungle,    name: 'Jungle',     difficulty: 4, unlockCondition: [BiomeType.Volcanic] },
  { type: BiomeType.Mesa,      name: 'Mesa',       difficulty: 5, unlockCondition: [BiomeType.Jungle] },
  { type: BiomeType.CoralReef, name: 'Coral Reef', difficulty: 5, unlockCondition: [BiomeType.Mesa] },
  { type: BiomeType.Hell,      name: 'Hell',       difficulty: 6, unlockCondition: [BiomeType.CoralReef] },
]

/** Biome-type → hex color used in the map card accent. */
const BIOME_ACCENT: Record<BiomeType, string> = {
  [BiomeType.Forest]:    '#44bb44',
  [BiomeType.Desert]:    '#d4a843',
  [BiomeType.Swamp]:     '#5a8a2a',
  [BiomeType.Snow]:      '#aaccff',
  [BiomeType.Volcanic]:  '#cc3300',
  [BiomeType.Crystal]:   '#44ddee',
  [BiomeType.Jungle]:    '#228822',
  [BiomeType.Mesa]:      '#cc7733',
  [BiomeType.CoralReef]: '#ff88aa',
  [BiomeType.Heaven]:    '#f0d060',
  [BiomeType.Hell]:      '#880000',
}

export class WorldMap {
  private overlay: HTMLElement | null = null

  show(
    metaState: MetaState,
    onSelect: (biome: BiomeType) => void,
    onClose: () => void,
    onSelectUnderground?: (id: number) => void,
  ): void {
    this.hide()

    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0,0,0,0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      overflow-y: auto;
    `

    const panel = document.createElement('div')
    panel.style.cssText = `
      background: #0d0d0d;
      border: 2px solid #446644;
      padding: 28px 32px;
      width: 700px;
      max-width: 96vw;
    `

    const title = document.createElement('h2')
    title.textContent = 'SELECT EXPEDITION'
    title.style.cssText = `
      color: #aaffaa;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 8px 0;
      font-size: 20px;
      text-shadow: 0 0 10px #44ff44;
    `
    panel.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.style.cssText = `color: #558855; font-size: 11px; text-align: center; letter-spacing: 2px; margin-bottom: 24px;`
    subtitle.textContent = 'DEFEAT EACH BIOME BOSS TO UNLOCK NEW PATHS'
    panel.appendChild(subtitle)

    // Two branch columns inside a flex row
    const branchRow = document.createElement('div')
    branchRow.style.cssText = `display: flex; gap: 24px; justify-content: center;`

    const desertBranch = BIOMES.filter(b =>
      [BiomeType.Desert, BiomeType.Snow, BiomeType.Crystal, BiomeType.Heaven].includes(b.type),
    )
    const swampBranch = BIOMES.filter(b =>
      [BiomeType.Swamp, BiomeType.Volcanic, BiomeType.Jungle, BiomeType.Mesa, BiomeType.CoralReef, BiomeType.Hell].includes(b.type),
    )

    const forestBiome = BIOMES.find(b => b.type === BiomeType.Forest)!

    // Forest card (full width)
    panel.appendChild(this._buildCard(forestBiome, metaState, onSelect))

    const arrow = document.createElement('div')
    arrow.style.cssText = `text-align: center; color: #446644; font-size: 18px; margin: 6px 0;`
    arrow.textContent = '▼'
    panel.appendChild(arrow)

    const branchLabels = document.createElement('div')
    branchLabels.style.cssText = `display: flex; gap: 24px; justify-content: center; margin-bottom: 4px;`
    const lLeft = document.createElement('div')
    lLeft.style.cssText = `flex: 1; text-align: center; color: #776644; font-size: 10px; letter-spacing: 2px;`
    lLeft.textContent = '— DESERT PATH —'
    const lRight = document.createElement('div')
    lRight.style.cssText = `flex: 1; text-align: center; color: #557755; font-size: 10px; letter-spacing: 2px;`
    lRight.textContent = '— SWAMP PATH —'
    branchLabels.appendChild(lLeft)
    branchLabels.appendChild(lRight)
    panel.appendChild(branchLabels)

    const leftCol = document.createElement('div')
    leftCol.style.cssText = `flex: 1; display: flex; flex-direction: column; gap: 8px;`
    for (const biome of desertBranch) {
      leftCol.appendChild(this._buildCard(biome, metaState, onSelect))
    }

    const rightCol = document.createElement('div')
    rightCol.style.cssText = `flex: 1; display: flex; flex-direction: column; gap: 8px;`
    for (const biome of swampBranch) {
      rightCol.appendChild(this._buildCard(biome, metaState, onSelect))
    }

    branchRow.appendChild(leftCol)
    branchRow.appendChild(rightCol)
    panel.appendChild(branchRow)

    // ── Underground section (unlocks after 8 surface biomes cleansed) ──────────
    const UNDERGROUND_UNLOCK_THRESHOLD = 8
    const surfaceCleansed = metaState.cleansedBiomes.length

    if (surfaceCleansed >= UNDERGROUND_UNLOCK_THRESHOLD) {
      const ugSeparator = document.createElement('div')
      ugSeparator.style.cssText = `text-align: center; color: #555588; font-size: 10px; letter-spacing: 3px; margin: 16px 0 4px;`
      ugSeparator.textContent = '▼  UNDERGROUND  ▼'
      panel.appendChild(ugSeparator)

      const ugSubtitle = document.createElement('div')
      ugSubtitle.style.cssText = `color: #443366; font-size: 10px; text-align: center; letter-spacing: 2px; margin-bottom: 12px;`
      ugSubtitle.textContent = 'DESCEND INTO THE DEPTHS — CLEANSE THE WORLD BELOW'
      panel.appendChild(ugSubtitle)

      const ugRow = document.createElement('div')
      ugRow.style.cssText = `display: flex; gap: 8px; justify-content: center; margin-bottom: 8px;`

      for (const ugBiome of UNDERGROUND_BIOMES) {
        const cleansed = (metaState.cleansedUnderground ?? []).includes(ugBiome.id)
        const card = this._buildUndergroundCard(ugBiome, cleansed, (id) => {
          if (onSelectUnderground) {
            this.hide()
            onSelectUnderground(id)
          }
        })
        ugRow.appendChild(card)
      }

      panel.appendChild(ugRow)

      if (metaState.worldRestored) {
        const restoredBanner = document.createElement('div')
        restoredBanner.style.cssText = `
          text-align: center; color: #ffd700; font-size: 13px; letter-spacing: 4px;
          text-shadow: 0 0 12px #ffd700; margin: 8px 0 0;
          border: 1px solid #ffd700; padding: 8px;
        `
        restoredBanner.textContent = '✦ WORLD RESTORED — PRESTIGE AVAILABLE ✦'
        panel.appendChild(restoredBanner)
      }
    }

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ CLOSE ]'
    closeBtn.style.cssText = `
      display: block;
      margin: 24px auto 0;
      background: transparent;
      border: 1px solid #446644;
      color: #aaffaa;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 8px 24px;
      cursor: pointer;
      letter-spacing: 2px;
    `
    closeBtn.addEventListener('click', () => {
      this.hide()
      onClose()
    })
    panel.appendChild(closeBtn)

    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    this.overlay = overlay
  }

  private _buildCard(
    biome: BiomeInfo,
    metaState: MetaState,
    onSelect: (b: BiomeType) => void,
  ): HTMLElement {
    const cleansed = metaState.cleansedBiomes.includes(biome.type)
    const available =
      biome.unlockCondition.length === 0 ||
      biome.unlockCondition.every(b => metaState.cleansedBiomes.includes(b))

    const accent = BIOME_ACCENT[biome.type]
    const stars = '★'.repeat(biome.difficulty) + '☆'.repeat(6 - biome.difficulty)
    const statusLabel = cleansed ? 'CLEANSED' : available ? 'AVAILABLE' : 'LOCKED'
    const statusColor = cleansed ? '#44ff88' : available ? '#ffdd55' : '#555555'
    const bgColor = cleansed ? '#0d1a0d' : available ? '#12120a' : '#0e0e0e'
    const borderColor = cleansed ? '#226622' : available ? accent : '#2a2a2a'

    const card = document.createElement('div')
    card.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      padding: 10px 16px;
      text-align: center;
      cursor: ${available && !cleansed ? 'pointer' : 'default'};
      transition: border-color 0.12s;
      user-select: none;
    `
    card.innerHTML = `
      <div style="color: #cccccc; font-size: 13px; font-weight: bold; letter-spacing: 2px; margin-bottom: 3px;">${biome.name.toUpperCase()}</div>
      <div style="color: #ffaa00; font-size: 12px; margin-bottom: 3px;">${stars}</div>
      <div style="color: ${statusColor}; font-size: 11px; letter-spacing: 1px;">${statusLabel}</div>
    `

    if (available && !cleansed) {
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#ffdd55' })
      card.addEventListener('mouseleave', () => { card.style.borderColor = borderColor })
      card.addEventListener('click', () => {
        this.hide()
        onSelect(biome.type)
      })
    }

    return card
  }

  private _buildUndergroundCard(
    biome: UndergroundConfig,
    cleansed: boolean,
    onSelect: (id: number) => void,
  ): HTMLElement {
    const stars = '★'.repeat(biome.difficulty - 6) + '☆'.repeat(Math.max(0, 9 - biome.difficulty))
    const statusLabel = cleansed ? 'CLEANSED' : 'AVAILABLE'
    const statusColor = cleansed ? '#44ff88' : '#aa88ff'
    const bgColor = cleansed ? '#0d0d1a' : '#0e0a16'
    const borderColor = cleansed ? '#224422' : '#443366'

    const card = document.createElement('div')
    card.style.cssText = `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      padding: 10px 16px;
      text-align: center;
      cursor: ${cleansed ? 'default' : 'pointer'};
      flex: 1;
      transition: border-color 0.12s;
      user-select: none;
    `
    card.innerHTML = `
      <div style="color: #aaaacc; font-size: 12px; font-weight: bold; letter-spacing: 2px; margin-bottom: 3px;">${biome.name.toUpperCase()}</div>
      <div style="color: #8855ff; font-size: 11px; margin-bottom: 3px;">${stars}</div>
      <div style="color: ${statusColor}; font-size: 10px; letter-spacing: 1px;">${statusLabel}</div>
    `

    if (!cleansed) {
      card.addEventListener('mouseenter', () => { card.style.borderColor = '#aa77ff' })
      card.addEventListener('mouseleave', () => { card.style.borderColor = borderColor })
      card.addEventListener('click', () => onSelect(biome.id))
    }

    return card
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.parentElement?.removeChild(this.overlay)
      this.overlay = null
    }
  }
}
