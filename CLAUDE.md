# CLAUDE.md — Bastion (Auth System)

> Personal self-hosted Identity Provider + SSO + RBAC platform by [@shadovxw](https://github.com/shadovxw)
> Deployed on the Shipyard home server infrastructure at `shadovx.me`

---

## What is Bastion?

Bastion is a self-hosted, centralized authentication and authorization system — think Keycloak, but purpose-built for the `shadovx.me` platform. It is the **single source of truth** for all identity, sessions, roles, permissions, and access control across every app on the platform.

No app on `shadovx.me` writes auth logic. They install the SDK and call one middleware. That's it.

---

## Project Info

| | |
|---|---|
| **Project name** | Bastion |
| **GitHub** | `shadovxw/bastion` |
| **Auth domain** | `auth.shadovx.me` |
| **Admin UI** | `auth.shadovx.me/admin` |
| **Cookie domain** | `.shadovx.me` (shared across all subdomains) |
| **Part of** | Shipyard home server platform |

---

## Repository Structure

```
bastion/
├── server/                        Go auth server
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── handlers/              HTTP route handlers
│   │   │   ├── authorize.go       OAuth 2.0 /authorize endpoint
│   │   │   ├── token.go           /token code exchange
│   │   │   ├── oauth.go           Google + GitHub callback handlers
│   │   │   ├── session.go         SSO session + logout
│   │   │   ├── jwks.go            /.well-known/jwks.json
│   │   │   └── admin/             All admin CRUD handlers
│   │   ├── middleware/
│   │   │   ├── auth.go            JWT validation middleware
│   │   │   └── cors.go
│   │   ├── models/                GORM models
│   │   │   ├── user.go
│   │   │   ├── app.go
│   │   │   ├── role.go
│   │   │   ├── permission.go
│   │   │   └── group.go
│   │   ├── services/
│   │   │   ├── token.go           JWT sign/verify, RS256 keypair
│   │   │   ├── oauth.go           Google + GitHub OAuth flows
│   │   │   ├── rbac.go            Role/permission resolution
│   │   │   └── session.go         Redis SSO session management
│   │   ├── db/
│   │   │   ├── postgres.go        DB connection + GORM setup
│   │   │   ├── redis.go           Redis connection
│   │   │   └── migrations/        SQL migration files
│   │   └── config/
│   │       └── config.go          Env config loader
│   ├── Dockerfile
│   └── go.mod
│
├── web/                           Next.js — Login UI + Admin Panel
│   ├── app/
│   │   ├── login/                 Google/GitHub login page
│   │   ├── callback/              Internal OAuth return handler
│   │   └── admin/                 Full RBAC admin dashboard
│   │       ├── users/
│   │       ├── roles/
│   │       ├── permissions/
│   │       ├── groups/
│   │       └── apps/
│   ├── components/
│   ├── lib/
│   └── Dockerfile
│
├── sdk/
│   ├── auth-browser/              @shadovxw/auth-browser (npm)
│   │   ├── src/
│   │   │   ├── index.ts           useUser hook, client helpers
│   │   │   └── server.ts          authMiddleware, getUser (server-side)
│   │   └── package.json
│   └── auth-node/                 github.com/shadovxw/auth-sdk (Go module)
│       ├── auth.go                New(), Middleware(), GetUser()
│       ├── admin.go               admin.* API wrappers
│       └── go.mod
│
├── docker-compose.yml
└── nginx.conf
```

---

## Deployment (Shipyard Infrastructure)

```
Internet → shadovx.me
               ↓
         Oracle Cloud VM  (static IP, Nginx, SSL termination)
               ↓ WireGuard tunnel
         Zebronics (app server, Ubuntu 24.04)
         ├── auth.shadovx.me   → bastion-server:3001  (Go)
         ├── auth.shadovx.me   → bastion-web:3002     (Next.js login + admin)
         ├── app1.shadovx.me   → app1:3003
         ├── app2.shadovx.me   → app2:3004
         └── shipyard.shadovx.me → shipyard:3000
```

All services run as Docker containers managed by Shipyard. SSL is terminated at Oracle VM. The `.shadovx.me` wildcard cookie works across all subdomains because SSL is end-to-end.

---

## Core Concepts

### Single User Pool
One `users` table. One identity per email across the entire platform. If a user signs up via `app1.shadovx.me`, they can immediately log into `app2.shadovx.me` — no second signup, no duplicate account.

### No Local Signup / No Passwords
Google and GitHub are the only identity providers. Bastion never stores passwords. On first login, a user record is automatically created (email + display name + avatar + provider info). On subsequent logins, the record is looked up.

### Shared Domain Cookie = Zero Token Handling in Apps
Bastion sets `Set-Cookie: auth_session=<jwt>; Domain=.shadovx.me; HttpOnly; Secure; SameSite=Lax`. Every subdomain receives this cookie automatically. Apps never decode JWTs, never handle OAuth callbacks, never store tokens.

### SSO Session
Bastion maintains a server-side SSO session in Redis. When `app2` redirects to `auth.shadovx.me`, the auth server checks the SSO session — if valid, it issues tokens and redirects back immediately. The user never sees the login page again during the session lifetime.

### RBAC
Roles and permissions can be **platform-wide** (`app_id = null`) or **app-scoped** (`app_id = 'app1'`). When issuing a JWT for app1, Bastion resolves: platform-wide roles + app1-scoped roles + roles inherited via groups. Only the relevant permissions are embedded in the token.

---

## Auth Flow (End to End)

```
1. User visits app1.shadovx.me
2. Next.js middleware checks for auth_session cookie → not found
3. Redirect → auth.shadovx.me/authorize?client_id=app1&return_to=https://app1.shadovx.me

4. auth.shadovx.me checks SSO session cookie
   → Exists and valid? Skip to step 9
   → Not found? Show login page

5. User clicks "Continue with Google"
6. Redirect → Google OAuth
7. Google → auth.shadovx.me/oauth/callback/google?code=...
8. Bastion exchanges code → gets email, display_name, avatar, provider_id from Google
   → First time? INSERT user (email, display_name, avatar, provider, provider_id)
   → Returning?  SELECT user by (provider, provider_id)

9. Bastion resolves all roles + permissions for user + app1
10. Signs JWT (RS256) with claims: { sub, email, displayName, avatar, roles, permissions, app, exp }
11. Sets SSO session in Redis
12. Sets cookie: auth_session=<jwt>; Domain=.shadovx.me; HttpOnly; Secure
13. Redirects → https://app1.shadovx.me (return_to URL)

14. app1.shadovx.me receives request with cookie already attached
15. Next.js middleware reads cookie server-side → user authenticated
16. Go backend reads same cookie via auth.Middleware() → user in context
17. Done. App never touched a token.
```

---

## Database Schema

```sql
-- Registered client applications
CREATE TABLE apps (
  id            TEXT PRIMARY KEY,          -- 'app1', 'app2', 'shipyard'
  name          TEXT NOT NULL,
  client_secret TEXT NOT NULL,             -- hashed
  redirect_uris TEXT[] NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- All users across the platform (single pool)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar      TEXT,
  provider    TEXT NOT NULL,               -- 'google' | 'github'
  provider_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, provider_id)
);

-- Roles — platform-wide (app_id null) or app-scoped
CREATE TABLE roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,
  app_id  TEXT REFERENCES apps(id),        -- null = platform-wide
  UNIQUE(name, app_id)
);

-- Permissions — platform-wide or app-scoped
CREATE TABLE permissions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT NOT NULL,                   -- 'posts:write', 'users:manage'
  app_id  TEXT REFERENCES apps(id),
  UNIQUE(name, app_id)
);

-- Groups — batch role assignment
CREATE TABLE groups (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- RBAC join tables
CREATE TABLE role_permissions (
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE group_roles (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  role_id  UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, role_id)
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  app_id  TEXT REFERENCES apps(id),        -- null = platform-wide assignment
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_groups (
  user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);
```

---

## JWT Structure

```json
{
  "sub":         "uuid",
  "email":       "user@gmail.com",
  "displayName": "Vrishank",
  "avatar":      "https://lh3.googleusercontent.com/...",
  "provider":    "google",
  "roles":       ["editor"],
  "permissions": ["posts:read", "posts:write"],
  "app":         "app1",
  "iat":         1700000000,
  "exp":         1700003600
}
```

Signed RS256. Public keys exposed at `auth.shadovx.me/.well-known/jwks.json`. Backend SDKs validate locally against cached JWKS — no network call to auth server per request.

---

## Admin APIs

All endpoints under `/admin/*` require a valid JWT with `auth:admin` permission. These APIs are called both from Bastion's own admin UI and from other apps via the SDK's `auth.Admin.*` methods.

```
# Apps
POST   /admin/apps
GET    /admin/apps
PUT    /admin/apps/:id
DELETE /admin/apps/:id

# Users
GET    /admin/users
GET    /admin/users/:id
DELETE /admin/users/:id

# Roles
POST   /admin/roles                  { name, appId? }
GET    /admin/roles
PUT    /admin/roles/:id
DELETE /admin/roles/:id
POST   /admin/roles/:id/permissions  { permissionIds[] }
DELETE /admin/roles/:id/permissions/:permId

# Permissions
POST   /admin/permissions            { name, appId? }
GET    /admin/permissions
DELETE /admin/permissions/:id

# Groups
POST   /admin/groups
GET    /admin/groups
PUT    /admin/groups/:id
DELETE /admin/groups/:id
POST   /admin/groups/:id/roles       { roleIds[] }
DELETE /admin/groups/:id/roles/:roleId

# User assignments
POST   /admin/users/:id/roles        { roleId, appId? }
DELETE /admin/users/:id/roles/:roleId
POST   /admin/users/:id/groups       { groupId }
DELETE /admin/users/:id/groups/:groupId
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Auth server | Go + Fiber v2 | Single binary, great stdlib, fast HTTP |
| ORM | GORM | Postgres integration, migrations |
| JWT | golang-jwt/jwt | RS256 signing + verification |
| OAuth | golang.org/x/oauth2 | Google + GitHub flows |
| Sessions | go-redis/redis | SSO session storage |
| Migrations | golang-migrate | SQL migration files |
| Auth web UI | Next.js 15 + shadcn/ui | Login page + admin dashboard |
| Browser SDK | TypeScript | useUser hook, server middleware |
| Go SDK | Go module | Middleware, guards, admin wrappers |
| DB | PostgreSQL 16 | Primary data store |
| Cache | Redis 7 | SSO sessions, refresh tokens, JWKS cache |
| Infra | Docker + Shipyard | Managed like any other app on the platform |

---

## Environment Variables

### Auth Server (`server/.env`)
```env
PORT=3001
DATABASE_URL=postgres://bastion:password@postgres:5432/bastion
REDIS_URL=redis://redis:6379
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
COOKIE_DOMAIN=.shadovx.me
SESSION_TTL_HOURS=24

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://auth.shadovx.me/oauth/callback/google

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://auth.shadovx.me/oauth/callback/github

ADMIN_PERMISSION=auth:admin
```

### Auth Web (`web/.env`)
```env
NEXT_PUBLIC_AUTH_SERVER=https://auth.shadovx.me
```

---

## Build Phases

### Phase 1 — Auth Server Core
- [ ] Go project scaffold (Fiber, GORM, config)
- [ ] PostgreSQL schema + migrations
- [ ] RS256 keypair generation + JWKS endpoint
- [ ] Google OAuth callback → user upsert → JWT issue → cookie set
- [ ] GitHub OAuth callback → user upsert → JWT issue → cookie set
- [ ] SSO session (Redis) — create, read, destroy
- [ ] `/authorize` + redirect logic
- [ ] SSO session check (skip login if session exists)

### Phase 2 — RBAC Engine
- [ ] CRUD APIs: roles, permissions, groups, apps
- [ ] User assignment APIs (roles, groups)
- [ ] Role/permission resolution query (direct + via groups)
- [ ] App-scoping logic (embed only relevant permissions in JWT)
- [ ] `auth:admin` permission guard on all `/admin/*` routes

### Phase 3 — SDKs
- [ ] `@shadovxw/auth-browser` — useUser hook, authMiddleware (Next.js), getUser server-side
- [ ] `github.com/shadovxw/auth-sdk` — Middleware(), GetUser(), Admin.* wrappers
- [ ] JWKS caching in Go SDK (refresh every 1h)
- [ ] Publish browser SDK to npm (or private registry)

### Phase 4 — Auth Web UI
- [ ] Login page (`auth.shadovx.me`) — Google + GitHub buttons
- [ ] Admin dashboard (`auth.shadovx.me/admin`) — protected by auth:admin
- [ ] Users list + role/group assignment UI
- [ ] Roles + permissions CRUD UI
- [ ] Groups CRUD UI
- [ ] Apps CRUD UI

### Phase 5 — Hardening
- [ ] Refresh token rotation (Redis, httpOnly cookie)
- [ ] Token revocation list (Redis)
- [ ] Rate limiting on auth endpoints
- [ ] Audit log table (who assigned what role, when)
- [ ] Same-email multi-provider merge logic

---

## Key Decisions

- No local signup, no passwords — Google + GitHub only
- Single user pool across all apps — one identity everywhere
- Shared `.shadovx.me` cookie — apps never handle tokens
- HttpOnly cookie — frontend JS never accesses JWT
- RS256 JWT — backends validate locally, no auth server roundtrip per request
- App-scoped RBAC — permissions are namespaced per app in the token
- All complexity in Bastion — apps are dumb consumers via SDK
- Deployed as a Docker container in Shipyard like any other app
