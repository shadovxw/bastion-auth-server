# CLAUDE.md — Bastion SDKs

> Two packages. Zero auth logic in your apps.
> `@shadovxw/auth-browser` — Next.js frontend SDK
> `github.com/shadovxw/auth-sdk` — Go backend SDK

---

## Design Principle

All complexity lives in the Bastion server. The SDKs are thin wrappers:
- **Browser SDK**: reads the `.shadovx.me` cookie server-side, exposes a `useUser` hook client-side
- **Go SDK**: validates the JWT locally (JWKS cache), provides middleware + guards + admin API wrappers

Apps never decode JWTs. Never handle OAuth. Never call the auth server per request.

---

# SDK 1 — `@shadovxw/auth-browser`

**TypeScript. For Next.js apps on the shadovx.me platform.**

## Package Structure

```
sdk/auth-browser/
├── src/
│   ├── server.ts          authMiddleware(), getUser() — server-side only (Next.js server components, middleware)
│   ├── client.ts          useUser() hook — client components
│   ├── types.ts           User type, AuthConfig type
│   └── index.ts           Re-exports
├── package.json
└── tsconfig.json
```

## Installation

```bash
npm install @shadovxw/auth-browser
```

## Types

```ts
// types.ts

export interface User {
  id:          string
  email:       string
  displayName: string
  avatar:      string | null
  provider:    'google' | 'github'
  roles:       string[]
  permissions: string[]
  app:         string
  exp:         number
}

export interface AuthConfig {
  authServer: string       // 'https://auth.shadovx.me'
  clientId:   string       // 'app1'
  publicPaths?: string[]   // paths that don't require auth
}
```

## Server-Side API (`import from '@shadovxw/auth-browser/server'`)

### `authMiddleware(config)` — Next.js middleware.ts

```ts
import { authMiddleware } from '@shadovxw/auth-browser/server'

export default authMiddleware({
  authServer: 'https://auth.shadovx.me',
  clientId: 'app1',
  publicPaths: ['/public', '/about'],
})

export const config = { matcher: ['/((?!_next|favicon).*)'] }
```

**What it does:**
1. Reads `auth_session` cookie from the request
2. Decodes the JWT (no signature verification — that's the Go backend's job; Next.js middleware just reads claims)
3. Checks `exp` — if expired, redirects to `auth.shadovx.me/authorize?client_id=app1&return_to=<current_url>`
4. If no cookie — same redirect
5. If valid — lets request through

> Note: Next.js middleware runs on the Edge runtime. Full RS256 verification is done by the Go backend. The middleware only checks expiry for the redirect decision — the Go backend is the trust boundary.

### `getUser()` — Server components + Route handlers

```ts
import { getUser } from '@shadovxw/auth-browser/server'

// In a Server Component
export default async function Page() {
  const user = await getUser()
  if (!user) redirect('/login')
  return <div>Hello {user.displayName}</div>
}

// In a Route Handler
export async function GET(req: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({ user })
}
```

**What it does:**
Reads `auth_session` cookie from `cookies()` (Next.js), decodes JWT claims, returns typed `User` object or `null`.

### `hasPermission(user, permission)` + `hasRole(user, role)`

```ts
import { getUser, hasPermission } from '@shadovxw/auth-browser/server'

const user = await getUser()
if (!hasPermission(user, 'posts:write')) {
  return Response.json({ error: 'Forbidden' }, { status: 403 })
}
```

## Client-Side API (`import from '@shadovxw/auth-browser'`)

### `useUser()` — Client components

```ts
'use client'
import { useUser } from '@shadovxw/auth-browser'

export function Avatar() {
  const user = useUser()
  if (!user) return null
  return <img src={user.avatar} alt={user.displayName} />
}
```

**What it does:**
Calls `GET /api/auth/me` (a route handler you add to your app — one-liner). Returns the user or null. Caches in React state.

### Route handler to add to your app (one time)

```ts
// app/api/auth/me/route.ts — copy this into every Next.js app, never touch it
import { getUser } from '@shadovxw/auth-browser/server'

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json(null, { status: 401 })
  return Response.json(user)
}
```

### `useHasPermission(permission)` + `useHasRole(role)`

```ts
'use client'
import { useHasPermission } from '@shadovxw/auth-browser'

export function DeleteButton() {
  const canDelete = useHasPermission('posts:delete')
  if (!canDelete) return null
  return <button>Delete</button>
}
```

## Implementation Notes

```ts
// server.ts — getUser() implementation
import { cookies } from 'next/headers'

export async function getUser(): Promise<User | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('auth_session')?.value
  if (!token) return null
  
  try {
    // JWT is three base64url segments: header.payload.signature
    // We decode the payload only — Go backend does signature verification
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    )
    if (payload.exp < Date.now() / 1000) return null
    return payload as User
  } catch {
    return null
  }
}
```

No crypto dependencies. No network calls. Just base64 decode. The Go backend is the trust boundary.

---

# SDK 2 — `github.com/shadovxw/auth-sdk`

**Go module. For Go backends on the shadovx.me platform.**

## Package Structure

```
sdk/auth-node/
├── auth.go            New(), Middleware(), GetUser(), HasPermission(), HasRole()
├── admin.go           Admin struct — all /admin/* API wrappers
├── jwks.go            JWKS fetch + cache + RS256 verification
├── types.go           User, Config structs
└── go.mod
```

> Note: named `auth-node` historically but it's a Go module. The module path is `github.com/shadovxw/auth-sdk`.

## Installation

```bash
go get github.com/shadovxw/auth-sdk
```

## Setup (once per app)

```go
import auth "github.com/shadovxw/auth-sdk"

var client = auth.New(auth.Config{
    ClientID:   "app1",
    AuthServer: "https://auth.shadovx.me",
    // ClientSecret only needed if using Admin APIs
    ClientSecret: os.Getenv("AUTH_CLIENT_SECRET"),
})
```

## Middleware — `client.Middleware()`

```go
// Fiber
app.Use(client.Middleware())

// What it does:
// 1. Reads auth_session cookie from request
// 2. Fetches JWKS from auth.shadovx.me/.well-known/jwks.json (cached 1h, refreshed on kid mismatch)
// 3. Verifies RS256 JWT signature
// 4. Checks exp
// 5. Attaches User to Fiber locals: c.Locals("user", user)
// 6. If invalid/missing: returns 401 JSON { error: "Unauthorized" }
```

## Guards

```go
// Permission guard
app.Get("/posts", client.Require("posts:read"), handler)
app.Post("/posts", client.Require("posts:write"), handler)

// Role guard
app.Delete("/admin/users", client.RequireRole("admin"), handler)

// Multiple permissions (all required)
app.Put("/posts/:id", client.RequireAll("posts:write", "posts:publish"), handler)

// Any of (at least one required)
app.Get("/dashboard", client.RequireAny("admin", "editor"), handler)
```

## GetUser

```go
func Handler(c *fiber.Ctx) error {
    user := auth.GetUser(c)
    // user is *auth.User — never nil here (middleware already validated)
    
    return c.JSON(fiber.Map{
        "id":          user.ID,
        "email":       user.Email,
        "displayName": user.DisplayName,
        "roles":       user.Roles,
        "permissions": user.Permissions,
    })
}
```

## User Type

```go
type User struct {
    ID          string   `json:"sub"`
    Email       string   `json:"email"`
    DisplayName string   `json:"displayName"`
    Avatar      string   `json:"avatar"`
    Provider    string   `json:"provider"`
    Roles       []string `json:"roles"`
    Permissions []string `json:"permissions"`
    App         string   `json:"app"`
    ExpiresAt   int64    `json:"exp"`
}

func (u *User) HasPermission(p string) bool {
    for _, perm := range u.Permissions { if perm == p { return true } }
    return false
}

func (u *User) HasRole(r string) bool {
    for _, role := range u.Roles { if role == r { return true } }
    return false
}
```

## JWKS Caching (`jwks.go`)

```go
// On first request:
//   GET https://auth.shadovx.me/.well-known/jwks.json
//   Parse RSA public keys by kid
//   Cache in memory with 1h TTL

// On JWT validation:
//   Read kid from JWT header
//   Look up in cache → verify signature
//   If kid not in cache → refetch JWKS (handles key rotation)
//   If still not found → 401

// This means:
//   Zero network calls to auth server per request in steady state
//   Automatic key rotation support
```

## Admin API Wrappers (`admin.go`)

```go
// Only needed if your app manages roles/users (most apps won't)
// All calls go to https://auth.shadovx.me/admin/*
// Authenticated via client_secret in Authorization header

client.Admin.GetUsers(ctx)                                            // []User
client.Admin.GetUser(ctx, userID)                                     // User
client.Admin.CreateRole(ctx, auth.CreateRoleInput{Name: "editor", AppID: "app1"})
client.Admin.AssignRole(ctx, userID, roleID, appID)
client.Admin.RemoveRole(ctx, userID, roleID)
client.Admin.AssignGroup(ctx, userID, groupID)
client.Admin.CreatePermission(ctx, auth.CreatePermissionInput{Name: "posts:write"})
client.Admin.GetRoles(ctx)
client.Admin.GetGroups(ctx)
```

---

## Complete Usage Example (app1 backend)

```go
package main

import (
    "github.com/gofiber/fiber/v2"
    auth "github.com/shadovxw/auth-sdk"
    "os"
)

var authClient = auth.New(auth.Config{
    ClientID:   "app1",
    AuthServer: "https://auth.shadovx.me",
})

func main() {
    app := fiber.New()

    // All routes protected
    app.Use(authClient.Middleware())

    // Public user info
    app.Get("/me", func(c *fiber.Ctx) error {
        return c.JSON(auth.GetUser(c))
    })

    // Permission-gated routes
    app.Get("/posts",    authClient.Require("posts:read"),   getPosts)
    app.Post("/posts",   authClient.Require("posts:write"),  createPost)
    app.Delete("/posts", authClient.RequireRole("admin"),    deletePost)

    app.Listen(":8080")
}
```

---

## Complete Usage Example (app1 frontend)

```ts
// middleware.ts — copy-paste, never touch
import { authMiddleware } from '@shadovxw/auth-browser/server'
export default authMiddleware({ authServer: 'https://auth.shadovx.me', clientId: 'app1' })
export const config = { matcher: ['/((?!_next|favicon).*)'] }
```

```ts
// app/api/auth/me/route.ts — copy-paste, never touch
import { getUser } from '@shadovxw/auth-browser/server'
export async function GET() {
  const user = await getUser()
  return Response.json(user ?? null, { status: user ? 200 : 401 })
}
```

```tsx
// Any server component
import { getUser } from '@shadovxw/auth-browser/server'
const user = await getUser()  // that's it

// Any client component
import { useUser } from '@shadovxw/auth-browser'
const user = useUser()  // that's it
```

---

## Build Checklist

### `@shadovxw/auth-browser`
- [ ] TypeScript project setup (tsup for bundling, dual CJS/ESM output)
- [ ] `types.ts` — User, AuthConfig interfaces
- [ ] `server.ts` — getUser() (cookie decode), authMiddleware() (Next.js middleware), hasPermission(), hasRole()
- [ ] `client.ts` — useUser() hook (fetches /api/auth/me), useHasPermission(), useHasRole()
- [ ] `index.ts` — re-export client API
- [ ] Separate entry points: package.json `exports` field for `/server` and `/` paths
- [ ] Publish to npm or private registry

### `github.com/shadovxw/auth-sdk`
- [ ] `types.go` — User, Config structs
- [ ] `jwks.go` — JWKS fetch, cache (sync.Map + TTL), RS256 verify
- [ ] `auth.go` — New(), Middleware() (Fiber), GetUser(), Require(), RequireRole(), RequireAll(), RequireAny()
- [ ] `admin.go` — Admin struct, all API wrapper methods
- [ ] Unit tests for JWT validation + JWKS cache
- [ ] Push to GitHub as Go module
