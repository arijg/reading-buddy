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

  /* ---------------- HOME ---------------- */
  function renderHome() {
    clear();
    app.appendChild(el("h1", { class: "home-title" }, ["Reading Buddy 📖"]));
    app.appendChild(el("p", { class: "home-sub" }, ["Pick something fun to do!"]));

    const items = [
      { emoji: "🔤", label: "Sounds",      go: renderSounds },
      { emoji: "🧩", label: "Blend Words", go: () => renderLevelPicker("blend") },
      { emoji: "📕", label: "Read Words",  go: () => renderLevelPicker("read") },
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
        onclick: () => (mode === "blend" ? renderBlend(lvl) : renderRead(lvl))
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
      if (i >= deck.length) { cheer("🌟"); renderDone("Sounds", "🔤", renderSounds); }
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
        el("button", { class: "btn green", onclick: next }, ["I read it! ✅"])
      ]));

      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }
    function next() {
      cheer("🎉");
      i++;
      if (i >= words.length) { markLevelStar(lvl.id); renderDone("Blend Words", "🧩", () => renderBlend(lvl)); }
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
      if (success) { got++; cheer("⭐"); }
      i++;
      if (i >= words.length) {
        if (got >= Math.ceil(words.length * 0.7)) markLevelStar(lvl.id);
        renderDone("Read Words", "📕", () => renderRead(lvl), "You got " + got + " of " + words.length + "!");
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
        el("button", { class: "btn pink", onclick: next }, ["Next ❤️"])
      ]));
      stage.appendChild(el("div", { class: "progress" }, [(i + 1) + " / " + words.length]));
      app.appendChild(stage);
    }
    function next() {
      i++;
      if (i >= words.length) { cheer("💖"); renderDone("Heart Words", "❤️", renderHeartWords); }
      else show();
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
  renderHome();
})();
