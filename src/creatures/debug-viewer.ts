import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'
import { DNA_PRESETS, getPresetDNA } from './DNAPresets'
import { buildFromDNA, animateLeg, animateInsectLeg, type MeshRefs } from './DNAMeshBuilder'
import { breedDNA } from './DNABreeding'

// ─── Scene setup ────────────────────────────────────────────────────────────

const wrap = document.getElementById('canvas-wrap')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(wrap.clientWidth, wrap.clientHeight)
renderer.setClearColor(0x1a1a2e)
wrap.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 200)
camera.position.set(12, 10, 15)

const orbitControls = new OrbitControls(camera, renderer.domElement)
orbitControls.target.set(0, 0.5, 0)
orbitControls.update()

scene.add(new THREE.AmbientLight(0x404060, 1.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 8, 3)
scene.add(dirLight)

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)
scene.add(new THREE.GridHelper(40, 40, 0x333355, 0x222244))

// ─── Shared state ───────────────────────────────────────────────────────────

const rng = { next: () => Math.random() }
let animTime = 0
let animating = true
let mode: 'editor' | 'simulation' = 'editor'

// ─── Editor mode state ─────────────────────────────────────────────────────

let currentDNA: CreatureDNA = { ...DNA_PRESETS['elk'], bodyColor: [...DNA_PRESETS['elk'].bodyColor] as [number, number, number], accentColor: [...DNA_PRESETS['elk'].accentColor] as [number, number, number] }
let editorGroup = new THREE.Group()
scene.add(editorGroup)
let editorRefs: MeshRefs | null = null
let parentA: CreatureDNA | null = null
let parentB: CreatureDNA | null = null

// ─── Simulation mode state ──────────────────────────────────────────────────

const ARENA_SIZE = 16  // half-extent of the walking area
let MAX_POP = 50
const BREED_INTERVAL_BASE = 4  // seconds between breed attempts (at 1x speed)
const DEATH_AGE = 60  // seconds until creature dies (at 1x speed)

interface SimCreature {
  dna: CreatureDNA
  group: THREE.Group
  refs: MeshRefs
  pos: THREE.Vector2       // XZ position
  heading: number          // radians
  targetPos: THREE.Vector2 // wander target
  speed: number
  age: number              // sim seconds alive
  generation: number
  breedCooldown: number
}

let simCreatures: SimCreature[] = []
let simTime = 0
let simSpeed = 1
let simGeneration = 0
let simTotalBorn = 0
let simRunning = false
let simStatsEl: HTMLElement | null = null

function cloneDNA(d: CreatureDNA): CreatureDNA {
  return { ...d, bodyColor: [...d.bodyColor] as [number, number, number], accentColor: [...d.accentColor] as [number, number, number] }
}

function randomArenaPos(): THREE.Vector2 {
  return new THREE.Vector2((Math.random() - 0.5) * ARENA_SIZE * 2, (Math.random() - 0.5) * ARENA_SIZE * 2)
}

function spawnSimCreature(dna: CreatureDNA, gen: number): SimCreature {
  const group = new THREE.Group()
  const refs = buildFromDNA(dna, group)
  const stats = dnaToStats(dna)
  const pos = randomArenaPos()

  // Position creature in world
  const legH = quantizeLegCount(dna.legCount) > 0 ? stats.bodyH * (0.5 + dna.legLength * 1.0) : 0
  const yPos = stats.mobility === 'air' ? 2.0 : stats.bodyH * 0.5 + legH
  group.position.set(pos.x, yPos, pos.y)
  group.scale.setScalar(Math.min(stats.adultScale, 1.5))  // cap scale for visibility

  scene.add(group)

  return {
    dna, group, refs, pos,
    heading: Math.random() * Math.PI * 2,
    targetPos: randomArenaPos(),
    speed: stats.maxSpeed * 0.3,  // slow wander speed
    age: 0,
    generation: gen,
    breedCooldown: BREED_INTERVAL_BASE * (0.5 + Math.random()),
  }
}

function removeSimCreature(idx: number) {
  scene.remove(simCreatures[idx].group)
  simCreatures.splice(idx, 1)
}

function initSimulation() {
  // Clear existing
  for (const c of simCreatures) scene.remove(c.group)
  simCreatures = []
  simTime = 0
  simGeneration = 0
  simTotalBorn = 0

  // Spawn initial population
  const startCount = parseInt(spawnInp?.value ?? '20') || 20
  const presetNames = Object.keys(DNA_PRESETS)
  for (let i = 0; i < startCount; i++) {
    const name = presetNames[Math.floor(Math.random() * presetNames.length)]
    const dna = getPresetDNA(name, rng)
    simCreatures.push(spawnSimCreature(dna, 0))
    simTotalBorn++
  }
}

function updateSimulation(delta: number) {
  if (!simRunning) return
  const dt = delta * simSpeed

  simTime += dt

  // Update each creature
  for (let i = simCreatures.length - 1; i >= 0; i--) {
    const c = simCreatures[i]
    c.age += dt
    c.breedCooldown -= dt

    // Death by age
    if (c.age > DEATH_AGE) {
      removeSimCreature(i)
      continue
    }

    // Wander toward target
    const dx = c.targetPos.x - c.pos.x
    const dz = c.targetPos.y - c.pos.y
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 1) {
      // Pick new wander target
      c.targetPos = randomArenaPos()
    } else {
      // Move toward target
      const moveSpeed = c.speed * dt
      c.pos.x += (dx / dist) * moveSpeed
      c.pos.y += (dz / dist) * moveSpeed
      c.heading = Math.atan2(dx, dz)

      // Clamp to arena
      c.pos.x = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, c.pos.x))
      c.pos.y = Math.max(-ARENA_SIZE, Math.min(ARENA_SIZE, c.pos.y))
    }

    // Update visual position
    c.group.position.x = c.pos.x
    c.group.position.z = c.pos.y
    c.group.rotation.y = c.heading

    // Animate
    const isInsect = c.dna.bodyPlan === 'insectoid'
    const moving = dist > 1
    if (moving && c.refs.legs.length >= 2) {
      const freq = 3.0
      const amp = 0.4
      const sinVal = Math.sin(animTime * freq + i * 1.7) * amp  // phase offset per creature
      for (let l = 0; l < c.refs.legs.length; l++) {
        const rot = sinVal * (l % 2 === 0 ? 1 : -1)
        if (isInsect) animateInsectLeg(c.refs.legs[l], rot)
        else animateLeg(c.refs.legs[l], rot)
      }
    }
    if (c.refs.wings.length >= 2) {
      const flapSpeed = c.dna.size > 0.6 ? 2.5 : 5.0
      const angle = Math.sin(animTime * flapSpeed + i) * 0.5
      c.refs.wings[0].rotation.z = angle
      c.refs.wings[1].rotation.z = -angle
    }
    if (c.refs.tail) {
      c.refs.tail.rotation.y = Math.sin(animTime * 2.0 + i * 0.5) * 0.3
    }
  }

  // Breeding: find nearby pairs
  if (simCreatures.length < MAX_POP) {
    for (let i = 0; i < simCreatures.length; i++) {
      const a = simCreatures[i]
      if (a.breedCooldown > 0 || a.age < 5) continue  // min age 5s to breed

      for (let j = i + 1; j < simCreatures.length; j++) {
        const b = simCreatures[j]
        if (b.breedCooldown > 0 || b.age < 5) continue

        const bDist = Math.sqrt((a.pos.x - b.pos.x) ** 2 + (a.pos.y - b.pos.y) ** 2)
        if (bDist > 4) continue  // must be close

        // Try to breed
        const childDna = breedDNA(a.dna, b.dna)
        if (childDna) {
          const childGen = Math.max(a.generation, b.generation) + 1
          if (childGen > simGeneration) simGeneration = childGen
          const child = spawnSimCreature(childDna, childGen)
          // Spawn near parents
          child.pos.x = (a.pos.x + b.pos.x) / 2 + (Math.random() - 0.5) * 2
          child.pos.y = (a.pos.y + b.pos.y) / 2 + (Math.random() - 0.5) * 2
          child.group.position.x = child.pos.x
          child.group.position.z = child.pos.y
          simCreatures.push(child)
          simTotalBorn++
        }

        a.breedCooldown = BREED_INTERVAL_BASE
        b.breedCooldown = BREED_INTERVAL_BASE
        break  // one breed attempt per creature per tick
      }
    }
  }

  // Update stats display
  if (simStatsEl) {
    const bodyPlanCounts: Record<string, number> = {}
    for (const c of simCreatures) {
      bodyPlanCounts[c.dna.bodyPlan] = (bodyPlanCounts[c.dna.bodyPlan] ?? 0) + 1
    }
    const planStr = Object.entries(bodyPlanCounts).map(([k, v]) => `${k}: ${v}`).join(', ')
    simStatsEl.textContent = [
      `Time: ${simTime.toFixed(0)}s (${simSpeed}x)`,
      `Population: ${simCreatures.length}/${MAX_POP}`,
      `Generation: ${simGeneration}`,
      `Total born: ${simTotalBorn}`,
      `Body plans: ${planStr}`,
    ].join('\n')
  }
}

// ─── Controls UI ────────────────────────────────────────────────────────────

const panel = document.getElementById('controls')!

function addHTML(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  while (div.firstChild) panel.appendChild(div.firstChild)
}

// ── Mode tabs ───────────────────────────────────────────────────────────

addHTML('<h2>Mode</h2>')
const modeWrap = document.createElement('div')
modeWrap.style.cssText = 'display:flex;gap:4px;margin:4px 0;'

const editorBtn = document.createElement('button')
editorBtn.textContent = 'Editor'
editorBtn.style.cssText = 'width:auto;padding:6px 12px;background:#2a5276;'

const simBtn = document.createElement('button')
simBtn.textContent = 'Simulation'
simBtn.style.cssText = 'width:auto;padding:6px 12px;'

function switchMode(newMode: 'editor' | 'simulation') {
  mode = newMode
  editorBtn.style.background = mode === 'editor' ? '#2a5276' : '#0f3460'
  simBtn.style.background = mode === 'simulation' ? '#2a5276' : '#0f3460'

  // Toggle visibility
  editorPanel.style.display = mode === 'editor' ? 'block' : 'none'
  simPanel.style.display = mode === 'simulation' ? 'block' : 'none'
  editorGroup.visible = mode === 'editor'

  if (mode === 'simulation' && simCreatures.length === 0) {
    initSimulation()
    simRunning = true
  }
  if (mode === 'editor') {
    simRunning = false
  }

  // Adjust camera
  if (mode === 'simulation') {
    camera.position.set(0, 25, 25)
    orbitControls.target.set(0, 0, 0)
  } else {
    camera.position.set(3, 2, 4)
    orbitControls.target.set(0, 0.5, 0)
  }
  orbitControls.update()
}

editorBtn.addEventListener('click', () => switchMode('editor'))
simBtn.addEventListener('click', () => switchMode('simulation'))
modeWrap.appendChild(editorBtn)
modeWrap.appendChild(simBtn)
panel.appendChild(modeWrap)

// ── Editor panel ────────────────────────────────────────────────────────

const editorPanel = document.createElement('div')
panel.appendChild(editorPanel)

const simPanel = document.createElement('div')
simPanel.style.display = 'none'
panel.appendChild(simPanel)

// Helper to add to editor panel
function addEditorHTML(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  while (div.firstChild) editorPanel.appendChild(div.firstChild)
}

function addEditorEl(el: HTMLElement) {
  editorPanel.appendChild(el)
}

// Helper to add to sim panel
function addSimHTML(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  while (div.firstChild) simPanel.appendChild(div.firstChild)
}

function addSimEl(el: HTMLElement) {
  simPanel.appendChild(el)
}

// ── Editor controls (same as before, but appended to editorPanel) ───────

type SliderEntry = { key: string; input: HTMLInputElement; valEl: HTMLElement }
const sliders: SliderEntry[] = []

function rebuildMesh() {
  while (editorGroup.children.length) editorGroup.remove(editorGroup.children[0])
  editorRefs = buildFromDNA(currentDNA, editorGroup)
  animTime = 0

  const stats = dnaToStats(currentDNA)
  if (stats.mobility === 'air') {
    editorGroup.position.y = 1.5
  } else {
    editorGroup.position.y = stats.bodyH * 0.5 + (quantizeLegCount(currentDNA.legCount) > 0 ? stats.bodyH * (0.5 + currentDNA.legLength * 1.0) : 0)
  }
  editorGroup.position.x = 0
  editorGroup.position.z = 0
  updateStatsDisplay()
}

function updateStatsDisplay() {
  const stats = dnaToStats(currentDNA)
  const el = document.getElementById('editor-stats')
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
    ].join('\n')
  }
}

// Preset dropdown
addEditorHTML('<h2>Preset</h2>')
const presetSelect = document.createElement('select')
for (const name of Object.keys(DNA_PRESETS)) {
  const opt = document.createElement('option')
  opt.value = name; opt.textContent = name
  presetSelect.appendChild(opt)
}
presetSelect.addEventListener('change', () => { currentDNA = getPresetDNA(presetSelect.value, rng); updateAllSliders(); rebuildMesh() })
addEditorEl(presetSelect)

// Body plan buttons
addEditorHTML('<h2>Body Plan</h2>')
const bpWrap = document.createElement('div')
bpWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:4px 0;'
for (const bp of ['quadruped', 'insectoid', 'avian', 'aquatic', 'serpentine'] as CreatureDNA['bodyPlan'][]) {
  const btn = document.createElement('button')
  btn.textContent = bp; btn.style.cssText = 'width:auto;padding:4px 8px;font-size:11px;'
  btn.addEventListener('click', () => { currentDNA.bodyPlan = bp; rebuildMesh() })
  bpWrap.appendChild(btn)
}
addEditorEl(bpWrap)

function addSlider(section: string | null, key: string, label: string, min = 0, max = 1, step = 0.01) {
  if (section) addEditorHTML(`<h2>${section}</h2>`)
  const wrap = document.createElement('label')
  const nameSpan = document.createElement('span'); nameSpan.textContent = label
  const inp = document.createElement('input'); inp.type = 'range'
  inp.min = String(min); inp.max = String(max); inp.step = String(step)
  const val = (currentDNA as unknown as Record<string, unknown>)[key]
  inp.value = String(typeof val === 'number' ? val : 0.5)
  const valEl = document.createElement('span'); valEl.className = 'val'
  valEl.textContent = Number(inp.value).toFixed(2)
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value); valEl.textContent = v.toFixed(2)
    ;(currentDNA as unknown as Record<string, unknown>)[key] = v; rebuildMesh()
  })
  wrap.appendChild(nameSpan); wrap.appendChild(inp); wrap.appendChild(valEl)
  addEditorEl(wrap)
  sliders.push({ key, input: inp, valEl })
}

function addColorSliders(section: string, key: 'bodyColor' | 'accentColor') {
  addEditorHTML(`<h2>${section}</h2>`)
  for (let ch = 0; ch < 3; ch++) {
    const chName = ['R', 'G', 'B'][ch]
    const wrap = document.createElement('label')
    const nameSpan = document.createElement('span'); nameSpan.textContent = chName
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.01'
    inp.value = String(currentDNA[key][ch])
    const valEl = document.createElement('span'); valEl.className = 'val'; valEl.textContent = Number(inp.value).toFixed(2)
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value); valEl.textContent = v.toFixed(2)
      currentDNA[key][ch] = v; rebuildMesh()
    })
    wrap.appendChild(nameSpan); wrap.appendChild(inp); wrap.appendChild(valEl)
    addEditorEl(wrap)
    sliders.push({ key: `${key}.${ch}`, input: inp, valEl })
  }
}

addSlider('Morphology', 'bodyLength', 'Body Length'); addSlider(null, 'bodyWidth', 'Body Width')
addSlider(null, 'bodyHeight', 'Body Height'); addSlider(null, 'headSize', 'Head Size'); addSlider(null, 'neckLength', 'Neck Length')
addSlider('Limbs', 'legCount', 'Leg Count'); addSlider(null, 'legLength', 'Leg Length'); addSlider(null, 'legThickness', 'Leg Thickness')
addSlider('Appendages', 'hasWings', 'Wings'); addSlider(null, 'wingSpan', 'Wing Span')
addSlider(null, 'hasTail', 'Tail'); addSlider(null, 'tailLength', 'Tail Length')
addSlider(null, 'hasHorns', 'Horns'); addSlider(null, 'hornSize', 'Horn Size')
addSlider(null, 'hasClaws', 'Claws'); addSlider(null, 'clawSize', 'Claw Size')
addSlider(null, 'hasMandibles', 'Mandibles'); addSlider(null, 'hasFins', 'Fins'); addSlider(null, 'finSize', 'Fin Size'); addSlider(null, 'hasAntennae', 'Antennae')
addSlider('Eyes', 'eyeSize', 'Eye Size'); addSlider(null, 'eyeCount', 'Eye Count')
addSlider('Behavior', 'speed', 'Speed'); addSlider(null, 'aggression', 'Aggression'); addSlider(null, 'size', 'Size')
addColorSliders('Body Color', 'bodyColor'); addColorSliders('Accent Color', 'accentColor')
addEditorHTML('<h2>Derived Stats</h2>'); addEditorHTML('<div id="editor-stats" style="font-size:10px;color:#888;white-space:pre;line-height:1.4;"></div>')

// Editor actions
addEditorHTML('<h2>Actions</h2>')
const mutateBtn = document.createElement('button'); mutateBtn.textContent = 'Mutate'
mutateBtn.addEventListener('click', () => {
  const keys = ['bodyLength','bodyWidth','bodyHeight','headSize','neckLength','legCount','legLength','legThickness','hasWings','wingSpan','hasTail','tailLength','hasHorns','hornSize','hasClaws','clawSize','hasMandibles','hasFins','finSize','hasAntennae','eyeSize','eyeCount','speed','aggression','size']
  for (const k of keys) { if (Math.random() < 0.15) { const cur = (currentDNA as unknown as Record<string, number>)[k]; (currentDNA as unknown as Record<string, unknown>)[k] = Math.max(0, Math.min(1, cur + (Math.random() - 0.5) * 0.3)) } }
  for (let ch = 0; ch < 3; ch++) { if (Math.random() < 0.15) currentDNA.bodyColor[ch] = Math.max(0, Math.min(1, currentDNA.bodyColor[ch] + (Math.random() - 0.5) * 0.2)); if (Math.random() < 0.15) currentDNA.accentColor[ch] = Math.max(0, Math.min(1, currentDNA.accentColor[ch] + (Math.random() - 0.5) * 0.2)) }
  updateAllSliders(); rebuildMesh()
})
addEditorEl(mutateBtn)

const animBtn = document.createElement('button'); animBtn.textContent = 'Pause Animation'
animBtn.addEventListener('click', () => { animating = !animating; animBtn.textContent = animating ? 'Pause Animation' : 'Play Animation' })
addEditorEl(animBtn)

addEditorHTML('<h2>Breeding</h2>')
const saveABtn = document.createElement('button'); saveABtn.textContent = 'Save as Parent A'
saveABtn.addEventListener('click', () => { parentA = JSON.parse(JSON.stringify(currentDNA)); saveABtn.textContent = `Parent A: ${currentDNA.bodyPlan} (saved)` })
addEditorEl(saveABtn)
const saveBBtn = document.createElement('button'); saveBBtn.textContent = 'Save as Parent B'
saveBBtn.addEventListener('click', () => { parentB = JSON.parse(JSON.stringify(currentDNA)); saveBBtn.textContent = `Parent B: ${currentDNA.bodyPlan} (saved)` })
addEditorEl(saveBBtn)
const breedBtn = document.createElement('button'); breedBtn.className = 'breed'; breedBtn.textContent = 'Breed A + B'
breedBtn.addEventListener('click', () => {
  if (!parentA || !parentB) { breedBtn.textContent = 'Save both parents first!'; return }
  const child = breedDNA(parentA, parentB)
  if (!child) { breedBtn.textContent = 'Cross-body breeding failed — try again'; return }
  currentDNA = child; updateAllSliders(); rebuildMesh(); breedBtn.textContent = 'Breed A + B'
})
addEditorEl(breedBtn)

function updateAllSliders() {
  for (const s of sliders) {
    if (s.key.includes('.')) {
      const [colorKey, chStr] = s.key.split('.'); const ch = parseInt(chStr)
      const arr = currentDNA[colorKey as 'bodyColor' | 'accentColor']
      s.input.value = String(arr[ch]); s.valEl.textContent = arr[ch].toFixed(2)
    } else {
      const v = (currentDNA as unknown as Record<string, unknown>)[s.key]
      if (typeof v === 'number') { s.input.value = String(v); s.valEl.textContent = v.toFixed(2) }
    }
  }
}

// ── Simulation controls ─────────────────────────────────────────────────

addSimHTML('<h2>Simulation</h2>')
addSimHTML('<div id="sim-stats" style="font-size:11px;color:#aaa;white-space:pre;line-height:1.6;margin-bottom:8px;"></div>')
simStatsEl = document.getElementById('sim-stats')

// Time speed slider
addSimHTML('<h2>Time Speed</h2>')
const speedLabel = document.createElement('label')
const speedSpan = document.createElement('span'); speedSpan.textContent = 'Speed'
const speedInp = document.createElement('input'); speedInp.type = 'range'; speedInp.min = '0.1'; speedInp.max = '20'; speedInp.step = '0.1'; speedInp.value = '1'
const speedVal = document.createElement('span'); speedVal.className = 'val'; speedVal.textContent = '1.0x'
speedInp.addEventListener('input', () => { simSpeed = parseFloat(speedInp.value); speedVal.textContent = simSpeed.toFixed(1) + 'x' })
speedLabel.appendChild(speedSpan); speedLabel.appendChild(speedInp); speedLabel.appendChild(speedVal)
addSimEl(speedLabel)

// Population cap slider
const popLabel = document.createElement('label')
const popSpan = document.createElement('span'); popSpan.textContent = 'Max Pop'
const popInp = document.createElement('input'); popInp.type = 'range'; popInp.min = '5'; popInp.max = '200'; popInp.step = '5'; popInp.value = String(MAX_POP)
const popVal = document.createElement('span'); popVal.className = 'val'; popVal.textContent = String(MAX_POP)
popInp.addEventListener('input', () => { MAX_POP = parseInt(popInp.value); popVal.textContent = String(MAX_POP) })
popLabel.appendChild(popSpan); popLabel.appendChild(popInp); popLabel.appendChild(popVal)
addSimEl(popLabel)

// Initial spawn count slider
const spawnLabel = document.createElement('label')
const spawnSpan = document.createElement('span'); spawnSpan.textContent = 'Start #'
const spawnInp = document.createElement('input'); spawnInp.type = 'range'; spawnInp.min = '5'; spawnInp.max = '100'; spawnInp.step = '5'; spawnInp.value = '20'
const spawnVal = document.createElement('span'); spawnVal.className = 'val'; spawnVal.textContent = '20'
spawnInp.addEventListener('input', () => { spawnVal.textContent = spawnInp.value })
spawnLabel.appendChild(spawnSpan); spawnLabel.appendChild(spawnInp); spawnLabel.appendChild(spawnVal)
addSimEl(spawnLabel)

// Controls
addSimHTML('<h2>Controls</h2>')

const pauseSimBtn = document.createElement('button'); pauseSimBtn.textContent = 'Pause'
pauseSimBtn.addEventListener('click', () => { simRunning = !simRunning; pauseSimBtn.textContent = simRunning ? 'Pause' : 'Resume' })
addSimEl(pauseSimBtn)

const resetSimBtn = document.createElement('button'); resetSimBtn.textContent = 'Reset (new 20)'
resetSimBtn.addEventListener('click', () => { initSimulation(); simRunning = true; pauseSimBtn.textContent = 'Pause' })
addSimEl(resetSimBtn)

const addCreatureBtn = document.createElement('button'); addCreatureBtn.textContent = 'Add Random Creature'
addCreatureBtn.addEventListener('click', () => {
  if (simCreatures.length >= MAX_POP) return
  const names = Object.keys(DNA_PRESETS)
  const dna = getPresetDNA(names[Math.floor(Math.random() * names.length)], rng)
  simCreatures.push(spawnSimCreature(dna, 0)); simTotalBorn++
})
addSimEl(addCreatureBtn)

const killOldBtn = document.createElement('button'); killOldBtn.textContent = 'Kill Oldest Half'
killOldBtn.addEventListener('click', () => {
  simCreatures.sort((a, b) => b.age - a.age)
  const half = Math.ceil(simCreatures.length / 2)
  for (let i = 0; i < half; i++) { scene.remove(simCreatures[0].group); simCreatures.shift() }
})
addSimEl(killOldBtn)

// ─── Render loop ────────────────────────────────────────────────────────

let lastTime = performance.now()

function animate() {
  requestAnimationFrame(animate)

  const now = performance.now()
  const delta = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  animTime += delta

  if (mode === 'editor' && animating && editorRefs) {
    const stats = dnaToStats(currentDNA)
    editorGroup.rotation.x = Math.sin(animTime * 1.2) * 0.01
    editorGroup.rotation.z = Math.sin(animTime * 0.8 + 1) * 0.008

    if (stats.mobility === 'ground' && editorRefs.legs.length >= 2) {
      const sinVal = Math.sin(animTime * 3.0) * 0.45
      const isInsect = currentDNA.bodyPlan === 'insectoid'
      for (let i = 0; i < editorRefs.legs.length; i++) {
        const rot = sinVal * (i % 2 === 0 ? 1 : -1)
        if (isInsect) animateInsectLeg(editorRefs.legs[i], rot)
        else animateLeg(editorRefs.legs[i], rot)
      }
    }
    if (editorRefs.wings.length >= 2) {
      const angle = Math.sin(animTime * (currentDNA.size > 0.6 ? 2.5 : 5.0)) * (currentDNA.size > 0.6 ? 0.4 : 0.6)
      editorRefs.wings[0].rotation.z = angle; editorRefs.wings[1].rotation.z = -angle
    }
    if (editorRefs.tail) editorRefs.tail.rotation.y = Math.sin(animTime * 2.0) * 0.35
  }

  if (mode === 'simulation') {
    updateSimulation(delta)
  }

  orbitControls.update()
  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(wrap.clientWidth, wrap.clientHeight)
})

rebuildMesh()
animate()
