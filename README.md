# Angielski z Werką

Static lesson site for GitHub Pages. No build step and no framework: open `index.html` in a browser, or serve the folder (`python3 -m http.server`).

## Structure

```
index.html              menu, built from lessons/lessons.js
lessons/lessons.js      the list of lessons (order, title, short description)
lessons/<slug>.html     one lesson: only its data, passed to lesson({...})
assets/site.css         the look of the whole site (light and dark)
assets/lesson.js        the engine: header, practice bar, list, flashcards, "Umiem", speech, tips
```

Every lesson gets the same features from the engine: List and Flashcards views, cover modes, the "Wszystko / … / Do nauki" filter, "Umiem" per item with progress (saved on the device and shown in the menu), speech with one speed for the whole site, stage navigation and a link to the next lesson.

## Adding a lesson

1. Copy a lesson of the same type (e.g. `lessons/reakcje.html` for phrases) to `lessons/<slug>.html` and replace the data.
2. Add a line to `lessons/lessons.js`: `{ slug: "<slug>", title: "…", desc: "…" }`.

That's all; the menu and the "next lesson" link update themselves.

### Phrase lesson (`type: "phrases"`)

```js
lesson({
  type: "phrases",
  intro: "Short Polish intro (HTML allowed).",
  other: "Rozmówca",                       // label of the second speaker
  legend: ["to, co mówisz ty", "to, co możesz usłyszeć"],
  tips: ["Polish practice tips (HTML allowed)", "…"],
  stages: [
    { en: "Stage title", pl: "Tytuł etapu", items: [
      // speaker ("you" or "other"), English, IPA (one token per English word), Polish, optional note
      ["you", "Could you repeat that, please?", "kʊd juː rɪˈpiːt ðæt pliːz", "Możesz to powtórzyć?"],
    ]},
  ],
});
```

The English text is the item's id for "Umiem", so fixing a typo in it resets that one item's progress.

### Verb lesson (`type: "verbs"`)

See `lessons/czasowniki-nieregularne.html`: `stages` are groups `{ pl, pattern, tip, items }`, each item is
`[base, past, participle, IPA ×3, Polish, Past Simple example with *marked* verb, its Polish, optional note]`;
optional `starred`, `tenseInfo`, `tenses` and `extra` (HTML shown above the practice bar).

### A new kind of lesson

Add a type to `TYPES` in `assets/lesson.js`. A type turns the data into `items` and `stages` and says how one item looks as a list row and as a flashcard; everything else is shared.
