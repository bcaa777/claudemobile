export interface ThemePassConfig {
  type: string
  enabled: boolean
  params: Record<string, number | boolean>
}

export interface Theme {
  name: string
  internalResolution: [number, number]
  passes: ThemePassConfig[]
}

/** Retro PS1 theme — pixelation, CRT scanlines, chromatic aberration, god rays */
export const RETRO_PS1_THEME: Theme = {
  name: 'retro-ps1',
  internalResolution: [640, 480],
  passes: [
    { type: 'pixelate', enabled: true, params: {} },
    { type: 'colorGrade', enabled: true, params: { saturation: 0.8, contrast: 1.1 } },
    { type: 'godRays', enabled: true, params: { intensity: 0.6 } },
    { type: 'heatDistortion', enabled: true, params: { strength: 0.0 } },
    { type: 'crt', enabled: true, params: { scanlines: true, barrel: 0.03, vignette: 0.4 } },
    { type: 'underwater', enabled: true, params: { strength: 0.0 } },
    { type: 'damage', enabled: true, params: { strength: 0.0 } },
    { type: 'retro', enabled: true, params: { chromaticAberration: 0.003, filmGrain: 0.05 } },
  ],
}

/** Clean modern theme — no post-processing, full resolution */
export const CLEAN_MODERN_THEME: Theme = {
  name: 'clean-modern',
  internalResolution: [0, 0], // 0 = use native resolution
  passes: [],
}
