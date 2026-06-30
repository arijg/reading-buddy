/*
 * Math Buddy — content & difficulty knobs live here.
 * Edit this file to tune the numbers to exactly where your child is.
 *
 * Math is generated fresh each time (endless practice), so instead of word
 * lists this file holds the RANGES that shape the problems. Difficulty is a
 * 1–5 dial: each level just widens those ranges. To add a 6th level, copy a
 * block and bump the numbers — it shows up on the Math home automatically.
 *
 * Style: Singapore-math flavored for K–1 — counting, number bonds
 * (part–part–whole), addition & subtraction within 10/20, comparing
 * quantities, and number sequences. Lots of pictures (concrete → pictorial),
 * then the number sentence (abstract).
 */

window.MATH_DATA = {

  // Friendly things to count. One emoji is picked per problem so a group of
  // "5" is five of the SAME thing (easier to count than a jumble).
  emojis: ["🍎", "🐸", "⭐", "🍓", "🐠", "🌸", "🐥", "🎈", "🦋", "🍪",
           "🚗", "🐞", "🌼", "🐱", "🍊", "🐢"],

  // Difficulty dial 1–5. Each level just widens the ranges below. Add a "6"
  // block here and it shows up as a new button on the Math home automatically.
  // Keys are kept as numeric strings so they sort 1→5 in the picker.
  levels: {
    "1": {
      label: "1",
      countMax:   12,   // "How many?" — count up to this
      addMax:     12,   // adding — sums stay within this
      subMax:     12,   // subtracting — start total within this
      bondMax:    12,   // number bonds — whole within this
      compareMax: 12,   // which is more — values within this
      seqSteps:  [1],   // "what comes next" — count by 1s
      seqMax:     20
    },
    "2": {
      label: "2",
      countMax:   15,
      addMax:     15,
      subMax:     15,
      bondMax:    15,
      compareMax: 15,
      seqSteps:  [1],
      seqMax:     25
    },
    "3": {
      label: "3",
      countMax:   20,
      addMax:     20,
      subMax:     20,
      bondMax:    20,
      compareMax: 20,
      seqSteps:  [1, 2],          // start of skip-counting
      seqMax:     30
    },
    "4": {
      label: "4",
      countMax:   20,
      addMax:     25,
      subMax:     25,
      bondMax:    20,
      compareMax: 25,
      seqSteps:  [1, 2, 5],
      seqMax:     50
    },
    "5": {
      label: "5",
      countMax:   20,
      addMax:     30,
      subMax:     30,
      bondMax:    20,
      compareMax: 30,
      seqSteps:  [1, 2, 5, 10],   // skip-count by 10s too
      seqMax:     60
    }
  }
};
