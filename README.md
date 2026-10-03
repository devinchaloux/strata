# Strata

**Existing music analysis tools produce display artifacts. Strata produces queryable scholarly data.**

Strata is a free, open-source web app for analysing the form of a recording: you
mark sections while it plays, stack several layers of form, and save the whole
analysis as one portable file. It's for music theorists, teachers, students and
scholars of popular music who want their analyses to be data they can share,
cite and query.

**Open it at [strata.devinchaloux.com](https://strata.devinchaloux.com).** It runs
in the browser on a laptop or desktop; there's nothing to install and no account.

Strata is in **beta**: it works end to end, the file format may still change, and
files from older versions are upgraded when opened. Save often.

## Try an example

On Strata's first screen, under **Or explore an example**, open **Alive**
(Krewella). It opens in the reading view; **Edit a copy** lets you change it. The
example analyses are in [`public/demos/`](public/demos/).

## Your first analysis

1. Click **New analysis**, name the track, and link a YouTube video or an audio
   file on your computer.
2. Press **Space** to play, and **B** at each boundary you hear. Each boundary
   splits the timeline into **spans**: a span is a stretch of the recording with a
   label, such as "Verse 1" or "Drop".
3. Click a span to give it a **type** and a label in the Inspector, the panel on
   the right. A type is the span's analytical category from a shared vocabulary
   (for example `chorus`); the label is free text. Types are what make analyses
   comparable across files.
4. Add a **layer** for another level of form (large-scale form, sections, phrases)
   or another framework: **+** above the layer names. Each layer is one reading of
   the timeline, and layers may disagree.
5. Write **Commentary** on a span; it shows above the diagram while that passage
   plays.
6. Save. In Chrome or Edge, **Save As** picks a file and **Save** then writes back
   to it. Other browsers download a copy of the `.strata` file each time.

Press **?** in the app for a short guide and every keyboard shortcut.

## Common tasks

- **Mark events.** **M** places a point marker, a single moment such as a
  cadence, at the playhead.
- **Choose types.** Built-in libraries (General, Pop/Rock, Song form, EDM, Common
  practice, Jazz, form letters) and optional packs (Caplin, Sonata Theory,
  Schenkerian and more), searchable from one picker. Add your own types, and
  import or share vocabulary packs (`.vocab.json` files). The built-in list is a
  draft under review.
- **Number bars.** Tap **T** along with the beat, or type a tempo in the **Grid**
  menu, to number bars and snap boundaries to beats, with free passages where
  there's no beat.
- **Write about a passage.** Commentary can link to any span or point marker by
  its **slug**, a short name made from its label: `[[drop]]`. Spans can carry
  lyrics too.
- **Read or teach from it.** **Reading view** lays the analysis out with editing
  off.
- **Share it.** Put the `.strata` file online (Dropbox, OneDrive, GitHub or your
  own site) and use **Share…** to make a link that opens it in Strata's reading
  view.
- **Embed it in a web page.** Strata has an embed mode for an iframe that can
  focus on one span:
  `https://strata.devinchaloux.com/?embed&src=<file address>&focus=<slug>`.
  See [`docs/decisions.md`](docs/decisions.md), "Embedding an Analysis".
- **Start from a link.** Another tool can open a new analysis with its setup
  filled in: `https://strata.devinchaloux.com/?new&title=…&artist=…&video=…&bpm=…`.
  See [`docs/decisions.md`](docs/decisions.md), "Starting an Analysis from a
  Link".
- **Export.** The diagram as an SVG or PNG figure; the commentary as one HTML
  page or Markdown.

## Words used in these docs

| Term | Meaning | Example |
|---|---|---|
| **span** | a stretch of the recording with a label and a type | "Drop", 1:45–2:15 |
| **layer** | one reading of the timeline, made of spans that don't overlap | "Sections" |
| **type** | a span's or marker's category from the vocabulary, used for queries | `chorus` |
| **point marker** | a single moment rather than a stretch | a perfect authentic cadence at 1:04 |
| **slug** | the short name links and embeds use for a span or marker | `drop-2` |
| **widget** | a kind of layer; today the form diagram and the written analysis | `form-diagram` |
| **`.strata` file** | the whole analysis as one JSON file | `alive.strata` |

The file format is documented field by field in
[`schema/strata-schema-reference.md`](schema/strata-schema-reference.md).

## The design bets

- **Analysis is data.** Formal annotations are structured, queryable records — not
  just display artifacts.
- **Overlapping frameworks are valid.** Several analytical frameworks can apply
  to the same passage at once, each on its own layer.
- **The file format is the invention.** The editor UI is downstream of getting the
  schema right.

EDM scholarship is the origin and stress test for the architecture; the broader
music-theory community is the intended audience.

## For contributors

Strata needs Node 24 (what CI uses).

```bash
npm ci           # install exactly what package-lock.json pins
npm run dev      # start the dev server at http://localhost:5173
npm run lint     # ESLint
npm run test:run # the Vitest suite, once
npm run build    # typecheck + production build
```

CI runs lint, the test suite and the build on every push and pull request, and
fails on any comment marked `TEMPORARY`. Before pushing, run
`npm run publish-check`: this repository is public, and the check stops new
content files, secrets and personal data from being published by accident.
[`CLAUDE.md`](CLAUDE.md) explains the workflow; it doubles as the instructions
for Claude Code.

**Tech stack:** React 18 · Vite · TypeScript · Zustand + zundo (undo/redo) ·
Tailwind CSS · Radix · lucide-react · dnd-kit · Vitest · Ajv (tests only) · File
System Access API.

### Documentation

- [`schema/`](schema) — the `.strata` JSON Schema, a plain-language field
  reference, and an example file.
- [`widgets/`](widgets) — the widget contract and each widget's spec.
- [`docs/decisions.md`](docs/decisions.md) — every design decision and its reason.
  It's binding: when another doc disagrees, the decisions log wins.
- [`docs/vision.md`](docs/vision.md) — the project's vision, written before the
  code.

## License

The code is MIT. See [`LICENSE`](LICENSE).

The example analyses in [`public/demos/`](public/demos/) are
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see that folder's README.
