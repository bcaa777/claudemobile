import { defineComponent, Types } from 'bitecs'

// --- Transform ---
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
})

export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32,
})

export const Rotation = defineComponent({
  yaw: Types.f32,
  pitch: Types.f32,
})

// --- Health ---
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
})

// --- Rendering ---
export const Renderable = defineComponent({
  meshId: Types.ui32,
  visible: Types.ui8,
  scale: Types.f32,
})

// --- AI ---
export const AIState = defineComponent({
  behavior: Types.ui8,
  target: Types.ui32,
  timer: Types.f32,
})

// --- DNA (flat numeric fields for bitECS SoA layout) ---
export const DNAComponent = defineComponent({
  bodyLength: Types.f32,
  bodyWidth: Types.f32,
  bodyHeight: Types.f32,
  limbCount: Types.ui8,
  limbLength: Types.f32,
  limbThickness: Types.f32,
  speed: Types.f32,
  aggression: Types.f32,
  colorR: Types.f32,
  colorG: Types.f32,
  colorB: Types.f32,
  accentR: Types.f32,
  accentG: Types.f32,
  accentB: Types.f32,
  size: Types.f32,
  rarity: Types.ui8,
})

// --- Weapon ---
export const WeaponComponent = defineComponent({
  type: Types.ui16,
  cooldown: Types.f32,
  damage: Types.f32,
  range: Types.f32,
  level: Types.ui8,
})

// --- Tags (zero-size components for query filtering) ---
export const IsPlayer = defineComponent()
export const IsEnemy = defineComponent()
export const IsCompanion = defineComponent()
export const IsProjectile = defineComponent()
export const IsPickup = defineComponent()
