# Strata

**Existing music analysis tools produce display artifacts. Strata produces queryable scholarly data.**

Strata is a web-based, open-source music analysis tool. An analyst links a YouTube
video, then builds layered analytical views — *widgets* — synchronized to one
playback timeline and saved into a single portable `.strata` file (JSON).

The design bets:

- **Analysis is data.** Formal annotations are structured, queryable records — not
  just display artifacts.
- **Overlapping time spans are valid.** Multiple analytical frameworks can apply
  to the same passage at once.
- **The file format is the invention.** The editor UI is downstream of getting the
  schema right.

EDM scholarship is the origin and stress test for the architecture; the broader
music-theory community is the intended audience.

## Status

**Pre-release, in active development.** Not yet deployed for general use.

- Schema and v1 scope finalized (`schema/`, `docs/decisions.md`).
- Foundation complete: Vite + React + TypeScript app, Zustand/zundo state,
  File System Access save/load, YouTube IFrame player chrome, shared timeline axis.
- Form diagram widget in progress: rendering, span selection + metadata editing,
  spacebar placement / boundary drag, and layer management (collapse, visibility)
  are working; merge and export are still to come.

## Tech stack

React 18 · Vite · TypeScript · Zustand + zundo (undo/redo) · Tailwind CSS ·
lucide-react · dnd-kit · Vitest · File System Access API.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the Vitest suite
npm run build    # typecheck + production build
```

## Documentation

- [`docs/vision.md`](docs/vision.md) — full project vision and architecture.
- [`docs/decisions.md`](docs/decisions.md) — architectural decisions log (living).
- [`schema/`](schema) — the `.strata` JSON schema, TypeScript types, and example files.

## License

MIT (intended). Open source from the start.
