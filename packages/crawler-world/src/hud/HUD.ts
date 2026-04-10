import type { GameState } from '../state/GameState'
import type { WaveSystem } from '../enemies/WaveSystem'

const GLOW = 'text-shadow: 0 0 8px currentColor'
const BASE_STYLE = `
  position: fixed;
  z-index: 100;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #e8e8e8;
  pointer-events: none;
  user-select: none;
`

function el(tag: string, style: string, parent: HTMLElement = document.body): HTMLElement {
  const e = document.createElement(tag)
  e.style.cssText = style
  parent.appendChild(e)
  return e
}

export class HUD {
  private healthWrap: HTMLElement
  private healthFill: HTMLElement
  private healthText: HTMLElement

  private xpWrap: HTMLElement
  private xpFill: HTMLElement
  private xpText: HTMLElement

  private waveEl: HTMLElement
  private goldEl: HTMLElement
  private weaponListEl: HTMLElement
  private crosshair: HTMLElement
  private retreatBtn: HTMLElement
  private confirmDialog: HTMLElement | null = null

  onRetreat: (() => void) | null = null

  constructor() {
    // ── Health bar (top-left) ───────────────────────────────────────────────
    this.healthWrap = el('div', `${BASE_STYLE} top:12px; left:12px; width:180px;`)

    this.healthText = el('div', `
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #ff6b6b;
      ${GLOW};
      margin-bottom: 3px;
    `, this.healthWrap)
    this.healthText.textContent = 'HP: 100/100'

    const healthTrack = el('div', `
      width: 100%;
      height: 8px;
      background: rgba(0,0,0,0.5);
      border: 1px solid #ff4444;
      border-radius: 2px;
      overflow: hidden;
    `, this.healthWrap)

    this.healthFill = el('div', `
      height: 100%;
      width: 100%;
      background: #ff3333;
      transition: width 0.15s ease;
    `, healthTrack)

    // ── XP bar (bottom-center) ──────────────────────────────────────────────
    this.xpWrap = el('div', `
      ${BASE_STYLE}
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: 280px;
      text-align: center;
    `)

    this.xpText = el('div', `
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #66aaff;
      ${GLOW};
      margin-bottom: 3px;
    `, this.xpWrap)
    this.xpText.textContent = 'LVL 1'

    const xpTrack = el('div', `
      width: 100%;
      height: 6px;
      background: rgba(0,0,0,0.5);
      border: 1px solid #3366cc;
      border-radius: 2px;
      overflow: hidden;
    `, this.xpWrap)

    this.xpFill = el('div', `
      height: 100%;
      width: 0%;
      background: #4488ff;
      transition: width 0.2s ease;
    `, xpTrack)

    // ── Wave counter (top-center) ───────────────────────────────────────────
    this.waveEl = el('div', `
      ${BASE_STYLE}
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffdd55;
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 2px;
      ${GLOW};
    `)
    this.waveEl.textContent = 'WAVE 0'

    // ── Gold (top-right) ────────────────────────────────────────────────────
    this.goldEl = el('div', `
      ${BASE_STYLE}
      top: 12px;
      right: 12px;
      color: #ffcc00;
      font-size: 13px;
      ${GLOW};
    `)
    this.goldEl.textContent = 'GOLD: 0'

    // ── Weapon list (bottom-left) ───────────────────────────────────────────
    this.weaponListEl = el('div', `
      ${BASE_STYLE}
      bottom: 24px;
      left: 12px;
      color: #aaffcc;
      line-height: 1.6;
      font-size: 12px;
      ${GLOW};
    `)

    // ── Crosshair (center) ──────────────────────────────────────────────────
    this.crosshair = el('div', `
      position: fixed;
      z-index: 100;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 6px;
      background: rgba(255,255,255,0.85);
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 4px rgba(255,255,255,0.6);
    `)

    // ── Retreat button (bottom-right) ───────────────────────────────────────
    this.retreatBtn = document.createElement('button')
    this.retreatBtn.textContent = 'RETREAT'
    this.retreatBtn.style.cssText = `
      position: fixed;
      z-index: 110;
      bottom: 24px;
      right: 16px;
      background: rgba(0,0,0,0.55);
      border: 1px solid #883333;
      color: #cc6666;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      letter-spacing: 2px;
      padding: 7px 14px;
      cursor: pointer;
      pointer-events: all;
      transition: background 0.15s, border-color 0.15s;
    `
    this.retreatBtn.addEventListener('mouseenter', () => {
      this.retreatBtn.style.background = 'rgba(80,0,0,0.7)'
      this.retreatBtn.style.borderColor = '#cc4444'
    })
    this.retreatBtn.addEventListener('mouseleave', () => {
      this.retreatBtn.style.background = 'rgba(0,0,0,0.55)'
      this.retreatBtn.style.borderColor = '#883333'
    })
    this.retreatBtn.addEventListener('click', () => this.showRetreatConfirm())
    document.body.appendChild(this.retreatBtn)
  }

  private showRetreatConfirm(): void {
    if (this.confirmDialog) return

    // Unlock pointer so cursor is visible
    document.exitPointerLock()

    this.confirmDialog = document.createElement('div')
    this.confirmDialog.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0,0,0,0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `

    const box = document.createElement('div')
    box.style.cssText = `
      background: rgba(10,10,14,0.97);
      border: 2px solid #663333;
      padding: 32px 40px;
      text-align: center;
      min-width: 320px;
      box-shadow: 0 0 24px #ff333344;
    `

    const msg = document.createElement('div')
    msg.innerHTML = `<div style="font-size:16px; letter-spacing:3px; color:#ff6666; margin-bottom:12px;">RETREAT?</div>
      <div style="font-size:12px; color:#aaaaaa; margin-bottom:24px; line-height:1.7;">
        You'll keep gold earned so far,<br>but forfeit the boss and victory.
      </div>`
    box.appendChild(msg)

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex; gap:16px; justify-content:center;'

    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = '[ CONFIRM ]'
    confirmBtn.style.cssText = `
      background: transparent; border: 2px solid #663333; color: #ff6666;
      font-family: 'Courier New', monospace; font-size: 13px; letter-spacing: 2px;
      padding: 10px 20px; cursor: pointer;
    `
    confirmBtn.addEventListener('click', () => {
      this.dismissRetreatConfirm()
      if (this.onRetreat) this.onRetreat()
    })

    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '[ CANCEL ]'
    cancelBtn.style.cssText = `
      background: transparent; border: 2px solid #335533; color: #66aa66;
      font-family: 'Courier New', monospace; font-size: 13px; letter-spacing: 2px;
      padding: 10px 20px; cursor: pointer;
    `
    cancelBtn.addEventListener('click', () => {
      this.dismissRetreatConfirm()
      // Re-lock pointer to resume gameplay
      document.body.requestPointerLock()
    })

    btnRow.appendChild(confirmBtn)
    btnRow.appendChild(cancelBtn)
    box.appendChild(btnRow)
    this.confirmDialog.appendChild(box)
    document.body.appendChild(this.confirmDialog)
  }

  private dismissRetreatConfirm(): void {
    if (this.confirmDialog) {
      this.confirmDialog.parentElement?.removeChild(this.confirmDialog)
      this.confirmDialog = null
    }
  }

  update(gameState: GameState, waveSystem: WaveSystem): void {
    // Health
    const hPct = Math.max(0, gameState.health / gameState.maxHealth) * 100
    this.healthFill.style.width = `${hPct}%`
    this.healthText.textContent = `HP: ${Math.ceil(gameState.health)}/${gameState.maxHealth}`

    // XP
    const xpPct = (gameState.xp / gameState.maxXp) * 100
    this.xpFill.style.width = `${xpPct}%`
    this.xpText.textContent = `LVL ${gameState.level}`

    // Wave
    this.waveEl.textContent = `WAVE ${waveSystem.currentWave}`

    // Gold
    this.goldEl.textContent = `GOLD: ${gameState.gold}`

    // Weapons
    this.weaponListEl.innerHTML = gameState.weapons
      .map((id) => {
        const lvl = gameState.weaponLevels[id] ?? 1
        return `▸ ${id.replace(/_/g, ' ').toUpperCase()} Lv${lvl}`
      })
      .join('<br>')
  }

  destroy(): void {
    this.dismissRetreatConfirm()
    ;[
      this.healthWrap,
      this.xpWrap,
      this.waveEl,
      this.goldEl,
      this.weaponListEl,
      this.crosshair,
      this.retreatBtn,
    ].forEach((e) => e.parentElement?.removeChild(e))
  }
}
