import crypto from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH_BYTES = 32; // 256 bits
const DIGEST = "sha256";

const [, , password] = process.argv;

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH_BYTES, DIGEST);

// Matches functions/_lib/auth.ts's hashPassword() output format exactly —
// self-describing, so no separate salt column or global secret is needed.
console.log(`pbkdf2$${ITERATIONS}$${salt.toString("base64")}$${derived.toString("base64")}`);
