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
 *   words             CVC words to read/blend (only sounds taught so far)
 *   sentences         short decodable sentences (optional, used later)
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

  // ---- Levels (short-vowel scope & sequence; cumulative) ----
  levels: [
    {
      id: 1,
      name: "Short a",
      focus: "Words with the /a/ sound",
      newSounds: ["s", "a", "t", "p", "n", "m", "d"],
      words: ["at", "am", "sat", "pat", "tap", "nap", "map", "mad",
              "dad", "sad", "tan", "pan", "man", "mat", "sap", "pad", "nab", "tam"],
      sentences: ["A man sat.", "Pat the cat.", "Dad ran."]
    },
    {
      id: 2,
      name: "Short i",
      focus: "Words with the /i/ sound",
      newSounds: ["i"],
      words: ["it", "in", "sit", "sip", "tip", "pit", "pin", "tin",
              "nip", "dip", "dim", "did", "mid", "rim", "rip", "tic"],
      sentences: ["Sit in it.", "Dip the tip.", "A pin is in."]
    },
    {
      id: 3,
      name: "Short o",
      focus: "Words with the /o/ sound",
      newSounds: ["o", "c", "g"],
      words: ["on", "cot", "cop", "top", "pop", "pot", "dot", "dog",
              "got", "mop", "mom", "nod", "cod", "tot", "sod", "tog"],
      sentences: ["The dog sat.", "Mom got a pot.", "A cat is on top."]
    },
    {
      id: 4,
      name: "Short u",
      focus: "Words with the /u/ sound",
      newSounds: ["u", "b"],
      words: ["up", "us", "cut", "cup", "pup", "sub", "tub", "bud",
              "mud", "mug", "nut", "sun", "bun", "but", "gum", "bug"],
      sentences: ["A pup is in mud.", "The sun is up.", "Cut the bun."]
    },
    {
      id: 5,
      name: "Short e",
      focus: "Words with the /e/ sound",
      newSounds: ["e", "r", "h", "f", "l"],
      words: ["bed", "red", "led", "fed", "pen", "ten", "hen", "men",
              "net", "pet", "get", "leg", "egg", "let", "set", "wet"],
      sentences: ["The hen is red.", "Get the pet.", "Ten men ran."]
    },
    {
      id: 6,
      name: "Digraphs sh, ch, th",
      focus: "Two letters, one sound",
      newSounds: ["sh", "ch", "th"],
      words: ["ship", "shop", "fish", "dish", "cash", "chip", "chop",
              "chin", "rich", "much", "this", "that", "then", "bath", "with", "thin"],
      sentences: ["The fish is in the dish.", "Chop with this.", "That ship is big."]
    }
  ],

  // ---- Heart / red words (irregular high-frequency words) ----
  // The "heart" marks the tricky part you learn "by heart".
  heartWords: [
    "the", "a", "is", "to", "was", "of", "said", "you",
    "are", "he", "she", "we", "me", "be", "my", "I",
    "they", "have", "do", "go", "no", "so", "for", "here"
  ]
};
