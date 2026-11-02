# Zevont

A Vite + React + TypeScript application configured with:

- shadcn/ui and Tailwind CSS v4
- Redux Toolkit with typed React Redux hooks
- RTK Query with a shared base API
- React Router with nested routes and a 404 page
- Cookie and bearer authentication against the Zevont .NET API
- Automatic rotating refresh-token handling in RTK Query
- Nested user settings for profile, account connections, display, and billing

Profile editing and social authentication are backed by the Zevont .NET API.

Zevont is currently hosted at https://dev-hub.site. The existing domain, API
addresses, and internal storage identifiers remain in place during the rebrand.

## Development

```bash
npm install
npm run dev
```

Create a local `.env.local` to enable social authentication against the local API:

```bash
VITE_API_BASE_URL=/api
VITE_OAUTH_API_BASE_URL=https://localhost:7116/api
VITE_OAUTH_ENABLED=true
```

During local development, Vite proxies `/api` to `https://localhost:7116`. Start
the Zevont API's HTTPS profile before starting the frontend. The proxy keeps the
browser requests same-origin and accepts the local ASP.NET development certificate.

Usernames use X-style handle syntax: 5-15 ASCII letters, numbers, or underscores.
The displayed `@` prefix is not part of the stored username, and handles are unique
without regard to letter casing.

## GitHub repositories

Use **Add repositories** in Create Project's technical step or Edit Project's
Links tab. Connect GitHub, use **Manage repository access** to install the GitHub app for
selected repositories, then refresh the picker. Select repositories and label
them Frontend, Backend, API, or another name. Up to ten GitHub repositories can be
saved per project. The manual Repository URL field is also available.

Authorization opens a separate window so unsaved project fields stay in place.
Allow pop-ups for Zevont. The connected repositories appear on the project's
Links tab after saving. Choosing a repository shares its name and URL with people
who can view the Zevont project; it does not give them GitHub repository access.

## Dashboard views

Use the icon switch beside **Dashboard** in the sidebar to switch between the
organization (building icon) and personal (person icon) views. Your last selection
is remembered for each account and organization in this browser.
The personal layout belongs to your account within the current organization and is
saved on the server. Each view has its own widgets and layout. Use **Manage Dashboard**
to customize it, then **Save personal dashboard** to keep your changes. Shared changes
still require dashboard permission and **Publish for everyone**. Save or discard an
edit before switching views. The personal view can also be linked with `?view=personal`.

## State Machine

Open **Design > State Machine** with a project selected. Use the palette to add
states or pseudostates, drag side handles to connect states, or use **Add transition**
for self-loops. The Properties panel edits triggers, guards, effects, entry/do/exit
behavior, parent containers, colors, and dimensions. Select a composite before adding
a region; select a container to add children. Moving a container moves its children.

**Check** flags missing start nodes, unreachable states, incomplete branches, and
fork/join issues without preventing draft saves. **Preview** walks through events and
branches, displays active states and an action log, and supports reset/back. Guards
are resolved by the person previewing the diagram; action text is never executed.
SVG/PNG retain the drawing; JSON retains all editable metadata. Mermaid export is
available for basic notation without advanced pseudostates, regions, or cross-scope
transitions. Use JSON for a lossless backup of every diagram and its layout.

Editing requires **Edit state machines**, Administrator/owner access, or the existing
legacy **Edit ideation** grant. Other project members can view and export. Shared
documents use the existing save/revision/conflict behavior. Local examples are saved
only in the current browser. The API requires the `AddStateMachineDocuments` migration.

## Project structure

```text
src/
├── app/          # Store, typed hooks, and router
├── components/   # Shared components; shadcn components live in ui/
├── features/     # Domain Redux slices and feature code
├── layouts/      # Route layouts
├── pages/        # Route-level screens grouped by related functionality
│   ├── account/  # Account layout, profile, connections, display, and billing
│   ├── auth/     # Login and registration
│   ├── discovery/ # Discovery screen
│   ├── general/  # Home and not-found screens
│   └── workshop/ # Organization selection, dashboard, todo, and ideation
│       ├── organization/ # Teams, organization chart, and roles
│       ├── projects/     # Project list and project details
│       └── settings/     # Organization settings: general, appearance, members, roles
└── services/     # RTK Query APIs
```

Add another shadcn component with:

```bash
npx shadcn@latest add <component>
```

## Checks

```bash
npm run lint
npm run build
node --test tests/*.test.mjs
```

See [CHANGELOG.md](CHANGELOG.md) for categorized workshop, project tools, Notes, ERD, canvas, and branding changes.

## Universal UML

The Design section has one UML workspace built from the archived Playground canvas. The directory opens first. Create a named diagram and optionally choose any of the 14 UML types; the selected category appears first while all shapes and connectors remain available. Diagrams can be renamed, reopened, and deleted independently.

Drag from a shape’s edge handle to create an attached UML relationship. A blank-space drop shows a small optional popup with six suggested UML shapes and search. Choosing a shape creates it at the drop point and connects the arrow; clicking away or pressing Escape leaves the arrow unconnected. Dropping onto an existing element connects directly. Double-click the middle of an arrow or its existing label to edit text directly on the canvas. Enter or clicking away saves, Escape cancels, and Shift+Enter adds a line. Connections follow movement, resize, rotation, and flips; selected connections expose draggable endpoints and waypoints. The inspector supports UML arrowheads, straight/elbow/curve routes, labels, guards/effects, roles, multiplicities, and message numbering. Copying both endpoint shapes includes their connections with fresh identities. Deleting a shape removes its incident connections in the same undoable change.

Element properties include classifier attributes and operations, stereotypes, state entry/do/exit actions, and interaction operators/operands. Layers can be selected, hidden, or locked. Diagram actions provide alignment, distribution, automatic arrangement, SVG/PNG export, and validated JSON import/export. The shapes palette stays open while adding elements, and every UML category remains available.

The canvas retains Playground selection, grouping, snapping, rotation, rich text, clipboard, and undo. The project library autosaves through the shared document service with conflict recovery; the API validates connection endpoints within each diagram. Separate UML editors have been removed; their historical database records and applied migrations are retained.

## Environment switch

- Local development: `npm run dev:local` (also the default `npm run dev`). Start the API with its Local profile.
- Production-mode development: `npm run dev:production`. Start the API with its Production profile. This runs locally; it does not deploy.
- Production build: `npm run build`. Local build: `npm run build:local`.

Shared public settings live in `.env.development` and `.env.production`. Use `.env.development.local` for private local overrides; avoid environment-specific values in `.env.local` because Vite reads it in every mode. Shell variables take precedence. In client code use `import.meta.env.MODE === "development"` to check the selected profile (Vite's DEV flag describes the dev server, not the selected mode). Production uses same-origin /api; the local Vite server proxies API and realtime traffic to https://localhost:7116.

Local Google login starts at https://localhost:7116/api and returns to http://localhost:5173. Provider credentials stay in API user-secrets.
