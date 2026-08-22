/**
 * App-side AES-256-GCM for Aadhaar at rest (Task 4, spec §6).
 *
 * - Key from `AADHAAR_ENCRYPTION_KEY` — 32-byte base64 (validate length at startup/lazy).
 * - `encryptAadhaar(plain)` → `v1.<iv>.<tag>.<ciphertext>` (each base64, never project by default).
 * - `decryptAadhaar(cipher)` → plaintext | null (timing-safe failure, never throw).
 * - `aadhaarHash(plain)` → deterministic SHA-256 hex for `students.aadhaar_hash` uniqueness column.
 * - Only decrypt via explicit helper `getAadhaarForAdmin` (RBAC must be checked by caller).
 *
 * Route/query guidance: never `select *` on students; omit `aadhaar_number` from default
 * column lists. Only call `getAadhaarForAdmin` after `assertPermission(user, 'student:write')`
 * or equivalent check.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit recommended for GCM
const AUTH_TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// Key resolution — validate 32-byte base64. Cached after first successful resolve.
// ---------------------------------------------------------------------------
let cachedKey: Buffer | null = null;

export function __resetKeyCacheForTests(): void {
  cachedKey = null;
}

function getKey(): Buffer {
  const b64 = process.env.AADHAAR_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "AADHAAR_ENCRYPTION_KEY is not set. Generate with: openssl rand -base64 32",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(b64, "base64");
  } catch {
    throw new Error("AADHAAR_ENCRYPTION_KEY is not valid base64");
  }
  if (key.length !== 32) {
    throw new Error(
      `AADHAAR_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const k = getKey();
  cachedKey = k;
  return k;
}

/** Validate the configured key without exposing it — useful at startup. */
export function validateAadhaarKey(): { ok: true } | { ok: false; error: string } {
  try {
    resolveKey();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Sensitive column name — never include in default select lists. */
export const AADHAAR_SENSITIVE_COLUMN = "aadhaar_number" as const;

/**
 * Deterministic SHA-256 hex of the plaintext Aadhaar.
 * Used for `students.aadhaar_hash` unique index (ciphertext is non-deterministic).
 * Never throws — returns empty string on unexpected failure (caller should treat as error).
 */
export function aadhaarHash(plain: string | null | undefined): string {
  try {
    if (typeof plain !== "string" || plain.length === 0) return "";
    return createHash("sha256").update(plain, "utf8").digest("hex");
  } catch {
    // Spec: never throw
    return "";
  }
}

/**
 * Encrypt a plaintext Aadhaar number with AES-256-GCM.
 * Returns `v1.<iv_b64>.<tag_b64>.<ciphertext_b64>`.
 * Throws if key is misconfigured (caller should handle at route boundary).
 */
export function encryptAadhaar(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("encryptAadhaar: plain must be a non-empty string");
  }
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  if (tag.length !== AUTH_TAG_LENGTH) {
    // Should not happen for aes-256-gcm, but guard
    throw new Error("Unexpected GCM auth tag length");
  }
  const ivB64 = iv.toString("base64");
  const tagB64 = tag.toString("base64");
  const ctB64 = encrypted.toString("base64");
  return `${VERSION}.${ivB64}.${tagB64}.${ctB64}`;
}

/**
 * Decrypt a `v1.<iv>.<tag>.<ciphertext>` value.
 * Returns plaintext string on success, `null` on any failure (tamper, wrong key, bad format).
 * Never throws.
 */
export function decryptAadhaar(
  ciphertext: string | null | undefined,
): string | null {
  if (typeof ciphertext !== "string" || ciphertext.length === 0) return null;
  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 4 || parts[0] !== VERSION) return null;
    const [, ivB64, tagB64, ctB64] = parts;
    if (!ivB64 || !tagB64 || !ctB64) return null;

    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");

    if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) return null;
    if (ct.length === 0) return null;

    const key = resolveKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // GCM auth failure (tamper/wrong key), base64 errors, missing key — all map to null, never throw
    return null;
  }
}

/**
 * Explicit admin helper: decrypt an `aadhaar_number` ciphertext.
 * **Caller MUST have already asserted RBAC** (e.g. `assertPermission(user, 'student:write')`).
 * This indirection exists so greps/audits can prove Aadhaar is never decrypted on the
 * default read path — only through this named helper.
 */
export function getAadhaarForAdmin(
  ciphertext: string | null | undefined,
): string | null {
  if (!ciphertext) return null;
  return decryptAadhaar(ciphertext);
}

/**
 * Whether a string looks like an encrypted Aadhaar value (format check only, not crypto).
 */
export function isEncryptedAadhaarFormat(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  return parts.length === 4 && parts[0] === VERSION;
}
