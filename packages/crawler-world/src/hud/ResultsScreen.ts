export interface ResultsData {
  victory: boolean
  biomeName: string
  duration: number       // seconds
  wavesCompleted: number
  totalWaves: number
  enemiesKilled: number
  goldEarned: number
  xpEarned: number
  levelReached: number
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function row(label: string, value: string | number, color = '#e8e8e8'): string {
  return `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px; color:${color};">
      <span style="letter-spacing:1px;">${label}</span>
      <span style="font-weight:bold; color:#ffcc00;">${value}</span>
    </div>`
}

export class ResultsScreen {
  private el: HTMLElement

  constructor(data: ResultsData, onReturn: () => void) {
    const victory = data.victory
    const accentColor = victory ? '#44ff88' : '#ff4444'
    const borderColor = victory ? '#226633' : '#662222'
    const bgOverlay = victory ? 'rgba(0,30,10,0.92)' : 'rgba(30,0,0,0.92)'

    this.el = document.createElement('div')
    this.el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 300;
      background: ${bgOverlay};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `

    const card = document.createElement('div')
    card.style.cssText = `
      background: rgba(8,8,12,0.97);
      border: 2px solid ${borderColor};
      box-shadow: 0 0 32px ${accentColor}44, inset 0 0 16px rgba(0,0,0,0.5);
      padding: 36px 48px;
      min-width: 380px;
      max-width: 480px;
      text-align: left;
    `

    // Title
    const title = document.createElement('div')
    title.textContent = victory ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED'
    title.style.cssText = `
      font-size: 22px;
      letter-spacing: 5px;
      color: ${accentColor};
      text-shadow: 0 0 16px ${accentColor};
      text-align: center;
      margin-bottom: 28px;
    `
    card.appendChild(title)

    // Stats rows
    const stats = document.createElement('div')
    stats.style.cssText = `
      border-top: 1px solid ${borderColor};
      border-bottom: 1px solid ${borderColor};
      padding: 16px 0;
      margin-bottom: 20px;
      font-size: 13px;
    `
    stats.innerHTML = [
      row('Biome', data.biomeName),
      row('Duration', formatDuration(data.duration)),
      row('Waves Survived', `${data.wavesCompleted}/${data.totalWaves}`),
      row('Enemies Killed', data.enemiesKilled.toLocaleString()),
      row('Gold Earned', data.goldEarned.toLocaleString()),
      row('XP Earned', data.xpEarned.toLocaleString()),
      row('Level Reached', data.levelReached),
    ].join('')
    card.appendChild(stats)

    // Victory badge
    if (victory) {
      const badge = document.createElement('div')
      badge.textContent = '★  BIOME CLEANSED  ★'
      badge.style.cssText = `
        text-align: center;
        color: #ffcc00;
        text-shadow: 0 0 12px #ffcc00;
        font-size: 14px;
        letter-spacing: 4px;
        margin-bottom: 20px;
      `
      card.appendChild(badge)
    }

    // Return button
    const btn = document.createElement('button')
    btn.textContent = '[ RETURN TO HUB ]'
    btn.style.cssText = `
      display: block;
      width: 100%;
      background: transparent;
      border: 2px solid ${borderColor};
      color: ${accentColor};
      font-family: 'Courier New', monospace;
      font-size: 14px;
      letter-spacing: 3px;
      padding: 12px 0;
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s;
    `
    btn.addEventListener('mouseenter', () => {
      btn.style.background = `${accentColor}22`
      btn.style.boxShadow = `0 0 8px ${accentColor}66`
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent'
      btn.style.boxShadow = 'none'
    })
    btn.addEventListener('click', () => {
      this.destroy()
      onReturn()
    })
    card.appendChild(btn)

    this.el.appendChild(card)
    document.body.appendChild(this.el)
  }

  destroy(): void {
    this.el.parentElement?.removeChild(this.el)
  }
}
