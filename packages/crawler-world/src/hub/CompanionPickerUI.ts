import { COMPANION_DEFS } from '../companion/CompanionDefs'

export class CompanionPickerUI {
  private overlay: HTMLElement | null = null

  show(
    currentSelection: string | null,
    onSelect: (companionId: string) => void,
    onConfirm: () => void,
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
    `

    const panel = document.createElement('div')
    panel.style.cssText = `
      background: #0d0d0a;
      border: 2px solid #664400;
      padding: 28px 32px;
      min-width: 520px;
      max-width: 700px;
    `

    const title = document.createElement('h2')
    title.textContent = 'CHOOSE YOUR COMPANION'
    title.style.cssText = `
      color: #ffcc66;
      text-align: center;
      letter-spacing: 4px;
      margin: 0 0 6px 0;
      font-size: 18px;
      text-shadow: 0 0 10px #ffaa00;
    `
    panel.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.textContent = 'One companion per expedition. They fight alongside you and level up.'
    subtitle.style.cssText = `
      color: #666655;
      text-align: center;
      font-size: 10px;
      letter-spacing: 1px;
      margin-bottom: 22px;
    `
    panel.appendChild(subtitle)

    const grid = document.createElement('div')
    grid.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
    `

    let selected = currentSelection
    const cards: Map<string, HTMLElement> = new Map()

    const renderSelected = () => {
      for (const [id, card] of cards) {
        const isSelected = id === selected
        card.style.borderColor = isSelected ? '#ffcc44' : '#443300'
        card.style.background = isSelected ? '#221500' : '#141008'
        confirmBtn.disabled = selected === null
        confirmBtn.style.opacity = selected !== null ? '1' : '0.4'
        confirmBtn.style.cursor = selected !== null ? 'pointer' : 'not-allowed'
      }
    }

    for (const def of Object.values(COMPANION_DEFS)) {
      const card = document.createElement('div')
      card.style.cssText = `
        background: #141008;
        border: 2px solid #443300;
        padding: 14px 16px;
        min-width: 140px;
        max-width: 160px;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.12s, background 0.12s;
        user-select: none;
      `

      const colorHex = '#' + def.color.toString(16).padStart(6, '0')
      card.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${colorHex};
          margin: 0 auto 8px;
          box-shadow: 0 0 8px ${colorHex};
        "></div>
        <div style="color: #ffeecc; font-size: 14px; font-weight: bold; letter-spacing: 2px; margin-bottom: 3px;">${def.name.toUpperCase()}</div>
        <div style="color: #886644; font-size: 10px; letter-spacing: 1px; margin-bottom: 8px;">${def.role}</div>
        <div style="color: #888877; font-size: 9px; margin-bottom: 5px;">${def.attackType.toUpperCase()} ATK</div>
        <div style="color: #665544; font-size: 9px; font-style: italic; line-height: 1.3;">${def.passiveDesc}</div>
      `

      card.addEventListener('mouseenter', () => {
        if (def.id !== selected) card.style.borderColor = '#886600'
      })
      card.addEventListener('mouseleave', () => {
        if (def.id !== selected) card.style.borderColor = '#443300'
      })
      card.addEventListener('click', () => {
        selected = def.id
        onSelect(def.id)
        renderSelected()
      })

      cards.set(def.id, card)
      grid.appendChild(card)
    }

    panel.appendChild(grid)

    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = selected ? '[ EMBARK WITH COMPANION ]' : '[ SELECT A COMPANION ]'
    confirmBtn.disabled = selected === null
    confirmBtn.style.cssText = `
      display: block;
      margin: 0 auto 10px;
      background: transparent;
      border: 2px solid #664400;
      color: #ffcc44;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      letter-spacing: 2px;
      padding: 10px 28px;
      cursor: ${selected !== null ? 'pointer' : 'not-allowed'};
      opacity: ${selected !== null ? '1' : '0.4'};
      transition: border-color 0.12s;
    `
    confirmBtn.addEventListener('mouseenter', () => {
      if (!confirmBtn.disabled) confirmBtn.style.borderColor = '#ffaa00'
    })
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.borderColor = '#664400'
    })
    confirmBtn.addEventListener('click', () => {
      if (selected !== null) {
        this.hide()
        onConfirm()
      }
    })
    panel.appendChild(confirmBtn)

    const skipBtn = document.createElement('button')
    skipBtn.textContent = '[ EMBARK SOLO ]'
    skipBtn.style.cssText = `
      display: block;
      margin: 0 auto;
      background: transparent;
      border: 1px solid #333333;
      color: #555555;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 2px;
      padding: 7px 20px;
      cursor: pointer;
    `
    skipBtn.addEventListener('click', () => {
      selected = null
      onSelect('')
      this.hide()
      onConfirm()
    })
    panel.appendChild(skipBtn)

    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    this.overlay = overlay

    // Initial render pass for pre-selected state
    renderSelected()
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.parentElement?.removeChild(this.overlay)
      this.overlay = null
    }
  }
}
