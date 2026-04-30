import crypto from "node:crypto";

const [, , salt, password] = process.argv;

if (!salt || !password) {
  console.error("Usage: node scripts/hash-password.mjs <salt> <password>");
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
console.log(hash);
