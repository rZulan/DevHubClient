# Backend work for user settings and external authentication

The frontend settings UI is ready for richer profile data and external providers,
but the current API only exposes `Id`, `Email`, `FirstName`, `LastName`, and
`CreatedAtUtc`. Keep `VITE_OAUTH_ENABLED=false` until the contracts below are live.

## 1. Extend the user profile

Add these fields to `User` and its EF Core configuration:

- `Username` and `NormalizedUsername`: required, unique, indexed, and immutable only
  if that is an intentional product rule.
- `AvatarUrl`: nullable. Prefer storing an object-storage key rather than arbitrary
  remote URLs.

Recommended username rules:

- 3–30 characters.
- Lowercase letters, numbers, `_`, and `-`.
- Case-insensitive uniqueness through `NormalizedUsername`.
- Reserve system names such as `admin`, `api`, `support`, and `settings`.

For existing users, backfill a unique username from the email prefix plus a short
suffix before making the column non-nullable.

Update `UserResponse` and `AuthenticationResponse` to return:

```json
{
  "username": "alex-rivera",
  "avatarUrl": "https://cdn.example.com/avatars/...",
  "connectedAccounts": [
    { "provider": "github", "providerUsername": "alexrivera" }
  ]
}
```

Add an authenticated endpoint such as:

```http
PATCH /api/users/me
Content-Type: application/json

{
  "username": "alex-rivera",
  "firstName": "Alex",
  "lastName": "Rivera"
}
```

For avatar uploads, prefer a dedicated multipart endpoint or a signed object-storage
upload flow. Validate content type, decoded file type, dimensions, and size; generate
the final filename server-side.

## 2. Model external accounts

Create an `ExternalAccount` entity rather than adding provider columns to `User`:

- `Id`
- `UserId`
- `Provider` (`google`, `github`, or `gitlab`)
- `ProviderUserId`
- `ProviderUsername` (nullable)
- `ProviderEmail` (nullable)
- `AvatarUrl` (nullable)
- `CreatedAtUtc` and `UpdatedAtUtc`

Add unique indexes on `(Provider, ProviderUserId)` and `(UserId, Provider)`. Do not
store provider access tokens unless DevHub needs to call provider APIs. If tokens are
required, encrypt them with ASP.NET Core Data Protection or an external secrets/KMS
service and store expiry and scopes explicitly.

Never automatically merge accounts solely because an OAuth provider returns the same
email. Require an authenticated linking flow or an explicit, verified confirmation to
avoid account takeover.

## 3. Add OAuth challenge and callback flows

Configure Google with its ASP.NET Core authentication handler. GitHub and GitLab can
use maintained provider handlers or ASP.NET Core's generic `AddOAuth` handler. Store
client IDs and secrets in user-secrets locally and environment/secret storage in
deployment—not in `appsettings.json`.

The frontend is prepared to call:

```text
GET /api/auth/external/{provider}?intent=login&returnUrl=/account/profile
GET /api/users/me/connections/{provider}?returnUrl=/account/account
```

The first endpoint starts login/registration. The second must require an authenticated
user and starts a linking flow. Validate `returnUrl` against an allow-list; never accept
arbitrary external redirect targets.

The callback should:

1. Validate OAuth state and correlation cookies.
2. Resolve or create the local user.
3. Create/link the `ExternalAccount` record.
4. Issue the DevHub session and rotated refresh token.
5. Redirect to an allow-listed frontend callback or settings route.

Add a protected disconnect endpoint:

```text
DELETE /api/users/me/connections/{provider}
```

Prevent disconnecting the final sign-in method when the user has no password or other
connected provider.

## 4. Adjust token and cookie handling

The current refresh endpoint requires the raw refresh token in the JSON body, forcing
the SPA to retain it in browser-readable storage. Before enabling OAuth, move the
refresh token to its own HTTP-only, Secure cookie and rotate it server-side. Do not put
JWTs or refresh tokens in OAuth redirect query strings.

The OAuth callback is cross-site. Configure temporary external/correlation cookies
with an appropriate SameSite policy, then issue the final first-party DevHub cookies.
Keep production origins HTTPS-only and configure CORS with explicit origins and
credentials if the SPA and API are deployed on different origins.

Also update logout to revoke the active refresh-token family rather than only clearing
the authentication cookie.

## 5. Billing later

Keep billing separate from `User`. Add subscription/customer entities only when a
billing provider is selected, and process subscription state through verified webhooks.
The frontend currently labels Billing as a future feature and does not fabricate plan
or payment API calls.

## 6. Enable the frontend

After the external challenge endpoints work, set:

```env
VITE_OAUTH_ENABLED=true
```

Then add RTK Query mutations for profile updates, avatar changes, password changes,
disconnecting providers, and billing operations as those API contracts are introduced.
