import { BiomeType } from '../biomes/types'
import { SpeciesId, ALL_SPECIES, SPECIES } from '../creatures/Species'
import { WeatherType } from '../systems/WeatherSystem'
import { getAllFragments, TOTAL_LORE_FRAGMENTS } from '../lore/LoreContent'

export type JournalCategory = 'creature' | 'biome' | 'landmark' | 'weather' | 'lore' | 'rune'

export interface JournalEntry {
  key: string
  name: string
  description: string
  category: JournalCategory
}

// Creature entries — exclude giants from journal tracking
const JOURNAL_SPECIES: SpeciesId[] = ALL_SPECIES.filter(s => !SPECIES[s].isGiant)

const CREATURE_NAMES: Record<string, string> = {
  rabbit: 'Rabbit', deer: 'Deer', bird: 'Bluebird', dragon: 'Dragon',
  fish: 'Fish', wolf: 'Grey Wolf', croc: 'Crocodile', bear: 'Brown Bear',
  camel: 'Camel', fox: 'Arctic Fox', bat: 'Cave Bat', scorpion: 'Scorpion',
  lion: 'Lion', mammoth: 'Mammoth', toad: 'Toad', eagle: 'Golden Eagle',
  parrot: 'Parrot', crab: 'Crab', goat: 'Mountain Goat',
  imp: 'Imp', hellhound: 'Hellhound',
}

const CREATURE_DESCS: Record<string, string> = {
  rabbit: 'A small, timid creature that flees at the slightest threat.',
  deer: 'Graceful and cautious, often found in herds near forests.',
  bird: 'A vibrant songbird that flits between branches overhead.',
  dragon: 'A fearsome winged predator wreathed in dark scales.',
  fish: 'Shimmering scales catch the light as it darts through water.',
  wolf: 'A cunning pack hunter with piercing eyes.',
  croc: 'Patient and deadly, it lurks in still waters.',
  bear: 'Massive and territorial, best observed from a distance.',
  camel: 'Hardy and stoic, perfectly adapted to harsh deserts.',
  fox: 'Quick and clever, its white-tipped tail vanishes into undergrowth.',
  bat: 'A leathery-winged creature of darkness.',
  scorpion: 'Its venomous tail curls menacingly overhead.',
  lion: 'The undisputed ruler of the open plains.',
  mammoth: 'An ancient giant, its tusks gleam in the cold.',
  toad: 'A plump amphibian content in damp places.',
  eagle: 'Razor talons and keen eyes that miss nothing.',
  parrot: 'Brilliant plumage and a raucous cry.',
  crab: 'Armored and sidling, pincers at the ready.',
  goat: 'Sure-footed on the steepest cliffs.',
  imp: 'A small fiend darting through infernal smoke.',
  hellhound: 'A savage hound forged in brimstone.',
}

const BIOME_NAMES: Record<number, string> = {
  [BiomeType.Forest]: 'Verdant Forest',
  [BiomeType.Desert]: 'Scorching Desert',
  [BiomeType.Swamp]: 'Murky Swamp',
  [BiomeType.Snow]: 'Frozen Highlands',
  [BiomeType.Volcanic]: 'Volcanic Wastes',
  [BiomeType.Crystal]: 'Crystal Fields',
  [BiomeType.Jungle]: 'Dense Jungle',
  [BiomeType.Mesa]: 'Red Mesa',
  [BiomeType.CoralReef]: 'Coral Reef',
  [BiomeType.Heaven]: 'Celestial Realm',
  [BiomeType.Hell]: 'The Inferno',
}

const LANDMARK_NAMES: Record<number, string> = {
  [BiomeType.Forest]: 'Druid Ring Temple',
  [BiomeType.Desert]: 'Great Pyramid',
  [BiomeType.Swamp]: 'Swamp Ziggurat',
  [BiomeType.Snow]: 'Ice Palace',
  [BiomeType.Volcanic]: 'Obsidian Citadel',
  [BiomeType.Crystal]: 'Crystal Cathedral',
  [BiomeType.Jungle]: 'Jungle Pyramid',
  [BiomeType.Mesa]: 'Mesa Citadel',
  [BiomeType.CoralReef]: 'Coral Palace',
  [BiomeType.Heaven]: 'Cloud Temple',
  [BiomeType.Hell]: 'Infernal Citadel',
}

const WEATHER_NAMES_JOURNAL: Record<number, string> = {
  [WeatherType.Clear]: 'Clear Skies',
  [WeatherType.Rain]: 'Rainfall',
  [WeatherType.HeavyRain]: 'Thunderstorm',
  [WeatherType.Snow]: 'Snowfall',
  [WeatherType.Blizzard]: 'Blizzard',
  [WeatherType.Sandstorm]: 'Sandstorm',
  [WeatherType.AshFall]: 'Ash Fall',
  [WeatherType.Fog]: 'Dense Fog',
}

// Lore text fragments — 80 short lore entries
export const LORE_TEXTS: string[] = [
  'The Eighth Keeper vanished when the world fractured. Seven remain, scattered.',
  'Before the Shattering, all biomes were one continuous garden.',
  'The castle was the last thing the Keeper built before silence.',
  'Crystals are fragments of the old world\'s heart, still pulsing with memory.',
  'The creatures remember. They were here before the Keepers.',
  'Each biome is a dream made solid, stitched together by ancient will.',
  'The stairs to Heaven were carved by grief. The stairs to Hell, by rage.',
  'Seven NPCs wander the world, each carrying a piece of the truth.',
  'Finch maps the world because he fears forgetting what was lost.',
  'Vesper watches the stars, hoping one will blink back.',
  'Bramble broke his oath and walks the broken lands seeking penance.',
  'Plume weaves wind into bridges between floating stones.',
  'Cinder tends dying flames, each one a memory of a dead world.',
  'Pearl heals the wounded earth, dream by dream.',
  'Thornwick catalogues everything, terrified that words too will fade.',
  'The dragons are not evil. They are angry. There is a difference.',
  'Mammoths carry the weight of time in their tusks.',
  'The titans are sleeping gods, or dreaming ones.',
  'Sky whales sing to the clouds. The clouds sometimes answer.',
  'Wolves hunt in silence. That is their prayer.',
  'The forest remembers rain that fell a thousand years ago.',
  'Desert sand was once ocean floor. Listen — you can hear it.',
  'Volcanic glass holds reflections of the world before.',
  'Snow buries everything equally. It is the kindest biome.',
  'Swamp water dissolves certainty. Walk carefully.',
  'Tundra wind strips away everything unnecessary.',
  'Mushrooms are the thoughts of the earth, made visible.',
  'Ash falls like grief — constant, grey, without beginning or end.',
  'Crystals sing when no one listens. That is their nature.',
  'The savanna stretches toward something always just out of reach.',
  'Heaven is not a reward. It is a question.',
  'Hell is not punishment. It is an answer no one wanted.',
  'Alpine peaks collect silence like snow collects in drifts.',
  'Cliff faces are the world\'s oldest scars.',
  'Floating islands forgot how to fall. Or chose not to.',
  'The jungle grows faster than memory can map it.',
  'The mesa is a book written in layers of red stone.',
  'Coral grows in the shape of forgotten languages.',
  'Bog water remembers every footstep that ever sank into it.',
  'Badlands are what happens when the earth stops pretending.',
  'Taiga trees grow toward something they can almost see.',
  'The oasis exists because the desert needs to dream of water.',
  'The castle bell has not rung since the Keeper vanished.',
  'Artefacts hum with a frequency just below hearing.',
  'Each NPC guards a fragment of the Eighth Keeper\'s final words.',
  'The world generates itself from a single seed — number 42.',
  'Campfire smoke rises like questions without answers.',
  'Rune stones mark the places where the world is thinnest.',
  'Completing a biome\'s challenge strengthens the boundary.',
  'The Eighth Keeper saw the Shattering coming. Built the castle. Waited.',
  'Some say the creatures are thoughts that escaped the Keeper\'s mind.',
  'Day and night cycle because the world cannot decide on one.',
  'Weather is the world\'s mood. Blizzards are its nightmares.',
  'The player is the first new thing the world has seen in ages.',
  'Grapple hooks work because the world wants you to reach high places.',
  'Flying is not natural here. The world merely tolerates it.',
  'The crosshair marks the point where looking becomes choosing.',
  'Health regenerates because the world is not ready for you to leave.',
  'The seven artefacts are keys. The question is: to what?',
  'Every chunk of terrain is a 64-unit dream.',
  'Creatures mate and die. The world renews itself endlessly.',
  'The spatial grid organizes life into 32-unit cells of possibility.',
  'Rivers flow downhill because even water remembers gravity.',
  'The flashlight at night is a small rebellion against darkness.',
  'Each biome has its own sky. Each sky has its own silence.',
  'The Shattering scattered the Keepers across impossible distances.',
  'Rune challenges test whether you truly know a biome.',
  'A companion creature trusts you. Do not betray that trust.',
  'The golden collar is a promise. The creature understands.',
  'Campfires are agreements between traveler and darkness.',
  'Three campfires: one for where you were, one for where you are, one for where you\'ll be.',
  'Fast travel is a kindness the campfires offer freely.',
  'The journal records what the eyes see and the heart remembers.',
  'Discovery is its own reward. The counter is just a formality.',
  'Predators flee campfire light. Even hunger respects fire.',
  'Herbivores gather near warmth. It reminds them of something older.',
  'The Eighth Keeper\'s ghost waits in the castle. Patient. Hopeful.',
  'When all runes glow, the world remembers itself.',
  'This lore stone was placed here by someone who wanted you to find it.',
  'You are reading this. That means the world is working.',
]

export function buildJournalEntries(): JournalEntry[] {
  const entries: JournalEntry[] = []

  // Creatures (21 non-giant species)
  for (const species of JOURNAL_SPECIES) {
    entries.push({
      key: `creature_${species}`,
      name: CREATURE_NAMES[species] || species,
      description: CREATURE_DESCS[species] || 'A creature of this world.',
      category: 'creature',
    })
  }

  // Biomes (11) — narrative descriptions referencing the Resonance Builders
  const BIOME_NARRATIVE: Record<number, string> = {
    [BiomeType.Forest]: 'Where the Builders first heard the world\'s frequency beneath the roots. The deer still circle the old resonance stones at dusk.',
    [BiomeType.Desert]: 'The Builders\' civilization grew here, amplifying the desert\'s dry frequency through monuments of stone and air. The sand still vibrates near the pyramid.',
    [BiomeType.Swamp]: 'Here the harmony first broke. The bog absorbs sound and twists it. Ancient pipes leak gas the Builders could never seal.',
    [BiomeType.Snow]: 'The Builders froze their knowledge into the ice. Mammoth herds encode memories in their breath-patterns. What the ice preserves, the thaw reveals.',
    [BiomeType.Volcanic]: 'Beneath the fire, the world\'s deepest frequency. The Builders tapped it for power, channeling lava through carved conduits of pure resonance.',
    [BiomeType.Crystal]: 'The crystals carry signals across the world — a network the Builders awakened but did not create. Every formation sings the same song.',
    [BiomeType.Jungle]: 'The strongest frequency, dense and layered. The Builders built platforms to rise above the canopy and hear the individual notes within the green chord.',
    [BiomeType.Mesa]: 'The world\'s own memory, written in layered stone. Each stratum a different age, each fossil a note in a chord millions of years old.',
    [BiomeType.CoralReef]: 'The tides carry frequencies between continents. The reef is a crossroads of harmonics where every current arrives bearing a song from elsewhere.',
    [BiomeType.Heaven]: 'The Builders rode harmonics upward and built platforms in the sky. The skywhales sing the original chord — but Heaven is crumbling.',
    [BiomeType.Hell]: 'Born from the Builders\' failed experiment — a new frequency that cracked the harmony. Dissonance given form, growing when the chord weakens.',
  }

  for (let i = 0; i <= 10; i++) {
    const biome = i as BiomeType
    entries.push({
      key: `biome_${biome}`,
      name: BIOME_NAMES[biome] || `Biome ${biome}`,
      description: BIOME_NARRATIVE[biome] || `You visited the ${BIOME_NAMES[biome] || 'unknown'}.`,
      category: 'biome',
    })
  }

  // Landmarks (11) — narrative descriptions
  const LANDMARK_NARRATIVE: Record<number, string> = {
    [BiomeType.Forest]: 'The Druid Ring — the Builders\' first resonance experiment. Stones tuned to the forest\'s voice still hum when the wind is right.',
    [BiomeType.Desert]: 'The Great Pyramid — their masterwork of amplification. When the capstone was placed, every grain of sand within a league trembled.',
    [BiomeType.Swamp]: 'The Ziggurat — an attempt to purify the swamp\'s corrupted frequency. It failed beautifully, vibrating with a chord between harmony and dissonance.',
    [BiomeType.Snow]: 'The Ice Palace — sung into shape during the longest night. Each wall a frozen waveform, re-sung each winter as the summer melt erases it.',
    [BiomeType.Volcanic]: 'The Obsidian Citadel — forged in eruption. The Builders convinced the volcano to shape itself; molten stone flowed into molds of pure sound.',
    [BiomeType.Crystal]: 'The Crystal Cathedral — built where seven crystal veins intersect. Stand at its center and hear every biome\'s frequency at once.',
    [BiomeType.Jungle]: 'The Jungle Pyramid — consumed by growth within a decade. Its resonance chambers merged with the canopy until jungle and structure became one instrument.',
    [BiomeType.Mesa]: 'The Mesa Citadel — carved, not built. Every removed stone changed the cliff\'s resonance. The architects worked by ear as much as by eye.',
    [BiomeType.CoralReef]: 'The Coral Palace — half-submerged to listen to both worlds. Above: wind and birdsong. Below: the deep hum of currents that circle the globe.',
    [BiomeType.Heaven]: 'The Cloud Temple — where every frequency arrives in perfect balance. For one moment, the Builders heard the world as it was meant to sound.',
    [BiomeType.Hell]: 'The Infernal Citadel — not built by the Builders. It assembled itself from the wreckage of their greatest experiment.',
  }

  for (let i = 0; i <= 10; i++) {
    const biome = i as BiomeType
    entries.push({
      key: `landmark_${biome}`,
      name: LANDMARK_NAMES[biome] || `Landmark ${biome}`,
      description: LANDMARK_NARRATIVE[biome] || `A monument found in the ${BIOME_NAMES[biome] || 'unknown'}.`,
      category: 'landmark',
    })
  }

  // Weather (8)
  for (let i = 0; i <= 7; i++) {
    entries.push({
      key: `weather_${i}`,
      name: WEATHER_NAMES_JOURNAL[i] || `Weather ${i}`,
      description: `You experienced ${WEATHER_NAMES_JOURNAL[i] || 'unknown weather'}.`,
      category: 'weather',
    })
  }

  // Narrative lore fragments from LoreContent (biome-specific)
  const allFragments = getAllFragments()
  for (const frag of allFragments) {
    entries.push({
      key: `lore_${frag.id}`,
      name: `Resonance Fragment: ${frag.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
      description: frag.text,
      category: 'lore',
    })
  }

  // Legacy lore stones (kept for backward compatibility with existing saves)
  for (let i = 0; i < LORE_TEXTS.length; i++) {
    entries.push({
      key: `lore_${i}`,
      name: `Lore Fragment #${i + 1}`,
      description: LORE_TEXTS[i],
      category: 'lore',
    })
  }

  return entries
}

export const TOTAL_ENTRIES = 21 + 11 + 11 + 8 + TOTAL_LORE_FRAGMENTS + LORE_TEXTS.length
