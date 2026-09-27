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

- **Form diagram.** Mark boundaries by ear (Space while playing), label and
  describe spans, drag boundaries, merge, and stack several layers for different
  levels or frameworks. Point markers (M) for cadences and other events.
- **Written analysis.** Commentary on any span, shown while that passage plays,
  with `[[slug]]` links between spans.
- **Export.** The diagram as SVG or PNG; the commentary as one HTML page.
- **Files.** Everything saves to one `.strata` file (JSON), validated against
  [`schema/strata.schema.json`](schema/strata.schema.json).

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
