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
  // One collectible star the FIRST time a given lesson is finished.
  // (key is unique per activity+level, e.g. "blend-3", "sounds", "heart")
  function completeLesson(key) {
    const p = loadProgress();
    p.lessonsDone = p.lessonsDone || {};
    if (p.lessonsDone[key]) return;       // already earned — no duplicate star
    p.lessonsDone[key] = true;
    const before = p.starCount || 0;
    const after = before + 1;
    p.starCount = after;
    saveProgress(p);
    const unlocked = STATUES.find(s => before < s.stars && after >= s.stars);
    if (unlocked) celebrateStatue(unlocked);
  }
  function getStarCount() { return loadProgress().starCount || 0; }
  function getLevelsMastered() { return Object.keys(loadProgress().stars || {}).length; }

  // One-time cleanup: the old version awarded a star per item read, which
  // inflated starCount (e.g. 74). The new rule is 1 star per finished lesson,
  // so recompute the count from lessons actually completed. Runs once.
  function migrateProgress() {
    const p = loadProgress();
    if (p._v >= 2) return;                 // already cleaned up
    p.lessonsDone = p.lessonsDone || {};
    p.starCount = Object.keys(p.lessonsDone).length;  // accurate under new rules
    p._v = 2;
    saveProgress(p);
  }
  function unlockedStatueCount() { const n = getStarCount(); return STATUES.filter(s => n >= s.stars).length; }

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
  function cheer(emoji) {
    const c = el("div", { class: "cheer" }, [emoji || "🎉"]);
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 800);
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

  const STATUES = [
    { id: "cat",     name: "Reading Cat",     stars: 3,  svg: CAT_SVG },
    { id: "unicorn", name: "Reading Unicorn", stars: 10, svg: UNICORN_SVG },
    { id: "mermaid", name: "Reading Mermaid", stars: 20, svg: MERMAID_SVG }
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
  function renderCollection() {
    clear();
    app.appendChild(topbar("My Collection 🏛️", renderHome));
    const n = getStarCount();
    const intro = el("div", { class: "prompt", style: "margin-bottom:8px" }, [
      "Collect a statue for every " + "milestone of stars!"
    ]);
    app.appendChild(intro);

    const grid = el("div", { class: "collection-grid" });
    STATUES.forEach(s => {
      const unlocked = n >= s.stars;
      const art = el("div", { class: "statue-art" });
      art.innerHTML = s.svg;
      const card = el("div", { class: "statue-card" + (unlocked ? "" : " locked") }, [
        art,
        el("div", { class: "statue-name" }, [unlocked ? s.name : "???"]),
        el("div", { class: "statue-req" }, [
          unlocked ? "✅ Unlocked!" : ("🔒 " + n + " / " + s.stars + " ⭐")
        ])
      ]);
      if (!unlocked) card.appendChild(el("div", { class: "lock-badge" }, ["🔒"]));
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  /* ---------------- Star jar (home accomplishments) ---------------- */
  function starsBanner() {
    const n = getStarCount();
    const mastered = getLevelsMastered();
    const total = DATA.levels.length;
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
      "🏅 Levels mastered: " + mastered + " of " + total
    ]));
    return banner;
  }

  /* ---------------- HOME ---------------- */
  function renderHome() {
    clear();
    app.appendChild(el("h1", { class: "home-title" }, ["Reading Buddy 📖"]));
    app.appendChild(el("p", { class: "home-sub" }, ["Pick something fun to do!"]));
    app.appendChild(starsBanner());
    app.appendChild(el("button", { class: "collection-btn", onclick: renderCollection }, [
      "🏛️ My Collection  (" + unlockedStatueCount() + " / " + STATUES.length + ")"
    ]));
    const trickyN = getTrickyWords().length;
    if (trickyN > 0) {
      app.appendChild(el("button", { class: "tricky-btn", onclick: renderTricky }, [
        "🤔 Review Tricky Words  (" + trickyN + ")"
      ]));
    }

    const items = [
      { emoji: "📚", label: "Stories",     go: renderStories },
      { emoji: "🔤", label: "Sounds",      go: renderSounds },
      { emoji: "🧩", label: "Blend Words", go: () => renderLevelPicker("blend") },
      { emoji: "📕", label: "Read Words",  go: () => renderLevelPicker("read") },
      { emoji: "📖", label: "Sentences",   go: () => renderLevelPicker("sentences") },
      { emoji: "🕵️", label: "Real or Not?", go: renderRealOrNot },
      { emoji: "❤️", label: "Heart Words", go: renderHeartWords }
    ];
    const menu = el("div", { class: "menu" });
    items.forEach(it => {
      menu.appendChild(el("button", { class: "menu-card", onclick: it.go }, [
        el("span", { class: "emoji" }, [it.emoji]),
        el("span", null, [it.label])
      ]));
    });
    app.appendChild(menu);
  }

  /* ---------------- LEVEL PICKER ---------------- */
  function renderLevelPicker(mode) {
    clear();
    app.appendChild(topbar("Pick a Level", renderHome));
    const stars = (loadProgress().stars) || {};
    const list = el("div", { class: "level-list" });
    DATA.levels.forEach(lvl => {
      list.appendChild(el("button", {
        class: "level-card",
        onclick: () => {
          if (mode === "blend") renderBlend(lvl);
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

  /* helper: render a word as tappable letters (groups digraphs visually) */
  function wordLetters(word, onTap) {
    const box = el("div", { class: "bigword" });
    // split into grapheme chunks: keep sh/ch/th together
    const chunks = [];
    for (let i = 0; i < word.length; i++) {
      const two = word.slice(i, i + 2);
      if (two === "sh" || two === "ch" || two === "th") { chunks.push(two); i++; }
      else chunks.push(word[i]);
    }
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
      app.appendChild(topbar("Sounds 🔤", renderHome));
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

      stage.appendChild(el("div", { class: "btn-row" }, [
        el("button", { class: "hear-btn", onclick: () => {
          reveal.style.visibility = "visible";
          speak(card.keyword);            // keyword cue (TTS can't do lone phonemes well)
        } }, ["👂 Check"]),
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
      stage.appendChild(el("div", { class: "bigcard" }, [ wordLetters(word) ]));

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
      app.appendChild(topbar("Real or Not? 🕵️", renderHome));
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
      else { cheer("🤔"); speak(card.real ? (card.word + " is a real word") : (card.word + " is not a real word")); }
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
      app.appendChild(topbar("Tricky Words 🤔", renderHome));
      const stage = el("div", { class: "stage" });
      stage.appendChild(el("div", { class: "done" }, [
        el("div", { class: "big" }, ["🎉"]),
        el("h2", null, ["No tricky words!"]),
        el("p", { class: "prompt" }, ["When something is hard, tap \"Tricky\" in any activity and it will show up here to practice."])
      ]));
      stage.appendChild(el("button", { class: "btn ghost", onclick: renderHome }, ["🏠 Home"]));
      app.appendChild(stage);
      return;
    }

    const deck = shuffle(words);
    let i = 0, fixed = 0;

    function show() {
      clear();
      app.appendChild(topbar("Tricky Words 🤔", renderHome));
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
      app.appendChild(topbar("Heart Words ❤️", renderHome));
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
    app.appendChild(topbar("Stories 📚", renderHome));
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
          el("div", { class: "sentence" }, [page.text])
        ]));
        stage.appendChild(el("button", { class: "hear-btn", onclick: () => speak(page.text) }, ["👂 Hear it"]));
        stage.appendChild(el("div", { class: "btn-row" }, [
          el("button", { class: "btn ghost", onclick: () => { p--; show(); } }, ["← Back"]),
          (p < pages.length)
            ? el("button", { class: "btn green", onclick: () => { p++; show(); } }, ["Next →"])
            : el("button", { class: "btn green", onclick: finish }, ["The End! 🎉"])
        ]));
        stage.appendChild(el("div", { class: "progress" }, [p + " / " + pages.length]));
      }
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
    app.appendChild(topbar(title, renderHome));
    const stage = el("div", { class: "stage" });
    stage.appendChild(el("div", { class: "done" }, [
      el("div", { class: "big" }, [emoji + " 🌟"]),
      el("h2", null, ["Great job!"]),
      subtitle ? el("p", { class: "prompt" }, [subtitle]) : el("span")
    ]));
    stage.appendChild(el("div", { class: "btn-row" }, [
      el("button", { class: "btn blue", onclick: again }, ["Again 🔁"]),
      el("button", { class: "btn ghost", onclick: renderHome }, ["🏠 Home"])
    ]));
    app.appendChild(stage);
  }

  /* ---------------- start ---------------- */
  migrateProgress();
  renderHome();
})();
