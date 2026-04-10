import { COMPANION_DEFS } from '../companion/CompanionDefs'
import type { MetaState } from '../state/MetaState'
import { saveMetaState } from '../state/SaveManager'

const DAMAGE_UPGRADE_COST = 80
const HEALTH_UPGRADE_COST = 60

export class CompanionTrainerUI {
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
      background: #000d03;
      border: 2px solid #226600;
      padding: 28px 32px;
      min-width: 460px;
      max-width: 620px;
    `

    const title = document.createElement('h2')
    title.textContent = 'COMPANION TRAINER'
    title.style.cssText = `
      color: #44ff88;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 6px 0;
      font-size: 18px;
      text-shadow: 0 0 10px #00ff66;
    `
    panel.appendChild(title)

    const sub = document.createElement('div')
    sub.textContent = 'Permanently upgrade your companions between expeditions.'
    sub.style.cssText = `
      color: #336644;
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

    const listEl = document.createElement('div')
    listEl.style.cssText = `display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;`

    const buildList = () => {
      listEl.innerHTML = ''
      for (const def of Object.values(COMPANION_DEFS)) {
        const upg = metaState.companionUpgrades[def.id] ?? { damage: 0, health: 0 }
        const colorHex = '#' + def.color.toString(16).padStart(6, '0')

        const card = document.createElement('div')
        card.style.cssText = `
          border: 1px solid #224411;
          padding: 10px 14px;
          background: #020a04;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        `

        const info = document.createElement('div')
        info.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <div style="width:12px;height:12px;border-radius:50%;background:${colorHex};"></div>
            <span style="color:#aaffcc;font-size:13px;letter-spacing:1px;">${def.name.toUpperCase()}</span>
          </div>
          <div style="color:#446633;font-size:10px;">DMG +${upg.damage * 10}% &nbsp;|&nbsp; HP +${upg.health * 20}</div>
        `
        card.appendChild(info)

        const btnGroup = document.createElement('div')
        btnGroup.style.cssText = `display:flex;gap:6px;`

        const canDmg = metaState.gold >= DAMAGE_UPGRADE_COST
        const dmgBtn = document.createElement('button')
        dmgBtn.innerHTML = `+10% DMG<br><span style="font-size:9px">${DAMAGE_UPGRADE_COST}g</span>`
        dmgBtn.style.cssText = `
          background: ${canDmg ? '#112200' : '#0a0a0a'};
          border: 1px solid ${canDmg ? '#44aa22' : '#222'};
          color: ${canDmg ? '#88dd55' : '#333'};
          font-family: 'Courier New', monospace;
          font-size: 10px;
          padding: 5px 10px;
          cursor: ${canDmg ? 'pointer' : 'not-allowed'};
          text-align: center;
          line-height: 1.4;
        `
        if (canDmg) {
          dmgBtn.addEventListener('click', () => {
            if (metaState.gold >= DAMAGE_UPGRADE_COST) {
              metaState.gold -= DAMAGE_UPGRADE_COST
              metaState.companionUpgrades[def.id] = {
                damage: upg.damage + 1,
                health: upg.health,
              }
              saveMetaState(metaState)
              refreshGold()
              buildList()
            }
          })
        }

        const canHp = metaState.gold >= HEALTH_UPGRADE_COST
        const hpBtn = document.createElement('button')
        hpBtn.innerHTML = `+20 HP<br><span style="font-size:9px">${HEALTH_UPGRADE_COST}g</span>`
        hpBtn.style.cssText = `
          background: ${canHp ? '#112200' : '#0a0a0a'};
          border: 1px solid ${canHp ? '#44aa22' : '#222'};
          color: ${canHp ? '#88dd55' : '#333'};
          font-family: 'Courier New', monospace;
          font-size: 10px;
          padding: 5px 10px;
          cursor: ${canHp ? 'pointer' : 'not-allowed'};
          text-align: center;
          line-height: 1.4;
        `
        if (canHp) {
          hpBtn.addEventListener('click', () => {
            if (metaState.gold >= HEALTH_UPGRADE_COST) {
              metaState.gold -= HEALTH_UPGRADE_COST
              metaState.companionUpgrades[def.id] = {
                damage: upg.damage,
                health: upg.health + 1,
              }
              saveMetaState(metaState)
              refreshGold()
              buildList()
            }
          })
        }

        btnGroup.appendChild(dmgBtn)
        btnGroup.appendChild(hpBtn)
        card.appendChild(btnGroup)
        listEl.appendChild(card)
      }
    }
    buildList()
    panel.appendChild(listEl)

    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ LEAVE ]'
    closeBtn.style.cssText = `
      display: block;
      margin: 10px auto 0;
      background: transparent;
      border: 1px solid #226600;
      color: #44ff88;
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
