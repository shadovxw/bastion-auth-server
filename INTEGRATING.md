# Bastion — Integration Guide

> How to authenticate users in any app on the `shadovx.me` platform.
> Give this file to Claude when building a new app so it understands the auth system.

---

## What Bastion Is

Bastion is the single identity provider for the entire `shadovx.me` platform. It runs at `auth.shadovx.me` and is the only service that:

- Runs Google / GitHub OAuth flows
- Creates and looks up user accounts
- Resolves roles and permissions (RBAC)
- Signs JWTs (RS256)
- Maintains SSO sessions (Redis)

**Apps never write auth logic.** They register with Bastion, redirect unauthenticated users to Bastion, and validate the JWT that comes back.

---

## Core Concepts Before You Build

### 1. Single user pool
There is one `users` table across the entire platform. If a user has ever signed in to any `shadovx.me` app, their account already exists. No duplicate accounts across apps.

### 2. No passwords
Authentication is Google or GitHub only. Bastion never stores passwords.

### 3. Roles and permissions are stamped into the JWT at login time
When Bastion issues a token for `app1`, it resolves every role and permission the user has (platform-wide + app1-scoped) and writes them directly into the JWT claims. The backend validates the JWT locally — there is no call to Bastion per request.

This means: if you change a user's roles, they need to re-authenticate to get a token with the updated roles.

### 4. Platform-wide vs app-scoped
- A role/permission with `app_id = NULL` applies to every app the user logs into.
- A role/permission with `app_id = "app1"` only appears in tokens issued for `app1`.

---

## Step 1 — Register Your App

Before writing any code, register the app in Bastion.

**In the Bastion admin panel** (`auth.shadovx.me/admin`):
1. Go to **Dashboard → click "New App"**
2. Set **App ID** — a short lowercase identifier, e.g. `blog`, `shipyard`, `notes`
3. Set **Name** — human-readable, e.g. `Blog`
4. Set **Redirect URIs** — the URL Bastion sends the user back to after login

   - Web: `https://blog.shadovx.me/api/auth/callback` (or whatever path handles the callback)
   - Mobile: a deep link scheme, e.g. `blog://auth/callback`

5. Save. Copy the **client secret** shown once — store it securely.

You now have:
- `client_id` — the App ID you chose (e.g. `blog`)
- `client_secret` — shown once at creation

---

## The JWT

Every token Bastion issues is RS256-signed. The payload looks like this:

```json
{
  "sub":         "550e8400-e29b-41d4-a716-446655440000",
  "email":       "user@gmail.com",
  "displayName": "Vrishank",
  "avatar":      "https://lh3.googleusercontent.com/...",
  "provider":    "google",
  "roles":       ["editor", "member"],
  "permissions": ["posts:read", "posts:write"],
  "app":         "blog",
  "iat":         1700000000,
  "exp":         1700003600
}
```

| Field | Type | Description |
|---|---|---|
| `sub` | UUID string | User ID — stable across all apps |
| `email` | string | User's email address |
| `displayName` | string | User's display name |
| `avatar` | string | Avatar URL (may be empty) |
| `provider` | string | `"google"` or `"github"` |
| `roles` | string[] | All roles for this user in this app (platform-wide + app-scoped) |
| `permissions` | string[] | All permissions resolved from those roles |
| `app` | string | The `client_id` this token was issued for |
| `iat` | Unix timestamp | Issued at |
| `exp` | Unix timestamp | Expires at (default 1 hour after issue) |

**The public key** to verify this token is at:
```
GET https://auth.shadovx.me/.well-known/jwks.json
```

Cache this response. It only changes on key rotation. SDKs should refresh it every hour.

---

## Web App Integration (Next.js on `*.shadovx.me`)

This is the simplest path. Because all apps run on `*.shadovx.me`, Bastion can set a cookie with `Domain=.shadovx.me` that is automatically sent to every subdomain.

### How the cookie works

When a user authenticates, Bastion sets:

```
Set-Cookie: auth_session=<JWT>; Domain=.shadovx.me; Path=/; HttpOnly; Secure; SameSite=Lax; MaxAge=3600
```

Your app at `blog.shadovx.me` receives this cookie on every request automatically. You never touch a token manually.

### The auth flow

```
1. User visits blog.shadovx.me/some-page
2. Your Next.js middleware checks for auth_session cookie
   → cookie missing or expired? → redirect to Bastion
3. Redirect to:
   https://auth.shadovx.me/authorize?client_id=blog&return_to=https://blog.shadovx.me/some-page
4. Bastion checks its own SSO session (Redis)
   → SSO session valid? → skip login, go to step 7
   → No SSO session? → show Google/GitHub login buttons
5. User clicks "Continue with Google" → Google OAuth
6. Bastion gets user info from Google, upserts user, resolves RBAC for "blog"
7. Bastion signs JWT, sets auth_session cookie (Domain=.shadovx.me), sets SSO session
8. Bastion redirects → https://blog.shadovx.me/some-page (the return_to URL)
9. Browser sends request to blog.shadovx.me/some-page with auth_session cookie attached
10. Your middleware reads cookie → user is authenticated
```

The user only sees the login screen on their very first login. After that, step 4 hits the SSO session and the whole flow is invisible — they're redirected back to your app in milliseconds.

### Next.js middleware (`middleware.ts`)

Using the `@shadovxw/auth-browser` SDK (to be published to npm):

```ts
// middleware.ts (at project root)
import { authMiddleware } from "@shadovxw/auth-browser/server"

export default authMiddleware({
  clientId: "blog",
  bastionUrl: "https://auth.shadovx.me",
  // Routes that don't require auth — default is []
  publicPaths: ["/", "/about"],
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

If the SDK is not yet published, implement it manually:

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server"

const BASTION = "https://auth.shadovx.me"
const CLIENT_ID = "blog"

function decodeJWT(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    if (payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("auth_session")?.value
  const user = token ? decodeJWT(token) : null

  if (!user) {
    const returnTo = encodeURIComponent(req.url)
    return NextResponse.redirect(
      `${BASTION}/authorize?client_id=${CLIENT_ID}&return_to=${returnTo}`
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
}
```

> **Important**: Never decode the JWT for security decisions in client components — always do it server-side.

### Reading the user in server components / API routes

```ts
// app/some-page/page.tsx  (server component)
import { cookies } from "next/headers"

function decodeJWT(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    if (payload.exp < Date.now() / 1000) return null
    return payload
  } catch { return null }
}

export default async function SomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_session")?.value
  const user = token ? decodeJWT(token) : null

  // user.sub          — UUID
  // user.email
  // user.displayName
  // user.roles        — string[]
  // user.permissions  — string[]

  return <div>Hello, {user?.displayName}</div>
}
```

Or using the SDK:

```ts
import { getUser } from "@shadovxw/auth-browser/server"

export default async function SomePage() {
  const user = await getUser()   // null if not authenticated
  return <div>Hello, {user?.displayName}</div>
}
```

### Reading the user in client components

```tsx
"use client"
import { useUser } from "@shadovxw/auth-browser"

export function ProfileButton() {
  const { user, isLoading } = useUser()
  if (isLoading) return null
  if (!user) return <a href="/api/auth/login">Sign in</a>
  return <span>{user.displayName}</span>
}
```

The `useUser` hook calls a lightweight API route (e.g. `/api/auth/me`) that reads the cookie server-side and returns the user payload. The JWT itself never touches client-side JavaScript.

### Checking permissions

```ts
// In a server component or API route
const user = await getUser()

if (!user?.permissions.includes("posts:write")) {
  // return 403 or redirect
}
```

```tsx
// In a client component
const { user } = useUser()
const canWrite = user?.permissions.includes("posts:write") ?? false
```

### Logging out

```ts
// app/api/auth/logout/route.ts
export async function POST() {
  await fetch("https://auth.shadovx.me/session/logout", {
    method: "POST",
    credentials: "include",
  })
  // Bastion clears its SSO session and the shared cookie
  return redirect("/")
}
```

Or just call `/session/logout` directly from the client:

```ts
await fetch("https://auth.shadovx.me/session/logout", {
  method: "POST",
  credentials: "include",
})
window.location.href = "/"
```

---

## Go Backend Integration (API server for a web app)

If your app has a separate Go API server (not Next.js), use the Go SDK:

```go
import "github.com/shadovxw/auth-sdk"

func main() {
    bastionClient := auth.New("https://auth.shadovx.me")

    app := fiber.New()
    
    // Protect all routes — validates JWT from auth_session cookie OR Authorization header
    app.Use(bastionClient.Middleware())

    app.Get("/api/posts", func(c *fiber.Ctx) error {
        user := auth.GetUser(c)        // *auth.User — never nil here (middleware guarantees it)
        _ = user.Sub                   // UUID string
        _ = user.Email
        _ = user.DisplayName
        _ = user.Roles                 // []string
        _ = user.Permissions           // []string
        return c.JSON(fiber.Map{"user": user})
    })

    // Guard a specific permission
    app.Post("/api/posts", bastionClient.RequirePermission("posts:write"), createPostHandler)
}
```

The SDK:
1. Reads the `auth_session` cookie (web) or `Authorization: Bearer <token>` header (mobile/API)
2. Fetches and caches JWKS from `auth.shadovx.me/.well-known/jwks.json` (refreshes every hour)
3. Validates the RS256 signature locally — no network call to Bastion per request
4. Rejects expired tokens
5. Attaches user to request context

---

## Mobile App Integration (iOS / Android / React Native / Flutter)

Mobile apps cannot use `HttpOnly` cookies, and they run outside the `shadovx.me` domain. The flow is different.

### Key differences from web

| | Web | Mobile |
|---|---|---|
| Token delivery | Cookie (automatic) | JSON response body |
| Token storage | Browser manages cookie | App stores in secure storage |
| Token attachment | Cookie (automatic) | `Authorization: Bearer` header |
| Redirect callback | HTTPS URL | Deep link / custom scheme |
| SSO | Shared cookie across subdomains | Per-app; SSO via device browser session |

### What Bastion needs to expose for mobile

> **These endpoints need to be built in Bastion server — they don't exist yet.** Add them when building mobile support.

```
# Mobile OAuth entry — starts PKCE flow
GET  /oauth/mobile/start?client_id=blog&code_challenge=<sha256>&code_challenge_method=S256&redirect_uri=blog://auth/callback

# Mobile token exchange — exchanges code for JSON tokens (no cookie)
POST /oauth/mobile/token
     { client_id, code, code_verifier, redirect_uri }
     → { access_token, refresh_token, expires_in, user }

# Mobile token refresh
POST /oauth/mobile/refresh
     { client_id, refresh_token }
     → { access_token, expires_in }

# Revoke (logout)
POST /oauth/mobile/revoke
     { client_id, refresh_token }
```

The mobile endpoints return JSON — no `Set-Cookie`. The access token is a standard Bastion JWT (same structure, same RS256 signature) so backend validation is identical.

### PKCE flow (Proof Key for Code Exchange)

PKCE prevents auth code interception attacks on mobile. It works like this:

```
1. App generates a random code_verifier (43–128 char random string)
2. App computes code_challenge = BASE64URL(SHA256(code_verifier))
3. App opens system browser / WebView with Bastion's mobile authorize URL
4. User logs in with Google or GitHub in the browser
5. Bastion redirects to your deep link: blog://auth/callback?code=abc123
6. App intercepts the deep link, extracts the code
7. App sends POST /oauth/mobile/token with code + code_verifier
8. Bastion verifies SHA256(code_verifier) == stored code_challenge → exchanges for tokens
9. App receives { access_token, refresh_token, expires_in, user }
10. App stores tokens in secure storage
```

### React Native example

```tsx
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import * as SecureStore from "expo-secure-store"
import { generatePKCE } from "./pkce"   // util — see below

const BASTION = "https://auth.shadovx.me"
const CLIENT_ID = "blog"
const REDIRECT_URI = Linking.createURL("auth/callback")

async function signIn() {
  const { codeVerifier, codeChallenge } = await generatePKCE()

  // Store verifier — needed for the token exchange
  await SecureStore.setItemAsync("pkce_verifier", codeVerifier)

  const url =
    `${BASTION}/oauth/mobile/start` +
    `?client_id=${CLIENT_ID}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`

  const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI)

  if (result.type === "success") {
    const code = new URL(result.url).searchParams.get("code")!
    await exchangeCode(code)
  }
}

async function exchangeCode(code: string) {
  const codeVerifier = await SecureStore.getItemAsync("pkce_verifier")

  const res = await fetch(`${BASTION}/oauth/mobile/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI }),
  })

  const data = await res.json()
  // { access_token, refresh_token, expires_in, user }

  await SecureStore.setItemAsync("access_token", data.access_token)
  await SecureStore.setItemAsync("refresh_token", data.refresh_token)
  await SecureStore.setItemAsync("user", JSON.stringify(data.user))
}
```

#### PKCE utility

```ts
// pkce.ts
import * as Crypto from "expo-crypto"

export async function generatePKCE() {
  const randomBytes = await Crypto.getRandomBytesAsync(32)
  const codeVerifier = base64url(randomBytes)

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  )
  const codeChallenge = hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

  return { codeVerifier, codeChallenge }
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}
```

### Calling your API from mobile

Once the app has an `access_token`:

```ts
async function apiFetch(path: string, options: RequestInit = {}) {
  let token = await SecureStore.getItemAsync("access_token")

  // Refresh if expired
  const payload = JSON.parse(atob(token!.split(".")[1]))
  if (payload.exp < Date.now() / 1000 + 60) {
    token = await refreshAccessToken()
  }

  const res = await fetch(`https://api.blog.shadovx.me${path}`, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (res.status === 401) {
    // Token rejected — send user back to login
    await signOut()
    throw new Error("Session expired")
  }

  return res.json()
}

async function refreshAccessToken() {
  const refreshToken = await SecureStore.getItemAsync("refresh_token")
  const res = await fetch(`${BASTION}/oauth/mobile/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, refresh_token: refreshToken }),
  })
  const data = await res.json()
  await SecureStore.setItemAsync("access_token", data.access_token)
  return data.access_token as string
}

async function signOut() {
  const refreshToken = await SecureStore.getItemAsync("refresh_token")
  await fetch(`${BASTION}/oauth/mobile/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, refresh_token: refreshToken }),
  })
  await SecureStore.deleteItemAsync("access_token")
  await SecureStore.deleteItemAsync("refresh_token")
  await SecureStore.deleteItemAsync("user")
}
```

### Native iOS (Swift)

```swift
import AuthenticationServices
import Security

class BastionAuth: NSObject, ASWebAuthenticationPresentationContextProviding {

    let bastionURL = "https://auth.shadovx.me"
    let clientId   = "blog"
    let redirectURI = "blog://auth/callback"

    func signIn() {
        let (verifier, challenge) = generatePKCE()
        KeychainHelper.save(verifier, key: "pkce_verifier")

        var components = URLComponents(string: "\(bastionURL)/oauth/mobile/start")!
        components.queryItems = [
            .init(name: "client_id",              value: clientId),
            .init(name: "code_challenge",         value: challenge),
            .init(name: "code_challenge_method",  value: "S256"),
            .init(name: "redirect_uri",           value: redirectURI),
        ]

        let session = ASWebAuthenticationSession(
            url: components.url!,
            callbackURLScheme: "blog"
        ) { callbackURL, error in
            guard let code = URLComponents(url: callbackURL!, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "code" })?.value
            else { return }
            self.exchangeCode(code)
        }
        session.presentationContextProvider = self
        session.start()
    }

    func exchangeCode(_ code: String) {
        let verifier = KeychainHelper.load(key: "pkce_verifier")!
        var req = URLRequest(url: URL(string: "\(bastionURL)/oauth/mobile/token")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try! JSONSerialization.data(withJSONObject: [
            "client_id":     clientId,
            "code":          code,
            "code_verifier": verifier,
            "redirect_uri":  redirectURI,
        ])
        URLSession.shared.dataTask(with: req) { data, _, _ in
            let json = try! JSONSerialization.jsonObject(with: data!) as! [String: Any]
            KeychainHelper.save(json["access_token"] as! String,  key: "access_token")
            KeychainHelper.save(json["refresh_token"] as! String, key: "refresh_token")
        }.resume()
    }

    // ASWebAuthenticationPresentationContextProviding
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.windows.first!
    }
}
```

Store tokens in **Keychain** (never UserDefaults). Attach the access token to API calls:

```swift
var request = URLRequest(url: url)
request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
```

### Native Android (Kotlin)

Use **AppAuth for Android** (`net.openid:appauth`):

```kotlin
val serviceConfig = AuthorizationServiceConfiguration(
    Uri.parse("$BASTION/oauth/mobile/start"),
    Uri.parse("$BASTION/oauth/mobile/token")
)

// Build request with PKCE (AppAuth generates verifier/challenge automatically)
val request = AuthorizationRequest.Builder(
    serviceConfig,
    CLIENT_ID,
    ResponseTypeValues.CODE,
    Uri.parse("blog://auth/callback")
).build()

val authService = AuthorizationService(context)
val intent = authService.getAuthorizationRequestIntent(request)
startActivityForResult(intent, RC_AUTH)

// In onActivityResult:
val response = AuthorizationResponse.fromIntent(data!!)
authService.performTokenRequest(response.createTokenExchangeRequest()) { tokenResponse, _ ->
    val accessToken = tokenResponse?.accessToken
    val refreshToken = tokenResponse?.refreshToken
    // Store in EncryptedSharedPreferences or Android Keystore
}
```

---

## Backend JWT Validation (any language)

All Bastion JWTs are RS256. Validate them using the JWKS endpoint. Here's how to do it in common languages.

### Go (using the SDK)

```go
bastionClient := auth.New("https://auth.shadovx.me")

// In your HTTP handler:
app.Use(bastionClient.Middleware())

// In a protected handler:
user := auth.GetUser(c)
fmt.Println(user.Email, user.Permissions)
```

### Go (manual, without SDK)

```go
import (
    "github.com/golang-jwt/jwt/v5"
    "github.com/lestrrat-go/jwx/v2/jwk"
)

var jwkSet jwk.Set   // cached, refresh every hour

func init() {
    set, _ := jwk.Fetch(context.Background(), "https://auth.shadovx.me/.well-known/jwks.json")
    jwkSet = set
}

func validateToken(tokenStr string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
        kid, _ := t.Header["kid"].(string)
        key, ok := jwkSet.LookupKeyID(kid)
        if !ok { return nil, errors.New("key not found") }
        var raw interface{}
        key.Raw(&raw)
        return raw, nil
    })
    if err != nil { return nil, err }
    return token.Claims.(*Claims), nil
}
```

### Node.js / TypeScript

```ts
import * as jose from "jose"

const JWKS = jose.createRemoteJWKSet(
  new URL("https://auth.shadovx.me/.well-known/jwks.json")
)

async function validateToken(token: string) {
  const { payload } = await jose.jwtVerify(token, JWKS, {
    algorithms: ["RS256"],
  })
  return payload as {
    sub: string
    email: string
    displayName: string
    avatar: string
    provider: string
    roles: string[]
    permissions: string[]
    app: string
  }
}
```

### Python

```python
import httpx
from jose import jwt, jwk
from jose.utils import base64url_decode
import json

_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        resp = httpx.get("https://auth.shadovx.me/.well-known/jwks.json")
        _jwks_cache = resp.json()["keys"]
    return _jwks_cache

def validate_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    keys = get_jwks()
    key = next(k for k in keys if k["kid"] == header["kid"])
    public_key = jwk.construct(key)
    return jwt.decode(token, public_key, algorithms=["RS256"])
```

### Getting the token

**From a web request (cookie):**
```python
token = request.cookies.get("auth_session")
```

**From a mobile/API request (header):**
```python
auth_header = request.headers.get("Authorization", "")
token = auth_header.removeprefix("Bearer ").strip()
```

---

## Environment Variables Your App Needs

```env
# The app ID you registered in Bastion admin
BASTION_CLIENT_ID=blog

# The client secret shown at app creation (backend only — never expose to frontend)
BASTION_CLIENT_SECRET=<secret>

# Bastion public URL
BASTION_URL=https://auth.shadovx.me

# For Next.js frontend — can be public
NEXT_PUBLIC_AUTH_SERVER=https://auth.shadovx.me
```

---

## RBAC — Using Roles and Permissions

### Setting up roles for your app

In the Bastion admin panel, under your app:
1. Go to **Roles → New Role** — creates a role scoped to your app
2. Go to **Permissions → New Permission** — creates a permission like `posts:write` scoped to your app
3. Go to **Roles → [your role] → add permissions** — assign permissions to the role
4. Go to **Users → [user] → assign role** — give the user the role, scoped to your app

### Checking permissions in code

```ts
// Next.js server component
const user = await getUser()
if (!user.permissions.includes("posts:write")) {
  return notFound()
}
```

```go
// Go API server — using SDK middleware
app.Delete("/api/posts/:id",
    bastionClient.RequirePermission("posts:delete"),
    deletePostHandler,
)
```

```ts
// React Native — hide UI elements
const canWrite = user?.permissions.includes("posts:write") ?? false
{canWrite && <Button title="New Post" onPress={createPost} />}
```

### Permission naming convention

Use `resource:action` format:

```
posts:read
posts:write
posts:delete
users:manage
settings:read
settings:write
```

Platform-wide permissions (no app scope) use the same format:
```
auth:admin      — Bastion admin panel access
platform:owner  — top-level platform permission
```

---

## Common Patterns

### Redirect to login and come back

```ts
// Always pass the current URL as return_to so the user lands back where they started
const loginUrl = `https://auth.shadovx.me/authorize?client_id=blog&return_to=${encodeURIComponent(req.url)}`
```

### Protect a specific page (Next.js server component)

```ts
import { redirect } from "next/navigation"
import { getUser } from "@shadovxw/auth-browser/server"

export default async function AdminPage() {
  const user = await getUser()
  if (!user) redirect("/")
  if (!user.permissions.includes("settings:write")) redirect("/")

  return <AdminPanel user={user} />
}
```

### Optimistic UI — show content while checking auth

```tsx
"use client"
import { useUser } from "@shadovxw/auth-browser"

export function PostActions({ postId }: { postId: string }) {
  const { user, isLoading } = useUser()

  if (isLoading) return <Skeleton />

  return (
    <div>
      {user?.permissions.includes("posts:write") && (
        <Button onClick={() => editPost(postId)}>Edit</Button>
      )}
      {user?.permissions.includes("posts:delete") && (
        <Button variant="destructive" onClick={() => deletePost(postId)}>Delete</Button>
      )}
    </div>
  )
}
```

---

## What Bastion Does NOT Do

- **No magic link / email login** — Google and GitHub only
- **No user registration form** — accounts are created automatically on first OAuth login
- **No session data storage on your app** — the JWT is the session
- **No per-request auth server calls** — validation is local using the cached public key
- **No two-factor auth** — deferred to the identity provider (Google/GitHub enforce their own MFA)
- **No fine-grained attribute-based access** — RBAC only (roles + permissions)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Cookie not sent to your app | App not on `*.shadovx.me` | Only works for subdomains of `shadovx.me` |
| `401 Unauthorized` from API | Token expired (1h TTL) | Refresh or re-authenticate |
| Roles/permissions wrong | User's roles changed after login | User must re-authenticate to get updated JWT |
| `invalid_redirect_uri` from Bastion | URI not registered | Add it in Bastion admin → app settings |
| SSO not working (login shown every time) | SSO session expired (24h TTL) | Expected — user re-authenticates |
| `jwks_key_not_found` | JWKS cache is stale | Force-refresh JWKS cache |

---

## Quick Reference

| What you need | Where |
|---|---|
| Register your app | `auth.shadovx.me/admin` → Dashboard → New App |
| Login / SSO entry point | `GET https://auth.shadovx.me/authorize?client_id=<id>&return_to=<url>` |
| Logout | `POST https://auth.shadovx.me/session/logout` |
| JWKS (public key) | `GET https://auth.shadovx.me/.well-known/jwks.json` |
| Mobile OAuth start | `GET https://auth.shadovx.me/oauth/mobile/start` |
| Mobile token exchange | `POST https://auth.shadovx.me/oauth/mobile/token` |
| Mobile token refresh | `POST https://auth.shadovx.me/oauth/mobile/refresh` |
| Browser SDK | `@shadovxw/auth-browser` (npm) |
| Go SDK | `github.com/shadovxw/auth-sdk` |
| Cookie name | `auth_session` |
| Cookie domain | `.shadovx.me` |
| JWT algorithm | RS256 |
| Access token TTL | 1 hour |
| Refresh token TTL | 30 days |
| SSO session TTL | 24 hours |
