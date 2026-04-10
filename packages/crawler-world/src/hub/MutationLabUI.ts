import type { MetaState } from '../state/MetaState'
import { saveMetaState } from '../state/SaveManager'

const RESISTANCE_COST = 100
const MAX_RESISTANCE_STACKS = 5  // each stack = +5% resistance, cap at 25%

const ARCHETYPE_INFO: Record<string, { label: string; dnaRange: string; color: string }> = {
  rusher: { label: 'RUSHER',  dnaRange: 'Speed 0.6-0.9 / Aggression 0.7-1.0', color: '#ff4444' },
  shooter: { label: 'SHOOTER', dnaRange: 'Range 15-30 / Projectile burst 2-4', color: '#ff8833' },
  flyer:   { label: 'FLYER',   dnaRange: 'Wings 0.7-1.0 / Speed 0.5-0.8',     color: '#4488ff' },
  tank:    { label: 'TANK',    dnaRange: 'Size 1.5-2.5 / Armor 0.4-0.8',      color: '#888888' },
}

export class MutationLabUI {
  private overlay: HTMLElement | null = null

  show(metaState: MetaState, onClose: () => void): void {
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
    `

    const panel = document.createElement('div')
    panel.style.cssText = `
      background: #06000d;
      border: 2px solid #550088;
      padding: 28px 32px;
      min-width: 480px;
      max-width: 640px;
    `

    const title = document.createElement('h2')
    title.textContent = 'MUTATION LAB'
    title.style.cssText = `
      color: #cc88ff;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 6px 0;
      font-size: 18px;
      text-shadow: 0 0 10px #9900ff;
    `
    panel.appendChild(title)

    const sub = document.createElement('div')
    sub.textContent = 'Study enemy archetypes encountered in expeditions. Buy resistance mutations.'
    sub.style.cssText = `
      color: #442255;
      text-align: center;
      font-size: 10px;
      letter-spacing: 1px;
      margin-bottom: 18px;
    `
    panel.appendChild(sub)

    const goldEl = document.createElement('div')
    goldEl.style.cssText = `
      color: #ffcc00;
      text-align: center;
      font-size: 13px;
      margin-bottom: 18px;
      letter-spacing: 2px;
    `
    const refreshGold = () => { goldEl.textContent = `GOLD: ${metaState.gold}` }
    refreshGold()
    panel.appendChild(goldEl)

    const bestiaryEl = document.createElement('div')
    bestiaryEl.style.cssText = `display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;`

    const buildBestiary = () => {
      bestiaryEl.innerHTML = ''

      const encountered = metaState.encounterLog
      const knownArchetypes = Object.keys(ARCHETYPE_INFO)

      for (const archetype of knownArchetypes) {
        const seen = encountered.includes(archetype)
        const info = ARCHETYPE_INFO[archetype]
        const stacks = metaState.resistances[archetype] ?? 0
        const resistPct = stacks * 5
        const atCap = stacks >= MAX_RESISTANCE_STACKS

        const card = document.createElement('div')
        card.style.cssText = `
          border: 1px solid ${seen ? '#330055' : '#1a1a1a'};
          padding: 10px 14px;
          background: ${seen ? '#0a0010' : '#070707'};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        `

        if (!seen) {
          card.innerHTML = `
            <div>
              <div style="color:#333333;font-size:12px;letter-spacing:2px;">???</div>
              <div style="color:#222222;font-size:9px;margin-top:3px;">Not yet encountered</div>
            </div>
          `
        } else {
          const canAfford = metaState.gold >= RESISTANCE_COST && !atCap

          card.innerHTML = `
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                <div style="width:10px;height:10px;border-radius:50%;background:${info.color};"></div>
                <span style="color:#cc88ff;font-size:13px;letter-spacing:2px;">${info.label}</span>
              </div>
              <div style="color:#664488;font-size:9px;margin-bottom:2px;">${info.dnaRange}</div>
              <div style="color:${resistPct > 0 ? '#aa66ff' : '#442255'};font-size:10px;">
                RESISTANCE: ${resistPct}% ${atCap ? '(MAX)' : `(${stacks}/${MAX_RESISTANCE_STACKS})`}
              </div>
            </div>
            <button class="resist-btn" style="
              background: ${canAfford ? '#220033' : '#0d0d0d'};
              border: 1px solid ${canAfford ? '#9933cc' : '#222'};
              color: ${canAfford ? '#cc66ff' : '#333'};
              font-family: 'Courier New', monospace;
              font-size: 10px;
              padding: 6px 12px;
              cursor: ${canAfford ? 'pointer' : 'not-allowed'};
              white-space: nowrap;
            ">${atCap ? 'MAXED' : `+5% RES\n${RESISTANCE_COST}g`}</button>
          `

          const btn = card.querySelector('.resist-btn') as HTMLButtonElement
          if (canAfford) {
            btn.addEventListener('click', () => {
              if (metaState.gold >= RESISTANCE_COST) {
                metaState.gold -= RESISTANCE_COST
                metaState.resistances[archetype] = stacks + 1
                saveMetaState(metaState)
                refreshGold()
                buildBestiary()
              }
            })
          }
        }

        bestiaryEl.appendChild(card)
      }
    }
    buildBestiary()
    panel.appendChild(bestiaryEl)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ LEAVE ]'
    closeBtn.style.cssText = `
      display: block;
      margin: 10px auto 0;
      background: transparent;
      border: 1px solid #550088;
      color: #cc88ff;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 7px 22px;
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

  hide(): void {
    if (this.overlay) {
      this.overlay.parentElement?.removeChild(this.overlay)
      this.overlay = null
    }
  }
}
