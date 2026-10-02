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

- Select one span; the Inspector's **Describe** tab shows a **Commentary** box.
- Typing saves as you go; one editing session is one undo step.
- The first commentary in a file creates a layer labelled "Commentary". The
  analyst never adds it by hand.
- Clearing the box removes the block.
- Select several spans and the Inspector offers **Commentary, m:ss–m:ss**:
  prose about the whole stretch they cover, stored as a time-range block.
- A time-range block (including one left by a deleted span) has an **Edit**
  button in the reading panel, since no single span's Inspector owns it.

## 2. Reading

- The panel sits in the open area above the form diagram and shows a moment
  as a **stack**: in each visible layer, from the top of the diagram down
  (rotation → section → phrase), the span sounding then, with its layer, label,
  times, annotation and commentary. Lower levels are indented, so the nesting
  reads at a glance.
- Commentary on a stretch of time ("Passage") covering the moment comes first,
  with its in-place **Edit** button.
- The moment is the playhead during playback. Paused with spans selected, it
  is where the selection begins: a selected rotation shows the rotation and
  what opens it; a selected phrase, the phrase and everything it sits inside.
  The selected span's level is marked.
- **Lyrics on/off** (top right, shown when any span has lyrics) adds each
  span's lyrics to its level. The choice is remembered in the browser.
- The panel re-renders only when the stack's spans change, never per frame.
- **Hide commentary** (top right) sets the commentary layer's visibility off;
  the panel then shows nothing and the diagram's "Hidden:" chips bring it back,
  as for a hidden form layer. Exports are unaffected.

## 3. Text format

| Write | Get |
|---|---|
| a blank line | a new paragraph |
| `**words**` | bold |
| `*words*` | italic |
| `[[slug]]` | a link to the span or point marker with that slug, showing the slug |
| `[[slug\|shown text]]` | the same link, showing the text |

Anything else is literal. A link to a slug that doesn't exist reads as plain
text (with a tooltip saying so). Clicking a link selects the span and seeks the
player to its start, or selects the point marker and seeks to its moment. A
marker's slug is shown, ready to copy, in its Inspector panel.

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

"Markdown" exports the same document as Markdown for technical users: each span
section is preceded by an `<a id="slug">` anchor (renderers derive heading ids
differently), and links point at it.
