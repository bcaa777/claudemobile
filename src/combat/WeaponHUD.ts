import { WorldState } from '../systems/WorldState'
import { WeaponSystem } from './WeaponSystem'

const TIER_NAMES = ['Novice', 'Initiate', 'Adept', 'Resonant', 'Ascended']
const TIER_BONUSES = [
  'Base resonance bolt',
  '+33% damage, faster cooldown',
  '+87% damage, particle trail',
  '+153% damage, rapid fire',
  '+233% damage, mastery',
]

export class WeaponHUD {
  private container: HTMLDivElement
  private xpDisplay: HTMLDivElement
  private weaponIcon: HTMLDivElement
  private upgradeNotice: HTMLDivElement
  private upgradePanel: HTMLDivElement
  private _panelOpen = false

  // XP fade tracking
  private lastXP = -1
  private xpFadeTimer = 0

  constructor() {
    // Container for bottom-right elements
    this.container = document.createElement('div')
    this.container.id = 'weapon-hud'
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 500;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      text-align: right;
    `
    document.body.appendChild(this.container)

    // Weapon indicator (above XP)
    this.weaponIcon = document.createElement('div')
    this.weaponIcon.style.cssText = `
      color: #ffcc44;
      font-size: 13px;
      margin-bottom: 4px;
      text-shadow: 0 0 6px rgba(255, 170, 0, 0.5);
      opacity: 0.8;
      transition: opacity 0.3s ease;
    `
    this.container.appendChild(this.weaponIcon)

    // XP display
    this.xpDisplay = document.createElement('div')
    this.xpDisplay.style.cssText = `
      color: #ffcc44;
      font-size: 14px;
      text-shadow: 0 0 8px rgba(255, 170, 0, 0.6);
      opacity: 0;
      transition: opacity 0.5s ease;
    `
    this.container.appendChild(this.xpDisplay)

    // Upgrade notice (top-center, pulsing)
    this.upgradeNotice = document.createElement('div')
    this.upgradeNotice.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffcc44;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      text-shadow: 0 0 10px rgba(255, 170, 0, 0.6);
      pointer-events: none;
      z-index: 500;
      opacity: 0;
      transition: opacity 0.5s ease;
    `
    document.body.appendChild(this.upgradeNotice)

    // Upgrade panel (modal overlay)
    this.upgradePanel = document.createElement('div')
    this.upgradePanel.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      z-index: 2000;
      pointer-events: all;
    `
    document.body.appendChild(this.upgradePanel)
  }

  update(worldState: WorldState, weaponSystem: WeaponSystem, dt: number): void {
    // XP display — show when XP changes, fade after 3s
    if (worldState.playerXP !== this.lastXP) {
      this.lastXP = worldState.playerXP
      this.xpFadeTimer = 3.0
      this.xpDisplay.style.opacity = '1'
    }
    if (this.xpFadeTimer > 0) {
      this.xpFadeTimer -= dt
      if (this.xpFadeTimer <= 0) {
        this.xpDisplay.style.opacity = '0.3'
      }
    }
    this.xpDisplay.textContent = `\u2726 ${worldState.playerXP} XP`

    // Weapon indicator
    if (worldState.hasGun) {
      const current = weaponSystem.getCurrentWeapon()
      if (current === 'magic') {
        this.weaponIcon.textContent = '\u26A1 RESONANCE BOLT'
        this.weaponIcon.style.opacity = '0.9'
      } else {
        this.weaponIcon.textContent = '\uD83D\uDC4A STRIKE'
        this.weaponIcon.style.opacity = '0.6'
      }
    } else {
      this.weaponIcon.textContent = '\uD83D\uDC4A STRIKE'
      this.weaponIcon.style.opacity = '0.6'
    }

    // Upgrade notice
    const info = weaponSystem.getUpgradeInfo()
    if (info && info.canUpgrade && worldState.hasGun && !this._panelOpen) {
      this.upgradeNotice.textContent = 'Attunement available [U]'
      this.upgradeNotice.style.opacity = String(0.5 + Math.sin(Date.now() * 0.004) * 0.3)
    } else {
      this.upgradeNotice.style.opacity = '0'
    }
  }

  showUpgradePanel(worldState: WorldState, weaponSystem: WeaponSystem): void {
    this._panelOpen = true
    this.upgradePanel.style.display = 'flex'

    const info = weaponSystem.getUpgradeInfo()
    const currentTier = worldState.gunTier
    const maxTier = 4

    let nextTierHTML = ''
    if (info) {
      const canAfford = info.canUpgrade
      nextTierHTML = `
        <div style="margin-top: 16px; padding: 12px; background: rgba(40,25,5,0.6); border: 1px solid #664422; border-radius: 4px;">
          <div style="font-size: 14px; color: #ccaa66;">
            Tier ${info.nextTier} — Cost: ${info.cost} XP
          </div>
          <div style="font-size: 12px; color: #998866; margin-top: 4px;">
            ${TIER_BONUSES[info.nextTier] || ''}
          </div>
          <button id="attune-btn" style="
            margin-top: 10px;
            padding: 8px 24px;
            background: ${canAfford ? 'rgba(200,150,50,0.3)' : 'rgba(80,60,30,0.3)'};
            border: 1px solid ${canAfford ? '#ffcc44' : '#665533'};
            color: ${canAfford ? '#ffcc44' : '#665533'};
            font-family: 'Courier New', monospace;
            font-size: 14px;
            cursor: ${canAfford ? 'pointer' : 'default'};
            border-radius: 4px;
            pointer-events: all;
          " ${canAfford ? '' : 'disabled'}>ATTUNE</button>
        </div>
      `
    } else {
      nextTierHTML = `
        <div style="margin-top: 16px; color: #998866; font-size: 13px;">
          Maximum attunement reached.
        </div>
      `
    }

    // Tier list
    let tierListHTML = ''
    for (let i = 0; i <= maxTier; i++) {
      const isCurrent = i === currentTier
      const isPast = i < currentTier
      const color = isCurrent ? '#ffcc44' : isPast ? '#88aa66' : '#665544'
      const marker = isCurrent ? '\u25B6 ' : isPast ? '\u2713 ' : '  '
      tierListHTML += `
        <div style="font-size: 12px; color: ${color}; margin: 3px 0;">
          ${marker}Tier ${i}: ${TIER_NAMES[i]} — ${TIER_BONUSES[i]}
        </div>
      `
    }

    this.upgradePanel.innerHTML = `
      <div style="
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(5,3,10,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background: rgba(20,12,5,0.95);
          border: 1px solid #664422;
          border-radius: 8px;
          padding: 28px 36px;
          max-width: 420px;
          width: 90%;
          font-family: 'Courier New', monospace;
          color: #ffcc44;
          pointer-events: all;
        ">
          <div style="font-size: 18px; text-align: center; letter-spacing: 0.15em; margin-bottom: 16px; text-shadow: 0 0 12px rgba(255,170,0,0.4);">
            RESONANCE ATTUNEMENT
          </div>
          <div style="font-size: 14px; color: #ccaa66; text-align: center;">
            Current: Tier ${currentTier} / ${maxTier}
          </div>
          <div style="font-size: 14px; color: #ccaa66; text-align: center; margin-top: 4px;">
            \u2726 ${worldState.playerXP} XP
          </div>
          <div style="margin-top: 16px; padding: 8px; background: rgba(30,18,8,0.6); border-radius: 4px;">
            ${tierListHTML}
          </div>
          ${nextTierHTML}
          <div style="text-align: center; margin-top: 16px;">
            <button id="close-upgrade-btn" style="
              padding: 6px 20px;
              background: rgba(60,40,20,0.4);
              border: 1px solid #554433;
              color: #998866;
              font-family: 'Courier New', monospace;
              font-size: 13px;
              cursor: pointer;
              border-radius: 4px;
              pointer-events: all;
            ">CLOSE [Esc]</button>
          </div>
        </div>
      </div>
    `

    // Wire button events
    const attuneBtn = this.upgradePanel.querySelector('#attune-btn') as HTMLButtonElement | null
    if (attuneBtn && !attuneBtn.disabled) {
      attuneBtn.addEventListener('click', () => {
        if (weaponSystem.upgrade()) {
          // Re-render the panel with updated state
          this.showUpgradePanel(worldState, weaponSystem)
        }
      })
    }

    const closeBtn = this.upgradePanel.querySelector('#close-upgrade-btn') as HTMLButtonElement | null
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideUpgradePanel()
      })
    }
  }

  hideUpgradePanel(): void {
    this._panelOpen = false
    this.upgradePanel.style.display = 'none'
    this.upgradePanel.innerHTML = ''
  }

  isUpgradePanelOpen(): boolean {
    return this._panelOpen
  }

  dispose(): void {
    this.container.remove()
    this.upgradeNotice.remove()
    this.upgradePanel.remove()
  }
}
