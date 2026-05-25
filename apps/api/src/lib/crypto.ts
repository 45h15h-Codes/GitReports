import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
}

function getKey(): Buffer {
  if (!ENCRYPTION_KEY) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

/**
 * Encrypts a GitHub access token with AES-256-GCM.
 * SECURITY: tokens must NEVER be stored or logged in plaintext.
 */
export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encryptedData — all base64
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a stored token to call the GitHub API.
 * Only called server-side — NEVER returned to client JS.
 */
export function decryptToken(stored: string): string {
  const [ivB64, authTagB64, encryptedB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64)
    throw new Error("Invalid token format");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
