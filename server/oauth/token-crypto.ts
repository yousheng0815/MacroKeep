import * as crypto from "node:crypto";

const ALGO = "aes-256-gcm";

export function encryptRefreshToken(
  plaintext: string,
  keyBase64: string,
): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptRefreshToken(
  blobBase64: string,
  keyBase64: string,
): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  }
  const buf = Buffer.from(blobBase64, "base64");
  if (buf.length < 12 + 16) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
