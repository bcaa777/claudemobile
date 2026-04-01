# Spatial Text-to-Speech Design

## Summary

Add spatial text-to-speech that reads lore stone fragments and NPC dialogue aloud, positioned in 3D space at the source location. Voice character varies by biome. Audio is routed through the existing spatial audio and environment reverb systems.

## New File

### `src/audio/SpatialTTS.ts`

Single class `SpatialTTS` responsible for all TTS behavior.

**Constructor dependencies:**
- `AudioContext` (from `AudioSystem.getContext()`)
- `EnvironmentReverb` (for reverb send bus)

**Public API:**
- `speak(text: string, position: THREE.Vector3, biome: BiomeType): void`
- `update(cameraPosition: THREE.Vector3): void` — called each frame for distance attenuation
- `cancel(): void` — stop current speech
- `dispose(): void` — cleanup

## Speech Pipeline

1. `speak()` cancels any in-progress speech
2. Creates `SpeechSynthesisUtterance` with biome-specific pitch and rate
3. Creates an accompaniment oscillator layer routed through:
   `OscillatorNode(s)` → `GainNode` → `createSpatialPanner(position)` → `EnvironmentReverb.getSendNode()`
4. Starts both the utterance and the accompaniment simultaneously
5. `update()` each frame:
   - Computes distance from camera to speech source position
   - Attenuates utterance volume: full at 0-5 units, linear falloff to 0 at 50 units
   - Attenuates accompaniment gain identically
   - Cancels utterance if distance exceeds 50 units
6. On `utterance.onend`: disconnect and clean up accompaniment nodes

## Biome Voice Profiles

Each biome maps to a voice parameter set applied to the utterance and an accompaniment synthesis recipe.

| Biome    | Pitch | Rate | Accompaniment                  |
|----------|-------|------|--------------------------------|
| Forest   | 1.0   | 0.9  | Warm breathy pad (filtered noise + sine) |
| Desert   | 0.8   | 0.85 | Dry whisper (highpass noise)    |
| Volcanic | 0.6   | 0.8  | Low rumble drone (sawtooth + LFO) |
| Snow     | 1.1   | 0.85 | Bright shimmer (high sine + tremolo) |
| Heaven   | 1.3   | 0.9  | Ethereal high sine (detuned pair) |
| Hell     | 0.5   | 0.75 | Dark distorted (waveshaper + low osc) |
| Swamp    | 0.9   | 0.8  | Murky filtered noise (bandpass) |
| Crystal  | 1.2   | 0.9  | Bell-like harmonics (FM synthesis) |
| Jungle   | 0.95  | 0.95 | Humid mid-range (filtered saw) |
| Mesa     | 0.85  | 0.85 | Hollow resonance (resonant bandpass) |
| Coral    | 1.05  | 0.9  | Bubbly modulation (LFO on gain) |

Accompaniment volume is subtle — roughly 20-30% of the utterance volume — serving as spatial texture rather than a competing sound.

## Distance Attenuation

- **0-5 units:** full volume (1.0)
- **5-50 units:** linear falloff to 0.0
- **>50 units:** cancel utterance, disconnect accompaniment

The accompaniment's PannerNode handles HRTF spatial positioning. The utterance volume is manually set via `utterance.volume` (no spatial panning — the accompaniment provides the spatial cue).

## Queue Behavior

One speech at a time. New `speak()` calls cancel the current speech before starting. No overlap, no queue.

## Integration Points

### LoreStone.ts

In the collection handler (where `collected = true` is set), call:
```
spatialTTS.speak(fragment.text, stone.position, stone.biome)
```

### DialogueSystem.ts

When a new dialogue line is displayed, call:
```
spatialTTS.speak(line.text, npcWorldPosition, currentBiome)
```

The NPC's world position and current biome need to be passed through to the dialogue system.

### Engine.ts

- Create `SpatialTTS` instance during init, passing `AudioSystem.getContext()` and `EnvironmentReverb`
- Pass `spatialTTS` reference to `LoreStone` manager and `DialogueSystem`
- Call `spatialTTS.update(cameraPosition)` each frame in the update loop

## Edge Cases

- **Browser has no voices:** `speechSynthesis.getVoices()` may return empty on first call. Listen for `voiceschanged` event before first speak. If no voices available, skip TTS silently — game still works without it.
- **Mobile browser restrictions:** Speech may require a user gesture. First speak call should happen after player interaction (collecting a stone or starting dialogue qualifies).
- **Utterance cancelled by distance:** Clean up accompaniment nodes immediately on cancel.
