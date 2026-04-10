import { BiomeType } from '../biomes/types'

export type NPCId = 'finch' | 'vesper' | 'bramble' | 'plume' | 'cinder' | 'pearl' | 'thornwick'

export type TimeCondition = 'day' | 'night' | 'dawn' | 'dusk'

export interface DialogueLine {
  text: string
  timeCondition?: TimeCondition
  minLoreFound?: number
  requiresSiteActivated?: BiomeType[]
  companionSpecies?: string
}

export interface NPCVisualConfig {
  robeColor: number
  trimColor: number
  glowColor: number
  eyeColor: number
  eyeEmissive: boolean
  hasGlow: boolean
  hat: 'wideBrim' | 'pointed' | 'starOrnament' | 'books' | 'none'
  backItem: 'scroll' | 'brokenSword' | 'hammer' | 'pouches' | 'books' | 'none'
  bodyScale: number
}

export interface NPCLocation {
  biome: BiomeType
  offset: { x: number; z: number }
}

export interface ArtefactDef {
  name: string
  color: number
  nearBiome: BiomeType
}

export interface NPCDef {
  id: NPCId
  name: string
  title: string
  visual: NPCVisualConfig
  locations: NPCLocation[]
  dialogue: DialogueLine[][]  // 4 stages, each with 3-4 lines (some night-only)
  artefact: ArtefactDef
  mapColor: string
  mapLabel: string
}

export const NPC_DEFINITIONS: Record<NPCId, NPCDef> = {
  finch: {
    id: 'finch',
    name: 'Finch',
    title: 'The Wandering Cartographer',
    visual: {
      robeColor: 0xc8a030,
      trimColor: 0x886620,
      glowColor: 0xe8b040,
      eyeColor: 0x44dd88,
      eyeEmissive: false,
      hasGlow: true,
      hat: 'wideBrim',
      backItem: 'scroll',
      bodyScale: 1.0,
    },
    locations: [
      { biome: BiomeType.Forest, offset: { x: 20, z: 18 } },
      { biome: BiomeType.Desert, offset: { x: -15, z: 22 } },
      { biome: BiomeType.Desert, offset: { x: 18, z: -16 } },
      { biome: BiomeType.Desert, offset: { x: -20, z: -18 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Forest)
      [
        { text: "Oh! A traveler! The trees keep rearranging when I'm not looking. Or perhaps I do. Hard to say." },
        { text: "I've drawn maps of every biome, but they never quite fit together. Like a torn painting." },
        { text: "The forest hums at a frequency just below hearing. Press your hand to the oldest tree and you'll feel it." },
        { text: "I've heard the desert hums at dawn. Never been brave enough to check." },
        { text: "The stones glow differently after dark. The old ones, the ones with markings. They remember.", timeCondition: 'night' },
        { text: "The swamp keeps secrets that the forest only whispers about." },
        { text: "Ah, you travel with a fox. They know paths that aren't on any map.", companionSpecies: 'fox' },
        { text: "A deer companion. The deer remember a dance that we've forgotten.", companionSpecies: 'deer' },
        { text: "That bird above you — it sees what the ground hides.", companionSpecies: 'bird' },
        { text: "Goats always know where the earth is thinnest. Trust yours.", companionSpecies: 'goat' },
        { text: "You've been reading the stones. Good. The land has more to say than any of us.", minLoreFound: 3 },
        { text: "Since the forest site awakened, my compass twitches north again. Almost.", requiresSiteActivated: [BiomeType.Forest] },
      ],
      // Stage 2 — Cross-biome hints
      [
        { text: "Oh, you found me again! The world rearranged. That's my theory anyway." },
        { text: "An astronomer in the peaks — Vesper. She reads the cracked sky like a book." },
        { text: "The stars used to form a map. Now there are gaps shaped like questions." },
        { text: "They speak louder after dark. The stones, I mean.", timeCondition: 'night' },
        { text: "A fox walked me to a stone once. Sat beside it until I listened.", companionSpecies: 'fox' },
        { text: "So many stones found. You're assembling a language nobody taught you.", minLoreFound: 8 },
        { text: "The snow peaks feel different now. Warmer, maybe. Or just less lonely.", requiresSiteActivated: [BiomeType.Snow] },
      ],
      // Stage 3 — Mystery deepens
      [
        { text: "A knight in the swamps — Bramble. He carries a broken sword and a heavier burden." },
        { text: "Everyone holds one shard of the same story. Even me." },
        { text: "Night makes cartographers of us all. Everything looks different in the dark.", timeCondition: 'night' },
        { text: "Two sites humming now. The map is drawing itself.", requiresSiteActivated: [BiomeType.Forest, BiomeType.Snow] },
      ],
      // Stage 4 — Reflection
      [
        { text: "The more I map this world, the more it feels intentional. Like controlled demolition." },
        { text: "Find Thornwick. He reads books nobody else can. Last I heard, he was freezing somewhere." },
        { text: "Safe travels. And if my map leads you off a cliff — that's a feature." },
      ],
    ],
    artefact: {
      name: 'The Torn Map',
      color: 0xddcc66,
      nearBiome: BiomeType.Forest,
    },
    mapColor: '#e8b040',
    mapLabel: 'FN',
  },

  vesper: {
    id: 'vesper',
    name: 'Vesper',
    title: 'The Mourning Astronomer',
    visual: {
      robeColor: 0x334488,
      trimColor: 0x5566aa,
      glowColor: 0x6688ff,
      eyeColor: 0xaaccff,
      eyeEmissive: false,
      hasGlow: true,
      hat: 'starOrnament',
      backItem: 'none',
      bodyScale: 0.95,
    },
    locations: [
      { biome: BiomeType.Snow, offset: { x: -18, z: 20 } },
      { biome: BiomeType.Crystal, offset: { x: 22, z: -14 } },
      { biome: BiomeType.Heaven, offset: { x: -16, z: 18 } },
      { biome: BiomeType.Snow, offset: { x: 20, z: 16 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Snow)
      [
        { text: "The stars weep. Can you hear them? No. Of course not." },
        { text: "I charted every star for forty years. Then the sky stuttered like old glass." },
        { text: "The snow holds light from constellations that no longer exist." },
        { text: "The crystal caves still bend light the old way. Refractions of what was." },
        { text: "The world breathes differently at night. You can almost hear what it lost.", timeCondition: 'night' },
        { text: "The desert sands shift in patterns that mirror the missing stars." },
        { text: "A fox at your heel. They see the old starlight that we've forgotten.", companionSpecies: 'fox' },
        { text: "Your deer knows the old paths. Watch where it pauses — those places still resonate.", companionSpecies: 'deer' },
        { text: "That bird traces arcs the lost constellations used to follow.", companionSpecies: 'bird' },
        { text: "Goats climb toward what's highest. Perhaps yours seeks the sky I mourn.", companionSpecies: 'goat' },
        { text: "You've gathered fragments of the old language. The stones speak more freely now.", minLoreFound: 3 },
        { text: "The snow site awakens. A star I thought dead just flickered.", requiresSiteActivated: [BiomeType.Snow] },
      ],
      // Stage 2 — Cross-biome connections
      [
        { text: "Each crystal hums a note from the old Harmony. Fragments of a song." },
        { text: "A cartographer — Finch — maps the broken world with such optimism. I envy that." },
        { text: "Eight Keepers once. The Eighth has no name now. Convenient, that." },
        { text: "At night the old constellations almost form again. An absence shaped like intent.", timeCondition: 'night' },
        { text: "Your deer pauses near the resonance. It hears the note I've been chasing.", companionSpecies: 'deer' },
        { text: "So many stones read. You carry more of the old sky than I do.", minLoreFound: 8 },
        { text: "The crystal site sings again. The refractions have found their source.", requiresSiteActivated: [BiomeType.Crystal] },
      ],
      // Stage 3 — Revelation
      [
        { text: "Above the clouds, the cracks are thinner. The old sky almost looks whole." },
        { text: "The Eighth saw something coming. A darkness between constellations, growing." },
        { text: "The Shattering wasn't destruction. It was surgery.", timeCondition: 'night' },
        { text: "Two wounds in the sky have closed. The pattern reshapes itself.", requiresSiteActivated: [BiomeType.Snow, BiomeType.Crystal] },
      ],
      // Stage 4 — Resolution
      [
        { text: "Each fragment still holds light. That must count for something." },
        { text: "Find Pearl. The healer. She dreams the old world whole." },
        { text: "...and what we saved." },
      ],
    ],
    artefact: {
      name: 'The Cracked Astrolabe',
      color: 0x6688ff,
      nearBiome: BiomeType.Snow,
    },
    mapColor: '#6688ff',
    mapLabel: 'VS',
  },

  bramble: {
    id: 'bramble',
    name: 'Bramble',
    title: 'The Cursed Knight',
    visual: {
      robeColor: 0x445544,
      trimColor: 0x333833,
      glowColor: 0x668866,
      eyeColor: 0xff2200,
      eyeEmissive: true,
      hasGlow: false,  // No glow — signifies shame
      hat: 'none',
      backItem: 'brokenSword',
      bodyScale: 1.15,
    },
    locations: [
      { biome: BiomeType.Swamp, offset: { x: 22, z: -20 } },
      { biome: BiomeType.Swamp, offset: { x: -18, z: -22 } },
      { biome: BiomeType.Snow, offset: { x: 16, z: 20 } },
      { biome: BiomeType.Volcanic, offset: { x: -22, z: 16 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Swamp)
      [
        { text: "What do you want. No, don't answer. Turn around." },
        { text: "This sword on my back. Sundered. Broken. Just like everything I've touched." },
        { text: "I struck the blow that shattered the world. Does that satisfy you?" },
        { text: "The swamp water glows where old roots remember the Harmony." },
        { text: "At night the blade still rings. A thin sound, like a bell underwater.", timeCondition: 'night' },
        { text: "Go find Plume in the mushroom groves. At least she'll entertain you while she lies." },
        { text: "That fox watches me like it knows what I did.", companionSpecies: 'fox' },
        { text: "Your deer flinches near me. Smart animal. Knows a blade-bearer when it sees one.", companionSpecies: 'deer' },
        { text: "Your bird won't land near me. Even the sky keeps its distance.", companionSpecies: 'bird' },
        { text: "A goat. Stubborn creature. Reminds me of someone I'd rather forget.", companionSpecies: 'goat' },
        { text: "You've been finding the old stones. They tell a kinder version of my story.", minLoreFound: 3 },
        { text: "The swamp site stirs. Even the rot tastes different now.", requiresSiteActivated: [BiomeType.Swamp] },
      ],
      // Stage 2 — Opens up
      [
        { text: "You again. Persistent." },
        { text: "I was told the strike would save the Harmony. Forge it anew. I believed that." },
        { text: "Cinder forged the blade. Poured everything into it. We were both tools." },
        { text: "The dark pulls up truths. The swamp and I have that in common.", timeCondition: 'night' },
        { text: "Your fox sniffs at the blade's shadow. Perhaps it smells the old Harmony.", companionSpecies: 'fox' },
        { text: "The stones you carry — they hold pieces of the moment I'd rather forget.", minLoreFound: 8 },
        { text: "The volcanic site woke. Cinder must feel that in his bones.", requiresSiteActivated: [BiomeType.Volcanic] },
      ],
      // Stage 3 — Dawning understanding
      [
        { text: "I've walked every waste punishing myself. But lately I wonder..." },
        { text: "What if the blow actually saved the world? Not how I intended, but the only way left?" },
        { text: "Vesper spoke of darkness in the stars. Something consuming. What if shattering was mercy?", timeCondition: 'night' },
        { text: "Sites awakening. The pieces I broke are mending themselves.", requiresSiteActivated: [BiomeType.Swamp, BiomeType.Volcanic] },
      ],
      // Stage 4 — Near resolution
      [
        { text: "I came back to the fire. Endings and beginnings share the same warmth." },
        { text: "Find Thornwick. He has the last page." },
        { text: "Tell him Bramble is done running." },
      ],
    ],
    artefact: {
      name: 'The Sundered Blade',
      color: 0x88aa88,
      nearBiome: BiomeType.Swamp,
    },
    mapColor: '#668866',
    mapLabel: 'BR',
  },

  plume: {
    id: 'plume',
    name: 'Plume',
    title: 'The Trickster Merchant',
    visual: {
      robeColor: 0x992288,
      trimColor: 0xcc44ee,
      glowColor: 0xcc44ee,
      eyeColor: 0xffcc00,
      eyeEmissive: false,
      hasGlow: true,
      hat: 'pointed',
      backItem: 'pouches',
      bodyScale: 0.9,
    },
    locations: [
      { biome: BiomeType.Swamp, offset: { x: -20, z: 16 } },
      { biome: BiomeType.Jungle, offset: { x: 18, z: -20 } },
      { biome: BiomeType.Mesa, offset: { x: -16, z: -18 } },
      { biome: BiomeType.Mesa, offset: { x: 22, z: 14 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Swamp/Mushroom)
      [
        { text: "Step right up! Plume's Emporium of Truths and Outright Fabrications!" },
        { text: "They call me a liar. I prefer 'narrative entrepreneur.'" },
        { text: "The mushrooms here grow in spirals that match the old Harmony's rhythm." },
        { text: "I hear the jungle vines still sing at dawn, if you know how to listen." },
        { text: "Night buyer's rate: the stones that glow after dark hold secrets even I can't sell.", timeCondition: 'night' },
        { text: "The mesa canyons echo with a voice that isn't wind." },
        { text: "Ah, a fox! They're natural merchants — always trading silence for knowledge.", companionSpecies: 'fox' },
        { text: "A deer at your side. Careful — they trade in honesty. Bad for my business.", companionSpecies: 'deer' },
        { text: "Your bird has sharp eyes. It'll find my hidden wares before you do.", companionSpecies: 'bird' },
        { text: "A goat? Stubborn customers, goats. Never accept the first offer.", companionSpecies: 'goat' },
        { text: "You've been reading the stones. Collecting truths I haven't catalogued yet.", minLoreFound: 3 },
        { text: "A site awakened in the swamp. Even lies ring truer there now.", requiresSiteActivated: [BiomeType.Swamp] },
      ],
      // Stage 2 — Real intel
      [
        { text: "You came back. You want truth, not trinkets." },
        { text: "Eight Keepers, not seven. Everyone forgets the Eighth. Convenient." },
        { text: "The Eighth had no title. Just purpose. When the darkness came, they acted alone." },
        { text: "After dark, secrets have fewer places to hide.", timeCondition: 'night' },
        { text: "Your fox tilts its head at me. It knows I'm mixing truth with performance.", companionSpecies: 'fox' },
        { text: "All those stones, and still you come to me for answers. Flattering.", minLoreFound: 8 },
        { text: "The jungle site hums now. Even my stories feel heavier there.", requiresSiteActivated: [BiomeType.Jungle] },
      ],
      // Stage 3 — Drops the mask
      [
        { text: "Between you and me — I miss the unbroken world." },
        { text: "I was the Keeper of Stories. Now the stories are scattered too." },
        { text: "Who whispered to Bramble where to strike? Not me. The Eighth.", timeCondition: 'night' },
        { text: "Sites waking everywhere. My old stories are becoming true again.", requiresSiteActivated: [BiomeType.Swamp, BiomeType.Jungle] },
      ],
      // Stage 4 — Almost honest
      [
        { text: "The Eighth loved this world more than any of us. That's why they broke it." },
        { text: "Pearl dreams the moment it happened. Ask her gently." },
        { text: "Find Thornwick. Tell him Plume sent you." },
      ],
    ],
    artefact: {
      name: 'The Whispering Coin',
      color: 0xcc66ff,
      nearBiome: BiomeType.Swamp,
    },
    mapColor: '#cc44ee',
    mapLabel: 'PL',
  },

  cinder: {
    id: 'cinder',
    name: 'Cinder',
    title: 'The Exiled Forgemaster',
    visual: {
      robeColor: 0x884422,
      trimColor: 0xcc5500,
      glowColor: 0xee6622,
      eyeColor: 0xff8800,
      eyeEmissive: true,
      hasGlow: true,
      hat: 'none',
      backItem: 'hammer',
      bodyScale: 1.1,
    },
    locations: [
      { biome: BiomeType.Volcanic, offset: { x: 18, z: 22 } },
      { biome: BiomeType.Volcanic, offset: { x: -22, z: -16 } },
      { biome: BiomeType.Hell, offset: { x: 16, z: -20 } },
      { biome: BiomeType.Snow, offset: { x: -18, z: 18 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Volcanic)
      [
        { text: "The metal still sings here. This is where I forged the Blade of Ending." },
        { text: "A smith doesn't choose how his weapons are used. That's what I tell myself." },
        { text: "The lava remembers the heat of the first forging. Before any of us existed." },
        { text: "The Eighth brought me the design. Said it was surgery, not violence." },
        { text: "The forge is loudest after dark. The old ore remembers the heat of creation.", timeCondition: 'night' },
        { text: "I hear there's ice in the far peaks that won't melt. Frozen in the moment of the Shattering." },
        { text: "Your fox watches the forge-light. It sees the old fire beneath the new.", companionSpecies: 'fox' },
        { text: "That deer stands where the cooling water flows. It knows the metal's grief.", companionSpecies: 'deer' },
        { text: "Your bird circles the smoke. Even ash carries messages.", companionSpecies: 'bird' },
        { text: "A goat here? They seek the hottest stone. Perhaps it reminds them of something.", companionSpecies: 'goat' },
        { text: "The stones you carry hum near the forge. Old metal recognizes old words.", minLoreFound: 3 },
        { text: "The volcanic site pulses. My hammer hand twitches in answer.", requiresSiteActivated: [BiomeType.Volcanic] },
      ],
      // Stage 2 — Connecting to Bramble
      [
        { text: "Bramble came to me before the strike. Hands shaking. Eyes full of borrowed purpose." },
        { text: "The world isn't broken. It's redistributed." },
        { text: "The pieces won't reforge. I've tried." },
        { text: "At night I hear the blade in memory. One clean note. One perfect strike.", timeCondition: 'night' },
        { text: "Your fox pressed its nose to the old anvil. Smelled something I've missed.", companionSpecies: 'fox' },
        { text: "All those fragments gathered. You carry the Harmony's echo now.", minLoreFound: 8 },
        { text: "The hell-fires burn calmer since the deep site woke.", requiresSiteActivated: [BiomeType.Hell] },
      ],
      // Stage 3 — Truth
      [
        { text: "The Eighth's workshop was down here. I found their notes." },
        { text: "They calculated everything. The angle, the frequency, the exact fracture point." },
        { text: "It wasn't chaos. It was the most precise creation I've ever seen.", timeCondition: 'night' },
        { text: "Two forges answer each other now. The old frequency is returning.", requiresSiteActivated: [BiomeType.Volcanic, BiomeType.Hell] },
      ],
      // Stage 4 — Acceptance
      [
        { text: "I've stopped trying to reforge. You can't unmake mercy." },
        { text: "Each biome hums the old song. Quieter now. Spread thinner." },
        { text: "Thornwick has the Eighth's journal. The real one." },
      ],
    ],
    artefact: {
      name: 'The Cooling Ingot',
      color: 0xff8844,
      nearBiome: BiomeType.Volcanic,
    },
    mapColor: '#ee6622',
    mapLabel: 'CI',
  },

  pearl: {
    id: 'pearl',
    name: 'Pearl',
    title: 'The Dreaming Healer',
    visual: {
      robeColor: 0xccccdd,
      trimColor: 0xeeeeff,
      glowColor: 0xeeeeff,
      eyeColor: 0xffffff,
      eyeEmissive: false,
      hasGlow: true,
      hat: 'none',
      backItem: 'none',
      bodyScale: 0.9,
    },
    locations: [
      { biome: BiomeType.CoralReef, offset: { x: 16, z: -18 } },
      { biome: BiomeType.Desert, offset: { x: -20, z: 14 } },
      { biome: BiomeType.Heaven, offset: { x: 18, z: 20 } },
      { biome: BiomeType.Heaven, offset: { x: -14, z: -22 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Coral Reef)
      [
        { text: "Sorry, I was dreaming. The old world visits me when I sleep." },
        { text: "The Harmony plays in my dreams. Seven voices, eight parts. The eighth is silence." },
        { text: "The coral grows in patterns from before the Shattering. It remembers the melody." },
        { text: "If you find Vesper, tell her the stars in my dreams are still whole." },
        { text: "The dreams are clearest at night. I can almost touch the Eighth's memory.", timeCondition: 'night' },
        { text: "The desert oasis reflects a sky that hasn't existed for ages." },
        { text: "Your fox curls beside me when I dream. It sees what I see.", companionSpecies: 'fox' },
        { text: "The deer knows the old dance. In my dreams, the whole world dances with it.", companionSpecies: 'deer' },
        { text: "That bird sings a note from the old Harmony. Only one, but it's enough.", companionSpecies: 'bird' },
        { text: "Your goat stands so still near me. Perhaps it dreams too.", companionSpecies: 'goat' },
        { text: "The stones you've touched glow in my dreams. Brighter each time.", minLoreFound: 3 },
        { text: "The coral site wakes. My dreams have color again.", requiresSiteActivated: [BiomeType.CoralReef] },
      ],
      // Stage 2 — Visions clearer
      [
        { text: "I dreamed of the Shattering. It was terrible and beautiful." },
        { text: "The Eighth stood at the center. They didn't flinch. They let go." },
        { text: "They poured themselves into the breaking. The mortar between the shards." },
        { text: "At night the visions speak freely. Daylight makes them shy.", timeCondition: 'night' },
        { text: "Your deer stood in my dream last night. It was leading me somewhere.", companionSpecies: 'deer' },
        { text: "So many fragments found. My dreams grow sharper with each one you carry.", minLoreFound: 8 },
        { text: "The desert site pulses. In my dreams, it sounds like a heartbeat.", requiresSiteActivated: [BiomeType.Desert] },
      ],
      // Stage 3 — The sacrifice
      [
        { text: "Between earth and sky, I can almost reach the Eighth. Woven into everything." },
        { text: "They gave themselves to hold the broken world together. Nothing left to find." },
        { text: "We can't remember their name. They became every breeze, every grain of sand.", timeCondition: 'night' },
        { text: "Two sites dreaming in harmony now. The Eighth stirs in the deep places.", requiresSiteActivated: [BiomeType.CoralReef, BiomeType.Heaven] },
      ],
      // Stage 4 — Final truth
      [
        { text: "The old world was dying. Something vast and hungry was coming." },
        { text: "We weren't broken. We were saved. Each biome is a lifeboat." },
        { text: "Go to Thornwick. He has the words I can only see in dreams." },
      ],
    ],
    artefact: {
      name: 'The Dreaming Vial',
      color: 0xddddff,
      nearBiome: BiomeType.CoralReef,
    },
    mapColor: '#eeeeff',
    mapLabel: 'PE',
  },

  thornwick: {
    id: 'thornwick',
    name: 'Thornwick',
    title: 'The Mad Librarian',
    visual: {
      robeColor: 0x556633,
      trimColor: 0x88aa44,
      glowColor: 0x88aa44,
      eyeColor: 0xccff88,
      eyeEmissive: false,
      hasGlow: true,
      hat: 'none',
      backItem: 'books',
      bodyScale: 1.0,
    },
    locations: [
      { biome: BiomeType.Snow, offset: { x: -16, z: -20 } },
      { biome: BiomeType.Volcanic, offset: { x: 20, z: 16 } },
      { biome: BiomeType.Swamp, offset: { x: -22, z: -14 } },
      { biome: BiomeType.Forest, offset: { x: 16, z: -22 } },
    ],
    dialogue: [
      // Stage 1 — Introduction (Snow/Tundra)
      [
        { text: "A seeker! Can you read? Doesn't matter. I'll read for you." },
        { text: "The Shattering wasn't a tragedy. It was a thesis. Applied metaphysics." },
        { text: "Seven Keepers, eight parts, one Harmony. Nobody reads the books!" },
        { text: "The volcanic forges hold pages written in heat. I must go there next." },
        { text: "These chapters only reveal themselves at night. Ink that fears the sun.", timeCondition: 'night' },
        { text: "The swamp's oldest trees have bark-writing. Older than any of my books." },
        { text: "A fox! Foxes can read the wind. Page seven of my field guide confirms it.", companionSpecies: 'fox' },
        { text: "Your deer. Deer appear in chapter twelve — the Keepers' first companions.", companionSpecies: 'deer' },
        { text: "That bird! Birds carried messages between the Keepers. It's in the appendix.", companionSpecies: 'bird' },
        { text: "A goat. Page 204: 'The mountain goat knows every page the mountain has written.'", companionSpecies: 'goat' },
        { text: "You've been reading the stones! Cross-referencing beautifully with my notes.", minLoreFound: 3 },
        { text: "A site activated in the snow. My frozen ink is thawing. Literally.", requiresSiteActivated: [BiomeType.Snow] },
      ],
      // Stage 2 — Connecting threads
      [
        { text: "Page 203: 'When the Consuming Dark reaches the outer stars, the Harmony must be unmade.'" },
        { text: "Written centuries before it happened. The Eighth planned everything." },
        { text: "Us, scattered across biomes — intentional. Seven fragments keeping seven worlds alive." },
        { text: "Page 312 only shows ink at night. The Eighth encoded darkness-responsive text.", timeCondition: 'night' },
        { text: "Your fox led me to a passage I'd overlooked. Remarkable research assistant.", companionSpecies: 'fox' },
        { text: "Your stone collection rivals my library. Different format, same knowledge.", minLoreFound: 8 },
        { text: "The volcanic site stirs. Cross-reference with chapter nine — the Forge Prophecy.", requiresSiteActivated: [BiomeType.Volcanic] },
      ],
      // Stage 3 — Full picture
      [
        { text: "Plume says I'm mad. Correct, but beside the point." },
        { text: "The Eighth didn't just shatter the Harmony. They became it. Every atom." },
        { text: "That's why rain still falls and mushrooms bloom. The Eighth runs in the background.", timeCondition: 'night' },
        { text: "Multiple sites singing. The bibliography is assembling itself.", requiresSiteActivated: [BiomeType.Snow, BiomeType.Volcanic] },
      ],
      // Stage 4 — The ending
      [
        { text: "Full circle. Forest. Where the first Keeper woke with no memory." },
        { text: "The Consuming Dark still exists beyond the edges. But it can't get in." },
        { text: "The Eighth's sacrifice was love so vast it rewrote reality." },
        { text: "You — collecting, listening, piecing together — you're doing what the Eighth hoped. Remembering." },
      ],
    ],
    artefact: {
      name: 'The Nameless Tome',
      color: 0xaacc66,
      nearBiome: BiomeType.Snow,
    },
    mapColor: '#88aa44',
    mapLabel: 'TW',
  },
}

export const ALL_NPC_IDS: NPCId[] = ['finch', 'vesper', 'bramble', 'plume', 'cinder', 'pearl', 'thornwick']
