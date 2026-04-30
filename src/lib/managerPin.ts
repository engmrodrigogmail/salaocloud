/**
 * Manager PIN utilities.
 *
 * The PIN is a 4–6 digit numeric string the gerente sets in their profile.
 * We never store the PIN in plain text. We hash with PBKDF2-SHA-256 and a
 * fixed per-installation pepper so the same PIN always hashes the same way
 * (allows constant-time DB lookup via `verify_manager_pin`).
 *
 * The pepper is intentionally hard-coded: it isn't a secret on its own
 * (the column is already protected by RLS), it just prevents trivial
 * rainbow-table style guessing of "1234".
 */

const PEPPER = "salaocloud::manager-pin::v1";
const ITERATIONS = 100_000;

const enc = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Validate PIN format: only digits, length 4..6.
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Hash the PIN with PBKDF2-SHA-256, deterministically (using PEPPER as salt).
 * Returns a hex-encoded 32-byte digest.
 */
export async function hashManagerPin(pin: string): Promise<string> {
  const trimmed = pin.trim();
  if (!isValidPinFormat(trimmed)) {
    throw new Error("PIN inválido");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(trimmed),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(PEPPER),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return bufToHex(bits);
}
