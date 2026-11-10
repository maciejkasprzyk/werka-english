/* Shared lesson engine. A lesson page only holds its data and calls lesson({...}).
   The engine builds the page: header, practice bar (list / flashcards, cover mode, filter, speech speed),
   the list of stages, flashcards, "Umiem" progress and the tips footer.
   How one item looks (a phrase, a verb) comes from a type in TYPES below. See README.md for the data format. */
(function () {
  "use strict";

  const SPEAK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const marked = s => esc(s).replace(/\*(.+?)\*/g, "<mark>$1</mark>");
  const plain = s => s.replace(/\*/g, "");
  const sayBtn = (text, label) => `<button type="button" class="say" data-say="${esc(text)}"${label ? "" : ' aria-label="Posłuchaj"'}>${SPEAK_ICON}${label || ""}</button>`;
  const KNOW_BTN = '<button type="button" class="know" aria-pressed="false">Umiem</button>';

  // Storage can be unavailable (private mode); everything then works for this page view only.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  /* ---------- Speech (one speed for the whole site) ---------- */
  const RATES = [["Wolno", 0.6], ["Normalnie", 0.85], ["Szybko", 1]];
  let rate = 0.85;
  {
    const r = parseFloat(store.get("werka-tts-rate") || store.get("werka-tts-rate-phrases"));
    if (r > 0) rate = RATES.reduce((best, [, x]) => (Math.abs(x - r) < Math.abs(best - r) ? x : best), 0.85);
  }
  let voice = null;
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => v.lang === "en-GB") || vs.find(v => /^en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    } catch (_) {}
  }
  function speak(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB"; u.rate = rate;
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  /* ---------- Item types ----------
     A type turns the lesson data into { items, stages } and knows how to draw one item as a list row and as a flashcard.
     items: [{ key (stable id for "Umiem"), stage (index) , ... }]
     stages: [{ title, side, tip, nav }] */
  const TYPES = {};

  // Phrases: [speaker, English, IPA (one token per English word), Polish, optional note]
  TYPES.phrases = cfg => {
    const other = cfg.other || "Rozmówca";
    const items = [];
    const stages = cfg.stages.map((st, si) => {
      st.items.forEach(([who, en, ipa, pl, note]) => items.push({ key: en, stage: si, who: who === "you" ? "you" : "other", en, ipa, pl, note }));
      return { title: st.en, side: st.pl, nav: st.pl, tip: st.tip };
    });
    const badge = it => `<span class="who ${it.who}">${it.who === "you" ? "Ty" : esc(other)}</span>`;
    const words = it => {
      const s = it.ipa.split(" ");
      return `<div class="line" lang="en-GB">${it.en.split(" ").map((w, i) => `<span class="w"><b>${esc(w)}</b><i>${esc(s[i] || "")}</i></span>`).join("")}</div>`;
    };
    const note = it => (it.note ? `<span class="note">${esc(it.note)}</span>` : "");
    const legend = cfg.legend || ["to, co mówisz ty", "to, co możesz usłyszeć"];
    return {
      items, stages,
      cls: "phrases",
      legend: `<div class="legend"><span class="pair"><span class="who you">Ty</span> ${esc(legend[0])}</span><span class="pair"><span class="who other">${esc(other)}</span> ${esc(legend[1])}</span></div>`,
      colhead: `<div class="colhead"><span>English</span><span>Polski</span></div>`,
      modes: [["pl", "Polski"], ["en", "Angielski"], ["none", "Nic"]],
      filters: [["you", "Ty", it => it.who === "you"], ["other", other, it => it.who === "other"]],
      rowClass: "phrase",
      row: it => `
        <div class="en">
          ${badge(it)}
          <button type="button" class="cover-btn" data-reveal="en">Powiedz to po angielsku, potem stuknij</button>
          ${words(it)}
          <span class="tools">${sayBtn(it.en, "Posłuchaj")}${KNOW_BTN}</span>
        </div>
        <div class="pl-cell"><button type="button" class="reveal" data-reveal="pl"><span class="hint">Stuknij, żeby odkryć</span><span class="txt" lang="pl">${esc(it.pl)}${note(it)}</span></button></div>`,
      // Your lines: see Polish, say it in English. Lines you hear: read and listen, then say what it means.
      card: (it, shown) => it.who === "you"
        ? `${badge(it)}<div class="k">Powiedz po angielsku</div><div class="meaning">${esc(it.pl)}</div>` +
          (shown ? `<div class="revealed">${words(it)}${it.note ? `<div class="note">${esc(it.note)}</div>` : ""}<div class="card-actions" style="margin-top:12px">${sayBtn(it.en, "Posłuchaj")}</div></div>` : "")
        : `${badge(it)}<div class="k">Co to znaczy?</div>${words(it)}<div class="card-actions" style="margin-top:12px">${sayBtn(it.en, "Posłuchaj")}</div>` +
          (shown ? `<div class="revealed"><div class="answer" lang="pl">${esc(it.pl)}</div>${it.note ? `<div class="note">${esc(it.note)}</div>` : ""}</div>` : ""),
      cardAsk: it => (it.who === "you" ? "Powiedz to na głos, potem sprawdź." : "Powiedz po polsku, co to znaczy."),
      cardSay: (it, shown) => (it.who === "you" ? (shown ? it.en : null) : (shown ? null : it.en)),
    };
  };

  // Verbs: [base, past, participle, IPA ×3, Polish, Past Simple example (*marks* the verb), its Polish, optional note]
  // Optional cfg.starred (space-separated bases), cfg.tenses { base: [PresS, PresC, PastC, PresPerf, Future] }, cfg.tenseInfo.
  TYPES.verbs = cfg => {
    const starred = new Set((cfg.starred || "").split(" "));
    const tenses = cfg.tenses || {};
    const items = [];
    const stages = cfg.stages.map((g, si) => {
      g.items.forEach(([base, past, pp, ib, ip, ipp, pl, exEn, exPl, note]) =>
        items.push({ key: base, stage: si, base, past, pp, ib, ip, ipp, pl, exEn, exPl, note, star: starred.has(base) }));
      return { title: g.pl, side: g.pattern, nav: g.pl, tip: g.tip };
    });
    const formsText = v => [v.base, v.past.replace(" / ", ", "), v.pp].join(", ");
    const form = (cls, word, ipa, star) => `<div class="f ${cls}"><b>${esc(word)}${star ? '<span class="star" title="Najważniejsze">★</span>' : ""}</b><i>${esc(ipa)}</i></div>`;
    const forms = v => form("f1", v.base, v.ib, v.star) + form("f2", v.past, v.ip) + form("f3", v.pp, v.ipp);
    function more(v) {
      if (!cfg.tenseInfo) return "";
      const t = tenses[v.base] || [];
      const ex = [t[0], t[1], [v.exEn, v.exPl], t[2], t[3], t[4]];
      const rows = cfg.tenseInfo.map(([name, hint], i) => `<div class="t"><div class="tn"><b>${name}</b><small>${hint}</small></div><div class="ts">${ex[i]
        ? `<span class="ex-en" lang="en-GB">${marked(ex[i][0])}</span>${sayBtn(plain(ex[i][0]))}<span class="ex-pl">${esc(ex[i][1])}</span>`
        : `<span class="none">Tego czasownika zwykle nie używa się w czasach Continuous.</span>`}</div></div>`).join("");
      return `<details class="more"><summary>Przykłady w ${cfg.tenseInfo.length} czasach</summary><div class="tenses">${rows}</div></details>`;
    }
    return {
      items, stages,
      cls: "verbs",
      colhead: `<div class="colhead"><div class="fh"><span>Forma 1<small>teraz</small></span><span>Forma 2<small>przeszłość</small></span><span>Forma 3<small>po have</small></span></div><span>Po polsku</span></div>`,
      modes: [["forms", "Formy 2 i 3"], ["en", "Angielski"], ["pl", "Polski"], ["none", "Nic"]],
      filters: starred.size > 1 ? [["star", "★ Najważniejsze", v => v.star]] : [],
      rowClass: "verb",
      row: v => `
        <div class="forms" lang="en-GB">${forms(v)}<button type="button" class="cover-btn" data-reveal="en">Powiedz na głos, potem stuknij</button></div>
        <div class="meta"><button type="button" class="reveal" data-reveal="pl"><span class="hint">Co to znaczy? Stuknij</span><span class="txt" lang="pl">${esc(v.pl)}${v.note ? `<span class="note">${esc(v.note)}</span>` : ""}</span></button></div>
        <div class="ex"><span class="ex-en" lang="en-GB">${marked(v.exEn)}</span><span class="ex-pl">${esc(v.exPl)}</span>
          <span class="tools">${sayBtn(formsText(v), "Formy")}${sayBtn(plain(v.exEn), "Zdanie")}${KNOW_BTN}</span>
        </div>
        ${more(v)}`,
      card: (v, shown) => `<div class="k">Po polsku</div><div class="meaning">${esc(v.pl)}</div>
        <div class="forms" lang="en-GB">${form("f1", v.base, v.ib, v.star)}${shown
          ? `<div class="revealed" style="display:contents">${form("f2", v.past, v.ip)}${form("f3", v.pp, v.ipp)}</div>`
          : '<div class="slot"></div><div class="slot"></div>'}</div>` +
        (shown ? `<div class="revealed">
          <div class="ex"><span class="ex-en" lang="en-GB">${marked(v.exEn)}</span><span class="ex-pl">${esc(v.exPl)}</span></div>
          ${v.note ? `<div class="note">${esc(v.note)}</div>` : ""}
          <div style="margin-top:14px">${more(v)}</div>
          <div class="card-actions" style="margin-top:12px">${sayBtn(formsText(v), "Formy")}${sayBtn(plain(v.exEn), "Zdanie")}</div>
        </div>` : ""),
      cardAsk: () => "Powiedz na głos formę 2 i 3.",
      cardSay: (v, shown) => (shown ? formsText(v) : null),
    };
  };

  /* ---------- Page ---------- */
  function build(cfg) {
    const slug = decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    const all = typeof LESSONS !== "undefined" ? LESSONS : []; // from lessons/lessons.js
    const idx = all.findIndex(l => l.slug === slug);
    const meta = all[idx] || {};
    const title = cfg.title || meta.title || document.title;
    const next = idx >= 0 ? all[idx + 1] : null;
    document.title = title;

    const T = TYPES[cfg.type](cfg);
    const items = T.items;
    const filters = [["all", "Wszystko", () => true], ...T.filters, ["todo", "Do nauki", it => !known.has(it.key)]];

    // "Umiem" progress per lesson and device. legacyKey keeps progress saved before the shared engine.
    const KEY = "werka-known:" + slug;
    if (store.get(KEY) == null && cfg.legacyKey && store.get(cfg.legacyKey) != null) store.set(KEY, store.get(cfg.legacyKey));
    let known = new Set();
    try { known = new Set(JSON.parse(store.get(KEY) || "[]")); } catch (_) {}
    function saveKnown() {
      store.set(KEY, JSON.stringify([...known]));
      store.set("werka-progress:" + slug, JSON.stringify({ known: knownCount(), total: items.length }));
    }
    const knownCount = () => items.filter(it => known.has(it.key)).length;

    const seg = (id, opts, cur, extraCls) => `<div class="seg${extraCls ? " " + extraCls : ""}" id="${id}">${opts.map(([v, label]) =>
      `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${esc(label)}</button>`).join("")}</div>`;

    let mode = T.modes[0][0], filter = "all", view = "list";
    document.body.classList.add(T.cls, "m-" + mode, "view-list");
    document.body.innerHTML = `<div class="wrap">
      <header class="intro">
        <a class="home" href="../">← Wszystkie lekcje</a>
        <h1>${esc(title)}</h1>
        ${cfg.intro ? `<p>${cfg.intro}</p>` : ""}
        ${T.legend || ""}
      </header>
      ${cfg.extra || ""}
      <div class="bar" role="toolbar" aria-label="Ćwiczenie">
        ${seg("view", [["list", "Lista"], ["cards", "Fiszki"]], view, "view")}
        <div class="group list-only"><span class="label">Zakryj</span>${seg("mode", T.modes, mode)}</div>
        ${seg("filter", filters, filter)}
        <div class="group"><span class="label">Tempo</span>${seg("rate", RATES.map(([l, r]) => [String(r), l]), String(rate))}</div>
        <span class="progress" id="progress"></span>
      </div>
      <div class="list-only">
        <nav class="steps" id="steps" aria-label="Etapy"></nav>
        <main id="list"></main>
      </div>
      <div class="cards cards-only" id="cards" aria-live="polite"></div>
      <footer>
        <h3>Jak ćwiczyć</h3>
        <ul>${(cfg.tips || []).map(t => `<li>${t}</li>`).join("")}
          <li>„Umiem” odhacza to, co już znasz. Filtr „Do nauki” pokaże tylko resztę, a Fiszki przepytają cię z niej po kolei. Postęp zapisuje się na tym telefonie.</li>
        </ul>
        ${next ? `<a class="next" href="${esc(next.slug)}.html">Następna lekcja: ${esc(next.title)} →</a>` : ""}
      </footer>
    </div>`;

    const $ = id => document.getElementById(id);
    const list = $("list"), cards = $("cards");
    let html = "", nav = "";
    T.stages.forEach((st, si) => {
      const id = "etap" + (si + 1);
      nav += `<a href="#${id}">${si + 1}. ${esc(st.nav)}</a>`;
      html += `<section class="stage" id="${id}"><div class="stage-head"><span class="n">${String(si + 1).padStart(2, "0")}</span><h2>${esc(st.title)}</h2>${st.side ? `<span class="side">${esc(st.side)}</span>` : ""}</div>`;
      if (st.tip) html += `<p class="tip">${esc(st.tip)}</p>`;
      html += T.colhead;
      items.forEach((it, i) => { if (it.stage === si) html += `<div class="item ${T.rowClass}" data-i="${i}">${T.row(it)}</div>`; });
      html += `</section>`;
    });
    list.innerHTML = html;
    $("steps").innerHTML = nav;
    const rows = [...list.querySelectorAll(".item")];

    const passes = it => filters.find(f => f[0] === filter)[2](it);
    // The pool the progress counts: the current filter, but "Do nauki" counts the whole lesson.
    const pool = () => (filter === "todo" ? items : items.filter(passes));
    function showProgress() {
      const p = pool();
      $("progress").textContent = `Umiesz ${p.filter(it => known.has(it.key)).length} z ${p.length}`;
    }
    function refreshList() {
      rows.forEach(r => {
        const it = items[r.dataset.i];
        r.hidden = !passes(it);
        r.querySelector(".know").setAttribute("aria-pressed", String(known.has(it.key)));
      });
      list.querySelectorAll("section.stage").forEach(s => { s.hidden = !s.querySelector(".item:not([hidden])"); });
      showProgress();
    }
    function applyMode() {
      T.modes.forEach(([m]) => document.body.classList.remove("m-" + m));
      document.body.classList.add("m-" + mode);
      rows.forEach(r => r.classList.remove("en-open", "pl-open"));
    }
    const pressOnly = (group, btn) => group.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === btn)));
    const onSeg = (id, fn) => $(id).addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      pressOnly(e.currentTarget, b); fn(b.dataset.v);
    });
    // Tapping the active cover mode again covers everything again.
    onSeg("mode", v => { mode = v; applyMode(); });
    onSeg("rate", v => { rate = parseFloat(v); store.set("werka-tts-rate", v); });
    onSeg("filter", v => { filter = v; refreshList(); if (view === "cards") newDeck(); });
    onSeg("view", v => {
      view = v;
      document.body.classList.toggle("view-list", view === "list");
      document.body.classList.toggle("view-cards", view === "cards");
      if (view === "cards") newDeck(); else refreshList();
      // On a phone the intro fills the screen; bring the practice area up.
      const bar = document.querySelector(".bar");
      if (bar.getBoundingClientRect().top > 0) bar.scrollIntoView({ block: "start" });
    });
    list.addEventListener("click", e => {
      const row = e.target.closest(".item"); if (!row) return;
      const say = e.target.closest(".say");
      if (say) return speak(say.dataset.say);
      const rev = e.target.closest("[data-reveal]");
      if (rev) { row.classList.toggle(rev.dataset.reveal + "-open"); return; }
      if (e.target.closest(".know")) {
        const k = items[row.dataset.i].key;
        known.has(k) ? known.delete(k) : known.add(k);
        saveKnown(); refreshList();
      }
    });

    /* Flashcards: shuffled deck of the filtered items not yet known; "Jeszcze nie" puts the card back a few places later. */
    let deck = [], cur = null, shown = false, allKnown = false;
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function newDeck() {
      const p = pool();
      const todo = p.filter(it => !known.has(it.key));
      allKnown = !todo.length && p.length > 0;
      deck = shuffle(allKnown ? p.slice() : todo);
      next_();
    }
    function next_() { cur = deck.shift() || null; shown = false; renderCard(); }
    function renderCard() {
      showProgress();
      const p = pool(), k = p.filter(it => known.has(it.key)).length;
      const head = `<div class="count"><span>${allKnown ? "Powtórka wszystkiego" : "Zostało " + (deck.length + (cur ? 1 : 0))}</span><span>Umiesz ${k} z ${p.length}</span></div><div class="meter"><span style="width:${p.length ? 100 * k / p.length : 0}%"></span></div>`;
      if (!cur) {
        cards.innerHTML = head + `<div class="card"><div class="meaning">Brawo!</div><p>Przeszłaś wszystkie fiszki w tym zestawie.</p><div class="card-actions"><button type="button" class="big primary" data-act="restart">Jeszcze raz</button></div></div>`;
        return;
      }
      cards.innerHTML = head + `<div class="card">${T.card(cur, shown)}${shown
        ? `<div class="card-actions"><button type="button" class="big again" data-act="again">Jeszcze nie</button><button type="button" class="big primary" data-act="know">Umiem ✓</button></div>`
        : `<p class="ask">${esc(T.cardAsk(cur))}</p><div class="card-actions"><button type="button" class="big primary" data-act="show">Sprawdź</button></div>`}
        </div><p class="keys">Klawiatura: spacja = sprawdź, ← jeszcze nie, → umiem</p>`;
      const s = T.cardSay(cur, shown);
      if (s) speak(s);
    }
    function act(a) {
      if (a === "restart") return newDeck();
      if (!cur) return;
      if (a === "show" && !shown) { shown = true; renderCard(); cards.querySelector('[data-act="know"]').focus({ preventScroll: true }); }
      else if (a === "know" && shown) { known.add(cur.key); saveKnown(); next_(); }
      else if (a === "again" && shown) { deck.splice(Math.min(3, deck.length), 0, cur); next_(); }
    }
    cards.addEventListener("click", e => {
      const say = e.target.closest(".say"); if (say) return speak(say.dataset.say);
      const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act);
    });
    document.addEventListener("keydown", e => {
      if (view !== "cards" || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === " " || e.key === "Enter") { if (!shown) { e.preventDefault(); act("show"); } }
      else if (e.key === "ArrowRight") act("know");
      else if (e.key === "ArrowLeft") act("again");
    });

    if (!("speechSynthesis" in window)) document.body.classList.add("no-tts");
    else { pickVoice(); try { speechSynthesis.addEventListener("voiceschanged", pickVoice); } catch (_) {} }

    saveKnown(); // records this lesson's size for the menu
    applyMode();
    refreshList();
  }

  window.lesson = cfg => (document.body ? build(cfg) : document.addEventListener("DOMContentLoaded", () => build(cfg)));
})();
