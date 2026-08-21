# Cloudflare Serverless Setup (Pages + Functions + D1 + R2)

This project now includes Cloudflare Pages Functions endpoints:

- `POST /api/auth/login`
- `POST /api/images/upload`
- `GET /images/:path` (serve image from R2)

## 1) Create D1 and run schema

```bash
npx wrangler d1 create guardianangel-db
```

Copy the returned `database_id` into `wrangler.toml`.

Run migrations:

```bash
npx wrangler d1 execute guardianangel-db --file=cloudflare/migrations/0001_init.sql
npx wrangler d1 execute guardianangel-db --file=cloudflare/migrations/0002_auth_hardening.sql
```

## 2) Create R2 bucket

```bash
npx wrangler r2 bucket create guardianangel-journal-images
```

## 3) Add Pages bindings in Cloudflare Dashboard

In your Pages project (`guardianangelapp`) -> **Settings** -> **Functions** -> **Bindings**:

- D1 binding:
  - Variable: `DB`
  - Database: `guardianangel-db`
- R2 binding:
  - Variable: `JOURNAL_IMAGES`
  - Bucket: `guardianangel-journal-images`
- Environment variables:
  - `AUTH_SECRET` = a long random secret (used to sign session JWTs)
  - `PASSWORD_SALT` = optional, legacy-only. Only needed temporarily if you have
    existing users whose password_hash predates the PBKDF2 migration; it lets
    login verify their old sha256 hash once and transparently upgrade it.
    New accounts don't use it — each password hash carries its own random salt.

## 4) Deploy

Git-based deploy:

1. Commit and push.
2. Pages will auto-build + auto-deploy.

Manual deploy from local:

```bash
npm run build
npx wrangler pages deploy dist --project-name guardianangelapp --branch main
```

## 5) Seed one user in D1

Passwords are stored as a self-describing PBKDF2 hash
(`pbkdf2$<iterations>$<saltBase64>$<hashBase64>`) with a fresh random salt
per account — generate one with:

```bash
node scripts/hash-password.mjs 1234
```

Then insert:

```sql
INSERT INTO users (username, password_hash)
VALUES ('demo_user', 'REPLACE_WITH_PBKDF2_HASH');
```

Execute:

```bash
npx wrangler d1 execute guardianangel-db --command "INSERT INTO users (username, password_hash) VALUES ('demo_user','REPLACE_WITH_PBKDF2_HASH')"
```

## 6) API examples

Login:

```bash
curl -X POST https://guardianangelapp.pages.dev/api/auth/login \
  -H "content-type: application/json" \
  -d "{\"username\":\"demo_user\",\"password\":\"123456\"}"
```

Upload image:

```bash
curl -X POST https://guardianangelapp.pages.dev/api/images/upload \
  -H "content-type: application/json" \
  -H "authorization: Bearer <TOKEN>" \
  -d "{\"imageBase64\":\"<BASE64>\",\"contentType\":\"image/jpeg\"}"
```

Response contains:

- `url` - direct image URL (served by `/images/...`)

## 7) Connect from your Expo app

Use this base URL in app code:

- Production: `https://guardianangelapp.pages.dev`

Then call:

- `POST /api/auth/login`
- `POST /api/images/upload` (with Bearer token)

If needed, store the token in `expo-secure-store`.
