import { FieldGuide, SpeciesEntry, KnowledgeTier } from './FieldGuide'
import { BodyPlan } from '../creatures/CreatureDNA'
import { getRarityColor } from '../creatures/CreatureVariant'
import { scoreToStars } from '../camera/PhotoScoring'

const BODY_PLAN_TABS: BodyPlan[] = ['quadruped', 'insectoid', 'avian', 'aquatic', 'serpentine']
const TAB_LABELS: Record<BodyPlan, string> = {
  quadruped: 'Quadrupeds',
  insectoid: 'Insectoids',
  avian: 'Avians',
  aquatic: 'Aquatic',
  serpentine: 'Serpentine',
}
const TIER_LABELS: Record<KnowledgeTier, string> = {
  0: '???',
  1: 'Silhouette',
  2: 'Documented',
  3: 'Studied',
  4: 'Mastered',
}
const BG = 'rgba(10,10,15,0.94)'
const TEXT = '#d4a574'
const DIM = '#666'

export class FieldGuideOverlay {
  private container: HTMLDivElement
  private fieldGuide: FieldGuide
  private visible = false
  private activeTab: BodyPlan = 'quadruped'
  private scrollOffset = 0

  constructor(fieldGuide: FieldGuide) {
    this.fieldGuide = fieldGuide

    this.container = document.createElement('div')
    this.container.style.cssText = `position:fixed; inset:0; z-index:200; display:none; background:${BG}; font-family:monospace; color:${TEXT}; overflow:hidden;`

    const appEl = document.getElementById('app')
    if (appEl) {
      appEl.appendChild(this.container)
    } else {
      document.body.appendChild(this.container)
    }

    window.addEventListener('keydown', this.handleKeyDown)
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyN') {
      this.visible = !this.visible
      this.container.style.display = this.visible ? 'flex' : 'none'
      if (this.visible) {
        this.container.style.flexDirection = 'column'
        this.render()
      }
      return
    }

    if (!this.visible) return

    if (e.code === 'ArrowRight' || e.code === 'Tab') {
      e.preventDefault()
      const idx = BODY_PLAN_TABS.indexOf(this.activeTab)
      this.activeTab = BODY_PLAN_TABS[(idx + 1) % BODY_PLAN_TABS.length]
      this.scrollOffset = 0
      this.render()
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault()
      const idx = BODY_PLAN_TABS.indexOf(this.activeTab)
      this.activeTab = BODY_PLAN_TABS[(idx - 1 + BODY_PLAN_TABS.length) % BODY_PLAN_TABS.length]
      this.scrollOffset = 0
      this.render()
    } else if (e.code === 'ArrowDown') {
      e.preventDefault()
      this.scrollOffset += 40
      this.render()
    } else if (e.code === 'ArrowUp') {
      e.preventDefault()
      this.scrollOffset = Math.max(0, this.scrollOffset - 40)
      this.render()
    }
  }

  isOpen(): boolean {
    return this.visible
  }

  private render(): void {
    const counts = this.fieldGuide.getCountByBodyPlan()

    // Tab bar
    const tabsHtml = BODY_PLAN_TABS.map(plan => {
      const isActive = plan === this.activeTab
      const color = isActive ? TEXT : DIM
      const borderBottom = isActive ? `border-bottom:2px solid ${TEXT};` : 'border-bottom:2px solid transparent;'
      return `<div style="padding:8px 16px; cursor:pointer; color:${color}; font-size:11px; letter-spacing:1px; text-transform:uppercase; ${borderBottom}">${TAB_LABELS[plan]} (${counts[plan]})</div>`
    }).join('')

    const tabBar = `<div style="display:flex; border-bottom:1px solid ${DIM}; flex-shrink:0;">${tabsHtml}</div>`

    // Title bar
    const titleBar = `<div style="padding:6px 16px; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:${DIM}; border-bottom:1px solid ${DIM}; flex-shrink:0;">FIELD GUIDE — Press [N] to close — Arrow keys to navigate</div>`

    // Species list
    const entries = this.fieldGuide.getEntriesForBodyPlan(this.activeTab)
    let entriesHtml: string
    if (entries.length === 0) {
      entriesHtml = `<div style="padding:24px 16px; color:${DIM}; font-size:12px;">No ${TAB_LABELS[this.activeTab]} discovered yet.</div>`
    } else {
      entriesHtml = entries.map(e => this.renderEntry(e)).join('')
    }

    const scrollContainer = `<div style="flex:1; overflow:hidden; position:relative;"><div style="position:absolute; top:-${this.scrollOffset}px; left:0; right:0; padding:8px 16px;">${entriesHtml}</div></div>`

    this.container.innerHTML = tabBar + titleBar + scrollContainer
  }

  private renderEntry(entry: SpeciesEntry): string {
    if (entry.tier <= 1) {
      return `<div style="border:1px solid ${DIM}; margin:4px 0; padding:8px; opacity:0.5;">
        <span style="color:${DIM}; font-size:12px;">??? — ${entry.bodyPlan}</span>
      </div>`
    }

    // Tier 2+: name, rarity, tier label, star rating
    const rarityColor = getRarityColor(entry.rarityTier)
    const tierLabel = TIER_LABELS[entry.tier]

    const starCount = scoreToStars(entry.bestScore)
    const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount)

    let extraHtml = ''

    // Tier 3+: behaviors photographed
    if (entry.tier >= 3) {
      const behaviors = Array.from(entry.behaviorsPhotographed).join(', ')
      extraHtml += `<div style="font-size:9px; color:${DIM}; margin-top:4px; letter-spacing:1px;">BEHAVIORS: ${behaviors}</div>`
    }

    // Tier 4: ecological tools unlocked
    if (entry.tier >= 4) {
      extraHtml += `<div style="font-size:9px; color:#9c27b0; margin-top:4px; letter-spacing:1px; text-transform:uppercase;">ECOLOGICAL TOOLS UNLOCKED</div>`
    }

    return `<div style="border:1px solid ${DIM}; margin:4px 0; padding:8px;">
      <div style="font-size:12px; letter-spacing:1px;">${entry.species}</div>
      <div style="font-size:9px; color:${DIM}; margin-top:4px; letter-spacing:1px;">
        <span style="color:${rarityColor};">${entry.rarityTier.toUpperCase()}</span>
        &nbsp;|&nbsp;<span style="color:${TEXT};">${tierLabel.toUpperCase()}</span>
        &nbsp;|&nbsp;<span style="color:${TEXT};">${stars}</span>
      </div>
      ${extraHtml}
    </div>`
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    this.container.remove()
  }
}
