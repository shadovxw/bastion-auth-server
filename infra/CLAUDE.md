# CLAUDE.md — Bastion Infra

> Docker Compose setup, nginx config, and deployment notes for running Bastion on Shipyard.

---

## Services

```
bastion-server    Go auth server                  :3001
bastion-web       Next.js login UI + admin panel  :3002
postgres          PostgreSQL 16                   :5432 (internal only)
redis             Redis 7                         :6379 (internal only)
```

Postgres and Redis are internal — never exposed outside Docker network.

---

## docker-compose.yml

```yaml
version: '3.9'

services:
  bastion-server:
    build: ./server
    container_name: bastion-server
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DATABASE_URL=postgres://bastion:${POSTGRES_PASSWORD}@postgres:5432/bastion
      - REDIS_URL=redis://redis:6379
      - JWT_PRIVATE_KEY_PATH=./keys/private.pem
      - JWT_PUBLIC_KEY_PATH=./keys/public.pem
      - COOKIE_DOMAIN=.shadovx.me
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=https://auth.shadovx.me/oauth/callback/google
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - GITHUB_REDIRECT_URI=https://auth.shadovx.me/oauth/callback/github
    volumes:
      - ./server/keys:/app/keys:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - bastion

  bastion-web:
    build: ./web
    container_name: bastion-web
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      - NEXT_PUBLIC_AUTH_SERVER=https://auth.shadovx.me
      - NEXT_PUBLIC_CLIENT_ID=bastion-web
      - BASTION_SERVER_URL=http://bastion-server:3001
    depends_on:
      - bastion-server
    networks:
      - bastion

  postgres:
    image: postgres:16-alpine
    container_name: bastion-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=bastion
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=bastion
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bastion"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - bastion

  redis:
    image: redis:7-alpine
    container_name: bastion-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - bastion

volumes:
  postgres_data:
  redis_data:

networks:
  bastion:
    driver: bridge
```

---

## Nginx Config (Oracle Cloud VM)

```nginx
# /etc/nginx/sites-available/auth.shadovx.me

server {
    listen 443 ssl;
    server_name auth.shadovx.me;

    ssl_certificate     /etc/letsencrypt/live/shadovx.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shadovx.me/privkey.pem;

    # Login UI + Admin (Next.js)
    location / {
        proxy_pass         http://<zebronics-wireguard-ip>:3002;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Auth server API (Go)
    location ~ ^/(authorize|token|oauth|session|admin|\.well-known) {
        proxy_pass         http://<zebronics-wireguard-ip>:3001;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name auth.shadovx.me;
    return 301 https://$host$request_uri;
}
```

---

## One-Time Setup

```bash
# 1. Generate RS256 keypair
mkdir -p server/keys
openssl genrsa -out server/keys/private.pem 2048
openssl rsa -in server/keys/private.pem -pubout -out server/keys/public.pem

# 2. Create .env
cp .env.example .env
# Fill in: POSTGRES_PASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
#          GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# 3. Start everything
docker compose up -d

# 4. Run DB migrations
docker compose exec bastion-server ./migrate up

# 5. Seed first admin user
# Login via Google/GitHub once to create your user record, then:
docker compose exec bastion-server ./seed-admin --email your@email.com
# This assigns auth:admin permission to your user
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs: `https://auth.shadovx.me/oauth/callback/google`
5. Copy Client ID + Secret to `.env`

## GitHub OAuth Setup

1. GitHub → Settings → Developer settings → OAuth Apps → New
2. Homepage URL: `https://auth.shadovx.me`
3. Callback URL: `https://auth.shadovx.me/oauth/callback/github`
4. Copy Client ID + Secret to `.env`

---

## Registering Apps

After Bastion is running, register each app via the Admin UI or API:

```bash
# Register app1
curl -X POST https://auth.shadovx.me/admin/apps \
  -H "Cookie: auth_session=<your-admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "app1",
    "name": "App One",
    "redirectUris": ["https://app1.shadovx.me/api/auth/callback"]
  }'
# Response includes client_secret — save it, shown only once
```

---

## .env.example

```env
POSTGRES_PASSWORD=change_me_strong_password

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## Volumes + Persistence

| Volume | Contains | Backed up? |
|---|---|---|
| `postgres_data` | All users, roles, permissions, groups | Yes — critical |
| `redis_data` | SSO sessions, refresh tokens | No — ephemeral is fine |
| `server/keys/` | RS256 keypair | Yes — changing keys invalidates all tokens |

---

## Health Checks

```
GET https://auth.shadovx.me/health        → { status: "ok", db: "ok", redis: "ok" }
GET https://auth.shadovx.me/.well-known/jwks.json  → JWKS (public key)
```
