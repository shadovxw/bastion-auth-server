# Bastion

Self-hosted Identity Provider and SSO platform for the `shadovxw.me` homelab. Think Keycloak, but purpose-built — a single auth server that every app on the platform integrates with via SDK in one line.

No app writes auth logic. No app handles OAuth. No app stores tokens. They install the SDK, call one middleware, and get a fully authenticated user object on every request.

## Architecture

```
Internet
    │
    ▼
Oracle Cloud VM  (Nginx + SSL termination)
    │  WireGuard tunnel
    ▼
Zebronics Home Server (Ubuntu 24.04, Docker)
    ├── auth.shadovxw.me    →  Next.js login UI + admin dashboard  (port 3002)
    ├── api.auth.shadovxw.me →  Go auth server                     (port 3001)
    ├── app1.shadovxw.me    →  any app using the SDK               (port 300x)
    └── ...
```

## How It Works

1. User visits `app1.shadovxw.me` — no cookie found
2. App redirects to `api.auth.shadovxw.me/authorize?client_id=app1&return_to=...`
3. Auth server checks Redis SSO session → found? Skip to step 7
4. User clicks "Continue with Google" on the login page
5. Google OAuth flow → Bastion gets email + profile from Google
6. Bastion upserts the user record (first login = create, returning = lookup)
7. Bastion resolves all roles + permissions for this user + app
8. Signs an RS256 JWT, sets `auth_session` cookie on `.shadovxw.me`
9. Redirects back to `app1.shadovxw.me`
10. Every subdomain now has the cookie — user is authenticated everywhere

**Zero passwords. Zero duplicate accounts. Zero token handling in apps.**

## Features

- **SSO** — log in once, authenticated on every subdomain instantly
- **RBAC** — platform-wide and app-scoped roles/permissions embedded in JWT
- **Google + GitHub OAuth** — no local signup, no passwords stored
- **Shared cookie** — `.shadovxw.me` wildcard, HttpOnly, Secure
- **RS256 JWT** — backends validate locally via JWKS, no auth server roundtrip per request
- **Admin dashboard** — full CRUD for users, roles, permissions, groups, apps
- **Email allowlist** — restrict login to specific accounts
- **SDKs** — Go middleware + Next.js hooks, one-line integration

## JWT Claims

```json
{
  "sub":         "uuid",
  "email":       "user@gmail.com",
  "displayName": "Vrishank",
  "avatar":      "https://...",
  "provider":    "google",
  "roles":       ["editor"],
  "permissions": ["posts:read", "posts:write"],
  "app":         "app1",
  "iat":         1700000000,
  "exp":         1700003600
}
```

## RBAC Model

Roles and permissions are either **platform-wide** (`app_id = NULL`) or **app-scoped** (`app_id = 'app1'`). At login, Bastion resolves:

- Direct user roles (platform-wide + app-scoped)
- Roles inherited via groups
- All permissions for those roles

Only the relevant permissions are stamped into the JWT for that app.

## Tech Stack

| Layer | Tech |
|---|---|
| Auth server | Go + Fiber v2 |
| Database | PostgreSQL 16 (GORM) |
| Sessions | Redis 7 |
| JWT | RS256 via golang-jwt/jwt v5 |
| OAuth | golang.org/x/oauth2 |
| Migrations | golang-migrate |
| Login UI + Admin | Next.js 15 + shadcn/ui |
| Infra | Docker + Shipyard (home PaaS) |

## SDK Integration (consuming apps)

**Go backend:**
```go
import auth "github.com/shadovxw/auth-sdk"

var client = auth.New(auth.Config{
    ClientID:   "app1",
    AuthServer: "https://api.auth.shadovxw.me",
})

app.Use(client.Middleware())
app.Get("/posts", client.Require("posts:read"), handler)

user := auth.GetUser(c)  // *auth.User — never nil inside protected route
```

**Next.js frontend:**
```ts
// middleware.ts
import { authMiddleware } from '@shadovxw/auth-browser/server'
export default authMiddleware({ authServer: 'https://api.auth.shadovxw.me', clientId: 'app1' })

// Server component
import { getUser } from '@shadovxw/auth-browser/server'
const user = await getUser()

// Client component
import { useUser } from '@shadovxw/auth-browser'
const user = useUser()
```

## Repos

| Repo | Description |
|---|---|
| [shadovxw/bastion](https://github.com/shadovxw/bastion) | This repo — auth server + web UI |
| [shadovxw/auth-sdk](https://github.com/shadovxw/auth-sdk) | Go SDK |
| [shadovxw/auth-browser](https://github.com/shadovxw/auth-browser) | Next.js / browser SDK |

## Database Schema

```sql
users        -- single pool, one identity per email across all apps
apps         -- registered client applications
roles        -- platform-wide or app-scoped
permissions  -- namespaced strings e.g. 'posts:write'
groups       -- batch role assignment
user_roles   -- direct role assignments
user_groups  -- group membership
group_roles  -- roles inherited via group
role_permissions
```

## Deployment

Runs as Docker containers on a Zebronics home server, managed by [Shipyard](https://github.com/shadovxw/shipyard) (a self-built PaaS). TLS is terminated at an Oracle Cloud VM and proxied over WireGuard to the home server.
