# Changelog

## 2026-10-30

### Workshop limits
- Pace and serialize autosaves, preserve drafts while throttled, display retry countdowns, and retry the newest edits after the server cooldown.
- Show storage and canvas capacity warnings, prevent further growth of full canvases, and preserve editing/export of existing larger documents.
- Explain daily invitation budgets, reduce selection update traffic, and retrieve all calendar TODOs through bounded pages.

### Security
- Update the development dependency lockfile and require Vite 8.3.5 or newer within the current major version.
- Move theme initialization to a same-origin script so production can enforce CSP without allowing arbitrary inline JavaScript.
- Verify workshop pages and syntax highlighting under the enforced production policy; document remaining development CLI advisories in the API security review.

## 2026-10-29

### Responsive workshop
- Adapt editor panels and settings to the width left by the workshop sidebars, including narrow desktop windows.
- Separate mobile page titles from organization names, enlarge touch controls, and keep project metrics and role cards readable on small screens.
- Keep the active settings tab visible, restore focus after closing drawers, and clear drawer state when resizing back to desktop.
- Support short landscape screens and safe areas while retaining workshop themes, canvas styling, and local document behavior.
- Extend the isolated responsive preview to all workshop pages with populated notes, wiki pages, members, and calendar events.

### Teams and organization chart
- Finish Teams with a shared directory design, accurate unique people and leader totals, team search by people or name, My teams, sorting, and member and project rosters.
- Add searchable role and team chart views, team filters, collapsible groups, member details, and an explicit place for people without a team or matching role.
- Keep API team memberships as the source for team labels; place each person once under their highest role in the role view.
- Preserve member selections when changing a leader, keep save controls busy through membership updates, and support partial-save retries without creating duplicate teams.
- Confirm team deletion by name and explain the existing cascade to projects and their saved data.
- Support narrow screens, dark mode, and workshop colors; remove Teams and Org chart construction markers.

## 2026-10-26

### Bug reports
- Replace the placeholder with a project inbox, status and category filters, priority, sender email, attachment downloads, and private triage notes.
- Add an optional public submission link: people can submit with an email and attachments without a DevHub account. Project managers can enable, disable, or replace the link.
- Add project-specific categories with rename, archive, and restore controls; keep existing report classifications when a category is archived.
- Keep reports and attachment bytes in SQL, protect private reads with project access, and require Manage bug reports for link settings, categories, and triage.

### Organization settings
- Group permissions with clear descriptions and separate access for ERD, UI/UX, Notes, Roadmap, dashboard publishing, and invitation management; preserve existing broad grants.
- Add an Invitations settings page to review expiry and revoke links, with creators limited to their own links and managers able to manage all links.
- Match member controls to role-assignment and removal permissions, protect team leaders, and confirm owner promotion, role deletion, and leaving an organization.
- Reorder roles in one atomic request, show save failures inside the role editor, and preserve profile edits while saved descriptions load or refresh.
- Add authorization, profile synchronization, and isolated settings preview coverage.

### Project Wiki
- Replace the placeholder with a project wiki: create, rename, edit, search, and delete Markdown pages with preview, page links, a configurable home page, and Markdown downloads.
- Keep stable page addresses and the latest 20 previous versions per page, with reviewed restoration and edit summaries.
- Persist wikis in shared project storage with live updates, revision conflicts, recoverable browser drafts, JSON backup downloads, and a separate Manage wiki permission.

### Notes
- Speed up the opening lift from 650 ms to 300 ms and the hover curl from 180 ms to 90 ms.

### Workshop pages
- Mark Teams, Org chart, Project Wiki, Bug Reports, SDLC Roadmap, UI/UX Editor, All projects, and every project entry as under construction while keeping them accessible.
- Move Organization to the top of the sidebar with Dashboard, Teams, and Org chart; remove the Workspace heading and group Project Wiki and Bug Reports under Project resources, separate from Project tools.
- Add Project Wiki and Bug Reports with themed placeholder pages and under-construction indicators.

### TODO boards
- Scroll task lists independently inside each column while keeping board controls, column headers, and Add a task buttons visible; keep horizontal board scrolling within the available height.
- Show a progress bar below the board title, with a color for each column, light green for the rightmost completion column, task counts, and completion percentage.

### Development roadmap
- Reduce Iterative roadmap star size, halo, and selection rings for clearer layers while retaining the existing click targets.

### Project tools
- Add State Machine with a themed placeholder page and under-construction indicator; include it in tool visibility and ordering settings while preserving existing preferences.

## 2026-10-25

### UI/UX studio
- Replace the placeholder with a dedicated design canvas, drawing tools, eight resize handles, multi-selection, snapping, alignment, and keyboard shortcuts.
- Keep layers nested under their screens with search, rename, drag reordering, visibility, locking, copy/paste, and reliable frame movement.
- Add screen presets, editable starter screens, component assets, image fills, typography, shadows, and horizontal or vertical frame layout.
- Connect screens with click actions, overlays, back navigation, and transitions; present prototypes with working text inputs, checkboxes, and toggles.
- Export screens or the canvas as SVG and PNG, import JSON drafts, and retain shared autosaving, browser recovery, permissions, and undo/redo.
- Integrate the workshop appearance and compact-screen drawers; remove the UI/UX under-construction marker.

### Development roadmap
- Add a phase overview, owners, target dates, overdue indicators, real deliverable checklists, and blockers with completion reviews.
- Preserve phase tracking in saved models, Sprint and iteration history, and independent deployment/maintenance progress; prevent blocked phases from being skipped.
- Add visible undo/redo controls, keyboard shortcuts, reviewed JSON draft restore, and Markdown reports covering saved models and cycle history.
- Keep phase actions reachable, open phase details in a compact-screen drawer, and fit the complete lifecycle on entry with readable map labels.
- Remove the SDLC under-construction marker and connect phases to related workshop tools.
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
- Pass the client regression suite and lint; verify the production build and browser workflows for phase tracking, completion, history, and draft restore.
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
