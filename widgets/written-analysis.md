# Written Analysis Widget
*Widget type: `"written-analysis"` | v1.0 | September 2026*

Prose commentary tied to the timeline. It surfaces while its passage plays, and
it can link to other spans by slug. Hierarchy lives in the writing, not the data
(`docs/decisions.md`, "Widgets" and "Written Analysis Widget").

**Data model reference:** `schema/strata-schema-reference.md`, "Written
Analysis Layer Data".

**Code:** `src/widgets/written-analysis/` — `commentary.ts` (pure logic: anchors,
lookup, re-anchoring, the text format, HTML export) and `CommentaryPanel.tsx`
(the reading view).

---

## 1. Writing

- Select one span; the Inspector shows a **Commentary** box under Notes.
- Typing saves as you go; one editing session is one undo step.
- The first commentary in a file creates a layer labelled "Commentary". The
  analyst never adds it by hand.
- Clearing the box removes the block.

## 2. Reading

- The panel sits in the open area above the form diagram.
- During playback it shows every block whose anchor contains the playhead,
  earliest-starting first.
- While paused with exactly one span selected, that span's commentary shows
  instead, if it has any.
- Each block is headed by its span's label (or type), or "Passage" for a
  time-range block, and its time range.
- The panel re-renders only when the set of active blocks changes, never per
  frame.

## 3. Text format

| Write | Get |
|---|---|
| a blank line | a new paragraph |
| `**words**` | bold |
| `*words*` | italic |
| `[[slug]]` | a link to the span with that slug, showing the slug |
| `[[slug\|shown text]]` | the same link, showing the text |

Anything else is literal. A link to a slug that doesn't exist reads as plain
text (with a tooltip saying so). Clicking a link selects the span and seeks the
player to its start.

## 4. What edits do to commentary

| Edit | Commentary |
|---|---|
| Drag a boundary, relabel | Follows the span (anchored by id) |
| Split a span | Stays on the original span |
| Merge spans | Moves to the merged span; two pieces are joined with a blank line |
| Delete a span, or its layer | Becomes a time-range block over the span's old times |

## 5. Export

"Commentary (HTML)" in the Export dialog, shown when the file has commentary:
one page, in time order, each section headed by its span and times. `[[slug]]`
links become in-page links when the target span has commentary of its own.

## 6. Not yet built

- Links to point markers.
- Markdown export.
- Creating a time-range block from the UI.
- Showing written-analysis layers in the layer panel.
