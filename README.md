# Dev Hub

A Vite + React + TypeScript application configured with:

- shadcn/ui and Tailwind CSS v4
- Redux Toolkit with typed React Redux hooks
- RTK Query with a shared base API
- React Router with nested routes and a 404 page
- Cookie and bearer authentication against the DevHub .NET API
- Automatic rotating refresh-token handling in RTK Query
- Nested user settings for profile, account connections, display, and billing

Profile editing and social authentication are backed by the DevHub .NET API.

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
the DevHub API's HTTPS profile before starting the frontend. The proxy keeps the
browser requests same-origin and accepts the local ASP.NET development certificate.

Usernames use X-style handle syntax: 5-15 ASCII letters, numbers, or underscores.
The displayed `@` prefix is not part of the stored username, and handles are unique
without regard to letter casing.

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
```

## Environment switch

- Local development: `npm run dev:local` (also the default `npm run dev`). Start the API with its Local profile.
- Production-mode development: `npm run dev:production`. Start the API with its Production profile. This runs locally; it does not deploy.
- Production build: `npm run build`. Local build: `npm run build:local`.

Shared public settings live in `.env.development` and `.env.production`. Use `.env.development.local` for private local overrides; avoid environment-specific values in `.env.local` because Vite reads it in every mode. Shell variables take precedence. In client code use `import.meta.env.MODE === "development"` to check the selected profile (Vite's DEV flag describes the dev server, not the selected mode). Production uses same-origin /api; the local Vite server proxies API and realtime traffic to https://localhost:7116.

Local Google login starts at https://localhost:7116/api and returns to http://localhost:5173. Provider credentials stay in API user-secrets.
