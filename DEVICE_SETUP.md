# DevHub client and API setup prompt

Copy this into Codex on the development device:

> Set up DevHub from https://github.com/rZulan/DevHubAPI.git and
> https://github.com/rZulan/DevHubClient.git, both on `master`, in sibling folders
> `DevHub/api` and `DevHub/client`. Preserve existing local work. Read the API's
> `DEVICE_SETUP.md` and both READMEs first. Verify .NET 10, the repository's EF tool,
> Node.js compatible with Vite 8, npm, Git, and local SQL Server. Restore and build
> both projects and run their relevant tests. Ask me only for credentials that are
> missing, using masked terminal entry or a secret store; do not ask me to paste
> secrets into chat. Configure the API connection string, JWT key, chat encryption
> key, and optional Google/GitHub OAuth application credentials in .NET user-secrets.
> Preserve restored encryption keys for existing data. For the client, use the
> tracked development profile and any necessary `.env.development.local` override:
> `VITE_API_BASE_URL=/api`,
> `VITE_OAUTH_API_BASE_URL=https://localhost:7116/api`, and
> `VITE_OAUTH_ENABLED=true` (false if OAuth is intentionally not configured).
> Client environment values are public: never put passwords, JWT keys, provider
> client secrets, or GitHub tokens in `VITE_*`. Start the API with its Local profile
> and the client with `npm run dev:local`; verify the local calendar and workshop.
> Do not deploy production as part of setting up a development machine.

The complete credential checklist and recovery guidance are in the
[API setup guide](https://github.com/rZulan/DevHubAPI/blob/master/DEVICE_SETUP.md).
