import type { MetaState } from '../state/MetaState'
import { saveMetaState } from '../state/SaveManager'

interface UpgradeDef {
  stat: string
  label: string
  description: string
}

const UPGRADES: UpgradeDef[] = [
  { stat: 'damage',  label: 'DAMAGE',  description: 'Increase weapon damage' },
  { stat: 'health',  label: 'HEALTH',  description: 'Increase max HP' },
  { stat: 'speed',   label: 'SPEED',   description: 'Move faster' },
  { stat: 'greed',   label: 'GREED',   description: 'Enemies drop more gold' },
  { stat: 'wisdom',  label: 'WISDOM',  description: 'Gain more XP per kill' },
  { stat: 'magnet',  label: 'MAGNET',  description: 'Pickup range increased' },
  { stat: 'armor',   label: 'ARMOR',   description: 'Reduce incoming damage' },
]

export class ShopUI {
  private overlay: HTMLElement | null = null

  show(metaState: MetaState, onClose: () => void): void {
    this.hide()

    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `

    const panel = document.createElement('div')
    panel.style.cssText = `
      background: #0d0a00;
      border: 2px solid #886600;
      padding: 32px;
      min-width: 420px;
      max-width: 560px;
    `

    const title = document.createElement('h2')
    title.textContent = 'MERCHANT'
    title.style.cssText = `
      color: #ffdd55;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 8px 0;
      font-size: 20px;
      text-shadow: 0 0 10px #ffaa00;
    `
    panel.appendChild(title)

    const goldEl = document.createElement('div')
    goldEl.style.cssText = `
      color: #ffcc00;
      text-align: center;
      font-size: 14px;
      margin-bottom: 20px;
      letter-spacing: 2px;
    `
    const refreshGold = () => { goldEl.textContent = `GOLD: ${metaState.gold}` }
    refreshGold()
    panel.appendChild(goldEl)

    const listEl = document.createElement('div')
    listEl.style.cssText = `display: flex; flex-direction: column; gap: 8px;`

    const buildList = () => {
      listEl.innerHTML = ''
      for (const upg of UPGRADES) {
        const level = metaState.upgrades[upg.stat as keyof typeof metaState.upgrades] ?? 0
        const cost = metaState.getUpgradeCost(upg.stat)
        const canAfford = metaState.gold >= cost

        const row = document.createElement('div')
        row.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid #443300;
          padding: 8px 12px;
          background: #1a1000;
        `
        row.innerHTML = `
          <div>
            <span style="color: #ffcc88; font-size: 13px; letter-spacing: 1px;">${upg.label}</span>
            <span style="color: #555555; font-size: 11px; margin-left: 8px;">Lv${level}</span>
            <div style="color: #666666; font-size: 10px; margin-top: 2px;">${upg.description}</div>
          </div>
          <button class="buy-btn" style="
            background: ${canAfford ? '#553300' : '#1a1a1a'};
            border: 1px solid ${canAfford ? '#ffaa00' : '#333333'};
            color: ${canAfford ? '#ffdd55' : '#444444'};
            font-family: 'Courier New', monospace;
            font-size: 11px;
            padding: 5px 10px;
            cursor: ${canAfford ? 'pointer' : 'not-allowed'};
            white-space: nowrap;
          ">${cost}g</button>
        `

        const buyBtn = row.querySelector('.buy-btn') as HTMLButtonElement
        if (canAfford) {
          buyBtn.addEventListener('click', () => {
            if (metaState.buyUpgrade(upg.stat)) {
              saveMetaState(metaState)
              refreshGold()
              buildList()
            }
          })
        }
        listEl.appendChild(row)
      }
    }

    buildList()
    panel.appendChild(listEl)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ LEAVE ]'
    closeBtn.style.cssText = `
      display: block;
      margin: 20px auto 0;
      background: transparent;
      border: 1px solid #886600;
      color: #ffdd55;
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

  hide(): void {
    if (this.overlay) {
      this.overlay.parentElement?.removeChild(this.overlay)
      this.overlay = null
    }
  }
}
