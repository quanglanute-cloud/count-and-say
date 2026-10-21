# Count and Say

An iPad English app for a 5-year-old (listening, speaking, vocabulary). It is a static site: `index.html` is the game engine and `lessons.json` holds all lesson content. The site deploys automatically when `main` is pushed, so pushing to `main` updates the live app.

## Adding a lesson (the usual task)

The owner sends photos or a PDF of textbook pages and asks for them to be added. To add them:

1. Read the pages and pick the vocabulary a 3–6 year old can learn from them: concrete nouns with a clear emoji, plus a few key phrases.
2. Decide which book the pages come from (`maths`, `science` or `english`; ask if unclear), then append one lesson object to the END of the `lessons` array in `lessons.json` with that `book`. Never change or remove an existing lesson unless asked.
3. Check that the JSON is valid: `python3 -m json.tool lessons.json > /dev/null`.
4. Commit with a message like `Add Unit 2: Shapes`, then push to `main`.
5. Tell the owner in one line what was added. The new lesson shows a NEW badge for 3 days.

Do not edit `index.html` just to add content. Change it only when the owner asks for a new feature or game.

## Books

The home screen is a bookshelf. `lessons.json` has a `books` array (Mathematics `maths`, Science `science`, Global English `english`); each lesson's `book` field puts it on one shelf. A book with no lessons shows "Coming soon". Add a new book only if the owner asks.

## Lesson format

```json
{
  "id": "u2-shapes",            // unique, lowercase, no spaces
  "book": "maths",              // maths | science | english
  "unit": "Unit 2",             // small label above the title
  "title": "Shapes",            // lesson name
  "icon": "🔷",                 // one emoji for the lesson button
  "added": "2026-10-20",        // YYYY-MM-DD (today); newest lessons appear first
  "mode": "words",              // "words" (default) or "numbers" (enables the number/domino games)
  "count": false,               // true = show the "Count with Me" game (needs items with "plural")
  "games": ["missing", "oddeven", "compare"],  // optional maths games, only if the pages teach them
  "tabs": [
    { "name": "Shapes", "items": [
      { "word": "circle", "pic": "⭕", "plural": "circles" },
      { "word": "square", "pic": "🟥", "hint": "4 sides", "sentence": "A square has four sides." }
    ]}
  ]
}
```

Item fields. Only `word` is required; `pic` is needed for the item to appear in games.

| field | meaning |
|---|---|
| `word` | the English word or short phrase shown and spoken |
| `pic` | an emoji (or a few) that shows the word clearly |
| `plural` | plural form; makes the item countable and gives the hint "two circles" |
| `hint` | small text under the word on the card |
| `say` | what the app says when the card is tapped (default: the word) |
| `sentence` | the sentence used in Say It! level 2 (default: "I can see a/an {word}.") |
| `find` | the instruction used in Listen & Find (default: "Find the {word}.") — set it for verbs, colours, phrases, e.g. "Find something red." |
| `quiz` | `false` keeps an item out of the games (for abstract words like "estimate") |
| `count`, `thing` | numbers mode only: the number and the singular noun of the counted object |

Maths games (`games` list), add only the ones the pages actually teach:
- `missing`: Missing Number. Number track with a gap, and "what comes before/after".
- `oddeven`: Odd or Even?. Objects shown in pairs, child picks odd or even.
- `compare`: More or Fewer?. Two sets of the lesson's countable things; uses items with `plural`.

Rules of thumb:
- Each lesson needs at least 3 items with `pic` and no `quiz: false`, or Listen & Find and Say It! are hidden.
- Use 1–3 tabs per lesson, with 6–15 items in each tab.
- Pick emojis that a child recognises without help. If no emoji fits, use a close one and set `hint`.
- Keep `sentence` short (3–6 words) and in the present tense.
