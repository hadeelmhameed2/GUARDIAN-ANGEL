-- Adds per-account failed-login tracking used by /api/auth/login rate limiting.
-- Run with: wrangler d1 execute <DB_NAME> --file=cloudflare/migrations/0002_auth_hardening.sql

ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
