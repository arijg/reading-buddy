# Learning Buddy 🌟

A simple, kid-friendly web app to help an early learner (kindergarten → first grade)
practice **reading** (using the **Orton-Gillingham** structured-literacy approach) and
**math** (Singapore-style: counting, number bonds, add/subtract, compare, sequences).
Built to run in Safari on an iPad and be hosted for free on GitHub Pages.

> Made by a dad and Claude, for one specific awesome kid.

---

## Goals

- Give a 5–6 year old fun, **low-pressure** practice decoding words.
- Follow OG principles: **explicit, sequential, cumulative, multisensory**.
- Work great on an **iPad in Safari**, installable to the home screen.
- **No accounts, no servers, nothing leaves the device.** Progress is saved
  locally on the iPad only.
- Easy for a parent to **tune the content** (it all lives in one data file).

## Who it's for

A child finishing kindergarten who learned letter–sounds and is starting to
blend simple words. Content starts at short-vowel CVC words (`cat`, `pin`) and
is organized into levels that build on each other.

---

## The activities

| Activity | What she does | OG skill |
|---|---|---|
| **🔤 Sounds** | See a letter/pattern, say its sound, tap to check (keyword + audio). | Letter–sound correspondence |
| **🧩 Blend Words** | See a CVC word, tap each letter and say its sound, then blend it; tap to hear the whole word and self-check. | Decoding / blending |
| **📕 Read Words** | A word appears; she reads it aloud and marks "Got it!" or "Tricky." | Word reading + fluency |
| **❤️ Heart Words** | Practice irregular high-frequency words (`the`, `said`) separately. | Sight / "red" words |
| **📚 Stories** | Read short **decodable** picture-book stories, one sentence + picture per page. | Connected-text reading |

Planned later: real-vs-nonsense word check, decodable sentences, parent progress view.

---

## How it works (tech)

Deliberately simple so it's easy to maintain and free to host:

- **Plain static web app** — HTML + CSS + vanilla JavaScript. No build step,
  no frameworks, no dependencies.
- **Hosted on GitHub Pages** (free). Add-to-home-screen makes it feel like a real app.
- **Audio** uses the browser's built-in speech (`SpeechSynthesis`) to read whole
  words aloud — zero setup. Upgrade path: recorded human audio for warmer, more
  accurate phoneme sounds.
- **Content in `data.js`** — every sound, word list, and heart word lives in one
  file so it's easy to adjust to exactly where she is.
- **Progress** saved with `localStorage` (on-device only).

### Why "say it yourself" for individual sounds?

Browser text-to-speech reads single letters by their **name** ("ay") not their
**sound** ("/a/"), which is wrong for OG. So the blending activity asks her to
*say each sound herself* (multisensory!) and only speaks the **whole word** for
self-checking, which TTS does reliably. True per-sound audio is the first
upgrade once we record or source phoneme clips.

---

## File layout

```
index.html      # app shell + screens
styles.css      # big, calm, kid-friendly styling
data.js         # ALL content: sounds, levels, word lists, nonsense words, sentences
app.js          # screen routing + the activities + progress saving
sw.js           # service worker (offline). Bump CACHE_VERSION when app code changes.
manifest.json   # PWA manifest (installable)
icon*.png       # home-screen icons (generated from icon.svg via `sips`)
build-artifact.py          # inlines the split app into one self-contained HTML
reading-buddy-artifact.html # the built single-file app (paste into the Claude app)
README.md       # this file
```

### Running it inside the Claude app (Artifact)

`reading-buddy-artifact.html` is a single self-contained file (no separate
assets, no service worker). Open it in the Claude app and it renders as an
interactive Artifact you can tap and play. Regenerate it after content/code
changes with `python3 build-artifact.py` (split files stay the source of truth).

Caveats vs the installed PWA: Artifacts run sandboxed — saved stars (localStorage)
may not persist between sessions, and read-aloud audio may not work; the PWA is
better for her actual daily practice, the Artifact is handy for quick demos/tweaks.

## Content / scope & sequence

Levels follow a standard OG short-vowel order (tunable in `data.js`):

1. Short **a** → 2. Short **i** → 3. Short **o** → 4. Short **u** →
5. Short **e** → 6. Digraphs (`sh`, `ch`, `th`)

Each level only uses sounds introduced at or before it. To match her actual
classroom sequence, edit the levels in `data.js`.

Word lists and the in-app stories are authored here (plain word lists and short
original decodable sentences aren't copyrightable), using these openly-licensed /
free references for ordering and coverage:

- [OER Commons – Word Lists by Syllable Type (OG)](https://oercommons.org/authoring/27442-word-lists-by-syllable-type-orton-gillingham/view) (openly licensed)
- [Reading Universe – decodable texts by skill](https://readinguniverse.org/article/explore-teaching-topics/word-recognition/phonics/decodable-texts-for-each-phonics-skill)
- [Spencer Learning – free phonics word lists](https://spencerlearning.com/ultimate-phonics/resources/free-phonics-word-lists.html)
- [Literacy Learn – free OG scope & sequence](https://literacylearn.com/free-phonics-scope-sequence/)

### Free illustrated story libraries (for reading *together*)

The in-app stories are decodable (she sounds them out solo). For richer
picture-book reading with a grown-up helping, these are free and openly licensed
(CC) — great to read together, not strictly decodable:

- [StoryWeaver (Pratham Books)](https://storyweaver.org.in/) — thousands of CC-BY illustrated books at graded reading levels
- [Free Kids Books](https://freekidsbooks.org/early-reader/) — Creative Commons early readers
- [Global Digital Library](https://digitallibrary.io/) — openly-licensed leveled, illustrated books

---

## Running it

**Live app:** https://arijg.github.io/reading-buddy/

**On a computer (to test):** open `index.html` in a browser. (Content is loaded
from `data.js`, not fetched, so it works straight from the file system.)

**On the iPad:**
1. Open **https://arijg.github.io/reading-buddy/** in Safari.
2. Tap the **Share** button → **Add to Home Screen** → *Add*.
3. Launch it from the home-screen icon — full screen, works offline.

**Updating the live app:** edit files, then
`git add -A && git commit -m "..." && git push`. GitHub Pages redeploys in a
minute or two. When you change app code, also bump `CACHE_VERSION` in `sw.js`
(e.g. `v1` → `v2`) so installed iPads load the new version instead of the cache.

---

## Build roadmap

- [x] Project plan
- [x] App shell + home menu + level picker
- [x] Sounds drill
- [x] Blend Words (CVC)
- [x] Read Words (self-check + progress)
- [x] Heart Words
- [x] Home-screen icon + offline support (installable PWA)
- [x] Decodable sentences (📖 Sentences activity)
- [x] Real-vs-nonsense word check (🕵️ Real or Not? activity)
- [x] Single-file Artifact build (runs inside the Claude app)
- [x] Star jar on the home page (collect a star for everything you read)
- [x] Milestone statues + 🏛️ Collection gallery (Cat @3, Unicorn @10, Mermaid @20)
- [x] Tricky-word review list (mark "Tricky" in Read Words → practice in Review Tricky Words)
- [ ] Recorded human audio for phonemes
- [ ] Parent progress view
- [ ] Read-aloud / pronunciation check (paused — needs iPad test)

## Privacy

No analytics, no accounts, no network calls except loading the page itself.
Progress lives in the browser's local storage on the device.
