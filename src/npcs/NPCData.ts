import { BiomeType } from '../biomes/types'

export type NPCId = 'finch' | 'vesper' | 'bramble' | 'plume' | 'cinder' | 'pearl' | 'thornwick'

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
  dialogue: string[][]  // 4 stages, each with 3-4 lines
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
      { biome: BiomeType.Savanna, offset: { x: -15, z: 22 } },
      { biome: BiomeType.Oasis, offset: { x: 18, z: -16 } },
      { biome: BiomeType.Desert, offset: { x: -20, z: -18 } },
    ],
    dialogue: [
      // Stage 1 — Forest (introduces world, cheerful, scatterbrained)
      [
        "Oh! A traveler! You have no idea how long I've been mapping these woods. The trees keep... moving. Or maybe I do. Hard to say!",
        "This world wasn't always broken apart like this, you know. Used to be one big beautiful place. Now it's all... chunks. Like a dropped mirror.",
        "I've drawn maps of every biome I can find, but they never quite fit together. Like someone tore a painting into pieces and shuffled them.",
        "Head south toward the savanna if you want answers. Or was it north? My compass hasn't worked since The Shattering. None of them do.",
      ],
      // Stage 2 — Savanna (mentions Vesper, sends player onward)
      [
        "Oh, you found me again! I swear I didn't move—the world just... rearranged. That's my theory anyway.",
        "I met an astronomer once, up in the snowy peaks. Vesper, she called herself. Terribly sad woman. Said she could read the old sky, before it cracked.",
        "She told me the stars used to form a pattern—a map of the whole realm. Now there are gaps where constellations used to be. Gave me chills.",
      ],
      // Stage 3 — Oasis (mentions Bramble, hints at the knight's guilt)
      [
        "There's a knight wandering the swamps. Bramble. Big fellow, broken sword on his back. Won't look you in the eye.",
        "He told me—well, mumbled really—that he struck the blow that broke the world. Can you imagine carrying that guilt?",
        "Funny thing is, everyone I talk to has a different piece of the story. Like we're all holding one shard of the same broken mirror.",
      ],
      // Stage 4 — Desert (reflects, hints at bigger truth)
      [
        "You know what's strange? The more I map this world, the more it feels... intentional. Like someone broke it on purpose.",
        "Not out of malice. More like... tearing down a house before a flood takes it. Controlled demolition, you might say.",
        "If you really want the whole truth, find Thornwick. Eccentric old librarian, last I heard he was freezing in the tundra. He reads books nobody else can.",
        "Safe travels, friend. And if my map leads you off a cliff—well, that's a feature, not a bug!",
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
      { biome: BiomeType.Alpine, offset: { x: 20, z: 16 } },
    ],
    dialogue: [
      // Stage 1 — Snow (melancholic, poetic, introduces cosmic lore)
      [
        "...the stars weep. Can you hear them? No. Of course not. Only I can, and I wish I couldn't.",
        "Before The Shattering, the night sky told a story. Seven constellations for seven Keepers. Now three are missing entirely.",
        "I charted every star for forty years. Then one morning the sky... stuttered. Cracked like old glass. And the Harmony was gone.",
        "Somewhere up in the crystal caves, the light still bends the way it used to. Refractions of the old world. I must go see.",
      ],
      // Stage 2 — Crystal (connects to Finch, deepens lore)
      [
        "The crystals remember what we've forgotten. Each one hums a note from the old Harmony. If you listen... fragments of a song.",
        "A cartographer found me once. Finch. Bright little soul. She maps the broken world with such... optimism. I envy that.",
        "There were eight of us originally. Eight Keepers. But the Eighth... we don't speak that name. Not anymore.",
      ],
      // Stage 3 — Heaven (reveals the sky's truth)
      [
        "Up here, above the clouds, the old sky almost looks whole. Almost. The cracks are thinner at this altitude.",
        "The Eighth Keeper saw something coming. Something that would devour the world whole. I know because I saw it too—in the stars.",
        "A darkness between constellations. Growing. Hungry. The Shattering wasn't destruction. It was... surgery. Cutting away the infected limb.",
      ],
      // Stage 4 — Alpine (final reflection)
      [
        "I've made my peace with the broken sky. Each fragment still holds light. That must count for something.",
        "Find Pearl if you can. The healer. She dreams of the old world—actually dreams it. She might show you what we lost.",
        "...and what we saved.",
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
      { biome: BiomeType.Bog, offset: { x: -18, z: -22 } },
      { biome: BiomeType.Taiga, offset: { x: 16, z: 20 } },
      { biome: BiomeType.Volcanic, offset: { x: -22, z: 16 } },
    ],
    dialogue: [
      // Stage 1 — Swamp (gruff, guarded, introduces his burden)
      [
        "...what do you want. No, don't answer. I don't care. Turn around and walk away.",
        "Still here? Fine. Look at this sword on my back. Sundered. Broken. Just like everything else I've touched.",
        "I struck the blow that shattered the world. Me. These hands. This blade. Does that satisfy your curiosity?",
        "Go bother someone else. There's a trickster in the mushroom groves—Plume. At least she'll entertain you while she lies to your face.",
      ],
      // Stage 2 — Bog (opens up slightly, reveals he was tricked)
      [
        "You again. Persistent little wretch, aren't you.",
        "I didn't know what I was doing. That's the worst part. I was told the strike would SAVE the Harmony. Forge it anew.",
        "Cinder made the blade. The forgemaster. Intense fellow—lives for his craft. He poured everything into that weapon. Said it was his masterwork.",
        "We were both tools. Used by someone who saw further than either of us could.",
      ],
      // Stage 3 — Taiga (softening, regret mixed with dawning understanding)
      [
        "I've walked every swamp, every bog, every frozen waste. Punishing myself. But lately I wonder...",
        "What if the blow I struck—what if it actually did save the world? Not the way I intended, but... in the only way that was left?",
        "Vesper told me about the darkness she saw in the stars. Something coming to consume everything. What if shattering was the only choice?",
      ],
      // Stage 4 — Volcanic (near resolution)
      [
        "I came back to the fire. Where Cinder forged the blade. Feels right, somehow. Endings and beginnings.",
        "If you've spoken to the others—if you've heard their pieces—then you know more than any of us did alone.",
        "Find Thornwick. The librarian. He has the last page of the story. The one that explains why any of this had to happen.",
        "And tell him... tell him Bramble is done running.",
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
      { biome: BiomeType.Mushroom, offset: { x: -20, z: 16 } },
      { biome: BiomeType.Jungle, offset: { x: 18, z: -20 } },
      { biome: BiomeType.Mesa, offset: { x: -16, z: -18 } },
      { biome: BiomeType.Badlands, offset: { x: 22, z: 14 } },
    ],
    dialogue: [
      // Stage 1 — Mushroom (theatrical, sing-song, half-truths)
      [
        "Step right up, step right up! Plume's Emporium of Truths, Half-Truths, and Outright Fabrications! Today's special: one genuine secret, only slightly used!",
        "They call me a liar. Harsh! I prefer 'narrative entrepreneur.' Every story I tell is true—from a certain point of view.",
        "Want to know about The Shattering? Oh, everyone has a version. The knight says guilt. The astronomer says fate. I say... good business!",
        "A broken world has more borders, more borders means more customs, more customs means more... opportunities. But I digress. Head to the jungle if you want another piece of the puzzle!",
      ],
      // Stage 2 — Jungle (drops real intel between jokes)
      [
        "You came back! Most don't. They take one look at my prices and flee. But you—you want truth, not trinkets.",
        "Fine, a real one, free of charge: there were EIGHT Keepers, not seven. Everyone forgets the Eighth. Convenient, that.",
        "The Eighth Keeper had no title. No constellation. Just... purpose. And when the darkness came, they acted alone.",
      ],
      // Stage 3 — Mesa (more serious, drops the mask slightly)
      [
        "You know, between you and me—and I'll deny saying this—I miss the old world. The unbroken one.",
        "I was the Keeper of Stories. Every tale, every song, every whispered legend passed through me. Now the stories are scattered too.",
        "Cinder forged the blade. Bramble swung it. But who told Bramble where to strike? Who whispered the words that made it seem heroic? ...not me. The Eighth.",
      ],
      // Stage 4 — Badlands (almost honest)
      [
        "Last truth, and it's a big one, so lean in close: the Eighth Keeper loved this world more than any of us.",
        "That's why they shattered it. You don't break something you don't love. You just... let it burn.",
        "Pearl knows more. The healer dreams of the moment it happened. Ask her—gently. She's fragile these days.",
        "And when you find Thornwick, tell him Plume sent you. He'll overcharge you for the truth, but at least his version is accurate!",
      ],
    ],
    artefact: {
      name: 'The Whispering Coin',
      color: 0xcc66ff,
      nearBiome: BiomeType.Mushroom,
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
      { biome: BiomeType.AshWastes, offset: { x: -22, z: -16 } },
      { biome: BiomeType.Hell, offset: { x: 16, z: -20 } },
      { biome: BiomeType.Cliffs, offset: { x: -18, z: 18 } },
    ],
    dialogue: [
      // Stage 1 — Volcanic (intense, obsessive about craft)
      [
        "The metal still sings here. Can you feel it in the ground? The old fire, the true fire. This is where I forged the Blade of Ending.",
        "Don't look at me like that. A smith doesn't choose how his weapons are used. I forged perfection. What Bramble did with it is his burden.",
        "...that's what I tell myself. Every day. Every hour. While the lava bubbles and the world stays broken.",
        "The Eighth Keeper brought me the design. Said it was the only way to cut the Harmony cleanly. A surgical tool, not a weapon.",
      ],
      // Stage 2 — Ash Wastes (connecting to Bramble)
      [
        "Bramble came to me, you know. Before the strike. Hands shaking. Eyes full of purpose someone else put there.",
        "I handed him the blade and I saw his face change. Like holding it made the decision for him. The metal wanted to swing.",
        "I've tried to forge another—to reforge the Harmony. But the pieces won't fit. The world isn't broken. It's... redistributed.",
      ],
      // Stage 3 — Hell (deep underground, closer to truth)
      [
        "Down here, beneath everything, the old forges still burn. The Eighth Keeper's workshop was here. I found their notes.",
        "They calculated everything. The angle of the strike, the resonance frequency, the exact point where the Harmony could be split without shattering into dust.",
        "It wasn't chaos. It was the most precise act of creation I've ever seen. Disguised as destruction.",
      ],
      // Stage 4 — Cliffs (acceptance)
      [
        "I've stopped trying to reforge. You can't unmake a decision that saved the world.",
        "Each biome holds a fragment of the Harmony. Together, they still hum the old song. Just... quieter. Spread thinner.",
        "Thornwick has the Eighth's journal. The real one, not copies. Find him and you'll understand why the world had to break.",
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
      { biome: BiomeType.Oasis, offset: { x: -20, z: 14 } },
      { biome: BiomeType.FloatingIslands, offset: { x: 18, z: 20 } },
      { biome: BiomeType.Heaven, offset: { x: -14, z: -22 } },
    ],
    dialogue: [
      // Stage 1 — Coral Reef (gentle, ethereal, half-asleep)
      [
        "Mmm... sorry, I was dreaming. I'm always dreaming. The old world visits me when I sleep. It misses us, I think.",
        "In my dreams, the Harmony plays like music. Seven voices, eight parts. The eighth part is silence—but a meaningful silence.",
        "The coral here grows in the old patterns. Before The Shattering, all of nature sang along. Now only the coral remembers the melody.",
        "If you meet Vesper, tell her the stars in my dreams are still whole. It might give her comfort.",
      ],
      // Stage 2 — Oasis (visions becoming clearer)
      [
        "I dreamed of the moment it happened. The Shattering. It was... beautiful. Terrible and beautiful.",
        "The Eighth Keeper stood at the center of everything. They didn't flinch. Didn't weep. They just... let go.",
        "They poured themselves into the breaking. That's why the pieces still hold together—the Eighth is the mortar between the shards.",
      ],
      // Stage 3 — Floating Islands (reveals the sacrifice)
      [
        "Up here, between earth and sky, I can almost reach them. The Eighth. They're woven into everything now.",
        "They didn't just shatter the world. They gave themselves to hold it together in its broken state. A sacrifice so complete there's nothing left to find.",
        "That's why we can't remember their name. They became the world itself. Every breeze, every wave, every grain of sand.",
      ],
      // Stage 4 — Heaven (final truth)
      [
        "I see it all now. The old world was dying. Something vast and hungry was coming—a void that would leave nothing behind.",
        "The Eighth Keeper shattered the Harmony to scatter us, to make the world too fragmented for the void to consume in one bite.",
        "We weren't broken. We were saved. Every biome is a lifeboat, and the Eighth is the ocean holding them all afloat.",
        "Go to Thornwick. He has the words I can only see in dreams. He'll give you the ending. Or perhaps... the beginning.",
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
      { biome: BiomeType.Tundra, offset: { x: -16, z: -20 } },
      { biome: BiomeType.AshWastes, offset: { x: 20, z: 16 } },
      { biome: BiomeType.Mushroom, offset: { x: -22, z: -14 } },
      { biome: BiomeType.Forest, offset: { x: 16, z: -22 } },
    ],
    dialogue: [
      // Stage 1 — Tundra (eccentric, rapid-fire, hints at everything)
      [
        "YES! A reader! A seeker! A—wait, can you read? Doesn't matter, I'll read FOR you. Page 47, paragraph 3, subsection—oh, wrong book.",
        "The Shattering, yes yes YES. Everyone talks about it like it was a tragedy. It was a THESIS! A masterwork of applied metaphysics!",
        "Seven Keepers, eight parts, one Harmony, zero warning. Well, not zero—I had warning. It's all in the books. Nobody reads the books!",
        "Come find me in the ash wastes. I need to cross-reference something. Also I'm cold. Terribly, achingly cold.",
      ],
      // Stage 2 — Ash Wastes (connecting the threads)
      [
        "Right, where was I—page 203, the Eighth Keeper's personal journal. 'When the Consuming Dark reaches the outer stars, the Harmony must be unmade or all is lost.'",
        "Clear as day! Written centuries before it happened! The Eighth KNEW. Planned everything. The forge, the blade, the knight, the strike.",
        "Even us—scattered across the biomes—that was intentional. Seven fragments of consciousness to keep seven fragments of world alive.",
      ],
      // Stage 3 — Mushroom (the full picture)
      [
        "Plume will tell you I'm mad. Plume is correct, but that's beside the point. Mad people see patterns sane people miss.",
        "Here's the pattern: the Eighth Keeper didn't just shatter the Harmony. They became it. Dispersed into every atom of every biome.",
        "That's why the world still works! Why rain falls and trees grow and mushrooms—these magnificent mushrooms—still bloom in the dark!",
        "The Eighth is the operating system of the broken world. Running in the background. Keeping the fragments from drifting apart.",
      ],
      // Stage 4 — Forest (the ending, where it began)
      [
        "We've come full circle. Forest. Where Finch started mapping. Where the first Keeper woke after The Shattering with no memory and a broken compass.",
        "The truth, then. All of it. The Consuming Dark still exists, out beyond the edges of the world. But it can't get in. The fragments are too small, too scattered, too alive.",
        "The Eighth Keeper's sacrifice wasn't just destruction—it was an act of love so vast it rewrote the laws of reality.",
        "And you, traveler—collecting artefacts, hearing our stories, piecing it all together—you're doing exactly what the Eighth hoped someone would. Remembering.",
      ],
    ],
    artefact: {
      name: 'The Nameless Tome',
      color: 0xaacc66,
      nearBiome: BiomeType.Tundra,
    },
    mapColor: '#88aa44',
    mapLabel: 'TW',
  },
}

export const ALL_NPC_IDS: NPCId[] = ['finch', 'vesper', 'bramble', 'plume', 'cinder', 'pearl', 'thornwick']
