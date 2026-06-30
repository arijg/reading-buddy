/*
 * Reading Buddy — all the content lives here.
 * Edit this file to tune things to exactly where your reader is.
 *
 * Each LETTER SOUND has:
 *   g       the grapheme she sees (e.g. "a", "sh")
 *   keyword a word that starts with the sound (for the picture/audio cue)
 *   emoji   a friendly picture for the keyword
 *
 * Each LEVEL has:
 *   id, name, focus   what it's about
 *   newSounds         graphemes introduced at this level
 *   words             real CVC/decodable words to read & blend
 *   nonsense          decodable NON-words (classic OG check that she's
 *                     sounding out, not memorizing) — used in "Real or Not?"
 *   sentences         short decodable sentences using sounds taught so far
 */

window.READING_DATA = {

  // ---- Master letter-sound deck (used by the "Sounds" activity) ----
  letterSounds: [
    { g: "s", keyword: "sun",      emoji: "☀️" },
    { g: "a", keyword: "apple",    emoji: "🍎" },
    { g: "t", keyword: "top",      emoji: "🔝" },
    { g: "p", keyword: "pig",      emoji: "🐷" },
    { g: "i", keyword: "igloo",    emoji: "🏠" },
    { g: "n", keyword: "net",      emoji: "🥅" },
    { g: "m", keyword: "moon",     emoji: "🌙" },
    { g: "d", keyword: "dog",      emoji: "🐶" },
    { g: "o", keyword: "octopus",  emoji: "🐙" },
    { g: "c", keyword: "cat",      emoji: "🐱" },
    { g: "k", keyword: "kite",     emoji: "🪁" },
    { g: "g", keyword: "goat",     emoji: "🐐" },
    { g: "u", keyword: "umbrella", emoji: "☂️" },
    { g: "r", keyword: "rabbit",   emoji: "🐰" },
    { g: "h", keyword: "hat",      emoji: "🎩" },
    { g: "b", keyword: "bus",      emoji: "🚌" },
    { g: "f", keyword: "fish",     emoji: "🐟" },
    { g: "l", keyword: "leaf",     emoji: "🍃" },
    { g: "e", keyword: "egg",      emoji: "🥚" },
    { g: "j", keyword: "jam",      emoji: "🍓" },
    { g: "w", keyword: "web",      emoji: "🕸️" },
    { g: "v", keyword: "van",      emoji: "🚐" },
    { g: "x", keyword: "fox",      emoji: "🦊" },
    { g: "y", keyword: "yo-yo",    emoji: "🪀" },
    { g: "z", keyword: "zip",      emoji: "🤐" },
    { g: "sh", keyword: "ship",    emoji: "🚢" },
    { g: "ch", keyword: "chip",    emoji: "🍟" },
    { g: "th", keyword: "thumb",   emoji: "👍" }
  ],

  // ---- Levels (short-vowel → digraphs → blends; cumulative) ----
  levels: [
    {
      id: 1,
      name: "Short a",
      focus: "Words with the /a/ sound",
      newSounds: ["s", "a", "t", "p", "n", "m", "d"],
      words: ["at", "am", "sat", "pat", "tap", "nap", "map", "mad",
              "dad", "sad", "tan", "pan", "man", "mat", "sap", "pad", "nab", "tam"],
      nonsense: ["nad", "pab", "mab", "sab", "dat", "nan", "tas", "dap"],
      sentences: ["A man sat.", "Pat the cat.", "Dad ran.", "A sad, sad nap.", "Sam sat at a mat."]
    },
    {
      id: 2,
      name: "Short i",
      focus: "Words with the /i/ sound",
      newSounds: ["i"],
      words: ["it", "in", "sit", "sip", "tip", "pit", "pin", "tin",
              "nip", "dip", "dim", "did", "mid", "rim", "rip", "tic"],
      nonsense: ["pim", "tib", "dit", "mip", "sib", "nid", "dap", "nim"],
      sentences: ["Sit in it.", "Dip the tip.", "A pin is in.", "Tim did a flip.", "Pat did sip a bit."]
    },
    {
      id: 3,
      name: "Short o",
      focus: "Words with the /o/ sound",
      newSounds: ["o", "c", "g"],
      words: ["on", "cot", "cop", "top", "pop", "pot", "dot", "dog",
              "got", "mop", "mom", "nod", "cod", "tot", "sod", "tog"],
      nonsense: ["pog", "tob", "dod", "nop", "gop", "mog", "cob", "sot"],
      sentences: ["The dog sat.", "Mom got a pot.", "A cat is on top.", "Dad got a big mop.", "The dog can not nod."]
    },
    {
      id: 4,
      name: "Short u",
      focus: "Words with the /u/ sound",
      newSounds: ["u", "b"],
      words: ["up", "us", "cut", "cup", "pup", "sub", "tub", "bud",
              "mud", "mug", "nut", "sun", "bun", "but", "gum", "bug"],
      nonsense: ["dut", "pud", "mub", "gub", "nug", "tup", "bup", "sut"],
      sentences: ["A pup is in mud.", "The sun is up.", "Cut the bun.", "The bug is in a cup.", "Gus had a big mug."]
    },
    {
      id: 5,
      name: "Short e",
      focus: "Words with the /e/ sound",
      newSounds: ["e", "r", "h", "f", "l"],
      words: ["bed", "red", "led", "fed", "pen", "ten", "hen", "men",
              "net", "pet", "get", "leg", "egg", "let", "set", "wet"],
      nonsense: ["bem", "tef", "heb", "nep", "fel", "ped", "lem", "ret"],
      sentences: ["The hen is red.", "Get the pet.", "Ten men ran.", "The red hen sat on a bed.", "Let the wet dog get in."]
    },
    {
      id: 6,
      name: "Digraphs sh, ch, th",
      focus: "Two letters, one sound",
      newSounds: ["sh", "ch", "th"],
      words: ["ship", "shop", "fish", "dish", "cash", "chip", "chop",
              "chin", "rich", "much", "this", "that", "then", "bath", "with", "thin"],
      nonsense: ["chid", "shet", "thip", "chab", "shom", "thut", "shig", "chun"],
      sentences: ["The fish is in the dish.", "Chop with this.", "That ship is big.",
                  "I wish for a chip.", "The thin cat is in the bath."]
    },
    {
      id: 7,
      name: "Starting blends",
      focus: "Two sounds at the start (st, pl, gr…)",
      newSounds: [],
      words: ["stop", "spot", "step", "plan", "plot", "clap", "clip", "flag",
              "flop", "grab", "grin", "trip", "trap", "drum", "drop", "frog", "spin", "slip"],
      nonsense: ["frop", "glet", "plit", "stom", "crad", "snib", "blet", "drix"],
      sentences: ["Stop at the step.", "The frog is on a flag.", "I can spin and grin.",
                  "Grab the drum and clap.", "The plan is to flip and flop."]
    },
    {
      id: 8,
      name: "Ending blends",
      focus: "Two sounds at the end (-nd, -mp, -st, -nk)",
      newSounds: [],
      words: ["hand", "land", "sand", "bend", "jump", "lamp", "camp", "fast",
              "last", "nest", "best", "bank", "sink", "pink", "junk", "wind", "tent", "milk"],
      nonsense: ["pand", "jund", "wint", "lemp", "gonk", "tisk", "fust", "rint"],
      sentences: ["The lamp is on the desk.", "I can jump in the sand.",
                  "Run fast to the tent.", "A pink sock is in the bank.", "The best nest is on land."]
    }
  ],

  // ---- Heart / red words (irregular high-frequency words) ----
  // The "heart" marks the tricky part you learn "by heart".
  heartWords: [
    "the", "a", "is", "to", "was", "of", "said", "you",
    "are", "he", "she", "we", "me", "be", "my", "I",
    "they", "have", "do", "go", "no", "so", "for", "here",
    "what", "want", "come", "some", "from", "were", "there", "where"
  ],

  // ---- Decodable stories (little picture books, one sentence per page) ----
  // Kept decodable: short-vowel words + a few taught heart words (the, a, is…).
  stories: [
    {
      id: "sam-cat", title: "Sam the Cat", cover: "🐱",
      pages: [
        { text: "Sam is a cat.",      pic: "🐱" },
        { text: "Sam has a hat.",     pic: "🎩" },
        { text: "Sam sat on a mat.",  pic: "🐈" },
        { text: "Sam had a nap.",     pic: "😴" }
      ]
    },
    {
      id: "big-pig", title: "The Big Pig", cover: "🐷",
      pages: [
        { text: "A pig is big.",       pic: "🐷" },
        { text: "The pig can dig.",    pic: "🕳️" },
        { text: "The pig digs a pit.", pic: "⛏️" },
        { text: "Hop in, pig!",        pic: "💦" }
      ]
    },
    {
      id: "dog-frog", title: "The Dog and the Frog", cover: "🐸",
      pages: [
        { text: "A dog sat on a log.",     pic: "🪵" },
        { text: "A frog hops on the log.", pic: "🐸" },
        { text: "The dog and frog jog.",   pic: "🏃" },
        { text: "Hop, dog! Hop, frog!",    pic: "🐾" }
      ]
    },
    {
      id: "fun-sun", title: "Fun in the Sun", cover: "☀️",
      pages: [
        { text: "The sun is up.",          pic: "☀️" },
        { text: "A pup runs in the sun.",  pic: "🐶" },
        { text: "The pup digs in mud.",    pic: "🐾" },
        { text: "Fun, fun, fun!",          pic: "🎉" }
      ]
    },
    {
      id: "red-hen", title: "The Red Hen", cover: "🐔",
      pages: [
        { text: "The hen is red.",          pic: "🐔" },
        { text: "The hen has ten eggs.",    pic: "🥚" },
        { text: "The hen sits on the eggs.", pic: "🪺" },
        { text: "Peck, peck, hen!",         pic: "🐥" }
      ]
    }
  ]
};
