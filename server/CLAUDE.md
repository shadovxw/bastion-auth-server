# CLAUDE.md — Bastion Server

> Go backend — the auth engine. JWT signing, OAuth flows, SSO sessions, RBAC resolution, admin APIs.

---

## What This Service Does

Everything auth-related that requires trust:
- Runs Google + GitHub OAuth flows
- Upserts users on first login
- Resolves roles + permissions per user per app
- Signs JWTs (RS256)
- Manages SSO sessions (Redis)
- Exposes JWKS endpoint for SDK validation
- Exposes all admin CRUD APIs

This is the only service that touches the database and Redis. SDKs validate JWTs locally against JWKS — they never call this server per request.

---

## Tech Stack

| | |
|---|---|
| Language | Go 1.22+ |
| HTTP Framework | Fiber v2 |
| ORM | GORM |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| JWT | golang-jwt/jwt v5 (RS256) |
| OAuth | golang.org/x/oauth2 |
| Migrations | golang-migrate |
| Config | godotenv |
| Dev reload | air |

---

## Project Structure

```
server/
├── cmd/
│   └── main.go                    Entry point — wire everything, start Fiber
├── internal/
│   ├── config/
│   │   └── config.go              Load + validate env vars into Config struct
│   ├── db/
│   │   ├── postgres.go            GORM connection setup
│   │   ├── redis.go               Redis client setup
│   │   └── migrations/
│   │       ├── 001_create_apps.sql
│   │       ├── 002_create_users.sql
│   │       ├── 003_create_roles.sql
│   │       ├── 004_create_permissions.sql
│   │       ├── 005_create_groups.sql
│   │       └── 006_create_join_tables.sql
│   ├── models/
│   │   ├── user.go
│   │   ├── app.go
│   │   ├── role.go
│   │   ├── permission.go
│   │   └── group.go
│   ├── services/
│   │   ├── token.go               RS256 keypair load, JWT sign, JWKS generation
│   │   ├── oauth/
│   │   │   ├── google.go          Google OAuth config + user info fetch
│   │   │   └── github.go          GitHub OAuth config + user info fetch
│   │   ├── user.go                Upsert user, fetch user by provider
│   │   ├── rbac.go                Resolve roles + permissions for user + app
│   │   └── session.go             Redis SSO session CRUD
│   ├── handlers/
│   │   ├── authorize.go           GET /authorize
│   │   ├── token.go               POST /token
│   │   ├── oauth.go               GET /oauth/start/:provider, GET /oauth/callback/:provider
│   │   ├── session.go             POST /session/logout
│   │   ├── jwks.go                GET /.well-known/jwks.json
│   │   └── admin/
│   │       ├── apps.go
│   │       ├── users.go
│   │       ├── roles.go
│   │       ├── permissions.go
│   │       └── groups.go
│   └── middleware/
│       ├── auth.go                Validate JWT from cookie, attach user to ctx
│       ├── admin.go               Require auth:admin permission
│       └── cors.go
├── keys/
│   ├── private.pem                RS256 private key (gitignored)
│   └── public.pem                 RS256 public key
├── Dockerfile
├── .air.toml
└── go.mod
```

---

## Routes

```
# OAuth entry + SSO
GET  /authorize                          Entry from apps → check SSO or show login
GET  /oauth/start/google                 Redirect to Google
GET  /oauth/start/github                 Redirect to GitHub
GET  /oauth/callback/google              Handle Google return
GET  /oauth/callback/github              Handle GitHub return
POST /session/logout                     Destroy SSO session + clear cookie
GET  /.well-known/jwks.json              Public keys for JWT validation

# Admin — all require auth:admin permission
GET    /admin/apps
POST   /admin/apps
PUT    /admin/apps/:id
DELETE /admin/apps/:id

GET    /admin/users
GET    /admin/users/:id
DELETE /admin/users/:id
POST   /admin/users/:id/roles            { roleId, appId? }
DELETE /admin/users/:id/roles/:roleId
POST   /admin/users/:id/groups           { groupId }
DELETE /admin/users/:id/groups/:groupId

GET    /admin/roles
POST   /admin/roles                      { name, appId? }
PUT    /admin/roles/:id
DELETE /admin/roles/:id
POST   /admin/roles/:id/permissions      { permissionIds[] }
DELETE /admin/roles/:id/permissions/:permId

GET    /admin/permissions
POST   /admin/permissions                { name, appId? }
DELETE /admin/permissions/:id

GET    /admin/groups
POST   /admin/groups
PUT    /admin/groups/:id
DELETE /admin/groups/:id
POST   /admin/groups/:id/roles           { roleIds[] }
DELETE /admin/groups/:id/roles/:roleId
```

---

## Key Service Logic

### token.go — JWT Signing
```go
// Load RS256 keypair from disk on startup
// Sign JWT with claims:
//   sub, email, displayName, avatar, provider,
//   roles[], permissions[], app, iat, exp
// Expose public key as JWKS JSON
// Key ID (kid) in JWKS header so SDK can match on rotation
```

### rbac.go — Permission Resolution
```go
// Given (userID, appID):
// 1. Fetch direct user_roles where app_id = appID OR app_id IS NULL
// 2. Fetch user_groups → group_roles where same scoping
// 3. Union all role IDs
// 4. Fetch all permissions for those roles
// 5. Return deduplicated []roles, []permissions
// This runs once at login — result is stamped into JWT
```

### session.go — SSO Session (Redis)
```go
// Key:   sso:<session_id>
// Value: { userID, createdAt }
// TTL:   24h (configurable)
// On /authorize: check cookie sso_session → GET from Redis
//   hit  → skip login, resolve permissions, issue JWT, redirect
//   miss → show login page
// On /oauth/callback: SET session after successful login
// On /session/logout: DEL session + clear cookie
```

### oauth/google.go
```go
// Exchange code for token
// Fetch https://www.googleapis.com/oauth2/v3/userinfo
// Return: { email, sub (provider_id), name (displayName), picture (avatar) }
```

### oauth/github.go
```go
// Exchange code for token
// Fetch https://api.github.com/user
// Fetch https://api.github.com/user/emails (for primary email)
// Return: { email, id (provider_id), name (displayName), avatar_url (avatar) }
```

### user.go — Upsert Logic
```go
// Lookup by (provider, provider_id)
//   found  → return existing user (update display_name + avatar if changed)
//   not found → check if email exists (different provider, same email)
//     found  → link provider to existing account (merge)
//     not found → INSERT new user
```

---

## Cookie Spec

```
Name:     auth_session
Value:    <signed RS256 JWT>
Domain:   .shadovx.me
Path:     /
HttpOnly: true
Secure:   true
SameSite: Lax
MaxAge:   3600 (1 hour — access token TTL)
```

Refresh token stored separately as `auth_refresh` cookie, same flags, MaxAge 30 days.

---

## Models

```go
type User struct {
    ID          uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Email       string    `gorm:"uniqueIndex;not null"`
    DisplayName string    `gorm:"not null"`
    Avatar      string
    Provider    string    `gorm:"not null"` // 'google' | 'github'
    ProviderID  string    `gorm:"not null"`
    CreatedAt   time.Time
}

type App struct {
    ID           string   `gorm:"primaryKey"`
    Name         string   `gorm:"not null"`
    ClientSecret string   `gorm:"not null"` // bcrypt hashed
    RedirectURIs pq.StringArray `gorm:"type:text[]"`
    CreatedAt    time.Time
}

type Role struct {
    ID        uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Name      string    `gorm:"not null"`
    AppID     *string   // null = platform-wide
    App       *App
}

type Permission struct {
    ID    uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Name  string    `gorm:"not null"` // 'posts:write'
    AppID *string
    App   *App
}

type Group struct {
    ID   uuid.UUID `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Name string    `gorm:"uniqueIndex;not null"`
}
```

---

## Environment Variables

```env
PORT=3001
DATABASE_URL=postgres://bastion:password@postgres:5432/bastion
REDIS_URL=redis://redis:6379

JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TTL_SECONDS=3600
JWT_REFRESH_TTL_DAYS=30

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

---

## Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o bastion-server ./cmd/main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/bastion-server .
COPY keys/ ./keys/
EXPOSE 3001
CMD ["./bastion-server"]
```

---

## Dev Setup

```bash
# Generate RS256 keypair (run once)
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Start dependencies
docker compose up postgres redis -d

# Run migrations
migrate -path internal/db/migrations -database $DATABASE_URL up

# Dev server with hot reload
air
```

---

## Build Checklist

- [ ] Config loader — fail fast on missing env vars
- [ ] GORM models + AutoMigrate (dev) / golang-migrate (prod)
- [ ] RS256 keypair loader + JWKS endpoint
- [ ] Google OAuth flow
- [ ] GitHub OAuth flow
- [ ] User upsert service (with merge logic)
- [ ] SSO session service (Redis)
- [ ] RBAC resolution service
- [ ] JWT signing with full claims
- [ ] Cookie setter (Domain=.shadovx.me, HttpOnly, Secure)
- [ ] /authorize handler (SSO check → login redirect)
- [ ] All admin CRUD handlers
- [ ] auth:admin guard middleware
- [ ] Refresh token rotation
- [ ] Rate limiting (fiber/limiter)
