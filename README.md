# Strata

**Existing music analysis tools produce display artifacts. Strata produces queryable scholarly data.**

Strata is a web-based, open-source music analysis tool. An analyst links a YouTube
video, then builds layered analytical views — *widgets* — synchronized to one
playback timeline and saved into a single portable `.strata` file (JSON).

The design bets:

- **Analysis is data.** Formal annotations are structured, queryable records — not
  just display artifacts.
- **Overlapping frameworks are valid.** Several analytical frameworks can apply
  to the same passage at once, each on its own layer.
- **The file format is the invention.** The editor UI is downstream of getting the
  schema right.

EDM scholarship is the origin and stress test for the architecture; the broader
music-theory community is the intended audience.

## Status

**Beta.** The editor works end to end; the format may still change, and files
from older versions are upgraded when opened.

What works today:

- **Form diagram.** Mark boundaries by ear (B while it plays; Space plays and
  pauses), label and describe spans, drag boundaries, merge, and stack several
  layers for different levels of form (large-scale form, sections, phrases)
  or frameworks. Point markers (M) for cadences and
  other events.
- **Types from a shared vocabulary.** Built-in libraries (General, Pop/Rock,
  Song form, EDM, Common practice, Jazz, form letters) and optional packs
  (Caplin, Sonata Theory, Schenkerian and more), searchable from one picker.
  Your own types, and vocabulary packs (`.vocab.json`) you import or share.
  The built-in list is a draft under review.
- **Beat grid.** Tap along (T) or type a tempo to number bars and snap to beats,
  with free passages where there's no beat.
- **Written analysis.** Commentary on any span, shown while that passage plays,
  stacked with the spans around it, with `[[slug]]` links and optional lyrics.
- **Sources.** A YouTube video or a local audio file.
- **Reading view and links.** A reading layout for teaching, and a link that
  opens a `.strata` file hosted anywhere (your site, GitHub) in it.
- **Export.** The diagram as SVG or PNG; the commentary as one HTML page.
- **Files.** Everything saves to one `.strata` file (JSON), validated against
  [`schema/strata.schema.json`](schema/strata.schema.json).

## Getting started

1. **New analysis**, then link a YouTube video or an audio file.
2. Press **Space** to play and **B** at each boundary you hear.
3. Click a span to give it a **Type** and a label in the Inspector; add layers
   for other levels of form.
4. Write **Commentary** on a span; it shows above the diagram as it plays.
5. **Save** a `.strata` file, or **Export** a figure.

Press `?` in the app for a short guide and every keyboard shortcut.

## Tech stack

React 18 · Vite · TypeScript · Zustand + zundo (undo/redo) · Tailwind CSS ·
Radix · lucide-react · dnd-kit · Vitest · Ajv (tests only) · File System Access API.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run lint     # ESLint
npm run test:run # the Vitest suite, once
npm run build    # typecheck + production build
```

## Documentation

- [`docs/vision.md`](docs/vision.md) — full project vision and architecture.
- [`docs/decisions.md`](docs/decisions.md) — architectural decisions log (living).
- [`schema/`](schema) — the `.strata` JSON Schema, a plain-language field
  reference, and example files.
- [`widgets/`](widgets) — the widget contract and each widget's spec.
- [`CLAUDE.md`](CLAUDE.md) — how to contribute (it doubles as the instructions
  for Claude Code).

## License

MIT. See [`LICENSE`](LICENSE).
