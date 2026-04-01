# Spatial Text-to-Speech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spatial text-to-speech that reads lore stone fragments and NPC dialogue aloud, positioned in 3D space with biome-aware voice character and reverb.

**Architecture:** `SpatialTTS` class in `src/audio/SpatialTTS.ts` uses the Web Speech API (`SpeechSynthesisUtterance`) for spoken words with manual distance-based volume attenuation, plus a spatial accompaniment oscillator layer routed through the existing `PannerNode` + `EnvironmentReverb` pipeline for spatial positioning and biome reverb.

**Tech Stack:** Web Speech API, Web Audio API (existing), Three.js (existing)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/audio/SpatialTTS.ts` | TTS class: speech synthesis, spatial accompaniment, distance attenuation |
| Modify | `src/audio/AudioSystem.ts` | Create SpatialTTS instance, expose it, call update |
| Modify | `src/journal/LoreStone.ts` | Trigger TTS on stone collection |
| Modify | `src/npcs/DialogueSystem.ts` | Accept and invoke TTS callback on new dialogue lines |
| Modify | `src/npcs/NPCManager.ts` | Wire TTS callback with NPC position and biome into DialogueSystem |

---

### Task 1: Create SpatialTTS core class

**Files:**
- Create: `src/audio/SpatialTTS.ts`

- [ ] **Step 1: Create SpatialTTS with biome voice profiles and speak/cancel API**

Create `src/audio/SpatialTTS.ts`:

```typescript
import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { createSpatialPanner } from './SpatialAudioHelper'
import type { EnvironmentReverb } from './EnvironmentReverb'

interface VoiceProfile {
  pitch: number
  rate: number
  /** Accompaniment oscillator type */
  oscType: OscillatorType
  /** Accompaniment base frequency */
  oscFreq: number
  /** Optional second detuned oscillator frequency (0 = off) */
  oscFreq2: number
  /** Accompaniment filter frequency */
  filterFreq: number
  /** Accompaniment filter Q */
  filterQ: number
}

const BIOME_VOICES: Record<number, VoiceProfile> = {
  [BiomeType.Forest]:    { pitch: 1.0, rate: 0.9,  oscType: 'sine',     oscFreq: 220,  oscFreq2: 0,   filterFreq: 2000, filterQ: 1 },
  [BiomeType.Desert]:    { pitch: 0.8, rate: 0.85, oscType: 'sawtooth', oscFreq: 180,  oscFreq2: 0,   filterFreq: 3000, filterQ: 2 },
  [BiomeType.Volcanic]:  { pitch: 0.6, rate: 0.8,  oscType: 'sawtooth', oscFreq: 80,   oscFreq2: 82,  filterFreq: 600,  filterQ: 1 },
  [BiomeType.Snow]:      { pitch: 1.1, rate: 0.85, oscType: 'sine',     oscFreq: 440,  oscFreq2: 443, filterFreq: 4000, filterQ: 0.5 },
  [BiomeType.Heaven]:    { pitch: 1.3, rate: 0.9,  oscType: 'sine',     oscFreq: 520,  oscFreq2: 523, filterFreq: 5000, filterQ: 0.5 },
  [BiomeType.Hell]:      { pitch: 0.5, rate: 0.75, oscType: 'sawtooth', oscFreq: 60,   oscFreq2: 63,  filterFreq: 400,  filterQ: 3 },
  [BiomeType.Swamp]:     { pitch: 0.9, rate: 0.8,  oscType: 'triangle', oscFreq: 150,  oscFreq2: 0,   filterFreq: 800,  filterQ: 4 },
  [BiomeType.Crystal]:   { pitch: 1.2, rate: 0.9,  oscType: 'sine',     oscFreq: 660,  oscFreq2: 665, filterFreq: 4000, filterQ: 2 },
  [BiomeType.Jungle]:    { pitch: 0.95, rate: 0.95, oscType: 'sawtooth', oscFreq: 200, oscFreq2: 0,   filterFreq: 1500, filterQ: 1 },
  [BiomeType.Mesa]:      { pitch: 0.85, rate: 0.85, oscType: 'triangle', oscFreq: 160, oscFreq2: 0,   filterFreq: 1200, filterQ: 5 },
  [BiomeType.CoralReef]: { pitch: 1.05, rate: 0.9,  oscType: 'sine',     oscFreq: 330, oscFreq2: 0,   filterFreq: 2500, filterQ: 1 },
}

const DEFAULT_VOICE: VoiceProfile = { pitch: 1.0, rate: 0.9, oscType: 'sine', oscFreq: 220, oscFreq2: 0, filterFreq: 2000, filterQ: 1 }

const REF_DISTANCE = 5
const MAX_DISTANCE = 50
const ACCOMP_VOLUME = 0.25

export class SpatialTTS {
  private ctx: AudioContext
  private masterGain: GainNode
  private reverb: EnvironmentReverb | null

  // Active speech state
  private utterance: SpeechSynthesisUtterance | null = null
  private sourcePos: THREE.Vector3 | null = null
  private accompGain: GainNode | null = null
  private accompNodes: AudioNode[] = []  // oscillators, filters, panner — for cleanup

  private voices: SpeechSynthesisVoice[] = []

  constructor(ctx: AudioContext, masterGain: GainNode, reverb: EnvironmentReverb | null) {
    this.ctx = ctx
    this.masterGain = masterGain
    this.reverb = reverb

    // Voices may load asynchronously
    this.voices = speechSynthesis.getVoices()
    speechSynthesis.addEventListener('voiceschanged', () => {
      this.voices = speechSynthesis.getVoices()
    })
  }

  speak(text: string, position: THREE.Vector3, biome: BiomeType): void {
    this.cancel()

    const profile = BIOME_VOICES[biome] ?? DEFAULT_VOICE
    this.sourcePos = position.clone()

    // --- Utterance ---
    const utt = new SpeechSynthesisUtterance(text)
    utt.pitch = profile.pitch
    utt.rate = profile.rate
    utt.volume = 1.0

    // Prefer an English voice if available
    const enVoice = this.voices.find(v => v.lang.startsWith('en'))
    if (enVoice) utt.voice = enVoice

    utt.onend = () => this.cleanup()
    utt.onerror = () => this.cleanup()
    this.utterance = utt

    // --- Spatial accompaniment ---
    this.buildAccompaniment(position, profile)

    speechSynthesis.speak(utt)
  }

  private buildAccompaniment(position: THREE.Vector3, profile: VoiceProfile): void {
    const ctx = this.ctx

    // Gain for accompaniment volume
    const gain = ctx.createGain()
    gain.gain.value = ACCOMP_VOLUME
    this.accompGain = gain

    // Bandpass filter for character shaping
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = profile.filterFreq
    filter.Q.value = profile.filterQ

    // Primary oscillator
    const osc1 = ctx.createOscillator()
    osc1.type = profile.oscType
    osc1.frequency.value = profile.oscFreq
    osc1.connect(filter)
    this.accompNodes.push(osc1)

    // Optional detuned second oscillator
    if (profile.oscFreq2 > 0) {
      const osc2 = ctx.createOscillator()
      osc2.type = profile.oscType
      osc2.frequency.value = profile.oscFreq2
      osc2.connect(filter)
      osc2.start()
      this.accompNodes.push(osc2)
    }

    // LFO tremolo on gain
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 2.5
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    lfo.start()
    this.accompNodes.push(lfo, lfoGain)

    // Spatial panner
    const panner = createSpatialPanner(ctx, position.x, position.y, position.z, REF_DISTANCE, MAX_DISTANCE)

    // Route: filter → gain → panner → master + reverb send
    filter.connect(gain)
    gain.connect(panner)
    panner.connect(this.masterGain)
    if (this.reverb) panner.connect(this.reverb.getSendNode())

    this.accompNodes.push(filter, gain, panner)

    osc1.start()
  }

  update(cameraPosition: THREE.Vector3): void {
    if (!this.sourcePos || !this.utterance) return

    const dx = cameraPosition.x - this.sourcePos.x
    const dy = cameraPosition.y - this.sourcePos.y
    const dz = cameraPosition.z - this.sourcePos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist > MAX_DISTANCE) {
      this.cancel()
      return
    }

    // Manual volume attenuation for the utterance (accompaniment uses PannerNode)
    const vol = dist <= REF_DISTANCE ? 1.0 : Math.max(0, 1.0 - (dist - REF_DISTANCE) / (MAX_DISTANCE - REF_DISTANCE))
    // SpeechSynthesisUtterance.volume can't be changed mid-speech in most browsers,
    // so we adjust accompaniment gain to match spatial feel
    if (this.accompGain) {
      this.accompGain.gain.value = ACCOMP_VOLUME * vol
    }
  }

  cancel(): void {
    speechSynthesis.cancel()
    this.cleanup()
  }

  private cleanup(): void {
    // Stop and disconnect all accompaniment nodes
    for (const node of this.accompNodes) {
      try {
        if (node instanceof OscillatorNode) node.stop()
        node.disconnect()
      } catch { /* already stopped */ }
    }
    this.accompNodes = []
    this.accompGain = null
    this.utterance = null
    this.sourcePos = null
  }

  dispose(): void {
    this.cancel()
  }
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors from SpatialTTS.ts

- [ ] **Step 3: Commit**

```bash
git add src/audio/SpatialTTS.ts
git commit -m "feat(tts): add SpatialTTS class with biome voice profiles and spatial accompaniment"
```

---

### Task 2: Wire SpatialTTS into AudioSystem

**Files:**
- Modify: `src/audio/AudioSystem.ts`

- [ ] **Step 1: Import SpatialTTS and create instance in init()**

In `src/audio/AudioSystem.ts`, add import at top:

```typescript
import { SpatialTTS } from './SpatialTTS'
```

Add property alongside other subsystem fields (near line 44):

```typescript
private spatialTTS: SpatialTTS | null = null
```

In `init()` method, after the `this.ambience = ...` line (after line 111), add:

```typescript
this.spatialTTS = new SpatialTTS(this.ctx, this.masterGain, this.environmentReverb)
```

- [ ] **Step 2: Add public accessor**

After the `getHarmonicGain()` method (line 59), add:

```typescript
getSpatialTTS(): SpatialTTS | null { return this.spatialTTS }
```

- [ ] **Step 3: Add update call**

In the `update()` method, find where `this.environmentReverb?.update(biome)` is called (line 159). The `update` method receives `camera` as a parameter. After the existing subsystem updates, find the camera position and add the TTS update. Look at the `update` method signature — it receives `playerPos: THREE.Vector3` (the `camPos` argument). After the environmentReverb update line, add:

```typescript
this.spatialTTS?.update(playerPos)
```

Note: The AudioSystem.update() receives `playerPos` as its 7th argument (index 6). Find the parameter name in the method signature and use it.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/audio/AudioSystem.ts
git commit -m "feat(tts): wire SpatialTTS into AudioSystem init and update loop"
```

---

### Task 3: Integrate TTS with LoreStone collection

**Files:**
- Modify: `src/journal/LoreStone.ts`

- [ ] **Step 1: Add SpatialTTS import and field**

In `src/journal/LoreStone.ts`, add import:

```typescript
import type { SpatialTTS } from '../audio/SpatialTTS'
```

Add a public field to the `LoreStoneManager` class (or whatever the class is named — check the file):

```typescript
spatialTTS: SpatialTTS | null = null
```

- [ ] **Step 2: Trigger TTS on collection**

In the collection handler (around line 191, after `const text = this.getFragmentText(s.fragmentId, s.loreIndex)`), add:

```typescript
if (this.spatialTTS && s.biome !== undefined) {
  this.spatialTTS.speak(text, s.position, s.biome)
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/journal/LoreStone.ts
git commit -m "feat(tts): trigger spatial TTS on lore stone collection"
```

---

### Task 4: Integrate TTS with NPC dialogue

**Files:**
- Modify: `src/npcs/DialogueSystem.ts`
- Modify: `src/npcs/NPCManager.ts`

- [ ] **Step 1: Add TTS callback to DialogueSystem**

In `src/npcs/DialogueSystem.ts`, add a callback field:

```typescript
private onSpeak: ((text: string) => void) | null = null
```

Add a setter method:

```typescript
setOnSpeak(cb: ((text: string) => void) | null): void {
  this.onSpeak = cb
}
```

- [ ] **Step 2: Invoke callback when dialogue lines start**

In `startDialogue()` (line 25), after `this.container.style.display = 'block'` (line 36), add:

```typescript
if (this.onSpeak && this.lines.length > 0) {
  this.onSpeak(this.lines[0])
}
```

In `handleInteract()`, in the "advance to next line" section (after line 63, `this.textEl.textContent = ''`), add:

```typescript
if (this.onSpeak) {
  this.onSpeak(this.lines[this.currentLine])
}
```

- [ ] **Step 3: Wire TTS in NPCManager**

In `src/npcs/NPCManager.ts`, add import:

```typescript
import type { SpatialTTS } from '../audio/SpatialTTS'
```

Add a public field:

```typescript
spatialTTS: SpatialTTS | null = null
```

In `startNPCDialogue()` (line 222), after `this.dialogue.startDialogue(npc.def.name, npc.def.title, filteredTexts)` (line 243), set up the speak callback that captures the NPC's position and biome:

```typescript
const npcPos = npc.worldPos
const npcBiome = this.biomeMap.getBiomeAt(npcPos.x, npcPos.z)
this.dialogue.setOnSpeak((text) => {
  this.spatialTTS?.speak(text, npcPos, npcBiome)
})
```

In the `close()` call path — when dialogue ends, clear the callback. In the `handleInteract` method, after `this.close()` is called (line 55 of DialogueSystem.ts), the `close()` method should also clear the callback. Add to `DialogueSystem.close()` (line 89):

```typescript
this.onSpeak = null
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/npcs/DialogueSystem.ts src/npcs/NPCManager.ts
git commit -m "feat(tts): trigger spatial TTS on NPC dialogue lines"
```

---

### Task 5: Wire references in Engine.ts

**Files:**
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Pass SpatialTTS to LoreStone and NPCManager**

In `src/engine/Engine.ts`, find where the lore stone manager and NPC manager are set up (after AudioSystem is initialized). After `this.audioSystem` is created and `init()` is called, add the wiring. Find the relevant section (likely after line 230 area where audioSystem is created, and after lore stones and NPC manager are initialized):

```typescript
const tts = this.audioSystem.getSpatialTTS()
if (tts) {
  this.loreStones.spatialTTS = tts
  this.npcManager.spatialTTS = tts
}
```

This should go after both `this.audioSystem.init()` has been called AND after `this.loreStones` and `this.npcManager` exist. Find the appropriate location — likely near the end of the constructor or init method where other systems are wired together.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Verify full build**

Run: `npx vite build 2>&1 | tail -5` (or the project's build command)
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/engine/Engine.ts
git commit -m "feat(tts): wire SpatialTTS references to LoreStone and NPCManager in Engine"
```
