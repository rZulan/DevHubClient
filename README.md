# Dev Hub

A Vite + React + TypeScript application configured with:

- shadcn/ui and Tailwind CSS v4
- Redux Toolkit with typed React Redux hooks
- RTK Query with a shared base API
- React Router with nested routes and a 404 page
- Cookie and bearer authentication against the DevHub .NET API
- Automatic rotating refresh-token handling in RTK Query
- Nested user settings for profile, account connections, display, and billing

Backend work required for profile editing and social authentication is documented in
[`docs/backend-user-settings.md`](docs/backend-user-settings.md).

## Development

```bash
npm install
npm run dev
```

Create a local `.env` when the API does not use the default `/api` base path:

```bash
VITE_API_BASE_URL=https://api.example.com
```

During local development, Vite proxies `/api` to `https://localhost:7116`. Start
the DevHub API's HTTPS profile before starting the frontend. The proxy keeps the
browser requests same-origin and accepts the local ASP.NET development certificate.

## Project structure

```text
src/
├── app/          # Store, typed hooks, and router
├── components/   # Shared components; shadcn components live in ui/
├── features/     # Domain Redux slices and feature code
├── layouts/      # Route layouts
├── pages/        # Route-level screens
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
