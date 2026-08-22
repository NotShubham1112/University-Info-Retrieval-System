import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";

// Generate a valid 32-byte base64 key for each test run
function genKeyB64(): string {
  return randomBytes(32).toString("base64");
}

function genOtherKeyB64(): string {
  let k: string;
  do {
    k = randomBytes(32).toString("base64");
    // ensure different from current env key with overwhelming probability
  } while (k === process.env.AADHAAR_ENCRYPTION_KEY);
  return k;
}

describe("crypto — AES-256-GCM Aadhaar", () => {
  let originalKey: string | undefined;

  beforeEach(async () => {
    originalKey = process.env.AADHAAR_ENCRYPTION_KEY;
    process.env.AADHAAR_ENCRYPTION_KEY = genKeyB64();
    // reset cached key between tests
    const { __resetKeyCacheForTests } = await import("./crypto");
    __resetKeyCacheForTests();
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalKey === undefined) delete process.env.AADHAAR_ENCRYPTION_KEY;
    else process.env.AADHAAR_ENCRYPTION_KEY = originalKey;
    try {
      const { __resetKeyCacheForTests } = await import("./crypto");
      __resetKeyCacheForTests();
    } catch {}
  });

  it("round-trip: encrypt then decrypt returns original", async () => {
    const { encryptAadhaar, decryptAadhaar } = await import("./crypto");
    const plain = "123456789012";
    const ct = encryptAadhaar(plain);
    expect(ct.startsWith("v1.")).toBe(true);
    expect(ct.split(".")).toHaveLength(4);
    expect(decryptAadhaar(ct)).toBe(plain);
  });

  it("same plaintext encrypts to different ciphertexts (non-deterministic IV) but both decrypt", async () => {
    const { encryptAadhaar, decryptAadhaar } = await import("./crypto");
    const plain = "999988887777";
    const a = encryptAadhaar(plain);
    const b = encryptAadhaar(plain);
    expect(a).not.toBe(b);
    expect(decryptAadhaar(a)).toBe(plain);
    expect(decryptAadhaar(b)).toBe(plain);
  });

  it("tamper detection: flipping a byte in iv/tag/ciphertext returns null, never throws", async () => {
    const { encryptAadhaar, decryptAadhaar } = await import("./crypto");
    const ct = encryptAadhaar("111122223333");
    const parts = ct.split(".");
    expect(parts).toHaveLength(4);

    // tamper tag (parts[2]): flip last char
    const tamperedTag = parts[2].slice(0, -2) + (parts[2].endsWith("AA") ? "BB" : "AA");
    const tampered = `${parts[0]}.${parts[1]}.${tamperedTag}.${parts[3]}`;
    expect(() => decryptAadhaar(tampered)).not.toThrow();
    expect(decryptAadhaar(tampered)).toBeNull();

    // tamper ciphertext (parts[3])
    const tamperedCt = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    const tampered2 = `${parts[0]}.${parts[1]}.${parts[2]}.${tamperedCt}`;
    expect(decryptAadhaar(tampered2)).toBeNull();

    // malformed format
    expect(decryptAadhaar("not-a-valid-format")).toBeNull();
    expect(decryptAadhaar("v1.bad")).toBeNull();
    expect(decryptAadhaar(null)).toBeNull();
    expect(decryptAadhaar("")).toBeNull();
  });

  it("wrong-key: decrypt with a different key returns null", async () => {
    const { encryptAadhaar } = await import("./crypto");
    const plain = "444455556666";
    const ct = encryptAadhaar(plain);

    // switch key
    process.env.AADHAAR_ENCRYPTION_KEY = genOtherKeyB64();
    const { __resetKeyCacheForTests } = await import("./crypto");
    __resetKeyCacheForTests();
    // need to re-import to pick up new key? decrypt uses lazy resolve, so existing module will re-resolve after cache reset
    const { decryptAadhaar } = await import("./crypto");
    expect(decryptAadhaar(ct)).toBeNull();
  });

  it("aadhaarHash is deterministic SHA-256 hex and never throws", async () => {
    const { aadhaarHash } = await import("./crypto");
    const h1 = aadhaarHash("123456789012");
    const h2 = aadhaarHash("123456789012");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(aadhaarHash("different")).not.toBe(h1);
    // empty/null inputs return empty string, not throw
    expect(() => aadhaarHash(null as unknown as string)).not.toThrow();
    expect(aadhaarHash("")).toBe("");
    expect(aadhaarHash(null as unknown as string)).toBe("");
  });

  it("getAadhaarForAdmin decrypts via explicit helper (same as decryptAadhaar)", async () => {
    const { encryptAadhaar, getAadhaarForAdmin } = await import("./crypto");
    const plain = "777788889999";
    const ct = encryptAadhaar(plain);
    expect(getAadhaarForAdmin(ct)).toBe(plain);
    expect(getAadhaarForAdmin(null)).toBeNull();
    expect(getAadhaarForAdmin("bogus")).toBeNull();
  });

  it("encryptAadhaar throws with misconfigured key (wrong length) and validateAadhaarKey reports error", async () => {
    process.env.AADHAAR_ENCRYPTION_KEY = Buffer.from("short").toString("base64"); // 5 bytes, not 32
    const { __resetKeyCacheForTests } = await import("./crypto");
    __resetKeyCacheForTests();
    const { encryptAadhaar, validateAadhaarKey } = await import("./crypto");
    expect(validateAadhaarKey().ok).toBe(false);
    expect(() => encryptAadhaar("123456789012")).toThrow(/32 bytes/);
  });
});
