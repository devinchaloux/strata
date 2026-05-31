# Strata — Architectural Decisions Log

This is a living document. Every significant architectural decision made during
design or development is recorded here with its rationale. New decisions are
added at the bottom. Decisions are never deleted — if a decision is reversed,
a new entry is added noting the reversal and why.

*Seeded from the v0.1 vision document, May 2026.*

---

## File Format

**Decision:** JSON, not XML.
**Rationale:** Web-native. Zero-friction in JavaScript/React. Human-readable. No parser library required. XML is the legacy desktop-app choice; JSON is correct for a web tool built in 2025+.

---

**Decision:** Custom file extension (`.strata`) wrapping plain JSON.
**Rationale:** Signals "this is an analysis file" rather than generic data. Contents are still plain JSON. Enables future versioning and association with the application.

---

**Decision:** Timestamps stored as seconds (float), not HH:MM:SS strings.
**Rationale:** Seconds is what the YouTube API provides and what arithmetic requires. Display formatting is a rendering concern, not a storage concern.

---

## Span Data Model

**Decision:** Span `id`, `label`, and `slug` are three separate fields.
**Rationale:** `id` is internal and stable (for references). `label` is display text (human-readable, can change). `slug` is the stable human-readable reference key (auto-generated from label, used for inter-widget imports, null until label is set).

---

**Decision:** Overlapping spans are valid data. Hierarchical constraints are a UI mode, not a data constraint.
**Rationale:** EDM and other repertoires require overlapping formal frameworks. Enforcing non-overlap in the data model would make the tool wrong for a significant scholarly use case. The "hierarchical mode" toggle applies the constraint at the editing UI level only.

---

**Decision:** `label` and `type` are separate fields on every span.
**Rationale:** `label` is free text (display). `type` is controlled vocabulary (corpus-queryable). A scholar can call a section "THE DROP" (label) while it is typed as "drop" (type). Cross-corpus comparison requires consistent types, not consistent labels.

---

## File-Level Metadata

**Decision:** `context` field (`recording` / `performance` / `remix`) drives UI progressive disclosure.
**Rationale:** A pop scholar should never see the composer field. A performance studies scholar needs it. One context choice at file creation collapses the metadata form appropriately. The underlying schema supports all contexts — the UI adapts.

---

## Architecture

**Decision:** Analysis Tool and Library are separate products. Build Analysis Tool first.
**Rationale:** Conflating them from the start will prevent v1 from shipping. The file format being open means the Library can be built later without requiring migration.

---

**Decision:** Build in React, client-side, no backend required for v1.
**Rationale:** Maximizes accessibility. No accounts, no server costs, no infrastructure to maintain. Scholars can use it immediately by opening a URL. The Library layer adds backend when ready.

---

## Widgets

**Decision:** Intensity graph is manually drawn, not computed from audio.
**Rationale:** Technically: automated waveform/spectrogram from YouTube is impossible due to browser cross-origin security. Philosophically: sonic intensity is interpretive, not purely acoustic. Manual drawing is epistemically correct for this kind of analysis.

---

## Vocabulary

**Decision:** v1 ships with global built-in types only. Project-level custom types are v2. Community vocabularies are v3+.
**Rationale:** Scope control. The architecture supports all three from day one — the file stores a vocabulary reference. The UI only needs to implement the simplest level first.

---

*Add new decisions below this line as they are made during development.*
