# Changelog

## 2026-10-25

### Development roadmap
- Align model paths with documented lifecycle practices and include expandable workflow guidance with source links.
- Pair V Model development stages with their test levels; distinguish early review and test preparation from test execution after implementation.
- Use a Scrum workflow for Agile with ongoing backlog refinement, overlapping development activities, optional release, and separate Sprint Review and Retrospective checkpoints.
- Start each new Sprint at Planning and preserve older combined review/retrospective notes and completion.
- Add explicit defect correction and retesting paths, plus feedback connections between Iterative tornado layers.
- Add Waterfall, V Model, Agile, and Iterative roadmaps with model-specific phases, notes, and progress preserved when switching models.
- Show completed sprints and iterations in history; offer another iteration or deployment and maintenance after evaluation.
- Display Iterative cycles as an interactive 3D tornado with orbit, pan, zoom, and phase selection.
- Refine the Waterfall illustration with matching smooth cascades, regular zigzag phase spacing, and a level pool.
- Scatter background stars independently to remove diagonal bands, keeping their positions stable during navigation and model changes.
- Add constellation artwork, readable phase labels, canvas navigation, and a collapsible phase details panel.
- Preserve shared saving, recovery drafts, undo/redo, permissions, and older Waterfall documents.

### Validation
- Pass all 268 client regression tests and lint; verify the production build.
- Release matching API validation for all roadmap models, cycle history, and iterative release progress without a database migration.

## 2026-10-22

### Notes
- Open previews as floating paper with Close and Edit controls and a darker backdrop for reading and editing.
- Peel notes from the bottom-right corner with a dark underside; continue from the hover lift and reverse the animation when closing.
- Keep resting notes flat, use a 13% hover lift, and remove detached fragments, oversized curl edges, and bright underside slivers.
- Skip the opening peel when returning from editing and respect reduced-motion preferences.
- Remove the Open note label, body placeholders, and Markdown helper text; update the formatting guide for inline code controls.

### ERD
- Move Tables and SQL tabs into the sidebar header, show the table count beside Tables, and keep Properties compact.
- Add a compact theme menu inside the SQL editor and remember its selection in this browser.
- Give SQL more editing space and use a full-width Apply SQL footer button that follows the active color scheme.
- Keep tables and Add column controls above relationship notation, including selected connections.
- Replace unreadable columns below 50% zoom with static placeholders, retaining full details for selected tables and restoring text when zooming in.
- Batch wheel zoom updates into one animation frame and preserve full detail and theme colors in PNG exports.

### Validation
- Pass all 242 client regression tests, including note peel geometry, detail transitions, zoom anchoring, routing, SQL editing, and exports.
- Client production build and lint pass.

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
- Show the grabbing cursor during middle-mouse panning and let Hand/Space/MMB pan over tables, fields, and relationship notation without triggering edits.
- Remove the SQL helper description so the editor uses the available height.
- Match relationship lines, notation previews, key markers, selection outlines, and PNG exports to the active color scheme.
- Add a + Add column row when hovering a table or the space directly beneath it, with keyboard access and new columns selected for editing.
- Balance broad relationship groups across columns and reuse gaps for disconnected tables instead of building tall stacks.
- Apply the same layout automatically when adding a table, with creation and arrangement in one undo step.
- Route connections around all tables with additional bends where needed; keep canvas paths, fit bounds, and PNG exports consistent.
- Reorganize Properties into a 300 px sidebar with compact 12 px controls, clearer spacing, and collapsible relationship cards with readable endpoint controls and separate removal actions.
- Use concise type codes such as UUID on the canvas, previews, and PNG exports; simplify the type picker to codes only.
- Widen the Schema sidebar, add drag/keyboard resizing, and split Tables and SQL into tabs.
- Edit highlighted SQL and apply it to the canvas with validation, draft conflict protection, and undo support; preserve existing positions, identities, and relationship attachments.
- Pin + Add Table to the bottom of the table list.
- Add table duplication, copy/cut/paste, redo, and zoom shortcuts while preserving native shortcuts in text fields.
- Offer a junction table when connecting tables as many-to-many, with matching foreign keys, a composite primary key, and two one-to-many links in one undoable step.

### Validation
- Pass all 232 client regression tests, including pan gesture capture, balanced layouts, obstacle routing, junction tables, SQL editing, ERD clipboard operations, keyboard scoping, note draft recovery, and emoji coverage.
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
