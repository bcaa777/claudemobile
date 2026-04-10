import type { LevelUpOption } from '../combat/WeaponProgression'

const REROLL_COST = 10

export class LevelUpScreen {
  private overlay: HTMLElement
  private options: LevelUpOption[]
  private gold: number
  private onSelect: (option: LevelUpOption) => void
  private onReroll: () => void

  constructor(
    options: LevelUpOption[],
    gold: number,
    onSelect: (option: LevelUpOption) => void,
    onReroll: () => void,
  ) {
    this.options = options
    this.gold = gold
    this.onSelect = onSelect
    this.onReroll = onReroll

    this.overlay = this.build()
    document.body.appendChild(this.overlay)
  }

  private build(): HTMLElement {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(0, 0, 0, 0.78);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `

    // Title
    const title = document.createElement('h1')
    title.textContent = 'LEVEL UP!'
    title.style.cssText = `
      color: #ffe066;
      font-size: 36px;
      letter-spacing: 6px;
      margin: 0 0 28px;
      text-shadow: 0 0 18px #ffcc00, 0 0 6px #ffcc00;
    `
    overlay.appendChild(title)

    // Cards row
    const row = document.createElement('div')
    row.style.cssText = `
      display: flex;
      gap: 18px;
      margin-bottom: 24px;
    `

    for (const opt of this.options) {
      const card = this.buildCard(opt)
      row.appendChild(card)
    }
    overlay.appendChild(row)

    // Reroll button
    const rerollBtn = document.createElement('button')
    const canReroll = this.gold >= REROLL_COST
    rerollBtn.textContent = `REROLL (${REROLL_COST}g)`
    rerollBtn.style.cssText = `
      background: ${canReroll ? 'rgba(80,60,0,0.85)' : 'rgba(40,40,40,0.7)'};
      border: 1px solid ${canReroll ? '#ffcc00' : '#555'};
      color: ${canReroll ? '#ffcc00' : '#777'};
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 8px 24px;
      cursor: ${canReroll ? 'pointer' : 'default'};
      letter-spacing: 2px;
      border-radius: 3px;
      text-shadow: ${canReroll ? '0 0 6px #ffcc00' : 'none'};
      transition: background 0.15s;
    `
    if (canReroll) {
      rerollBtn.addEventListener('click', () => {
        this.destroy()
        this.onReroll()
      })
      rerollBtn.addEventListener('mouseenter', () => {
        rerollBtn.style.background = 'rgba(120,90,0,0.9)'
      })
      rerollBtn.addEventListener('mouseleave', () => {
        rerollBtn.style.background = 'rgba(80,60,0,0.85)'
      })
    }
    overlay.appendChild(rerollBtn)

    return overlay
  }

  private buildCard(opt: LevelUpOption): HTMLElement {
    const isEvolution = opt.type === 'evolution'
    const isFusion = opt.type === 'fusion'

    const borderColor = isEvolution ? '#ffcc00' : isFusion ? '#cc55ff' : '#3366aa'
    const hoverBorderColor = isEvolution ? '#ffe566' : isFusion ? '#dd88ff' : '#66aaff'
    const bgColor = isEvolution
      ? 'rgba(30, 20, 0, 0.95)'
      : isFusion
      ? 'rgba(20, 5, 35, 0.95)'
      : 'rgba(10, 20, 40, 0.92)'
    const hoverBgColor = isEvolution
      ? 'rgba(60, 40, 0, 0.98)'
      : isFusion
      ? 'rgba(45, 10, 70, 0.98)'
      : 'rgba(20, 40, 80, 0.95)'
    const labelColor = isEvolution ? '#ffe066' : isFusion ? '#dd99ff' : '#aaddff'
    const labelShadow = isEvolution ? '#ffcc00' : isFusion ? '#bb44ff' : '#4488ff'

    const card = document.createElement('div')
    card.style.cssText = `
      position: relative;
      width: 160px;
      min-height: 120px;
      background: ${bgColor};
      border: ${isEvolution || isFusion ? '2px' : '1px'} solid ${borderColor};
      border-radius: 6px;
      padding: 16px 14px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: border-color 0.15s, background 0.15s;
      ${isEvolution ? 'box-shadow: 0 0 14px rgba(255, 200, 0, 0.35);' : ''}
      ${isFusion ? 'box-shadow: 0 0 14px rgba(180, 60, 255, 0.35);' : ''}
    `

    // Badge for evolution / fusion
    if (isEvolution || isFusion) {
      const badge = document.createElement('div')
      badge.textContent = isEvolution ? 'EVOLVE' : 'FUSE'
      badge.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isEvolution ? '#ffcc00' : '#cc55ff'};
        color: ${isEvolution ? '#1a1000' : '#fff'};
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 2px;
        padding: 2px 8px;
        border-radius: 3px;
      `
      card.appendChild(badge)
    }

    const icon = document.createElement('div')
    icon.textContent = iconForOption(opt)
    icon.style.cssText = 'font-size: 28px; line-height: 1;'

    const label = document.createElement('div')
    label.textContent = opt.label
    label.style.cssText = `
      color: ${labelColor};
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      text-shadow: 0 0 6px ${labelShadow};
      letter-spacing: 1px;
    `

    const desc = document.createElement('div')
    desc.textContent = opt.description
    desc.style.cssText = `
      color: #8899aa;
      font-size: 11px;
      text-align: center;
      line-height: 1.4;
    `

    card.appendChild(icon)
    card.appendChild(label)
    card.appendChild(desc)

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = hoverBorderColor
      card.style.background = hoverBgColor
    })
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = borderColor
      card.style.background = bgColor
    })
    card.addEventListener('click', () => {
      this.destroy()
      this.onSelect(opt)
    })

    return card
  }

  /** Replace the current options (called after reroll from outside) */
  refresh(options: LevelUpOption[], gold: number): void {
    this.options = options
    this.gold = gold
    const newOverlay = this.build()
    document.body.replaceChild(newOverlay, this.overlay)
    this.overlay = newOverlay
  }

  destroy(): void {
    this.overlay.parentElement?.removeChild(this.overlay)
  }
}

function iconForOption(opt: LevelUpOption): string {
  if (opt.type === 'evolution') return '★'
  if (opt.type === 'fusion') return '✦'
  if (opt.type === 'weapon_unlock') return '⚔'
  if (opt.type === 'weapon_levelup') return '▲'
  switch (opt.stat) {
    case 'damage': return '💥'
    case 'speed': return '⚡'
    case 'health': return '❤'
    case 'pickup': return '✦'
    default: return '★'
  }
}
