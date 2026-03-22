import { BiomeType } from '../biomes/types'

export interface LoreFragment {
  id: string
  text: string
  order: number
  biome: BiomeType
}

// ── Forest (Discovery) ──────────────────────────────────────────────
const FOREST_LORE: LoreFragment[] = [
  {
    id: 'forest_1', order: 0, biome: BiomeType.Forest,
    text: 'The first Builders heard it beneath the roots — a low hum older than wood, older than soil. They pressed their ears to the ground and wept, for the sound was beautiful and they had almost missed it.',
  },
  {
    id: 'forest_2', order: 1, biome: BiomeType.Forest,
    text: 'The deer knew before the Builders did. They circled the grove at dusk, antlers trembling like tuning forks. Where the herd paused longest, the Builders placed their first stones.',
  },
  {
    id: 'forest_3', order: 2, biome: BiomeType.Forest,
    text: 'They tuned the standing stones to the forest\'s own voice — a chord of rainfall, root-growth, and the slow exhale of ancient oaks. The grove sang back, and the Builders knew they were not alone.',
  },
  {
    id: 'forest_4', order: 3, biome: BiomeType.Forest,
    text: 'Moss covered the first instruments within a season. The Builders learned: the forest does not preserve what it is given. It consumes, transforms, returns. Their tools became part of the song.',
  },
  {
    id: 'forest_5', order: 4, biome: BiomeType.Forest,
    text: 'A bird landed on the resonance stone and sang a note the Builders had never charted. They realized the frequency map was incomplete — the forest held harmonics no instrument could capture.',
  },
  {
    id: 'forest_6', order: 5, biome: BiomeType.Forest,
    text: 'The grove was their first experiment and their most honest failure. They could amplify the song but never compose it. The forest wrote its own music. The Builders merely learned to listen.',
  },
]

// ── Desert (Growth) ─────────────────────────────────────────────────
const DESERT_LORE: LoreFragment[] = [
  {
    id: 'desert_1', order: 0, biome: BiomeType.Desert,
    text: 'From the forest they carried the knowledge outward. In the desert they found a different frequency — dry, vast, patient. The sand itself vibrated when the pyramid hummed its deepest note.',
  },
  {
    id: 'desert_2', order: 1, biome: BiomeType.Desert,
    text: 'The civilization grew where the frequencies were strongest. They built monuments not to gods but to sound — great amplifiers of stone and air that turned the desert into an instrument.',
  },
  {
    id: 'desert_3', order: 2, biome: BiomeType.Desert,
    text: 'Caravans followed the sound across dunes that shifted like slow waves. Traders said you could navigate by pitch alone: the pyramid\'s hum deepened as you drew near, thinned as you strayed.',
  },
  {
    id: 'desert_4', order: 3, biome: BiomeType.Desert,
    text: 'At noon the sand sang — a high, thin whine that only the camels seemed to tolerate. The Builders wore ear-plugs of woven reed. Even so, some claimed the midday frequency gave them visions.',
  },
  {
    id: 'desert_5', order: 4, biome: BiomeType.Desert,
    text: 'They carved channels in the bedrock so the wind would play as it passed. A sandstorm became a symphony — terrible and magnificent. The scorpions danced to it, or seemed to.',
  },
  {
    id: 'desert_6', order: 5, biome: BiomeType.Desert,
    text: 'The Great Pyramid was their masterwork of amplification. When the capstone was placed, every grain of sand within a league trembled in sympathy. The Builders called it the First Chord.',
  },
  {
    id: 'desert_7', order: 6, biome: BiomeType.Desert,
    text: 'A Builder inscribed on the pyramid\'s inner wall: "We did not build this. We merely gave the desert a throat to sing with." The inscription still vibrates when the wind is right.',
  },
]

// ── Crystal (Communication) ─────────────────────────────────────────
const CRYSTAL_LORE: LoreFragment[] = [
  {
    id: 'crystal_1', order: 0, biome: BiomeType.Crystal,
    text: 'The crystals were not grown — they were awakened. The Builders struck the first formation and heard an echo return from the far side of the world. A network already existed beneath their feet.',
  },
  {
    id: 'crystal_2', order: 1, biome: BiomeType.Crystal,
    text: 'Messages traveled as harmonics through the crystal lattice. A thought sung into one spire would emerge, changed but intact, from another a continent away. Every crystal sang the same song, offset by distance.',
  },
  {
    id: 'crystal_3', order: 2, biome: BiomeType.Crystal,
    text: 'The crystal fields were the Builders\' greatest library. Knowledge was stored not as words but as resonance patterns — touch a formation and feel the memory of whoever last sang into it.',
  },
  {
    id: 'crystal_4', order: 3, biome: BiomeType.Crystal,
    text: 'Some crystals held frequencies so old the Builders could not decode them. Voices from before the Builders, before the biomes split. The crystals remembered a world that no longer existed.',
  },
  {
    id: 'crystal_5', order: 4, biome: BiomeType.Crystal,
    text: 'A Builder discovered that two crystals struck simultaneously produced a third tone — a ghost frequency that belonged to neither. They called these phantom harmonics and feared them.',
  },
  {
    id: 'crystal_6', order: 5, biome: BiomeType.Crystal,
    text: 'The cathedral was built where seven crystal veins intersected. Stand at its center and you hear every biome at once — forest rain, desert wind, volcanic rumble — a chord of the whole world singing.',
  },
]

// ── Snow (Preservation) ─────────────────────────────────────────────
const SNOW_LORE: LoreFragment[] = [
  {
    id: 'snow_1', order: 0, biome: BiomeType.Snow,
    text: 'They froze their knowledge into the ice because ice forgets nothing. Each layer a year, each crystal a syllable. The glaciers are books that take centuries to read.',
  },
  {
    id: 'snow_2', order: 1, biome: BiomeType.Snow,
    text: 'The mammoth herds circled the frozen lake in patterns that encoded memories. Their breath crystallized into glyphs that the Builders copied onto stone before the wind erased them.',
  },
  {
    id: 'snow_3', order: 2, biome: BiomeType.Snow,
    text: 'What the ice preserves, the thaw reveals. The Builders feared spring — not for the floods, but for the secrets the melting would expose before anyone was ready to hear them.',
  },
  {
    id: 'snow_4', order: 3, biome: BiomeType.Snow,
    text: 'Sound travels differently through frozen air. The Builders found that certain frequencies only existed in deep cold — notes that shattered when the temperature rose above freezing.',
  },
  {
    id: 'snow_5', order: 4, biome: BiomeType.Snow,
    text: 'The Ice Palace was not built. It was sung into shape during the longest night. Each wall is a frozen waveform, each corridor a captured echo. It melts a little each summer and is re-sung each winter.',
  },
  {
    id: 'snow_6', order: 5, biome: BiomeType.Snow,
    text: 'An arctic fox led a Builder to a crevasse where the ice was so old it had turned blue. Pressed against it, she heard a voice — not words, but the unmistakable cadence of someone saying goodbye.',
  },
]

// ── Jungle (Power) ──────────────────────────────────────────────────
const JUNGLE_LORE: LoreFragment[] = [
  {
    id: 'jungle_1', order: 0, biome: BiomeType.Jungle,
    text: 'The jungle\'s frequency was the strongest — dense, layered, overwhelming. Every vine, every insect, every rotting log added its voice. The Builders could not hear themselves think.',
  },
  {
    id: 'jungle_2', order: 1, biome: BiomeType.Jungle,
    text: 'They built platforms to rise above the canopy, to hear the individual notes within the roar. From the treetops, the jungle resolved into a thousand distinct melodies woven into one green chord.',
  },
  {
    id: 'jungle_3', order: 2, biome: BiomeType.Jungle,
    text: 'The parrots showed them the canopy held the key. Bright-feathered messengers carried seeds that, when planted in sequence, grew into living resonance chambers. The jungle composed itself.',
  },
  {
    id: 'jungle_4', order: 3, biome: BiomeType.Jungle,
    text: 'Beneath the canopy, the frequency was so powerful it bent light. The Builders saw colors that had no name — shimmering between green and something older than green.',
  },
  {
    id: 'jungle_5', order: 4, biome: BiomeType.Jungle,
    text: 'The jungle pyramid was covered within a decade. Vines threaded through the resonance chambers, and the structure\'s song merged with the forest\'s. The Builders could no longer tell where their work ended and the jungle began.',
  },
  {
    id: 'jungle_6', order: 5, biome: BiomeType.Jungle,
    text: 'A Builder wrote: "The jungle does not amplify. It devours and remakes. We fed it our strongest frequency and it returned something wilder, something we could not control but only ride."',
  },
  {
    id: 'jungle_7', order: 6, biome: BiomeType.Jungle,
    text: 'At the heart of the deepest growth, where no light reaches, there is a silence so complete it hums. The Builders called it the Green Zero — the frequency from which all jungle sound is born.',
  },
]

// ── Mesa (History) ──────────────────────────────────────────────────
const MESA_LORE: LoreFragment[] = [
  {
    id: 'mesa_1', order: 0, biome: BiomeType.Mesa,
    text: 'In the layered stone they found the world\'s own memory. Each stratum a different age, each seam a different chord. The mesa was an archive written in geology.',
  },
  {
    id: 'mesa_2', order: 1, biome: BiomeType.Mesa,
    text: 'The fossils hummed when touched in sequence. A trilobite, then a fern, then a jawbone — and the mesa played back the sound of an ocean that dried up a million years ago.',
  },
  {
    id: 'mesa_3', order: 2, biome: BiomeType.Mesa,
    text: 'The Builders carved listening posts into the cliff faces. Each post tuned to a different geological layer, a different era. They could dial through time by climbing.',
  },
  {
    id: 'mesa_4', order: 3, biome: BiomeType.Mesa,
    text: 'A goat led them to the deepest stratum — red rock so old it predated sound itself. Pressed against it, the Builders heard nothing. They wept, because they understood what silence meant before the world learned to sing.',
  },
  {
    id: 'mesa_5', order: 4, biome: BiomeType.Mesa,
    text: 'The mesa citadel was carved, not built. Every removed stone changed the cliff\'s resonance. The architects worked by ear as much as by eye, chiseling until the fortress hummed in tune with the bedrock.',
  },
  {
    id: 'mesa_6', order: 5, biome: BiomeType.Mesa,
    text: 'At dawn the mesa layers glow in sequence — red, gold, amber — as the sun\'s warmth expands the stone. The Builders called it the Morning Chord and used it to calibrate their instruments.',
  },
]

// ── Coral Reef (Connection) ─────────────────────────────────────────
const CORAL_LORE: LoreFragment[] = [
  {
    id: 'coral_1', order: 0, biome: BiomeType.CoralReef,
    text: 'The tides carried the frequencies between continents. What one shore sang at dawn, another received at dusk. The ocean was the Builders\' first messenger, older than the crystal network.',
  },
  {
    id: 'coral_2', order: 1, biome: BiomeType.CoralReef,
    text: 'At low tide, the patterns were visible in the pools — standing waves frozen in shallow water, each one a note held in place by the reef\'s geometry. The crabs walked between them carefully.',
  },
  {
    id: 'coral_3', order: 2, biome: BiomeType.CoralReef,
    text: 'The reef was a crossroads of harmonics. Every current carried a frequency from somewhere else. Stand still in the shallows and you could hear the whole world arriving in waves.',
  },
  {
    id: 'coral_4', order: 3, biome: BiomeType.CoralReef,
    text: 'Coral grew in the shape of waveforms. The Builders realized the reef was not just carrying sound — it was recording it. Each polyp a living memory of the tide that shaped it.',
  },
  {
    id: 'coral_5', order: 4, biome: BiomeType.CoralReef,
    text: 'The Coral Palace was built half-submerged so it could listen to both worlds. Above water: wind and birdsong. Below: the deep hum of ocean currents that have circled the globe since the beginning.',
  },
  {
    id: 'coral_6', order: 5, biome: BiomeType.CoralReef,
    text: 'A Builder noticed the fish swam in patterns that matched the crystal network\'s signal paths. The ocean had its own communication grid — older, slower, but carrying messages the crystals had lost.',
  },
]

// ── Volcanic (Power Source) ─────────────────────────────────────────
const VOLCANIC_LORE: LoreFragment[] = [
  {
    id: 'volcanic_1', order: 0, biome: BiomeType.Volcanic,
    text: 'Beneath the fire, the deepest frequency — so low it was felt in the bones rather than heard. The Builders called it the World\'s Heartbeat and built their forges around its rhythm.',
  },
  {
    id: 'volcanic_2', order: 1, biome: BiomeType.Volcanic,
    text: 'They tapped the deep frequency for power, channeling lava through carved conduits that amplified the tremor into usable resonance. The obsidian walls hummed with captured heat.',
  },
  {
    id: 'volcanic_3', order: 2, biome: BiomeType.Volcanic,
    text: 'The wurms followed the warmth of the world\'s engine, burrowing along fault lines the Builders had mapped. Where wurm and conduit crossed, the frequency doubled in strength.',
  },
  {
    id: 'volcanic_4', order: 3, biome: BiomeType.Volcanic,
    text: 'Obsidian held reflections of the world before the Shattering. The Builders gazed into cooled lava flows and saw landscapes that no longer existed — whole biomes swallowed by the deep.',
  },
  {
    id: 'volcanic_5', order: 4, biome: BiomeType.Volcanic,
    text: 'The Obsidian Citadel was forged in eruption. The Builders did not build it so much as convince the volcano to shape itself. Molten stone flowed into molds of pure sound.',
  },
  {
    id: 'volcanic_6', order: 5, biome: BiomeType.Volcanic,
    text: 'A Builder who stayed too long near the deep vents began to hear a second heartbeat beneath the first. She wrote: "The world has a basement. Something lives in it. It is not sleeping — it is waiting."',
  },
]

// ── Swamp (Corruption) ──────────────────────────────────────────────
const SWAMP_LORE: LoreFragment[] = [
  {
    id: 'swamp_1', order: 0, biome: BiomeType.Swamp,
    text: 'Here the harmony first broke. The bog absorbed sound like a wound absorbs blood — slowly, completely, leaving nothing behind. The Builders\' instruments went mute within days.',
  },
  {
    id: 'swamp_2', order: 1, biome: BiomeType.Swamp,
    text: 'Gas seeped through ancient pipes they couldn\'t seal. The swamp had its own plumbing — channels older than the Builders\' work, carrying something that corroded resonance itself.',
  },
  {
    id: 'swamp_3', order: 2, biome: BiomeType.Swamp,
    text: 'The toads tried to sing it right, but the rhythm faltered. Their croaking was almost the correct frequency — close enough to be haunting, wrong enough to be disturbing.',
  },
  {
    id: 'swamp_4', order: 3, biome: BiomeType.Swamp,
    text: 'The Builders sent their best acoustician into the swamp. She returned changed — said the bog didn\'t corrupt sound, it told the truth about it. "Every harmony contains its own decay," she whispered.',
  },
  {
    id: 'swamp_5', order: 4, biome: BiomeType.Swamp,
    text: 'The ziggurat was an attempt to purify the swamp\'s frequency. It failed, but beautifully — the structure vibrates with a chord that is neither harmony nor dissonance but something in between.',
  },
  {
    id: 'swamp_6', order: 5, biome: BiomeType.Swamp,
    text: 'Bog water remembers every sound that ever entered it. The Builders tried to drain a pool and heard a thousand years of rainfall played back in a single moment. They sealed it immediately.',
  },
]

// ── Heaven (Aspiration) ─────────────────────────────────────────────
const HEAVEN_LORE: LoreFragment[] = [
  {
    id: 'heaven_1', order: 0, biome: BiomeType.Heaven,
    text: 'They rode the harmonics upward. The deepest frequencies pushed against the earth, and the Builders learned to stand on the pressure wave. The first floating stone was an accident. The rest were ambition.',
  },
  {
    id: 'heaven_2', order: 1, biome: BiomeType.Heaven,
    text: 'The skywhales sang the original chord — the sound the world makes when it is whole and unbroken. The Builders wept when they heard it, for they recognized it as something they had been trying to reconstruct all along.',
  },
  {
    id: 'heaven_3', order: 2, biome: BiomeType.Heaven,
    text: 'The platforms in the sky were tuned to hover at the altitude where the world\'s song was clearest. Too high and it thinned to silence. Too low and the noise of living things drowned it out.',
  },
  {
    id: 'heaven_4', order: 3, biome: BiomeType.Heaven,
    text: 'The Cloud Temple was their masterwork — a place where every frequency arrived in perfect balance. For one moment, the Builders heard the world as it was meant to sound. Then the moment passed.',
  },
  {
    id: 'heaven_5', order: 4, biome: BiomeType.Heaven,
    text: 'Heaven is crumbling. The floating stones lose altitude year by year, their sustaining frequency weakening. The skywhales sing louder to compensate, but even their voices thin.',
  },
  {
    id: 'heaven_6', order: 5, biome: BiomeType.Heaven,
    text: 'A Builder carved into a drifting stone: "We climbed so high to hear the chord that we forgot to listen to the ground. The sky remembers. The sky forgives. The sky is also falling."',
  },
  {
    id: 'heaven_7', order: 6, biome: BiomeType.Heaven,
    text: 'From Heaven you can see every biome — forest, desert, coral, fire. They look like notes on a staff, arranged by a composer who left before the performance. The wind turns the pages.',
  },
]

// ── Hell (The Fall) ─────────────────────────────────────────────────
const HELL_LORE: LoreFragment[] = [
  {
    id: 'hell_1', order: 0, biome: BiomeType.Hell,
    text: 'They tried to create a new frequency — one that had never existed, born from no biome. The experiment cracked the harmony like a stone through glass. What emerged was dissonance given form.',
  },
  {
    id: 'hell_2', order: 1, biome: BiomeType.Hell,
    text: 'The new sound devoured other sounds. It did not harmonize or even clash — it consumed, leaving voids where music had been. The Builders called it the Unmaking Note.',
  },
  {
    id: 'hell_3', order: 2, biome: BiomeType.Hell,
    text: 'The Depths grow when the chord weakens. Every broken instrument, every silenced stone, every forgotten song makes Hell a little larger. It feeds on the absence of harmony.',
  },
  {
    id: 'hell_4', order: 3, biome: BiomeType.Hell,
    text: 'The imps are not creatures — they are echoes of the Unmaking Note, given legs and hunger. They gnaw at the edges of sound, fraying the world\'s remaining harmonics.',
  },
  {
    id: 'hell_5', order: 4, biome: BiomeType.Hell,
    text: 'The Infernal Citadel was not built by the Builders. It built itself from the wreckage of their greatest experiment — a monument to the frequency that should never have been sung.',
  },
  {
    id: 'hell_6', order: 5, biome: BiomeType.Hell,
    text: 'Deep in the Depths, past the fire and the howling, there is a sound so low it is almost silence. The Builders\' last expedition reported: "It is not nothing. It is the sound of everything ending, played very slowly."',
  },
  {
    id: 'hell_7', order: 6, biome: BiomeType.Hell,
    text: 'One Builder remained in Hell voluntarily. She believed the Unmaking Note could be reversed — that dissonance, understood deeply enough, was just harmony heard from the wrong direction.',
  },
]

// ── Assemble the full map ───────────────────────────────────────────
export const LORE_CONTENT: Map<BiomeType, LoreFragment[]> = new Map([
  [BiomeType.Forest, FOREST_LORE],
  [BiomeType.Desert, DESERT_LORE],
  [BiomeType.Crystal, CRYSTAL_LORE],
  [BiomeType.Snow, SNOW_LORE],
  [BiomeType.Jungle, JUNGLE_LORE],
  [BiomeType.Mesa, MESA_LORE],
  [BiomeType.CoralReef, CORAL_LORE],
  [BiomeType.Volcanic, VOLCANIC_LORE],
  [BiomeType.Swamp, SWAMP_LORE],
  [BiomeType.Heaven, HEAVEN_LORE],
  [BiomeType.Hell, HELL_LORE],
])

/** Flat array of all fragments, ordered by biome then by fragment order. */
export function getAllFragments(): LoreFragment[] {
  const all: LoreFragment[] = []
  for (const fragments of LORE_CONTENT.values()) {
    all.push(...fragments)
  }
  return all
}

/** Total number of lore fragments across all biomes. */
export const TOTAL_LORE_FRAGMENTS = getAllFragments().length
