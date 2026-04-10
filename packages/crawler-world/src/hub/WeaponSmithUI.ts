import { WEAPON_DEFS } from '../combat/WeaponDefs'
import type { MetaState } from '../state/MetaState'
import { saveMetaState } from '../state/SaveManager'

const BASE_WEAPONS = ['bolt_caster', 'tri_shot', 'ricochet', 'shockwave', 'blade_orbit', 'lightning_arc']

export class WeaponSmithUI {
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
      background: #0d0500;
      border: 2px solid #882200;
      padding: 28px 32px;
      min-width: 460px;
      max-width: 620px;
    `

    const title = document.createElement('h2')
    title.textContent = 'WEAPON SMITH'
    title.style.cssText = `
      color: #ff6633;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 6px 0;
      font-size: 18px;
      text-shadow: 0 0 10px #ff4400;
    `
    panel.appendChild(title)

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

    // ── Starting weapon selector ─────────────────────────────────────────────
    const secTitle = (text: string) => {
      const el = document.createElement('div')
      el.textContent = text
      el.style.cssText = `
        color: #ff8855;
        font-size: 11px;
        letter-spacing: 3px;
        border-bottom: 1px solid #441100;
        padding-bottom: 5px;
        margin-bottom: 10px;
        margin-top: 14px;
      `
      panel.appendChild(el)
    }

    secTitle('STARTING WEAPON')

    const weaponGrid = document.createElement('div')
    weaponGrid.style.cssText = `display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;`

    const renderWeaponGrid = () => {
      weaponGrid.innerHTML = ''
      for (const id of BASE_WEAPONS) {
        const def = WEAPON_DEFS[id]
        if (!def) continue
        const isSelected = metaState.startingWeapon === id
        const btn = document.createElement('button')
        btn.textContent = def.name.toUpperCase()
        btn.style.cssText = `
          background: ${isSelected ? '#441100' : '#1a0800'};
          border: 1px solid ${isSelected ? '#ff6633' : '#442200'};
          color: ${isSelected ? '#ff8866' : '#886655'};
          font-family: 'Courier New', monospace;
          font-size: 10px;
          padding: 5px 10px;
          cursor: pointer;
          letter-spacing: 1px;
        `
        btn.addEventListener('click', () => {
          metaState.startingWeapon = id
          saveMetaState(metaState)
          renderWeaponGrid()
        })
        weaponGrid.appendChild(btn)
      }
    }
    renderWeaponGrid()
    panel.appendChild(weaponGrid)

    // ── Reforge section ──────────────────────────────────────────────────────
    secTitle('REFORGE (reset weapon level for gold)')

    const reforgeList = document.createElement('div')
    reforgeList.style.cssText = `display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;`

    const buildReforge = () => {
      reforgeList.innerHTML = ''
      for (const id of BASE_WEAPONS) {
        const def = WEAPON_DEFS[id]
        if (!def) continue
        const level = (metaState.weaponLevels?.[id] ?? 0)
        if (level === 0) continue
        const cost = 50 * level
        const canAfford = metaState.gold >= cost

        const row = document.createElement('div')
        row.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid #331100;
          padding: 6px 10px;
          background: #110500;
        `
        row.innerHTML = `
          <span style="color: #cc6633; font-size: 12px;">${def.name.toUpperCase()}</span>
          <span style="color: #665544; font-size: 11px;">Lv${level}</span>
          <button class="reforge-btn" style="
            background: ${canAfford ? '#441100' : '#1a1a1a'};
            border: 1px solid ${canAfford ? '#ff4400' : '#333'};
            color: ${canAfford ? '#ff7755' : '#444'};
            font-family: 'Courier New', monospace;
            font-size: 10px;
            padding: 4px 8px;
            cursor: ${canAfford ? 'pointer' : 'not-allowed'};
          ">REFORGE ${cost}g</button>
        `
        const btn = row.querySelector('.reforge-btn') as HTMLButtonElement
        if (canAfford) {
          btn.addEventListener('click', () => {
            if (metaState.gold >= cost) {
              metaState.gold -= cost
              if (metaState.weaponLevels) metaState.weaponLevels[id] = 0
              saveMetaState(metaState)
              refreshGold()
              buildReforge()
            }
          })
        }
        reforgeList.appendChild(row)
      }
      if (reforgeList.childElementCount === 0) {
        const empty = document.createElement('div')
        empty.textContent = 'No leveled weapons to reforge.'
        empty.style.cssText = 'color: #443322; font-size: 10px; padding: 6px 0;'
        reforgeList.appendChild(empty)
      }
    }
    buildReforge()
    panel.appendChild(reforgeList)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ LEAVE ]'
    closeBtn.style.cssText = `
      display: block;
      margin: 16px auto 0;
      background: transparent;
      border: 1px solid #882200;
      color: #ff6633;
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
