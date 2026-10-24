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
- Commentary on a stretch of time ("Passage") covering the moment comes first.
- **Editing in place** (editor only, not the reading view): hovering a level
  shows **Edit** (or **Add commentary** for a span without any), and
  double-clicking its text does the same. The text becomes a box with a
  Markdown toolbar: bold, italic, code, heading, bulleted and numbered lists,
  quote, a link picker (spans and markers with a slug, found by name, written
  `[[slug]]`, or `[[slug|selected text]]`), and the symbol palette. Ctrl/⌘+B
  and Ctrl/⌘+I format; Esc, Ctrl/⌘+Enter or **Done** finishes. Changes write
  through at once to the same text the Inspector shows, and one session's
  typing and formatting undo together. While a box is open the stack holds at
  the moment editing began (`uiStore.commentaryEdit`), so playback can't swap
  it away. Passage commentary is edited only here.
- The moment is the playhead during playback. Paused with spans selected, it
  is where the selection begins: a selected rotation shows the rotation and
  what opens it; a selected phrase, the phrase and everything it sits inside.
  The selected span's level is marked.
- **Lyrics on/off** (at the top of the stack, shown when any span has lyrics)
  adds each span's lyrics to its level. On until the analyst turns it off;
  the choice is remembered in the browser and shared with the reading view's
  Lyrics chip.
- The panel re-renders only when the stack's spans change, never per frame.
- With the corner mini player showing, the panel keeps clear of it (a right
  margin the player's width), so no text or control sits underneath.
- **Hide commentary** (beside Lyrics) sets the commentary layer's visibility off;
  the panel then shows nothing and the diagram's "Hidden:" chips bring it back,
  as for a hidden form layer. Exports are unaffected.

## 3. Text format

Commentary is **Markdown** (CommonMark, rendered by react-markdown), with
Strata's own links:

| Write | Get |
|---|---|
| a blank line | a new paragraph |
| `**words**`, `*words*`, `` `code` `` | bold, italic, code |
| `# ` … `###### ` at a line's start | a heading |
| `- ` or `* `, `1. ` at a line's start | a bulleted or numbered list |
| `> ` at a line's start | a quote |
| `[text](https://…)` | a link, opening in a new tab |
| `[[slug]]` | a link to the span or point marker with that slug, showing the slug |
| `[[slug\|shown text]]` | the same link, showing the text |

Commentary comes from shared files, so only those elements are drawn (plus
code blocks, rules and line breaks): raw HTML is never rendered, an angle
bracket outside code shows as typed (`<tonic>`, `I < V`), images are dropped,
and unsafe link schemes are removed. A link to a slug that doesn't exist reads
as plain text (with a tooltip saying so). Clicking a `[[slug]]` link selects
the span and seeks the player to its start, or selects the point marker and
seeks to its moment. A marker's slug is shown, ready to copy, in its Inspector
panel. The HTML export renders the same Markdown with the same renderer, and
the Markdown export keeps it as written, `[[slug]]` links becoming in-page
links (or their text, where the target has no section).

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
