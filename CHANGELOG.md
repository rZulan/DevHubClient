# Changelog

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
