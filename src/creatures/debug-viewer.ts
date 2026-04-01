import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'
import { DNA_PRESETS, getPresetDNA } from './DNAPresets'
import { buildFromDNA, type MeshRefs } from './DNAMeshBuilder'
import { breedDNA } from './DNABreeding'

// ─── Scene setup ────────────────────────────────────────────────────────────

const wrap = document.getElementById('canvas-wrap')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(wrap.clientWidth, wrap.clientHeight)
renderer.setClearColor(0x1a1a2e)
wrap.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 100)
camera.position.set(3, 2, 4)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.5, 0)
controls.update()

scene.add(new THREE.AmbientLight(0x404060, 1.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 8, 3)
scene.add(dirLight)

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)
scene.add(new THREE.GridHelper(20, 20, 0x333355, 0x222244))

// ─── State ──────────────────────────────────────────────────────────────────

let currentDNA: CreatureDNA = { ...DNA_PRESETS['elk'], bodyColor: [...DNA_PRESETS['elk'].bodyColor] as [number,number,number], accentColor: [...DNA_PRESETS['elk'].accentColor] as [number,number,number] }
let creatureGroup = new THREE.Group()
scene.add(creatureGroup)

let parentA: CreatureDNA | null = null
let parentB: CreatureDNA | null = null
let currentRefs: MeshRefs | null = null
let animTime = 0
let animating = true

const rng = { next: () => Math.random() }

// ─── Controls UI ────────────────────────────────────────────────────────────

const panel = document.getElementById('controls')!

function rebuildMesh() {
  scene.remove(creatureGroup)
  creatureGroup = new THREE.Group()
  scene.add(creatureGroup)

  currentRefs = buildFromDNA(currentDNA, creatureGroup)
  animTime = 0

  const stats = dnaToStats(currentDNA)
  if (stats.mobility === 'air') {
    creatureGroup.position.y = 1.5
  } else {
    creatureGroup.position.y = stats.bodyH * 0.5 + (quantizeLegCount(currentDNA.legCount) > 0 ? stats.bodyH * (0.5 + currentDNA.legLength * 1.0) : 0)
  }

  updateStatsDisplay()
}

function updateStatsDisplay() {
  const stats = dnaToStats(currentDNA)
  const el = document.getElementById('stats')
  if (el) {
    el.textContent = [
      `Body Plan: ${currentDNA.bodyPlan}`,
      `Role: ${stats.role}`,
      `Mobility: ${stats.mobility}`,
      `Speed: ${stats.maxSpeed.toFixed(1)}`,
      `Scale: ${stats.adultScale.toFixed(2)}`,
      `Legs: ${quantizeLegCount(currentDNA.legCount)}`,
      `Eyes: ${quantizeEyeCount(currentDNA.eyeCount)}`,
      `Giant: ${stats.isGiant ? 'YES' : 'no'}`,
      `Max Age: ${stats.maxAge.toFixed(0)}`,
      `Hunger Cap: ${stats.maxHunger.toFixed(0)}`,
    ].join('\n')
  }
}

function addHTML(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  while (div.firstChild) panel.appendChild(div.firstChild)
}

// Preset dropdown
addHTML('<h2>Preset</h2>')
const presetSelect = document.createElement('select')
for (const name of Object.keys(DNA_PRESETS)) {
  const opt = document.createElement('option')
  opt.value = name
  opt.textContent = name
  presetSelect.appendChild(opt)
}
presetSelect.addEventListener('change', () => {
  currentDNA = getPresetDNA(presetSelect.value, rng)
  updateAllSliders()
  rebuildMesh()
})
panel.appendChild(presetSelect)

// Body plan buttons
addHTML('<h2>Body Plan</h2>')
const bodyPlans: CreatureDNA['bodyPlan'][] = ['quadruped', 'insectoid', 'avian', 'aquatic', 'serpentine']
const bpWrap = document.createElement('div')
bpWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:4px 0;'
for (const bp of bodyPlans) {
  const btn = document.createElement('button')
  btn.textContent = bp
  btn.style.cssText = 'width:auto;padding:4px 8px;font-size:11px;'
  btn.addEventListener('click', () => {
    currentDNA.bodyPlan = bp
    rebuildMesh()
  })
  bpWrap.appendChild(btn)
}
panel.appendChild(bpWrap)

// Gene sliders
type SliderEntry = { key: string; input: HTMLInputElement; valEl: HTMLElement }
const sliders: SliderEntry[] = []

function addSlider(section: string | null, key: string, label: string, min = 0, max = 1, step = 0.01) {
  if (section) addHTML(`<h2>${section}</h2>`)

  const wrap = document.createElement('label')
  const nameSpan = document.createElement('span')
  nameSpan.textContent = label
  const inp = document.createElement('input')
  inp.type = 'range'
  inp.min = String(min); inp.max = String(max); inp.step = String(step)

  const val = (currentDNA as unknown as Record<string, unknown>)[key]
  inp.value = String(typeof val === 'number' ? val : 0.5)

  const valEl = document.createElement('span')
  valEl.className = 'val'
  valEl.textContent = Number(inp.value).toFixed(2)

  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value)
    valEl.textContent = v.toFixed(2)
    ;(currentDNA as unknown as Record<string, unknown>)[key] = v
    rebuildMesh()
  })

  wrap.appendChild(nameSpan)
  wrap.appendChild(inp)
  wrap.appendChild(valEl)
  panel.appendChild(wrap)
  sliders.push({ key, input: inp, valEl })
}

function addColorSliders(section: string, key: 'bodyColor' | 'accentColor') {
  addHTML(`<h2>${section}</h2>`)
  for (let ch = 0; ch < 3; ch++) {
    const chName = ['R', 'G', 'B'][ch]
    const wrap = document.createElement('label')
    const nameSpan = document.createElement('span')
    nameSpan.textContent = chName
    const inp = document.createElement('input')
    inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.01'
    inp.value = String(currentDNA[key][ch])
    const valEl = document.createElement('span')
    valEl.className = 'val'
    valEl.textContent = Number(inp.value).toFixed(2)

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value)
      valEl.textContent = v.toFixed(2)
      currentDNA[key][ch] = v
      rebuildMesh()
    })

    wrap.appendChild(nameSpan); wrap.appendChild(inp); wrap.appendChild(valEl)
    panel.appendChild(wrap)
    sliders.push({ key: `${key}.${ch}`, input: inp, valEl })
  }
}

addSlider('Morphology', 'bodyLength', 'Body Length')
addSlider(null, 'bodyWidth', 'Body Width')
addSlider(null, 'bodyHeight', 'Body Height')
addSlider(null, 'headSize', 'Head Size')
addSlider(null, 'neckLength', 'Neck Length')

addSlider('Limbs', 'legCount', 'Leg Count')
addSlider(null, 'legLength', 'Leg Length')
addSlider(null, 'legThickness', 'Leg Thickness')

addSlider('Appendages', 'hasWings', 'Wings')
addSlider(null, 'wingSpan', 'Wing Span')
addSlider(null, 'hasTail', 'Tail')
addSlider(null, 'tailLength', 'Tail Length')
addSlider(null, 'hasHorns', 'Horns')
addSlider(null, 'hornSize', 'Horn Size')
addSlider(null, 'hasClaws', 'Claws')
addSlider(null, 'clawSize', 'Claw Size')
addSlider(null, 'hasMandibles', 'Mandibles')
addSlider(null, 'hasFins', 'Fins')
addSlider(null, 'finSize', 'Fin Size')
addSlider(null, 'hasAntennae', 'Antennae')

addSlider('Eyes', 'eyeSize', 'Eye Size')
addSlider(null, 'eyeCount', 'Eye Count')

addSlider('Behavior', 'speed', 'Speed')
addSlider(null, 'aggression', 'Aggression')
addSlider(null, 'size', 'Size')

addColorSliders('Body Color', 'bodyColor')
addColorSliders('Accent Color', 'accentColor')

addHTML('<h2>Derived Stats</h2>')
addHTML('<div id="stats"></div>')

// Mutate button
addHTML('<h2>Actions</h2>')
const mutateBtn = document.createElement('button')
mutateBtn.textContent = 'Mutate'
mutateBtn.addEventListener('click', () => {
  const keys = ['bodyLength','bodyWidth','bodyHeight','headSize','neckLength','legCount','legLength','legThickness','hasWings','wingSpan','hasTail','tailLength','hasHorns','hornSize','hasClaws','clawSize','hasMandibles','hasFins','finSize','hasAntennae','eyeSize','eyeCount','speed','aggression','size']
  for (const k of keys) {
    if (Math.random() < 0.15) {
      const cur = (currentDNA as unknown as Record<string, number>)[k]
      ;(currentDNA as unknown as Record<string, unknown>)[k] = Math.max(0, Math.min(1, cur + (Math.random() - 0.5) * 0.3))
    }
  }
  for (let ch = 0; ch < 3; ch++) {
    if (Math.random() < 0.15) currentDNA.bodyColor[ch] = Math.max(0, Math.min(1, currentDNA.bodyColor[ch] + (Math.random() - 0.5) * 0.2))
    if (Math.random() < 0.15) currentDNA.accentColor[ch] = Math.max(0, Math.min(1, currentDNA.accentColor[ch] + (Math.random() - 0.5) * 0.2))
  }
  updateAllSliders()
  rebuildMesh()
})
panel.appendChild(mutateBtn)

const animBtn = document.createElement('button')
animBtn.textContent = 'Pause Animation'
animBtn.addEventListener('click', () => {
  animating = !animating
  animBtn.textContent = animating ? 'Pause Animation' : 'Play Animation'
})
panel.appendChild(animBtn)

// Breed section
addHTML('<h2>Breeding</h2>')
const saveABtn = document.createElement('button')
saveABtn.textContent = 'Save as Parent A'
saveABtn.addEventListener('click', () => {
  parentA = JSON.parse(JSON.stringify(currentDNA))
  saveABtn.textContent = `Parent A: ${currentDNA.bodyPlan} (saved)`
})
panel.appendChild(saveABtn)

const saveBBtn = document.createElement('button')
saveBBtn.textContent = 'Save as Parent B'
saveBBtn.addEventListener('click', () => {
  parentB = JSON.parse(JSON.stringify(currentDNA))
  saveBBtn.textContent = `Parent B: ${currentDNA.bodyPlan} (saved)`
})
panel.appendChild(saveBBtn)

const breedBtn = document.createElement('button')
breedBtn.className = 'breed'
breedBtn.textContent = 'Breed A + B'
breedBtn.addEventListener('click', () => {
  if (!parentA || !parentB) { breedBtn.textContent = 'Save both parents first!'; return }
  const child = breedDNA(parentA, parentB)
  if (!child) { breedBtn.textContent = 'Cross-body breeding failed — try again'; return }
  currentDNA = child
  updateAllSliders()
  rebuildMesh()
  breedBtn.textContent = 'Breed A + B'
})
panel.appendChild(breedBtn)

// Slider sync
function updateAllSliders() {
  for (const s of sliders) {
    if (s.key.includes('.')) {
      const [colorKey, chStr] = s.key.split('.')
      const ch = parseInt(chStr)
      const arr = currentDNA[colorKey as 'bodyColor' | 'accentColor']
      s.input.value = String(arr[ch])
      s.valEl.textContent = arr[ch].toFixed(2)
    } else {
      const v = (currentDNA as unknown as Record<string, unknown>)[s.key]
      if (typeof v === 'number') {
        s.input.value = String(v)
        s.valEl.textContent = v.toFixed(2)
      }
    }
  }
}

// ─── Render loop with animation ─────────────────────────────────────────

let lastTime = performance.now()

function animate() {
  requestAnimationFrame(animate)

  const now = performance.now()
  const delta = (now - lastTime) / 1000
  lastTime = now

  if (animating && currentRefs) {
    animTime += delta
    const stats = dnaToStats(currentDNA)

    // Idle body bob
    creatureGroup.rotation.x = Math.sin(animTime * 1.2) * 0.01
    creatureGroup.rotation.z = Math.sin(animTime * 0.8 + 1) * 0.008

    // Leg walk cycle
    if (stats.mobility === 'ground' && currentRefs.legs.length >= 2) {
      const freq = 3.0
      const amp = 0.45
      const sinVal = Math.sin(animTime * freq) * amp
      for (let i = 0; i < currentRefs.legs.length; i++) {
        currentRefs.legs[i].rotation.x = sinVal * (i % 2 === 0 ? 1 : -1)
      }
    }

    // Wing flap
    if (currentRefs.wings.length >= 2) {
      const flapSpeed = currentDNA.size > 0.6 ? 2.5 : 5.0
      const flapAmp = currentDNA.size > 0.6 ? 0.4 : 0.6
      const angle = Math.sin(animTime * flapSpeed) * flapAmp
      currentRefs.wings[0].rotation.z = angle
      currentRefs.wings[1].rotation.z = -angle
    }

    // Tail wag
    if (currentRefs.tail) {
      currentRefs.tail.rotation.y = Math.sin(animTime * 2.0) * 0.35
    }
  }

  controls.update()
  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(wrap.clientWidth, wrap.clientHeight)
})

rebuildMesh()
animate()
