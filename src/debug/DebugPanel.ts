import * as THREE from 'three'
import { DayNightCycle } from '../lighting/DayNightCycle'
import { ColorGradePass } from '../postprocessing/ColorGradePass'
import { CRTPass } from '../postprocessing/CRTPass'
import { RetroPass } from '../postprocessing/RetroPass'
import { PerfOverlay } from './PerfOverlay'
import {
  PLAYER_CONFIG, POST_CONFIG, SPRITE_CONFIG,
  WORLD_CONFIG, TIME_CONFIG, BIOME_CONFIG, CREATURE_CONFIG,
  RENDER_CONFIG, LS_CONFIG_KEY,
} from '../config'

interface SavedLS {
  player?: Record<string, unknown>
  post?: Record<string, unknown>
  sprites?: Record<string, unknown>
  world?: Record<string, unknown>
  time?: Record<string, unknown>
  biome?: Record<string, unknown>
  creature?: Record<string, unknown>
  render?: Record<string, unknown>
  debug?: Record<string, unknown>
}

function readLS(): SavedLS {
  try { return JSON.parse(localStorage.getItem(LS_CONFIG_KEY) || '{}') } catch { return {} }
}

export class DebugPanel {
  private panel: HTMLDivElement
  private dayNight: DayNightCycle
  private flashlight: THREE.SpotLight
  private colorGrade: ColorGradePass
  private crt: CRTPass
  private retro: RetroPass
  private perfOverlay: PerfOverlay
  public isOpen = false

  constructor(
    dayNight: DayNightCycle,
    flashlight: THREE.SpotLight,
    colorGrade: ColorGradePass,
    crt: CRTPass,
    retro: RetroPass,
    perfOverlay: PerfOverlay,
  ) {
    this.dayNight = dayNight
    this.flashlight = flashlight
    this.colorGrade = colorGrade
    this.crt = crt
    this.retro = retro
    this.perfOverlay = perfOverlay

    // Restore saved debug state (lighting mults, playerLight)
    const saved = readLS()
    if (saved.debug) {
      const d = saved.debug
      if (typeof d.ambientMult === 'number') dayNight.ambientMult = d.ambientMult
      if (typeof d.sunMult === 'number')     dayNight.sunMult = d.sunMult
      if (typeof d.hemiMult === 'number')    dayNight.hemiMult = d.hemiMult
      if (typeof d.playerLightVisible === 'boolean') flashlight.visible = d.playerLightVisible
      if (typeof d.playerLightIntensity === 'number') flashlight.intensity = d.playerLightIntensity
      if (typeof d.playerLightDistance === 'number')  flashlight.distance  = d.playerLightDistance
    }

    // Apply saved POST_CONFIG values to shader uniforms immediately
    colorGrade.uniforms['contrast'].value         = POST_CONFIG.contrast
    colorGrade.uniforms['saturation'].value        = POST_CONFIG.saturation
    crt.uniforms['scanlineIntensity'].value        = POST_CONFIG.scanlineIntensity
    crt.uniforms['vignetteStrength'].value         = POST_CONFIG.vignetteStrength
    crt.uniforms['barrelDistortion'].value         = POST_CONFIG.barrelDistortion
    retro.uniforms['chromaStrength'].value         = POST_CONFIG.chromaStrength
    retro.uniforms['grainStrength'].value          = POST_CONFIG.grainStrength

    this.panel = this.buildHTML()
    document.getElementById('app')?.appendChild(this.panel)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'F3') { e.preventDefault(); this.toggle() }
    })
  }

  private toggle() {
    this.isOpen = !this.isOpen
    this.panel.style.display = this.isOpen ? 'block' : 'none'
  }

  private saveConfig() {
    const data: SavedLS = {
      player:  { ...PLAYER_CONFIG },
      post:    { ...POST_CONFIG },
      sprites: { ...SPRITE_CONFIG },
      world:   { ...WORLD_CONFIG },
      time:    { ...TIME_CONFIG },
      biome:   { ...BIOME_CONFIG },
      creature: { ...CREATURE_CONFIG },
      render:   { ...RENDER_CONFIG },
      debug: {
        ambientMult:          this.dayNight.ambientMult,
        sunMult:              this.dayNight.sunMult,
        hemiMult:             this.dayNight.hemiMult,
        playerLightVisible:   this.flashlight.visible,
        playerLightIntensity: this.flashlight.intensity,
        playerLightDistance:  this.flashlight.distance,
      },
    }
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(data))
  }

  private buildHTML(): HTMLDivElement {
    const { dayNight, flashlight, colorGrade, crt, retro } = this

    const panel = document.createElement('div')
    Object.assign(panel.style, {
      position: 'absolute',
      top: '10px',
      right: '10px',
      width: '240px',
      background: 'rgba(0,0,0,0.92)',
      color: '#ccc',
      font: '11px "Courier New", monospace',
      padding: '10px 12px 12px',
      border: '1px solid #3a3a3a',
      display: 'none',
      borderRadius: '4px',
      zIndex: '200',
      lineHeight: '1.4',
      maxHeight: '90vh',
      overflowY: 'auto',
    })

    const el = (tag: string, style?: Partial<CSSStyleDeclaration>, text?: string): HTMLElement => {
      const e = document.createElement(tag)
      if (style) Object.assign(e.style, style)
      if (text !== undefined) e.textContent = text
      return e
    }

    const section = (title: string) =>
      el('div', {
        color: '#7aabcc', margin: '10px 0 5px',
        borderTop: '1px solid #2a2a2a', paddingTop: '6px',
        letterSpacing: '1px', fontSize: '10px',
      }, title)

    const slider = (
      label: string,
      min: number, max: number, step: number, value: number,
      onChange: (v: number) => void,
      needsReload = false,
    ) => {
      const wrap = el('div', { marginBottom: '6px' })
      const row  = el('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' })
      const decimals = step < 0.1 ? 4 : step < 1 ? 2 : 0
      const lblEl = el('span', { color: needsReload ? '#cc9944' : '#ccc' }, label + (needsReload ? ' ↺' : ''))
      const valEl = el('span', { color: '#fff', minWidth: '40px', textAlign: 'right' }, value.toFixed(decimals))
      row.appendChild(lblEl); row.appendChild(valEl)

      const inp = document.createElement('input')
      inp.type = 'range'
      inp.min = String(min); inp.max = String(max); inp.step = String(step); inp.value = String(value)
      Object.assign(inp.style, { width: '100%', accentColor: needsReload ? '#c84' : '#6af', cursor: 'pointer' })
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value)
        valEl.textContent = v.toFixed(decimals)
        onChange(v)
        this.saveConfig()
      })

      wrap.appendChild(row); wrap.appendChild(inp)
      return wrap
    }

    const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const lbl = document.createElement('label')
      Object.assign(lbl.style, { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px', cursor: 'pointer' })
      const inp = document.createElement('input')
      inp.type = 'checkbox'; inp.checked = checked
      inp.addEventListener('change', () => { onChange(inp.checked); this.saveConfig() })
      lbl.appendChild(inp); lbl.appendChild(el('span', {}, label))
      return lbl
    }

    const btn = (text: string, bg: string, bgHover: string, color: string, borderColor: string) => {
      const b = document.createElement('button')
      b.textContent = text
      Object.assign(b.style, {
        display: 'block', width: '100%', marginTop: '6px', padding: '6px 0',
        background: bg, color, border: `1px solid ${borderColor}`,
        borderRadius: '3px', font: '11px "Courier New", monospace',
        cursor: 'pointer', letterSpacing: '1px',
      })
      b.addEventListener('mouseenter', () => { b.style.background = bgHover })
      b.addEventListener('mouseleave', () => { b.style.background = bg })
      return b
    }

    // ── Title ────────────────────────────────────────────────────────────────
    panel.appendChild(el('div', { color: '#555', textAlign: 'center', marginBottom: '2px', letterSpacing: '1px' }, '[ F3 ] DEBUG PANEL'))
    panel.appendChild(el('div', { color: '#383838', fontSize: '9px', textAlign: 'center', marginBottom: '2px' }, 'Esc = release cursor   M = map'))
    panel.appendChild(el('div', { color: '#665533', fontSize: '9px', textAlign: 'center', marginBottom: '4px' }, '↺ = requires Save & Reload'))

    // ── PERFORMANCE ──────────────────────────────────────────────────────────
    panel.appendChild(section('PERFORMANCE'))
    panel.appendChild(toggle('Perf Overlay', this.perfOverlay.getVisible(), v => { this.perfOverlay.setVisible(v) }))

    // ── LIGHTING ─────────────────────────────────────────────────────────────
    panel.appendChild(section('LIGHTING'))
    panel.appendChild(slider('Ambient ×', 0, 8,  0.1, dayNight.ambientMult, v => { dayNight.ambientMult = v }))
    panel.appendChild(slider('Sun ×',     0, 4,  0.1, dayNight.sunMult,     v => { dayNight.sunMult = v }))
    panel.appendChild(slider('Sky ×',     0, 6,  0.1, dayNight.hemiMult,    v => { dayNight.hemiMult = v }))

    // ── FLASHLIGHT ───────────────────────────────────────────────────────────
    panel.appendChild(section('FLASHLIGHT'))
    panel.appendChild(toggle('Enabled', flashlight.visible, v => { flashlight.visible = v }))
    panel.appendChild(slider('Intensity',  0,    12,   0.1,   flashlight.intensity, v => { flashlight.intensity = v }))
    panel.appendChild(slider('Distance',   0,    80,   1,     flashlight.distance,  v => { flashlight.distance = v }))
    panel.appendChild(slider('Angle °',    5,    90,   1,     flashlight.angle * 180 / Math.PI,
      v => { flashlight.angle = v * Math.PI / 180 }))
    panel.appendChild(slider('Penumbra',   0,    1,    0.05,  flashlight.penumbra,  v => { flashlight.penumbra = v }))

    // ── POST-PROCESSING ───────────────────────────────────────────────────────
    panel.appendChild(section('POST-PROCESSING'))
    panel.appendChild(slider('Contrast',   0.5, 2.0,  0.05, POST_CONFIG.contrast,
      v => { POST_CONFIG.contrast = v; colorGrade.uniforms['contrast'].value = v }))
    panel.appendChild(slider('Saturation', 0.0, 1.5,  0.05, POST_CONFIG.saturation,
      v => { POST_CONFIG.saturation = v; colorGrade.uniforms['saturation'].value = v }))
    panel.appendChild(slider('Scanlines',  0.0, 0.5,  0.01, POST_CONFIG.scanlineIntensity,
      v => { POST_CONFIG.scanlineIntensity = v; crt.uniforms['scanlineIntensity'].value = v }))
    panel.appendChild(slider('Vignette',   0.0, 1.0,  0.05, POST_CONFIG.vignetteStrength,
      v => { POST_CONFIG.vignetteStrength = v; crt.uniforms['vignetteStrength'].value = v }))
    panel.appendChild(slider('Barrel',     0.0, 0.3,  0.005, POST_CONFIG.barrelDistortion,
      v => { POST_CONFIG.barrelDistortion = v; crt.uniforms['barrelDistortion'].value = v }))
    panel.appendChild(slider('Chroma',     0.0, 0.02, 0.001, POST_CONFIG.chromaStrength,
      v => { POST_CONFIG.chromaStrength = v; retro.uniforms['chromaStrength'].value = v }))
    panel.appendChild(slider('Film grain', 0.0, 0.4,  0.01,  POST_CONFIG.grainStrength,
      v => { POST_CONFIG.grainStrength = v; retro.uniforms['grainStrength'].value = v }))
    panel.appendChild(slider('Pixel W',    160, 1280, 16,    POST_CONFIG.pixelWidth,
      v => { POST_CONFIG.pixelWidth = Math.round(v) }, true))
    panel.appendChild(slider('Pixel H',    120, 960,  16,    POST_CONFIG.pixelHeight,
      v => { POST_CONFIG.pixelHeight = Math.round(v) }, true))

    // ── PLAYER ───────────────────────────────────────────────────────────────
    panel.appendChild(section('PLAYER'))
    panel.appendChild(slider('Move speed',   1,  40,   0.5,    PLAYER_CONFIG.moveSpeed,
      v => { PLAYER_CONFIG.moveSpeed = v }))
    panel.appendChild(slider('Sprint speed', 5,  80,   0.5,    PLAYER_CONFIG.sprintSpeed,
      v => { PLAYER_CONFIG.sprintSpeed = v }))
    panel.appendChild(slider('Mouse sens',   0.0002, 0.006, 0.0001, PLAYER_CONFIG.mouseSensitivity,
      v => { PLAYER_CONFIG.mouseSensitivity = v }))
    panel.appendChild(slider('Jump speed',   2,  30,   0.5,    PLAYER_CONFIG.jumpSpeed,
      v => { PLAYER_CONFIG.jumpSpeed = v }))
    panel.appendChild(slider('Gravity',      5,  80,   0.5,    PLAYER_CONFIG.gravity,
      v => { PLAYER_CONFIG.gravity = v }))

    // ── TIME ─────────────────────────────────────────────────────────────────
    panel.appendChild(section('TIME'))
    panel.appendChild(slider('Day duration', 30, 3600, 10, TIME_CONFIG.dayDuration,
      v => { TIME_CONFIG.dayDuration = v }))
    panel.appendChild(slider('Start time',   0,  1,    0.01, TIME_CONFIG.startTime,
      v => { TIME_CONFIG.startTime = v }, true))

    // ── SPRITES ───────────────────────────────────────────────────────────────
    panel.appendChild(section('SPRITES'))
    panel.appendChild(slider('Density',     0,   1,   0.05, SPRITE_CONFIG.spawnDensity,
      v => { SPRITE_CONFIG.spawnDensity = v }, true))
    panel.appendChild(slider('Grid step',   1,   8,   0.1,  SPRITE_CONFIG.gridStep,
      v => { SPRITE_CONFIG.gridStep = v }, true))
    panel.appendChild(slider('Scale ×',     0.2, 4,   0.1,  SPRITE_CONFIG.globalScaleMultiplier,
      v => { SPRITE_CONFIG.globalScaleMultiplier = v }, true))
    panel.appendChild(slider('Variants',    1,   8,   1,    SPRITE_CONFIG.variants,
      v => { SPRITE_CONFIG.variants = Math.round(v) }, true))
    panel.appendChild(slider('Resolution',  16,  128, 16,   SPRITE_CONFIG.spriteResolution,
      v => { SPRITE_CONFIG.spriteResolution = Math.round(v) }, true))
    panel.appendChild(slider('Color var',   0,   0.4, 0.01, SPRITE_CONFIG.colorVariance,
      v => { SPRITE_CONFIG.colorVariance = v }, true))

    // ── ANIMALS ──────────────────────────────────────────────────────────────
    panel.appendChild(section('ANIMALS'))
    panel.appendChild(slider('Spawn ×',  0, 3,   0.1,  CREATURE_CONFIG.spawnMultiplier,
      v => { CREATURE_CONFIG.spawnMultiplier = v }, true))
    panel.appendChild(slider('Aggro ×',  0, 4,   0.1,  CREATURE_CONFIG.aggroRange,
      v => { CREATURE_CONFIG.aggroRange = v }))
    panel.appendChild(slider('Speed ×',  0, 4,   0.1,  CREATURE_CONFIG.speedMultiplier,
      v => { CREATURE_CONFIG.speedMultiplier = v }))

    // ── WORLD ────────────────────────────────────────────────────────────────
    panel.appendChild(section('WORLD'))
    panel.appendChild(slider('Draw dist ×', 1, 10,  0.5, RENDER_CONFIG.renderScale,
      v => { RENDER_CONFIG.renderScale = v }))
    panel.appendChild(slider('View radius', 1, 20,  1,   WORLD_CONFIG.viewRadius,
      v => { WORLD_CONFIG.viewRadius = Math.round(v) }, true))
    panel.appendChild(slider('Seed',        0, 999, 1,   WORLD_CONFIG.seed,
      v => { WORLD_CONFIG.seed = Math.round(v) }, true))
    panel.appendChild(slider('Biome size',  60, 400, 10, BIOME_CONFIG.seedSpacing,
      v => { BIOME_CONFIG.seedSpacing = v }, true))

    // ── SAVE & RELOAD ─────────────────────────────────────────────────────────
    const saveBtn = btn('SAVE & RELOAD', '#1a3a1a', '#2a5a2a', '#6f6', '#3a6a3a')
    saveBtn.addEventListener('click', () => { this.saveConfig(); window.location.reload() })
    panel.appendChild(saveBtn)

    const resetBtn = btn('RESET DEFAULTS', '#2a1a1a', '#4a2a2a', '#f66', '#6a3a3a')
    resetBtn.addEventListener('click', () => { localStorage.removeItem(LS_CONFIG_KEY); window.location.reload() })
    panel.appendChild(resetBtn)

    return panel
  }
}
