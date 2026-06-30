/*
 * Reading Buddy — app logic.
 * Plain vanilla JS. No build step, no dependencies.
 *
 * Structure: a tiny screen router renders into #app. Each activity is a
 * function that builds its own DOM and wires up its own buttons.
 */

(function () {
  "use strict";

  const DATA = window.READING_DATA;
  const MATH = window.MATH_DATA;
  const app = document.getElementById("app");
  const VOWELS = new Set(["a", "e", "i", "o", "u"]);

  /* ---------------- Audio (browser text-to-speech) ----------------
     TTS reads single letters by NAME ("ay"), not sound ("/a/"), so we only
     ever speak whole WORDS or KEYWORDS, never lone letters. Per-sound practice
     is "say it yourself" (multisensory). Recorded phoneme audio is a later upgrade. */
  function speak(text, rate) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate || 0.85;   // a touch slow for little ears
      u.pitch = 1.05;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech not available — fail quietly */ }
  }

  /* ---------------- Phoneme audio (recorded on-device) ----------------
     TTS can't say true phonemes (/a/, /sh/), so a grown-up records each
     sound ONCE in the Parent area. Clips live in IndexedDB on this device
     only — nothing leaves the iPad, same as the rest of the app. When a
     sound has no recording yet, activities fall back to "say it yourself". */
  const PhonemeAudio = (function () {
    const DB_NAME = "learning-buddy-audio", STORE = "phonemes";
    let dbp = null;
    const urlCache = {};
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        try {
          const r = indexedDB.open(DB_NAME, 1);
          r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    function tx(mode) { return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); }); }
    function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
    return {
      supported: (function () { try { return !!window.indexedDB && !!window.MediaRecorder; } catch (e) { return false; } })(),
      get: function (g) { return tx("readonly").then(function (s) { return req(s.get(g)); }); },
      put: function (g, blob) { return tx("readwrite").then(function (s) { delete urlCache[g]; return req(s.put(blob, g)); }); },
      del: function (g) { return tx("readwrite").then(function (s) { delete urlCache[g]; return req(s.delete(g)); }); },
      keys: function () { return tx("readonly").then(function (s) { return req(s.getAllKeys()); }).catch(function () { return []; }); },
      play: function (g) {
        return this.get(g).then(function (blob) {
          if (!blob) return false;
          const url = urlCache[g] || (urlCache[g] = URL.createObjectURL(blob));
          const a = new Audio(url); a.play().catch(function () {}); return true;
        }).catch(function () { return false; });
      }
    };
  })();

  // A fast, synchronous "is this sound recorded?" for showing/hiding buttons.
  // Kept in sync with IndexedDB; preloaded once at startup.
  let recordedSounds = new Set();
  function refreshRecordedSounds() {
    return PhonemeAudio.keys().then(function (ks) { recordedSounds = new Set(ks); return recordedSounds; });
  }
  function hasPhoneme(g) { return recordedSounds.has(g); }
  // Play a recorded phoneme if we have one; otherwise speak the keyword cue.
  function playPhoneme(g, keyword) {
    if (hasPhoneme(g)) PhonemeAudio.play(g);
    else if (keyword) speak(keyword);
  }

  /* ---------------- Sound effects (synthesized, no files) ----------------
     A short happy arpeggio on success, a gentle two-note "try again". Built
     with the Web Audio API so there are no audio files to ship or cache. */
  let _audioCtx = null;
  function tone(freq, start, dur, gainVal) {
    const ctx = _audioCtx, t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function chime(ok) {
    try {
      _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === "suspended") _audioCtx.resume();
      const notes = ok ? [523.25, 659.25, 783.99] : [392.0, 311.13];  // C-E-G up, or a soft fall
      notes.forEach(function (f, k) { tone(f, k * 0.09, 0.22, 0.16); });
    } catch (e) { /* no audio — fine */ }
  }
  // A single soft "tick" — used when a letter tile drops correctly into place.
  function pip() {
    try {
      _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (_audioCtx.state === "suspended") _audioCtx.resume();
      tone(660, 0, 0.12, 0.12);
    } catch (e) {}
  }

  /* ---------------- Progress (on-device only) ---------------- */
  const STORE_KEY = "reading-buddy-progress";
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function markLevelStar(levelId) {
    const p = loadProgress();
    p.stars = p.stars || {};
    p.stars[levelId] = true;
    saveProgress(p);
  }
  // Reading vs math: a lesson key starting with "math-" earns a MATH star,
  // everything else a READING star. Each subject has its own statue shelf.
  function subjectOf(key) { return key.indexOf("math-") === 0 ? "math" : "reading"; }

  // One collectible star the FIRST time a given lesson is finished.
  // (key is unique per activity+level, e.g. "blend-3", "sounds", "math-add-1")
  function completeLesson(key) {
    const p = loadProgress();
    p.lessonsDone = p.lessonsDone || {};
    if (p.lessonsDone[key]) return;       // already earned — no duplicate star
    p.lessonsDone[key] = true;
    p.starCounts = p.starCounts || { reading: 0, math: 0 };
    const subj = subjectOf(key);
    const before = p.starCounts[subj] || 0;
    const after = before + 1;
    p.starCounts[subj] = after;
    p.starCount = (p.starCount || 0) + 1;   // grand total across both subjects
    saveProgress(p);
    const shelf = subj === "math" ? MATH_STATUES : READING_STATUES;
    const unlocked = shelf.find(s => before < s.stars && after >= s.stars);
    if (unlocked) celebrateStatue(unlocked);
  }
  function getStarCount() { return loadProgress().starCount || 0; }            // both subjects
  function getSubjectStars(subj) { const c = loadProgress().starCounts || {}; return c[subj] || 0; }
  function getLevelsMastered() { return Object.keys(loadProgress().stars || {}).length; }

  // Math difficulty — the "make it harder" setting. Stored on-device so it
  // sticks between visits. Defaults to "easy". (Keys come from MATH.levels.)
  function getMathLevel() {
    const l = loadProgress().mathLevel;
    return (l && MATH.levels[l]) ? l : "1";   // unknown/old values fall back to level 1
  }
  function setMathLevel(l) {
    if (!MATH.levels[l]) return;
    const p = loadProgress();
    p.mathLevel = l;
    saveProgress(p);
  }

  // One-time cleanup: the old version awarded a star per item read, which
  // inflated starCount (e.g. 74). The new rule is 1 star per finished lesson,
  // so recompute the count from lessons actually completed. Runs once.
  function migrateProgress() {
    const p = loadProgress();
    if (p._v >= 3) return;
    p.lessonsDone = p.lessonsDone || {};
    // Recompute star totals from the lessons actually completed, split by
    // subject so reading and math each track their own statue progress.
    const counts = { reading: 0, math: 0 };
    Object.keys(p.lessonsDone).forEach(k => { counts[subjectOf(k)]++; });
    p.starCounts = counts;
    p.starCount = counts.reading + counts.math;
    p._v = 3;
    saveProgress(p);
  }
  function unlockedStatueCount() {
    const r = getSubjectStars("reading"), m = getSubjectStars("math");
    return READING_STATUES.filter(s => r >= s.stars).length +
           MATH_STATUES.filter(s => m >= s.stars).length;
  }
  function totalStatueCount() { return READING_STATUES.length + MATH_STATUES.length; }

  // Tricky-word review list — words she marked "Tricky" go here to practice later.
  function addTricky(word) {
    const p = loadProgress();
    p.tricky = p.tricky || {};
    p.tricky[word] = true;
    saveProgress(p);
  }
  function removeTricky(word) {
    const p = loadProgress();
    if (p.tricky && p.tricky[word]) { delete p.tricky[word]; saveProgress(p); }
  }
  function getTrickyWords() { return Object.keys(loadProgress().tricky || {}); }

  /* ---------------- Small helpers ---------------- */
  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      if (k === "class") n.className = props[k];
      else if (k === "html") n.innerHTML = props[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(c => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }
  function clear() { app.innerHTML = ""; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Build N answer buttons for a number question: the correct value plus
  // distinct, nearby distractors, all kept inside [lo, hi], then shuffled.
  function numberChoices(correct, n, lo, hi) {
    const opts = new Set([correct]);
    let guard = 0;
    while (opts.size < n && guard++ < 200) {
      const delta = randInt(1, 3) * (Math.random() < 0.5 ? -1 : 1);
      let v = correct + delta;
      if (v < lo) v = correct + Math.abs(delta);
      if (v > hi) v = correct - Math.abs(delta);
      if (v >= lo && v <= hi) opts.add(v);
    }
    for (let f = lo; opts.size < n && f <= hi; f++) opts.add(f);  // fallback fill
    return shuffle([...opts]);
  }

  // A row of countable picture objects. `crossFrom` (optional) crosses out
  // every object from that index on — used to show "take away" in subtraction.
  function objectsRow(count, emoji, crossFrom) {
    const box = el("div", { class: "objrow" });
    for (let k = 0; k < count; k++) {
      const crossed = (crossFrom != null && k >= crossFrom);
      box.appendChild(el("span", { class: "obj" + (crossed ? " crossed" : "") }, [emoji]));
    }
    return box;
  }

  // A Singapore-style number bond: whole on top, two parts below, joined by
  // lines. Pass null for the unknown — it renders as a highlighted "?".
  function bondNode(whole, a, b) {
    function circle(x, y, val, unknown) {
      const fill = unknown ? "#ffe9a8" : "#eaf0ff";
      const stroke = unknown ? "#f0b429" : "#9bb8f0";
      return '<circle cx="' + x + '" cy="' + y + '" r="32" fill="' + fill + '" stroke="' + stroke + '" stroke-width="3"/>' +
        '<text x="' + x + '" y="' + (y + 11) + '" text-anchor="middle" font-size="34" fill="#2d3142" font-family="inherit">' +
        (unknown ? "?" : val) + '</text>';
    }
    const svg = '<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="120" y1="64" x2="60" y2="124" stroke="#9bb8f0" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="120" y1="64" x2="180" y2="124" stroke="#9bb8f0" stroke-width="5" stroke-linecap="round"/>' +
      circle(120, 42, whole, whole == null) +
      circle(60, 150, a, a == null) +
      circle(180, 150, b, b == null) +
      '</svg>';
    const d = el("div", { class: "bond" });
    d.innerHTML = svg;
    return d;
  }

  /* ---------------- Buddy mascot ----------------
     A friendly star character that gives the app a face. It reacts on every
     cheer (happy bounce) and greets her on the home screens. SVG only — no
     image files to ship. */
  function buddySvg(mood) {
    // mood: "happy" (default), "wave", "think"
    const eyes = mood === "think"
      ? '<circle cx="78" cy="98" r="7" fill="#3a2f1f"/><circle cx="122" cy="98" r="7" fill="#3a2f1f"/>'
      : '<circle cx="78" cy="96" r="8" fill="#3a2f1f"/><circle cx="122" cy="96" r="8" fill="#3a2f1f"/>' +
        '<circle cx="81" cy="93" r="2.6" fill="#fff"/><circle cx="125" cy="93" r="2.6" fill="#fff"/>';
    const mouth = mood === "think"
      ? '<path d="M88 120 q 12 6 24 0" stroke="#b5791a" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : '<path d="M84 116 q 16 18 32 0" stroke="#b5791a" stroke-width="5" fill="none" stroke-linecap="round"/>';
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M100 14 L122 74 L186 78 L136 118 L154 182 L100 146 L46 182 L64 118 L14 78 L78 74 Z" ' +
      'fill="#ffd45e" stroke="#f0b429" stroke-width="5" stroke-linejoin="round"/>' +
      '<circle cx="62" cy="112" r="9" fill="#ffb3c1" opacity="0.8"/>' +
      '<circle cx="138" cy="112" r="9" fill="#ffb3c1" opacity="0.8"/>' +
      eyes + mouth +
      '</svg>';
  }
  // A buddy element to drop onto a screen. `size` is a CSS class suffix.
  function buddyNode(mood, cls) {
    const b = el("div", { class: "buddy " + (cls || "") });
    b.innerHTML = buddySvg(mood);
    return b;
  }

  function cheer(emoji, quiet) {
    if (!quiet) chime(true);
    const wrap = el("div", { class: "cheer" });
    const b = el("div", { class: "cheer-buddy" });
    b.innerHTML = buddySvg("happy");
    wrap.appendChild(b);
    wrap.appendChild(el("div", { class: "cheer-emoji" }, [emoji || "🎉"]));
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 900);
  }
  function topbar(title, onBack) {
    return el("div", { class: "topbar" }, [
      onBack
        ? el("button", { class: "back-btn", onclick: onBack }, ["← Back"])
        : el("div", { class: "spacer" }),
      el("h1", null, [title]),
      el("div", { class: "spacer" })
    ]);
  }

  /* ---------------- Collectible statues ---------------- */
  // Shared pieces so all three statues sit on the same pedestal + open book.
  const PEDESTAL =
    '<ellipse cx="100" cy="233" rx="74" ry="7" fill="#00000015"/>' +
    '<rect x="40" y="208" width="120" height="26" rx="6" fill="#e3c682"/>' +
    '<rect x="40" y="208" width="120" height="7" rx="4" fill="#f1dca0"/>' +
    '<rect x="54" y="192" width="92" height="18" rx="5" fill="#eed79a"/>';

  const BOOK =
    '<path d="M100 152 C 80 143, 56 145, 45 152 L 45 196 C 56 189, 80 187, 100 196 Z" fill="#ffffff" stroke="#d9c08a" stroke-width="2"/>' +
    '<path d="M100 152 C 120 143, 144 145, 155 152 L 155 196 C 144 189, 120 187, 100 196 Z" fill="#fbf4e2" stroke="#d9c08a" stroke-width="2"/>' +
    '<line x1="100" y1="152" x2="100" y2="196" stroke="#d9c08a" stroke-width="2"/>' +
    '<g stroke="#cdd8f2" stroke-width="3" stroke-linecap="round">' +
    '<line x1="58" y1="162" x2="90" y2="160"/><line x1="58" y1="172" x2="90" y2="170"/><line x1="60" y1="182" x2="86" y2="181"/>' +
    '<line x1="110" y1="160" x2="142" y2="162"/><line x1="110" y1="170" x2="142" y2="172"/><line x1="114" y1="181" x2="140" y2="182"/>' +
    '</g>';

  const CAT_CHAR =
    '<path d="M72 66 L 66 40 L 92 56 Z" fill="#f0a04e"/>' +
    '<path d="M128 66 L 134 40 L 108 56 Z" fill="#f0a04e"/>' +
    '<path d="M75 60 L 71 47 L 87 56 Z" fill="#ffd0c0"/>' +
    '<path d="M125 60 L 129 47 L 113 56 Z" fill="#ffd0c0"/>' +
    '<circle cx="100" cy="96" r="40" fill="#f3a85a"/>' +
    '<path d="M100 58 q 5 11 0 20" stroke="#e08b3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M85 60 q 3 9 -2 16" stroke="#e08b3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M115 60 q -3 9 2 16" stroke="#e08b3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="100" cy="108" rx="21" ry="14" fill="#ffe9c9"/>' +
    '<path d="M79 94 q 7 8 14 0" stroke="#3a2f1f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M107 94 q 7 8 14 0" stroke="#3a2f1f" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M96 103 L 104 103 L 100 109 Z" fill="#e98aa0"/>' +
    '<path d="M100 109 q -5 7 -11 3 M100 109 q 5 7 11 3" stroke="#3a2f1f" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<g stroke="#d9b88a" stroke-width="2" stroke-linecap="round">' +
    '<line x1="67" y1="104" x2="84" y2="106"/><line x1="67" y1="112" x2="84" y2="112"/>' +
    '<line x1="133" y1="104" x2="116" y2="106"/><line x1="133" y1="112" x2="116" y2="112"/></g>';

  const UNICORN_CHAR =
    '<path d="M62 66 q -16 30 -4 72 q 14 -12 18 -34 q -8 -22 0 -38 Z" fill="#b794e8"/>' +
    '<path d="M70 58 q -10 26 -2 60 q 12 -10 14 -28 q -6 -18 0 -32 Z" fill="#f3a6d0"/>' +
    '<path d="M80 60 L 74 42 L 94 56 Z" fill="#ffffff"/>' +
    '<path d="M100 26 L 91 60 L 109 60 Z" fill="#ffd76a" stroke="#e8b94a" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="95" y1="46" x2="105" y2="42" stroke="#e8b94a" stroke-width="2"/>' +
    '<line x1="96" y1="54" x2="104" y2="50" stroke="#e8b94a" stroke-width="2"/>' +
    '<circle cx="100" cy="96" r="40" fill="#ffffff" stroke="#efe9f5" stroke-width="2"/>' +
    '<path d="M100 58 q -14 4 -16 22 q 14 -4 18 -14 q 4 10 18 14 q -2 -18 -16 -22 Z" fill="#f3a6d0"/>' +
    '<path d="M81 96 q 6 7 12 0" stroke="#5a4a6a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M107 96 q 6 7 12 0" stroke="#5a4a6a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<circle cx="80" cy="110" r="5" fill="#ffc2dd"/><circle cx="120" cy="110" r="5" fill="#ffc2dd"/>' +
    '<ellipse cx="100" cy="116" rx="15" ry="10" fill="#fdeef5"/>' +
    '<path d="M96 120 q 4 4 8 0" stroke="#caa0c0" stroke-width="2" fill="none" stroke-linecap="round"/>';

  const MERMAID_CHAR =
    '<path d="M150 158 q 30 -8 30 -38 q 0 -20 -12 -30 q 18 14 16 40 q -2 26 -22 38 Z" fill="#56c3bb"/>' +
    '<path d="M170 96 q 20 -8 28 4 q -10 14 -28 9 q -7 -7 0 -13 Z" fill="#7ad7cf"/>' +
    '<path d="M58 70 q -14 40 2 80 q 16 -10 18 -36 q -10 -24 -2 -44 Z" fill="#5ec8c0"/>' +
    '<path d="M142 70 q 14 38 -2 74 q -12 -8 -14 -30 q 8 -22 2 -44 Z" fill="#5ec8c0"/>' +
    '<path d="M62 80 q 0 -46 38 -50 q 38 4 38 50 q -16 -24 -38 -24 q -22 0 -38 24 Z" fill="#7ad7cf"/>' +
    '<circle cx="100" cy="98" r="37" fill="#ffe0c4"/>' +
    '<path d="M64 82 q 14 -16 36 -16 q 22 0 36 16 q -10 6 -36 6 q -26 0 -36 -6 Z" fill="#7ad7cf"/>' +
    '<g transform="translate(72 72)"><path d="M0 -9 L 2.6 -2.6 L 9 -2.2 L 4 2 L 5.6 8.6 L 0 4.6 L -5.6 8.6 L -4 2 L -9 -2.2 L -2.6 -2.6 Z" fill="#ffb84d"/></g>' +
    '<path d="M82 98 q 6 7 12 0" stroke="#6a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M106 98 q 6 7 12 0" stroke="#6a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<circle cx="80" cy="112" r="5" fill="#ffc0b0"/><circle cx="120" cy="112" r="5" fill="#ffc0b0"/>' +
    '<path d="M92 116 q 8 8 16 0" stroke="#c97a6a" stroke-width="2.5" fill="none" stroke-linecap="round"/>';

  function svgWrap(inner) {
    return '<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  // A scalable open book centered at (cx, cy-top), scale s.
  function bookGroup(cx, cy, s) {
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">' +
      '<path d="M0 0 C -20 -9, -44 -7, -55 0 L -55 44 C -44 37, -20 35, 0 44 Z" fill="#ffffff" stroke="#d9c08a" stroke-width="2"/>' +
      '<path d="M0 0 C 20 -9, 44 -7, 55 0 L 55 44 C 44 37, 20 35, 0 44 Z" fill="#fbf4e2" stroke="#d9c08a" stroke-width="2"/>' +
      '<line x1="0" y1="0" x2="0" y2="44" stroke="#d9c08a" stroke-width="2"/>' +
      '<g stroke="#cdd8f2" stroke-width="3" stroke-linecap="round">' +
      '<line x1="-42" y1="10" x2="-10" y2="8"/><line x1="-42" y1="20" x2="-10" y2="18"/><line x1="-40" y1="30" x2="-14" y2="29"/>' +
      '<line x1="10" y1="8" x2="42" y2="10"/><line x1="10" y1="18" x2="42" y2="20"/><line x1="14" y1="29" x2="40" y2="30"/></g></g>';
  }
  function spark(x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#ffd76a"/></g>';
  }
  // A little chalkboard "slate" with numbers on it — the math counterpart of
  // the open book the reading statues hold. Centered at (cx, cy), scale s.
  function slateGroup(cx, cy, s, txt) {
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">' +
      '<rect x="-48" y="-8" width="96" height="64" rx="9" fill="#caa46a"/>' +              // wood frame
      '<rect x="-40" y="-1" width="80" height="50" rx="5" fill="#3a6b5c"/>' +              // chalkboard
      '<text x="0" y="34" text-anchor="middle" font-size="34" fill="#ffffff" font-family="inherit">' + txt + '</text>' +
      '</g>';
  }

  // ---- CAT: cozy bookworm cat (full body + tail + glasses) on a wood step ----
  const CAT_SVG = svgWrap(
    '<ellipse cx="100" cy="232" rx="66" ry="7" fill="#00000015"/>' +
    '<rect x="48" y="214" width="104" height="20" rx="6" fill="#caa46a"/>' +
    '<rect x="48" y="214" width="104" height="6" rx="3" fill="#e0c188"/>' +
    '<ellipse cx="100" cy="180" rx="50" ry="40" fill="#f3a85a"/>' +
    '<ellipse cx="100" cy="190" rx="30" ry="28" fill="#ffe9c9"/>' +
    '<path d="M150 192 q 28 0 28 -24 q 0 -16 -16 -18 q 9 10 7 20 q -3 14 -26 12 Z" fill="#e8923f"/>' +
    '<path d="M70 160 q 6 8 2 16" stroke="#e08b3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M130 160 q -6 8 -2 16" stroke="#e08b3a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    CAT_CHAR +
    '<g fill="none" stroke="#5a4636" stroke-width="3"><circle cx="86" cy="95" r="12"/><circle cx="114" cy="95" r="12"/><line x1="98" y1="95" x2="102" y2="95"/></g>' +
    bookGroup(100, 150, 0.8) +
    '<ellipse cx="58" cy="182" rx="11" ry="8" fill="#f3a85a"/>' +
    '<ellipse cx="142" cy="182" rx="11" ry="8" fill="#f3a85a"/>'
  );

  // ---- UNICORN: floating on a cloud with a magic book + sparkles ----
  const UNICORN_SVG = svgWrap(
    '<ellipse cx="100" cy="234" rx="62" ry="7" fill="#00000012"/>' +
    '<g fill="#cdbcef">' +
    '<circle cx="59" cy="219" r="20"/><circle cx="90" cy="209" r="25"/>' +
    '<circle cx="123" cy="211" r="23"/><circle cx="151" cy="220" r="17"/>' +
    '<rect x="49" y="214" width="106" height="20" rx="12"/></g>' +
    '<g fill="#eef2fd">' +
    '<circle cx="60" cy="217" r="17"/><circle cx="90" cy="207" r="22"/>' +
    '<circle cx="122" cy="209" r="20"/><circle cx="150" cy="218" r="14"/>' +
    '<rect x="51" y="213" width="100" height="17" rx="10"/></g>' +
    UNICORN_CHAR +
    bookGroup(100, 152, 0.58) +
    spark(56, 120, 1.5) + spark(150, 106, 1.7) + spark(142, 162, 1.1) + spark(70, 152, 0.9)
  );

  // ---- MERMAID: on a scallop shell, teal hair + bubbles ----
  const MERMAID_SVG = svgWrap(
    '<ellipse cx="100" cy="233" rx="64" ry="7" fill="#00000012"/>' +
    '<path d="M50 232 C 54 198, 146 198, 150 232 Z" fill="#ffc6d3"/>' +
    '<path d="M50 232 C 54 198, 146 198, 150 232 Z" fill="none" stroke="#f3a9bb" stroke-width="2"/>' +
    '<g stroke="#f3a9bb" stroke-width="2">' +
    '<line x1="100" y1="207" x2="100" y2="230"/><line x1="100" y1="207" x2="78" y2="230"/>' +
    '<line x1="100" y1="207" x2="122" y2="230"/><line x1="100" y1="207" x2="62" y2="231"/>' +
    '<line x1="100" y1="207" x2="138" y2="231"/></g>' +
    '<circle cx="100" cy="205" r="6" fill="#ffd7e0"/>' +
    '<g fill="#bfeaf0"><circle cx="40" cy="150" r="6"/><circle cx="30" cy="128" r="4"/><circle cx="46" cy="112" r="3"/></g>' +
    MERMAID_CHAR +
    bookGroup(100, 150, 0.78)
  );

  // ---- MATH STATUES (matching shelf, earned with math stars) ----

  // ---- NUMBER OWL: a wise owl holding a "123" slate, on a wood step ----
  const OWL_SVG = svgWrap(
    '<ellipse cx="100" cy="232" rx="64" ry="7" fill="#00000015"/>' +
    '<rect x="46" y="214" width="108" height="20" rx="6" fill="#caa46a"/>' +
    '<rect x="46" y="214" width="108" height="6" rx="3" fill="#e0c188"/>' +
    '<ellipse cx="100" cy="148" rx="50" ry="60" fill="#b07b46"/>' +
    '<path d="M54 130 q -10 36 8 64 q -18 -6 -22 -34 q -2 -22 14 -30 Z" fill="#9c6a3a"/>' +
    '<path d="M146 130 q 10 36 -8 64 q 18 -6 22 -34 q 2 -22 -14 -30 Z" fill="#9c6a3a"/>' +
    '<ellipse cx="100" cy="158" rx="32" ry="44" fill="#f3e2c2"/>' +
    '<path d="M64 96 L 58 64 L 86 86 Z" fill="#9c6a3a"/>' +
    '<path d="M136 96 L 142 64 L 114 86 Z" fill="#9c6a3a"/>' +
    '<circle cx="82" cy="116" r="22" fill="#ffffff"/>' +
    '<circle cx="118" cy="116" r="22" fill="#ffffff"/>' +
    '<circle cx="82" cy="116" r="11" fill="#3a2f1f"/>' +
    '<circle cx="118" cy="116" r="11" fill="#3a2f1f"/>' +
    '<circle cx="86" cy="112" r="3.5" fill="#ffffff"/>' +
    '<circle cx="122" cy="112" r="3.5" fill="#ffffff"/>' +
    '<path d="M62 96 q 20 -12 38 0" stroke="#7a5230" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M138 96 q -20 -12 -38 0" stroke="#7a5230" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M94 128 L 106 128 L 100 140 Z" fill="#f0a04e"/>' +
    slateGroup(100, 168, 0.5, "123") +
    '<path d="M80 206 l -6 9 m 6 -9 l 0 10 m 0 -10 l 6 9" stroke="#f0a04e" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M120 206 l -6 9 m 6 -9 l 0 10 m 0 -10 l 6 9" stroke="#f0a04e" stroke-width="4" fill="none" stroke-linecap="round"/>'
  );

  // ---- ADDING ROBOT: a friendly robot with a "+" chest screen + sparkles ----
  const ROBOT_SVG = svgWrap(
    '<ellipse cx="100" cy="232" rx="60" ry="7" fill="#00000015"/>' +
    '<rect x="50" y="214" width="100" height="20" rx="6" fill="#9aa6b2"/>' +
    '<rect x="50" y="214" width="100" height="6" rx="3" fill="#c2ccd6"/>' +
    '<rect x="80" y="196" width="14" height="20" rx="4" fill="#7f8b99"/>' +
    '<rect x="106" y="196" width="14" height="20" rx="4" fill="#7f8b99"/>' +
    '<rect x="44" y="146" width="16" height="46" rx="8" fill="#9aa6b2"/>' +
    '<rect x="140" y="146" width="16" height="46" rx="8" fill="#9aa6b2"/>' +
    '<circle cx="52" cy="196" r="9" fill="#7f8b99"/>' +
    '<circle cx="148" cy="196" r="9" fill="#7f8b99"/>' +
    '<rect x="64" y="138" width="72" height="66" rx="14" fill="#b9c4d0"/>' +
    '<rect x="64" y="138" width="72" height="66" rx="14" fill="none" stroke="#8e9aa8" stroke-width="3"/>' +
    '<rect x="80" y="152" width="40" height="38" rx="8" fill="#2d3142"/>' +
    '<path d="M100 159 v24 M88 171 h24" stroke="#5fd3a0" stroke-width="5" stroke-linecap="round"/>' +
    '<rect x="92" y="120" width="16" height="22" fill="#8e9aa8"/>' +
    '<rect x="66" y="74" width="68" height="56" rx="14" fill="#cfd8e2"/>' +
    '<rect x="66" y="74" width="68" height="56" rx="14" fill="none" stroke="#8e9aa8" stroke-width="3"/>' +
    '<line x1="100" y1="74" x2="100" y2="56" stroke="#8e9aa8" stroke-width="4"/>' +
    '<circle cx="100" cy="52" r="7" fill="#ff8fab"/>' +
    '<circle cx="86" cy="98" r="9" fill="#2d3142"/>' +
    '<circle cx="114" cy="98" r="9" fill="#2d3142"/>' +
    '<circle cx="88" cy="95" r="2.6" fill="#ffffff"/>' +
    '<circle cx="116" cy="95" r="2.6" fill="#ffffff"/>' +
    '<path d="M86 114 q 14 12 28 0" stroke="#2d3142" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    spark(52, 92, 1.3) + spark(150, 82, 1.4) + spark(152, 150, 1.0)
  );

  // ---- NUMBER ROCKET: blasting off a cloud with a number window + stars ----
  const ROCKET_SVG = svgWrap(
    '<ellipse cx="100" cy="234" rx="58" ry="7" fill="#00000012"/>' +
    '<g fill="#dfe7f5"><circle cx="70" cy="216" r="18"/><circle cx="100" cy="208" r="22"/>' +
    '<circle cx="130" cy="216" r="18"/><rect x="58" y="212" width="84" height="20" rx="10"/></g>' +
    '<path d="M88 176 q 12 28 12 44 q 0 -16 12 -44 q -6 8 -12 8 q -6 0 -12 -8 Z" fill="#ffb84d"/>' +
    '<path d="M93 178 q 7 20 7 30 q 0 -10 7 -30 q -3 6 -7 6 q -4 0 -7 -6 Z" fill="#ff7a59"/>' +
    '<path d="M76 132 q -24 12 -28 38 q 20 -2 32 -16 Z" fill="#ff8fab"/>' +
    '<path d="M124 132 q 24 12 28 38 q -20 -2 -32 -16 Z" fill="#ff8fab"/>' +
    '<path d="M100 40 C 128 60, 134 122, 124 176 L 76 176 C 66 122, 72 60, 100 40 Z" fill="#eef2fb" stroke="#c4cfe4" stroke-width="3"/>' +
    '<path d="M100 40 C 112 52, 118 72, 120 88 L 80 88 C 82 72, 88 52, 100 40 Z" fill="#ff8fab"/>' +
    '<circle cx="100" cy="116" r="22" fill="#9bd0ff" stroke="#5b8def" stroke-width="4"/>' +
    '<text x="100" y="127" text-anchor="middle" font-size="28" fill="#2d3142" font-family="inherit">5</text>' +
    spark(44, 120, 1.6) + spark(158, 104, 1.7) + spark(150, 162, 1.1) + spark(50, 178, 1.0)
  );

  const READING_STATUES = [
    { id: "cat",     name: "Reading Cat",     stars: 3,  svg: CAT_SVG },
    { id: "unicorn", name: "Reading Unicorn", stars: 10, svg: UNICORN_SVG },
    { id: "mermaid", name: "Reading Mermaid", stars: 20, svg: MERMAID_SVG }
  ];

  const MATH_STATUES = [
    { id: "owl",    name: "Number Owl",    stars: 3,  svg: OWL_SVG },
    { id: "robot",  name: "Adding Robot",  stars: 10, svg: ROBOT_SVG },
    { id: "rocket", name: "Number Rocket", stars: 20, svg: ROCKET_SVG }
  ];

  // Big reveal overlay when a new statue is unlocked.
  function celebrateStatue(s) {
    const art = el("div", { class: "statue-art big" });
    art.innerHTML = s.svg;
    const overlay = el("div", { class: "celebrate-overlay" }, [
      el("div", { class: "celebrate-card" }, [
        el("div", { class: "celebrate-title" }, ["🎉 New Statue! 🎉"]),
        art,
        el("div", { class: "celebrate-name" }, ["You unlocked the " + s.name + "!"]),
        el("button", { class: "btn blue", onclick: function () { overlay.remove(); } }, ["Awesome! ✨"])
      ])
    ]);
    document.body.appendChild(overlay);
    cheer("🌟");
  }

  /* ---------------- COLLECTION ---------------- */
  // One shelf of statues (reading or math), unlocked by that subject's stars.
  function statueShelf(heading, statues, stars) {
    const grid = el("div", { class: "collection-grid" });
    statues.forEach(s => {
      const unlocked = stars >= s.stars;
      const art = el("div", { class: "statue-art" });
      art.innerHTML = s.svg;
      const card = el("div", { class: "statue-card" + (unlocked ? "" : " locked") }, [
        art,
        el("div", { class: "statue-name" }, [unlocked ? s.name : "???"]),
        el("div", { class: "statue-req" }, [
          unlocked ? "✅ Unlocked!" : ("🔒 " + stars + " / " + s.stars + " ⭐")
        ])
      ]);
      if (!unlocked) card.appendChild(el("div", { class: "lock-badge" }, ["🔒"]));
      grid.appendChild(card);
    });
    return el("div", { class: "collection-section" }, [
      el("h2", { class: "collection-heading" }, [heading]),
      grid
    ]);
  }

  function renderCollection() {
    clear();
    app.appendChild(topbar("My Collection 🏛️", renderMainMenu));
    app.appendChild(el("div", { class: "prompt", style: "margin-bottom:8px" }, [
      "Collect a statue for every milestone of stars!"
    ]));
    app.appendChild(statueShelf("📖 Reading Statues", READING_STATUES, getSubjectStars("reading")));
    app.appendChild(statueShelf("🔢 Math Statues", MATH_STATUES, getSubjectStars("math")));
  }

  /* ---------------- PARENT AREA ----------------
     A little dashboard for a grown-up: see what she's mastered, what's still
     tricky, and record the phoneme sounds. Gated behind a simple multiplication
     question so a 5-year-old doesn't wander in. */
  function openParentGate() {
    const a = randInt(3, 9), b = randInt(3, 9), correct = a * b;
    const overlay = el("div", { class: "celebrate-overlay" });
    // Four distinct, plausible answers near the product.
    const opts = new Set([correct]);
    [a, -a, b, -b, 1, -1, a + b, -(a + b)].forEach(function (d) {
      const v = correct + d;
      if (opts.size < 4 && v > 0 && v !== correct) opts.add(v);
    });
    const choices = shuffle([...opts]);
    const row = el("div", { class: "btn-row", style: "margin-top:14px" });
    choices.forEach(v => {
      row.appendChild(el("button", { class: "btn blue", onclick: function () {
        if (v === correct) { overlay.remove(); renderParent(); }
        else { this.classList.add("shake"); setTimeout(() => this.classList.remove("shake"), 400); }
      } }, [String(v)]));
    });
    overlay.appendChild(el("div", { class: "celebrate-card" }, [
      el("div", { class: "celebrate-title" }, ["For Grown-Ups 🔒"]),
      el("p", { class: "prompt" }, ["What is " + a + " × " + b + "?"]),
      row,
      el("button", { class: "btn ghost", style: "margin-top:14px", onclick: () => overlay.remove() }, ["Cancel"])
    ]));
    document.body.appendChild(overlay);
  }

  function renderParent() {
    clear();
    app.appendChild(topbar("For Grown-Ups 👩‍👧", renderMainMenu));

    // --- Summary stats ---
    app.appendChild(el("div", { class: "parent-stats" }, [
      el("div", { class: "pstat" }, [el("b", null, [String(getStarCount())]), el("span", null, ["stars"])]),
      el("div", { class: "pstat" }, [el("b", null, [getLevelsMastered() + "/" + DATA.levels.length]), el("span", null, ["levels mastered"])]),
      el("div", { class: "pstat" }, [el("b", null, [unlockedStatueCount() + "/" + totalStatueCount()]), el("span", null, ["statues"])])
    ]));

    // --- Per-level reading progress (which activities she has finished) ---
    const done = loadProgress().lessonsDone || {};
    const stars = loadProgress().stars || {};
    const table = el("div", { class: "parent-table" });
    table.appendChild(el("div", { class: "ptr phead" }, [
      el("span", null, ["Level"]), el("span", null, ["🧩"]), el("span", null, ["🔡"]),
      el("span", null, ["📕"]), el("span", null, ["📖"]), el("span", null, ["⭐"])
    ]));
    function dot(on) { return el("span", null, [on ? "✅" : "·"]); }
    DATA.levels.forEach(lvl => {
      table.appendChild(el("div", { class: "ptr" }, [
        el("span", { class: "pname" }, [lvl.id + ". " + lvl.name]),
        dot(done["blend-" + lvl.id]),
        dot(done["build-" + lvl.id]),
        dot(done["read-" + lvl.id]),
        dot(done["sentences-" + lvl.id]),
        el("span", null, [stars[lvl.id] ? "⭐" : "☆"])
      ]));
    });
    app.appendChild(el("h2", { class: "collection-heading" }, ["Reading progress"]));
    app.appendChild(table);

    // --- Math progress: how many activities finished at each difficulty ---
    const MKEYS = ["count", "show", "bond", "add", "sub", "compare", "seq", "word"];
    const mtable = el("div", { class: "parent-table" });
    Object.keys(MATH.levels).forEach(k => {
      const n = MKEYS.filter(key => done["math-" + key + "-" + k]).length;
      mtable.appendChild(el("div", { class: "mrow" }, [
        el("span", null, ["Level " + MATH.levels[k].label]),
        el("span", { class: "mrow-val" }, [n + " / " + MKEYS.length + (n === MKEYS.length ? " ✅" : "")])
      ]));
    });
    app.appendChild(el("h2", { class: "collection-heading" }, ["Math progress"]));
    app.appendChild(mtable);

    // --- Tricky words she's flagged ---
    const tricky = getTrickyWords();
    app.appendChild(el("h2", { class: "collection-heading" }, ["Tricky words (" + tricky.length + ")"]));
    if (tricky.length) {
      const chips = el("div", { class: "tricky-chips" });
      tricky.forEach(w => chips.appendChild(el("span", { class: "tchip" }, [w])));
      app.appendChild(chips);
    } else {
      app.appendChild(el("p", { class: "prompt" }, ["Nothing flagged as tricky right now. 🎉"]));
    }

    // --- Tools ---
    app.appendChild(el("button", { class: "collection-btn", style: "margin-top:20px", onclick: renderRecordSounds }, [
      "🎙️ Record the Sounds"
    ]));
    app.appendChild(el("button", { class: "btn ghost", style: "width:100%;margin-top:12px", onclick: function () {
      if (window.confirm("Reset ALL progress — stars, statues, tricky words? This can't be undone.")) {
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        renderMainMenu();
      }
    } }, ["♻️ Reset progress"]));
  }

  /* ---------------- PARENT: record phoneme sounds ----------------
     Records each letter-sound once with the device mic and stores it in
     IndexedDB (on-device only). These power the Sounds & Blend activities. */
  function renderRecordSounds() {
    clear();
    app.appendChild(topbar("Record the Sounds 🎙️", renderParent));

    if (!PhonemeAudio.supported) {
      app.appendChild(el("p", { class: "prompt" }, [
        "Recording isn't available in this browser. Open the installed app (Safari on the iPad) to record sounds."
      ]));
      return;
    }

    app.appendChild(el("p", { class: "prompt", style: "margin-bottom:6px" }, [
      "Tap ● and say the SOUND, not the letter name — \"/a/\" (as in apple), not \"ay\". " +
      "Each clip is ~1.5s and saved on this device only."
    ]));

    const list = el("div", { class: "sound-list" });
    let recording = false;

    DATA.letterSounds.forEach(card => {
      const have = hasPhoneme(card.g);
      const row = el("div", { class: "sound-row" + (have ? " has" : "") });
      row.appendChild(el("span", { class: "sound-g" }, [card.g]));
      row.appendChild(el("span", { class: "sound-kw" }, [card.emoji + " " + card.keyword]));

      const recBtn = el("button", { class: "rec-btn", onclick: function () {
        if (recording) return;
        recordPhoneme(card.g, this);
      } }, [have ? "● Re-record" : "● Record"]);
      row.appendChild(recBtn);

      if (have) {
        row.appendChild(el("button", { class: "hear-btn small", onclick: () => PhonemeAudio.play(card.g) }, ["▶︎"]));
        row.appendChild(el("button", { class: "hear-btn small", onclick: function () {
          PhonemeAudio.del(card.g).then(() => refreshRecordedSounds()).then(renderRecordSounds);
        } }, ["🗑️"]));
      }
      list.appendChild(row);
    });
    app.appendChild(list);

    function recordPhoneme(g, btn) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        recording = true;
        btn.textContent = "● Recording…";
        btn.classList.add("recording");
        const rec = new MediaRecorder(stream);
        const chunks = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          PhonemeAudio.put(g, blob)
            .then(() => refreshRecordedSounds())
            .then(() => { recording = false; renderRecordSounds(); });
        };
        rec.start();
        setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 1500);
      }).catch(function () {
        recording = false;
        window.alert("Couldn't use the microphone. Check the mic permission for this site.");
      });
    }
  }

  /* ---------------- Star jar (home accomplishments) ---------------- */
  function starsBanner() {
    const n = getStarCount();
    const MAX_SHOWN = 60; // keep the row from overflowing on big collections

    const head = el("div", { class: "stars-head" }, [
      el("span", { class: "stars-count" }, ["⭐ " + n]),
      el("span", { class: "stars-label" }, [n === 1 ? "star collected!" : "stars collected!"])
    ]);
    const banner = el("div", { class: "stars-banner" }, [head]);

    if (n > 0) {
      const row = el("div", { class: "stars-row" });
      const shown = Math.min(n, MAX_SHOWN);
      for (let k = 0; k < shown; k++) row.appendChild(document.createTextNode("⭐"));
      if (n > MAX_SHOWN) row.appendChild(el("span", { class: "stars-more" }, [" +" + (n - MAX_SHOWN)]));
      banner.appendChild(row);
    } else {
      banner.appendChild(el("div", { class: "stars-empty" }, ["Read and play to collect stars! 🌟"]));
    }

    banner.appendChild(el("div", { class: "stars-sub" }, [
      "📖 Reading: " + getSubjectStars("reading") + " ⭐    🔢 Math: " + getSubjectStars("math") + " ⭐"
    ]));
    return banner;
  }

  // Shared: turn a list of {emoji,label,go} into the 2-column card menu.
  function menuGrid(items) {
    const menu = el("div", { class: "menu" });
    items.forEach(it => {
      menu.appendChild(el("button", { class: "menu-card", onclick: it.go }, [
        el("span", { class: "emoji" }, [it.emoji]),
        el("span", null, [it.label])
      ]));
    });
    return menu;
  }

  /* ---------------- MAIN MENU (pick Reading or Math) ---------------- */
  // The top-level home. The star jar + collection live here now, so they
  // celebrate everything she's done across BOTH reading and math.
  function renderMainMenu() {
    clear();
    app.appendChild(el("div", { class: "home-hello" }, [
      buddyNode("wave", "hello"),
      el("div", null, [
        el("h1", { class: "home-title" }, ["Learning Buddy 🌟"]),
        el("p", { class: "home-sub" }, ["What do you want to do today?"])
      ])
    ]));
    app.appendChild(starsBanner());
    app.appendChild(el("button", { class: "collection-btn", onclick: renderCollection }, [
      "🏛️ My Collection  (" + unlockedStatueCount() + " / " + totalStatueCount() + ")"
    ]));

    const choices = el("div", { class: "choice-cards" }, [
      el("button", { class: "big-choice reading", onclick: renderReadingHome }, [
        el("span", { class: "bc-emoji" }, ["📖"]),
        el("span", { class: "bc-label" }, ["Reading"])
      ]),
      el("button", { class: "big-choice math", onclick: renderMathHome }, [
        el("span", { class: "bc-emoji" }, ["🔢"]),
        el("span", { class: "bc-label" }, ["Math"])
      ])
    ]);
    app.appendChild(choices);

    app.appendChild(el("button", { class: "grownup-btn", onclick: openParentGate }, [
      "🔒 For Grown-Ups"
    ]));
  }

  /* ---------------- READING HOME ---------------- */
  function renderReadingHome() {
    clear();
    app.appendChild(topbar("Reading 📖", renderMainMenu));

    const trickyN = getTrickyWords().length;
    if (trickyN > 0) {
      app.appendChild(el("button", { class: "tricky-btn", onclick: renderTricky }, [
        "🤔 Review Tricky Words  (" + trickyN + ")"
      ]));
    }

    app.appendChild(menuGrid([
      { emoji: "📚", label: "Stories",     go: renderStories },
      { emoji: "🔤", label: "Sounds",      go: renderSounds },
      { emoji: "🧩", label: "Blend Words", go: () => renderLevelPicker("blend") },
      { emoji: "🔡", label: "Build Words", go: () => renderLevelPicker("build") },
      { emoji: "📕", label: "Read Words",  go: () => renderLevelPicker("read") },
      { emoji: "📖", label: "Sentences",   go: () => renderLevelPicker("sentences") },
      { emoji: "🕵️", label: "Real or Not?", go: renderRealOrNot },
      { emoji: "❤️", label: "Heart Words", go: renderHeartWords }
    ]));
  }

  /* ---------------- MATH HOME ---------------- */
  function renderMathHome() {
    clear();
    app.appendChild(topbar("Math 🔢", renderMainMenu));

    app.appendChild(el("div", { class: "home-hello math-hello" }, [
      buddyNode("happy", "hello"),
      el("div", null, [el("p", { class: "home-sub", style: "margin:0" }, ["Let's count and play! 🔢"])])
    ]));

    // Difficulty picker — this is the "make it harder" setting. Tapping a
    // level just widens the number ranges used to build every problem.
    const lvl = getMathLevel();
    const diff = el("div", { class: "difficulty" }, [
      el("span", { class: "diff-label" }, ["Level"])
    ]);
    Object.keys(MATH.levels).forEach(k => {
      diff.appendChild(el("button", {
        class: "diff-btn" + (lvl === k ? " on" : ""),
        onclick: () => { setMathLevel(k); renderMathHome(); }
      }, [MATH.levels[k].label]));
    });
    app.appendChild(diff);

    app.appendChild(menuGrid([
      { emoji: "🔢", label: "Counting",       go: mathCounting },
      { emoji: "🔟", label: "Show the Number", go: mathShowNumber },
      { emoji: "🔗", label: "Number Bonds",   go: mathBonds },
      { emoji: "➕", label: "Adding",          go: mathAdding },
      { emoji: "➖", label: "Subtracting",     go: mathSubtracting },
      { emoji: "⚖️", label: "Which Is More?",  go: mathCompare },
      { emoji: "➡️", label: "What Comes Next?", go: mathSequence },
      { emoji: "📖", label: "Story Problems",  go: mathWordProblem }
    ]));
  }

  /* ---------------- MATH: shared quiz runner ----------------
     Every math activity is the same loop — show a question with a picture,
     tap an answer, get a cheer, move on — so they share this runner. Each
     activity just supplies makeQ(): a fresh { prompt, visual, sentence,
     choices, correct } each round. A star is earned the first time the
     activity is finished at a given difficulty. */
  function runQuiz(opts) {
    const total = opts.total || 8;
    let i = 0, got = 0;

    function show() {
      clear();
      app.appendChild(topbar(opts.title, renderMathHome));
      const q = opts.makeQ();
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, [q.prompt]));
      if (q.visual) stage.appendChild(el("div", { class: "bigcard mathcard" }, [q.visual]));
      if (q.sentence) stage.appendChild(el("div", { class: "mathsentence" }, [q.sentence]));

      // Read the question aloud — she's still learning to read, so the words
      // shouldn't be the thing that blocks the math.
      const said = q.say || q.prompt;
      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(said) }, ["👂 Hear it"]));
      if (opts.speakOnShow) speak(said);

      let answered = false, firstTry = true;
      const row = el("div", { class: "choice-row" });
      q.choices.forEach(c => {
        const btn = el("button", { class: "choice-btn", onclick: function () {
          if (answered) return;
          if (c === q.correct) {
            answered = true;
            this.classList.add("right");
            if (firstTry) got++;
            cheer("⭐");
            setTimeout(next, 750);
          } else {
            this.classList.add("wrong");
            firstTry = false;
            chime(false);
          }
        } }, [String(c)]);
        row.appendChild(btn);
      });
      stage.appendChild(row);
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + total]));
      app.appendChild(stage);
    }
    function next() {
      i++;
      if (i >= total) {
        completeLesson(opts.lessonKey);
        renderDone(opts.title, opts.emoji, () => runQuiz(opts), "You got " + got + " of " + total + "!");
      } else show();
    }
    show();
  }

  /* ---------------- MATH ACTIVITIES ---------------- */

  // How many? — count a group of objects.
  function mathCounting() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "Counting 🔢", emoji: "🔢", lessonKey: "math-count-" + lvl,
      makeQ: function () {
        const n = randInt(1, cfg.countMax);
        return {
          prompt: "How many?",
          visual: objectsRow(n, pick(MATH.emojis)),
          choices: numberChoices(n, 4, 1, cfg.countMax),
          correct: n
        };
      }
    });
  }

  // Number bonds — find the missing part (part–part–whole).
  function mathBonds() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "Number Bonds 🔗", emoji: "🔗", lessonKey: "math-bond-" + lvl,
      makeQ: function () {
        const whole = randInt(3, cfg.bondMax);
        const a = randInt(1, whole - 1), b = whole - a;
        const hideB = Math.random() < 0.5;
        const correct = hideB ? b : a;
        return {
          prompt: "What is the missing part?",
          visual: bondNode(whole, hideB ? a : null, hideB ? null : b),
          choices: numberChoices(correct, 4, 0, cfg.bondMax),
          correct: correct
        };
      }
    });
  }

  // Adding — two groups, how many altogether?
  function mathAdding() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "Adding ➕", emoji: "➕", lessonKey: "math-add-" + lvl,
      makeQ: function () {
        const a = randInt(1, cfg.addMax - 1);
        const b = randInt(1, cfg.addMax - a);
        const emoji = pick(MATH.emojis);
        const visual = el("div", { class: "addsub" }, [
          objectsRow(a, emoji),
          el("div", { class: "op" }, ["+"]),
          objectsRow(b, emoji)
        ]);
        return {
          prompt: "How many altogether?",
          say: a + " plus " + b + ". How many altogether?",
          visual: visual,
          sentence: a + " + " + b + " = ?",
          choices: numberChoices(a + b, 4, 1, cfg.addMax),
          correct: a + b
        };
      }
    });
  }

  // Subtracting — take some away, how many are left?
  function mathSubtracting() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "Subtracting ➖", emoji: "➖", lessonKey: "math-sub-" + lvl,
      makeQ: function () {
        const total = randInt(2, cfg.subMax);
        const take = randInt(1, total - 1);
        const left = total - take;
        return {
          prompt: "How many are left?",
          say: total + " take away " + take + ". How many are left?",
          visual: objectsRow(total, pick(MATH.emojis), left),  // cross out the last `take`
          sentence: total + " − " + take + " = ?",
          choices: numberChoices(left, 4, 0, cfg.subMax),
          correct: left
        };
      }
    });
  }

  // Which is more? — compare two groups.
  function mathCompare() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "Which Is More? ⚖️", emoji: "⚖️", lessonKey: "math-compare-" + lvl,
      makeQ: function () {
        const a = randInt(1, cfg.compareMax);
        let b = randInt(1, cfg.compareMax);
        while (b === a) b = randInt(1, cfg.compareMax);
        const e1 = pick(MATH.emojis), e2 = pick(MATH.emojis);
        const visual = el("div", { class: "compare" }, [
          el("div", { class: "compare-side" }, [objectsRow(a, e1), el("div", { class: "compare-num" }, [String(a)])]),
          el("div", { class: "compare-vs" }, ["vs"]),
          el("div", { class: "compare-side" }, [objectsRow(b, e2), el("div", { class: "compare-num" }, [String(b)])])
        ]);
        return {
          prompt: "Which group has MORE? Tap the bigger number.",
          visual: visual,
          choices: shuffle([a, b]),
          correct: Math.max(a, b)
        };
      }
    });
  }

  // What comes next? — number sequences (and skip-counting when harder).
  function mathSequence() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    runQuiz({
      title: "What Comes Next? ➡️", emoji: "➡️", lessonKey: "math-seq-" + lvl,
      makeQ: function () {
        const step = pick(cfg.seqSteps);
        const start = randInt(0, Math.max(0, cfg.seqMax - step * 3));
        const seq = [start, start + step, start + 2 * step];
        const answer = start + 3 * step;
        const visual = el("div", { class: "seqrow" });
        seq.forEach(v => visual.appendChild(el("div", { class: "seq-card" }, [String(v)])));
        visual.appendChild(el("div", { class: "seq-card seq-q" }, ["?"]));
        return {
          prompt: step === 1 ? "What number comes next?" : "Count by " + step + "s. What comes next?",
          say: seq.join(", ") + "… what comes next?",
          visual: visual,
          choices: numberChoices(answer, 4, 0, cfg.seqMax + step * 3),
          correct: answer
        };
      }
    });
  }

  // Show the Number — a ten-frame she FILLS to match a numeral. This is the
  // math twin of Build-a-Word: she produces the quantity instead of picking it,
  // and ten-frames build the K-1 "ten and some more" sense + subitizing.
  function mathShowNumber() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    const showMax = Math.min(20, cfg.countMax);
    const frameCount = showMax > 10 ? 2 : 1;
    const total = 8;
    let i = 0, got = 0;

    function show() {
      clear();
      app.appendChild(topbar("Show the Number 🔟", renderMathHome));
      const target = randInt(1, showMax);
      const counter = pick(MATH.emojis);

      const stage = el("div", { class: "stage" });
      stage.appendChild(el("div", { class: "prompt" }, ["Tap the frame to show this many!"]));
      stage.appendChild(el("div", { class: "bigcard" }, [
        el("div", { class: "show-number" }, [String(target)])
      ]));
      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(String(target)) }, ["👂 Hear it"]));

      // The ten-frame(s). Tapping a cell toggles a counter in/out.
      const cells = [];
      const frames = el("div", { class: "tenframes" });
      for (let f = 0; f < frameCount; f++) {
        const frame = el("div", { class: "tenframe" });
        for (let c = 0; c < 10; c++) {
          const cell = el("button", { class: "frame-cell", onclick: function () {
            this.classList.toggle("on");
            this.textContent = this.classList.contains("on") ? counter : "";
            paintCount();
          } }, [""]);
          cells.push(cell);
          frame.appendChild(cell);
        }
        frames.appendChild(frame);
      }
      stage.appendChild(frames);

      const countEl = el("div", { class: "frame-count" }, ["You placed: 0"]);
      function paintCount() { countEl.textContent = "You placed: " + cells.filter(c => c.classList.contains("on")).length; }
      stage.appendChild(countEl);

      stage.appendChild(el("button", { class: "btn green", onclick: function () {
        const have = cells.filter(c => c.classList.contains("on")).length;
        if (have === target) { got++; cheer("⭐"); setTimeout(next, 800); }
        else { chime(false); countEl.textContent = have < target ? "A few more! You placed: " + have : "Too many! You placed: " + have; }
      } }, ["Check ✓"]));

      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + total]));
      app.appendChild(stage);
    }
    function next() {
      i++;
      if (i >= total) { completeLesson("math-show-" + lvl); renderDone("Show the Number", "🔟", () => mathShowNumber(), "You got " + got + " of " + total + "!"); }
      else show();
    }
    show();
  }

  // Story Problems — short word problems read aloud. The math twin of story
  // comprehension: she has to understand the situation, not just compute.
  function mathWordProblem() {
    const lvl = getMathLevel(), cfg = MATH.levels[lvl];
    const themes = [
      { e: "🐸", name: "frogs",  place: "in the pond",  inV: "more hop in",   outV: "hop away" },
      { e: "🐦", name: "birds",  place: "on a branch",  inV: "more fly over", outV: "fly away" },
      { e: "🍎", name: "apples", place: "in the basket", inV: "more go in",    outV: "are eaten" },
      { e: "🚗", name: "cars",   place: "in the lot",   inV: "more drive up", outV: "drive off" },
      { e: "🐱", name: "cats",   place: "on the mat",   inV: "more come over", outV: "run off" },
      { e: "🍪", name: "cookies", place: "on the plate", inV: "more are baked", outV: "are eaten" }
    ];
    runQuiz({
      title: "Story Problems 📖", emoji: "📖", lessonKey: "math-word-" + lvl, speakOnShow: true,
      makeQ: function () {
        const t = pick(themes);
        const hiMax = Math.max(cfg.addMax, cfg.subMax);
        let story, answer;
        if (Math.random() < 0.5) {                       // adding
          const a = randInt(1, Math.max(2, cfg.addMax - 2));
          const b = randInt(1, Math.max(1, cfg.addMax - a));
          answer = a + b;
          story = "There are " + a + " " + t.name + " " + t.place + ". " + b + " " + t.inV + ". How many now?";
        } else {                                          // taking away
          const a = randInt(2, cfg.subMax);
          const b = randInt(1, a - 1);
          answer = a - b;
          story = "There are " + a + " " + t.name + " " + t.place + ". " + b + " " + t.outV + ". How many are left?";
        }
        return {
          prompt: story,
          say: story,
          visual: el("div", { class: "wordproblem-pic" }, [t.e]),
          choices: numberChoices(answer, 4, 0, hiMax),
          correct: answer
        };
      }
    });
  }

  /* ---------------- LEVEL PICKER ---------------- */
  function renderLevelPicker(mode) {
    clear();
    app.appendChild(topbar("Pick a Level", renderReadingHome));
    const stars = (loadProgress().stars) || {};
    const list = el("div", { class: "level-list" });
    DATA.levels.forEach(lvl => {
      list.appendChild(el("button", {
        class: "level-card",
        onclick: () => {
          if (mode === "blend") renderBlend(lvl);
          else if (mode === "build") renderBuild(lvl);
          else if (mode === "sentences") renderSentences(lvl);
          else renderRead(lvl);
        }
      }, [
        el("span", { class: "level-num" }, [String(lvl.id)]),
        el("span", { class: "meta" }, [
          el("b", null, [lvl.name]),
          el("span", null, [lvl.focus])
        ]),
        el("span", { class: "star" }, [stars[lvl.id] ? "⭐" : "☆"])
      ]));
    });
    app.appendChild(list);
  }

  /* split a word into grapheme chunks, keeping digraphs (sh/ch/th) together */
  function graphemes(word) {
    const chunks = [];
    for (let i = 0; i < word.length; i++) {
      const two = word.slice(i, i + 2);
      if (two === "sh" || two === "ch" || two === "th") { chunks.push(two); i++; }
      else chunks.push(word[i]);
    }
    return chunks;
  }

  /* helper: render a word as tappable letters (groups digraphs visually) */
  function wordLetters(word, onTap) {
    const box = el("div", { class: "bigword" });
    const chunks = graphemes(word);
    chunks.forEach(ch => {
      const isVowel = ch.length === 1 && VOWELS.has(ch);
      const span = el("span", {
        class: "ltr" + (isVowel ? " vowel" : ""),
        onclick: function () {
          this.classList.add("lit");
          setTimeout(() => this.classList.remove("lit"), 350);
          if (onTap) onTap(ch);
        }
      }, [ch]);
      box.appendChild(span);
    });
    return box;
  }

  /* ---------------- ACTIVITY: SOUNDS ---------------- */
  function renderSounds() {
    const deck = shuffle(DATA.letterSounds);
    let i = 0;

    function show() {
      clear();
      app.appendChild(topbar("Sounds 🔤", renderReadingHome));
      const card = deck[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["What sound does this make? Say it out loud!"]));
      stage.appendChild(el("div", { class: "bigcard" }, [
        el("div", { class: "bigword" }, [
          el("span", { class: "ltr" + (card.g.length === 1 && VOWELS.has(card.g) ? " vowel" : "") }, [card.g])
        ])
      ]));

      const reveal = el("div", { class: "keyword-line", style: "visibility:hidden" }, [
        el("span", { class: "emoji" }, [card.emoji]),
        " " + card.g + "  …like  " + card.keyword
      ]);
      stage.appendChild(reveal);

      // If a grown-up recorded this sound, "Hear the sound" plays the real
      // phoneme; otherwise it falls back to the keyword cue + picture.
      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "hear-btn", onclick: () => {
          reveal.style.visibility = "visible";
          playPhoneme(card.g, card.keyword);
        } }, [hasPhoneme(card.g) ? "🔊 Hear the sound" : "👂 Check"]),
        el("button", { class: "btn green", onclick: next }, ["Next →"])
      ]));

      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + deck.length]));
      app.appendChild(stage);
    }
    function next() {
      i++;
      if (i >= deck.length) { completeLesson("sounds"); cheer("🌟"); renderDone("Sounds", "🔤", renderSounds); }
      else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: BLEND WORDS ---------------- */
  function renderBlend(lvl) {
    const words = shuffle(lvl.words);
    let i = 0;

    function show() {
      clear();
      app.appendChild(topbar("Blend: " + lvl.name + " 🧩", () => renderLevelPicker("blend")));
      const word = words[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["Tap each letter and say its sound… then blend it together!"]));
      // Tapping a letter plays its recorded sound (if a grown-up recorded it).
      stage.appendChild(el("div", { class: "bigcard" }, [ wordLetters(word, (ch) => playPhoneme(ch)) ]));

      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "hear-btn", onclick: () => speak(word, 0.6) }, ["👂 Hear it slow"]),
        el("button", { class: "hear-btn", onclick: () => speak(word, 0.95) }, ["🔊 Hear it"])
      ]));

      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => next(false) }, ["I read it! ✅"]),
        el("button", { class: "btn yellow", onclick: () => next(true) }, ["Tricky 🤔"])
      ]));

      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }
    function next(tricky) {
      const word = words[i];
      if (tricky) { addTricky(word); cheer("🤔"); }
      else { removeTricky(word); cheer("🎉"); }
      i++;
      if (i >= words.length) { completeLesson("blend-" + lvl.id); markLevelStar(lvl.id); renderDone("Blend Words", "🧩", () => renderBlend(lvl)); }
      else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: BUILD A WORD (spelling / encoding) ----------------
     Decoding's twin: she HEARS a word and SPELLS it by tapping letter tiles in
     order. Encoding is half of the OG method, and it's a check she can't fake by
     just nodding along. Tiles are the word's own graphemes, shuffled. */
  function renderBuild(lvl) {
    const words = shuffle(lvl.words);
    let i = 0, got = 0;

    function show() {
      clear();
      app.appendChild(topbar("Build: " + lvl.name + " 🔡", () => renderLevelPicker("build")));
      const word = words[i];
      const target = graphemes(word);
      let pos = 0;                 // next slot to fill

      const stage = el("div", { class: "stage" });
      stage.appendChild(el("div", { class: "prompt" }, ["Listen, then build the word!"]));

      // Hear-it buttons (TTS does whole words reliably).
      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "hear-btn", onclick: () => speak(word, 0.6) }, ["👂 Hear it slow"]),
        el("button", { class: "hear-btn", onclick: () => speak(word, 0.95) }, ["🔊 Hear it"])
      ]));

      // Empty slots she fills left-to-right.
      const slotRow = el("div", { class: "build-slots" });
      const slotEls = target.map(() => {
        const s = el("div", { class: "build-slot" }, [""]);
        slotRow.appendChild(s);
        return s;
      });
      stage.appendChild(el("div", { class: "bigcard build-card" }, [slotRow]));

      // Tile tray — the word's graphemes, shuffled.
      const order = shuffle(target.map((g, k) => ({ g: g, k: k })));
      const tray = el("div", { class: "tile-tray" });
      order.forEach(item => {
        const isVowel = item.g.length === 1 && VOWELS.has(item.g);
        const tile = el("button", {
          class: "tile" + (isVowel ? " vowel" : ""),
          onclick: function () {
            if (this.disabled) return;
            if (item.g === target[pos]) {            // correct next letter
              this.classList.add("used");
              this.disabled = true;
              slotEls[pos].textContent = item.g;
              slotEls[pos].classList.add("filled");
              pos++;
              pip();
              if (pos === target.length) finish();
            } else {                                  // not the next sound
              this.classList.add("shake");
              chime(false);
              setTimeout(() => this.classList.remove("shake"), 400);
            }
          }
        }, [item.g]);
        tray.appendChild(tile);
      });
      stage.appendChild(tray);
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }

    function finish() {
      const word = words[i];
      got++;
      removeTricky(word);
      speak(word, 0.9);
      cheer("⭐");
      setTimeout(() => {
        i++;
        if (i >= words.length) {
          completeLesson("build-" + lvl.id);
          renderDone("Build Words", "🔡", () => renderBuild(lvl), "You built " + got + " of " + words.length + "!");
        } else show();
      }, 850);
    }
    show();
  }

  /* ---------------- ACTIVITY: READ WORDS ---------------- */
  function renderRead(lvl) {
    const words = shuffle(lvl.words);
    let i = 0, got = 0;

    function show() {
      clear();
      app.appendChild(topbar("Read: " + lvl.name + " 📕", () => renderLevelPicker("read")));
      const word = words[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["Read this word out loud."]));
      stage.appendChild(el("div", { class: "bigcard" }, [ wordLetters(word) ]));

      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(word) }, ["👂 Check it"]));

      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => next(true) }, ["Got it! 😄"]),
        el("button", { class: "btn yellow", onclick: () => next(false) }, ["Tricky 🤔"])
      ]));

      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }
    function next(success) {
      const word = words[i];
      if (success) { got++; removeTricky(word); cheer("⭐"); }  // got it now → clear from review
      else { addTricky(word); }                                 // tricky → save to review list
      i++;
      if (i >= words.length) {
        completeLesson("read-" + lvl.id);
        if (got >= Math.ceil(words.length * 0.7)) markLevelStar(lvl.id);
        renderDone("Read Words", "📕", () => renderRead(lvl), "You got " + got + " of " + words.length + "!");
      } else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: SENTENCES ---------------- */
  function renderSentences(lvl) {
    const sentences = shuffle(lvl.sentences);
    let i = 0;

    function show() {
      clear();
      app.appendChild(topbar("Read: " + lvl.name + " 📖", () => renderLevelPicker("sentences")));
      const sentence = sentences[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["Read the whole sentence out loud."]));
      stage.appendChild(el("div", { class: "bigcard" }, [
        el("div", { class: "sentence" }, [sentence])
      ]));

      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(sentence) }, ["👂 Check it"]));
      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => next(false) }, ["I read it! ✅"]),
        el("button", { class: "btn yellow", onclick: () => next(true) }, ["Tricky 🤔"])
      ]));
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + sentences.length]));
      app.appendChild(stage);
    }
    function next(tricky) {
      const sentence = sentences[i];
      if (tricky) { addTricky(sentence); cheer("🤔"); }
      else { removeTricky(sentence); cheer("🎉"); }
      i++;
      if (i >= sentences.length) { completeLesson("sentences-" + lvl.id); markLevelStar(lvl.id); renderDone("Sentences", "📖", () => renderSentences(lvl)); }
      else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: REAL OR NOT? ---------------- */
  function renderRealOrNot() {
    // Build a mixed deck of real words and decodable non-words from all levels.
    const pool = [];
    DATA.levels.forEach(lvl => {
      lvl.words.forEach(w => pool.push({ word: w, real: true }));
      (lvl.nonsense || []).forEach(w => pool.push({ word: w, real: false }));
    });
    const deck = shuffle(pool).slice(0, 12);
    let i = 0, got = 0;

    function show() {
      clear();
      app.appendChild(topbar("Real or Not? 🕵️", renderReadingHome));
      const card = deck[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["Sound it out. Is it a REAL word?"]));
      stage.appendChild(el("div", { class: "bigcard" }, [ wordLetters(card.word) ]));

      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => answer(true) }, ["✅ Real word"]),
        el("button", { class: "btn pink", onclick: () => answer(false) }, ["❌ Not a word"])
      ]));
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + deck.length]));
      app.appendChild(stage);
    }
    function answer(saidReal) {
      const card = deck[i];
      if (saidReal === card.real) { got++; cheer("⭐"); }
      else { chime(false); cheer("🤔", true); speak(card.real ? (card.word + " is a real word") : (card.word + " is not a real word")); }
      i++;
      if (i >= deck.length) {
        completeLesson("real");
        renderDone("Real or Not?", "🕵️", renderRealOrNot, "You got " + got + " of " + deck.length + "!");
      } else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: TRICKY WORDS (review) ---------------- */
  function renderTricky() {
    const words = getTrickyWords();   // snapshot of the current review list
    if (words.length === 0) {
      clear();
      app.appendChild(topbar("Tricky Words 🤔", renderReadingHome));
      const stage = el("div", { class: "stage" });
      stage.appendChild(el("div", { class: "done" }, [
        el("div", { class: "big" }, ["🎉"]),
        el("h2", null, ["No tricky words!"]),
        el("p", { class: "prompt" }, ["When something is hard, tap \"Tricky\" in any activity and it will show up here to practice."])
      ]));
      stage.appendChild(el("button", { class: "btn ghost", onclick: renderReadingHome }, ["🏠 Home"]));
      app.appendChild(stage);
      return;
    }

    const deck = shuffle(words);
    let i = 0, fixed = 0;

    function show() {
      clear();
      app.appendChild(topbar("Tricky Words 🤔", renderReadingHome));
      const word = deck[i];
      const stage = el("div", { class: "stage" });

      const isSentence = word.indexOf(" ") >= 0;
      stage.appendChild(el("div", { class: "prompt" }, ["Practice this tricky one. Read it out loud!"]));
      stage.appendChild(el("div", { class: "bigcard" }, [ isSentence ? el("div", { class: "sentence" }, [word]) : wordLetters(word) ]));
      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(word) }, ["👂 Check it"]));
      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => next(true) }, ["Got it now! 😄"]),
        el("button", { class: "btn yellow", onclick: () => next(false) }, ["Still tricky 🤔"])
      ]));
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + deck.length]));
      app.appendChild(stage);
    }
    function next(success) {
      const word = deck[i];
      if (success) { fixed++; removeTricky(word); cheer("⭐"); }  // mastered → leaves the list
      i++;
      if (i >= deck.length) {
        renderDone("Tricky Words", "🤔", renderTricky, "You fixed " + fixed + " of " + deck.length + "!");
      } else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: HEART WORDS ---------------- */
  function renderHeartWords() {
    const words = shuffle(DATA.heartWords);
    let i = 0;

    function show() {
      clear();
      app.appendChild(topbar("Heart Words ❤️", renderReadingHome));
      const word = words[i];
      const stage = el("div", { class: "stage" });

      stage.appendChild(el("div", { class: "prompt" }, ["Some words you just know by heart. Read it!"]));
      stage.appendChild(el("div", { class: "bigcard" }, [
        el("div", { class: "bigword" }, [ el("span", { class: "ltr" }, [word]) ])
      ]));

      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(word) }, ["👂 Check it"]));
      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "btn green", onclick: () => next(false) }, ["Got it! ❤️"]),
        el("button", { class: "btn yellow", onclick: () => next(true) }, ["Tricky 🤔"])
      ]));
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }
    function next(tricky) {
      const word = words[i];
      if (tricky) { addTricky(word); cheer("🤔"); }
      else { removeTricky(word); }
      i++;
      if (i >= words.length) { completeLesson("heart"); cheer("💖"); renderDone("Heart Words", "❤️", renderHeartWords); }
      else show();
    }
    show();
  }

  /* ---------------- ACTIVITY: STORIES ---------------- */
  function renderStories() {
    clear();
    app.appendChild(topbar("Stories 📚", renderReadingHome));
    app.appendChild(el("div", { class: "prompt", style: "margin-bottom:10px" }, ["Pick a story to read!"]));
    const list = el("div", { class: "story-list" });
    DATA.stories.forEach(s => {
      list.appendChild(el("button", { class: "story-card", onclick: () => renderStory(s) }, [
        el("span", { class: "story-card-pic" }, [s.cover]),
        el("span", { class: "story-card-title" }, [s.title])
      ]));
    });
    app.appendChild(list);
  }

  function renderStory(story) {
    const pages = story.pages;
    let p = 0; // 0 = cover, 1..N = pages

    function show() {
      clear();
      app.appendChild(topbar(story.title + " 📖", renderStories));
      const stage = el("div", { class: "stage" });

      if (p === 0) {
        stage.appendChild(el("div", { class: "bigcard story-cover" }, [
          el("div", { class: "story-cover-pic" }, [story.cover]),
          el("div", { class: "story-title" }, [story.title])
        ]));
        stage.appendChild(el("div", { class: "btn-row" }, [
          el("button", { class: "btn green", onclick: () => { p = 1; show(); } }, ["Start Reading ▶️"])
        ]));
      } else {
        const page = pages[p - 1];
        stage.appendChild(el("div", { class: "bigcard" }, [
          el("div", { class: "story-pic" }, [page.pic]),
          el("div", { class: "sentence story-text" }, [page.text])
        ]));
        stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(page.text) }, ["👂 Hear it"]));
        stage.appendChild(el("div", { class: "btn-row" }, [
          el("button", { class: "btn ghost", onclick: () => { p--; show(); } }, ["← Back"]),
          (p < pages.length)
            ? el("button", { class: "btn green", onclick: () => { p++; show(); } }, ["Next →"])
            : el("button", { class: "btn green", onclick: afterPages }, ["The End! 🎉"])
        ]));
        stage.appendChild(el("div", { class: "progress" }, [p + " / " + pages.length]));
      }
      app.appendChild(stage);
    }
    // After the last page: a quick comprehension check (if the story has one),
    // which connects decoding to meaning. Low-pressure — she retries till right.
    function afterPages() {
      if (story.q) askQuestion();
      else finish();
    }
    function askQuestion() {
      clear();
      app.appendChild(topbar(story.title + " 📖", renderStories));
      const stage = el("div", { class: "stage" });
      stage.appendChild(buddyNode("think", "ask-buddy"));
      stage.appendChild(el("div", { class: "prompt" }, ["Story question!"]));
      stage.appendChild(el("div", { class: "bigcard" }, [
        el("div", { class: "story-question" }, [story.q.ask])
      ]));
      stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(story.q.ask) }, ["👂 Hear it"]));

      const row = el("div", { class: "btn-row story-answers" });
      let answered = false;
      story.q.choices.forEach((choice, idx) => {
        const btn = el("button", { class: "btn blue", onclick: function () {
          if (answered) return;
          if (idx === story.q.answer) {
            answered = true;
            this.classList.add("right");
            cheer("⭐");
            setTimeout(finish, 850);
          } else {
            this.classList.add("shake");
            chime(false);
            setTimeout(() => this.classList.remove("shake"), 400);
          }
        } }, [choice]);
        row.appendChild(btn);
      });
      stage.appendChild(row);
      app.appendChild(stage);
    }
    function finish() {
      completeLesson("story-" + story.id);
      cheer("📚");
      renderDone("Story", "📚", () => renderStory(story), "You read the whole story! 🌟");
    }
    show();
  }

  /* ---------------- DONE SCREEN ---------------- */
  function renderDone(title, emoji, again, subtitle) {
    clear();
    app.appendChild(topbar(title, renderMainMenu));
    const stage = el("div", { class: "stage" });
    stage.appendChild(el("div", { class: "done" }, [
      buddyNode("happy", "done-buddy"),
      el("div", { class: "big" }, [emoji + " 🌟"]),
      el("h2", null, ["Great job!"]),
      subtitle ? el("p", { class: "prompt" }, [subtitle]) : el("span")
    ]));
    stage.appendChild(el("div", { class: "btn-row" }, [
      el("button", { class: "btn blue", onclick: again }, ["Again 🔁"]),
      el("button", { class: "btn ghost", onclick: renderMainMenu }, ["🏠 Home"])
    ]));
    app.appendChild(stage);
  }

  /* ---------------- start ---------------- */
  migrateProgress();
  if (PhonemeAudio.supported) refreshRecordedSounds();   // preload which sounds are recorded
  renderMainMenu();
})();
