# Changelog

## 2026-10-21

### Home and Discovery
- Redesign the homepage around Workshop and Discovery while preserving its background and scroll effects.
- Add a 350 ms clockwise hover indicator and animated Workshop and Discovery previews; clicks still open each page immediately.
- Show task dragging, ERD relationships, and note editing in the Workshop preview, with a cursor that follows the dragged task.
- Center Discovery's orbiting profiles on the signed-in user's avatar and name, with initials and visitor fallbacks.
- Add a hard-hat avatar with a construction notice linking to the public changelogs page.

### Workshop
- Save note drafts while writing and restore them after a refresh, keeping them until the shared note finishes saving.
- Add the full searchable emoji catalog, skin tones, and a None option; allow scrolling inside the picker while editing a note.
- Replace the note card corner action with a delete button and confirmation.
- Animate selected ERD relationships like a conveyor belt, respecting reduced-motion preferences.
- Refresh the organization chooser with a concise workbench layout.

### ERD editing
- Reorganize Properties with compact 12 px controls, clearer spacing, and collapsible relationship cards with readable endpoint controls and separate removal actions.
- Use concise type codes such as UUID on the canvas, previews, and PNG exports; simplify the type picker to codes only.
- Widen the Schema sidebar, add drag/keyboard resizing, and split Tables and SQL into tabs.
- Edit highlighted SQL and apply it to the canvas with validation, draft conflict protection, and undo support; preserve existing positions, identities, and relationship attachments.
- Pin + Add Table to the bottom of the table list.
- Add table duplication, copy/cut/paste, redo, and zoom shortcuts while preserving native shortcuts in text fields.
- Offer a junction table when connecting tables as many-to-many, with matching foreign keys, a composite primary key, and two one-to-many links in one undoable step.

### Validation
- Pass all 226 client regression tests, including junction tables, SQL editing, ERD clipboard operations, keyboard scoping, note draft recovery, and emoji coverage.
- Client production build and lint pass; API schema checks cover emoji and None values, older notes, and malformed values.

## 2026-10-20

### Project tools and Notes
- Add project-scoped ERD, UI/UX Editor, SDLC Roadmap, and Notes with revision-safe saving, recovery drafts, undo/redo, permissions, and realtime updates.
- Archive Playground navigation while preserving saved canvas data and redirecting legacy links to Notes.
- Add configurable project tool visibility and ordering, responsive panels, and compact animated construction indicators.
- Add colored sticky notes sorted by latest update, full Markdown previews, and inline Shiki code editing with per-block grammar and theme choices.

### ERD
- Add SQL/JSON import, database dialects, composite keys, indexes, checks, relationship editing, and automatic arrangement.
- Expand common SQL type mappings and show explicit notes for database-specific details that cannot be retained.
- Combine SQL, PNG, and JSON downloads into an Export menu; PNG includes the complete diagram.
- Improve large-diagram performance with indexed foreign keys, reusable table content and routes, offscreen culling, and local drag previews.

### Canvas and workshop interactions
- Improve rotation, flipping, multi-selection, snapping, zoom, minimap geometry, and touch gestures.
- Add TODO task editing, deletion, duplication, assignment, and board actions with revision handling.
- Improve member menus, responsive chat launcher positions, project selection persistence, and workshop typography and colors.

### Branding
- Refresh the DevHub brand mark, application icons, manifest, header, and footer.
- Include licenses for the additional bundled fonts.

### Validation
- Client build and lint pass; 189 regression tests cover documents, Markdown, highlighting, imports/exports, geometry, realtime updates, and gestures.
- Refresh compatible dependency patches and classify the shadcn CLI as development tooling. Production dependencies have no reported advisories; seven development dependency audit entries remain in the shadcn globbing chain, whose suggested remediation is a breaking downgrade.
