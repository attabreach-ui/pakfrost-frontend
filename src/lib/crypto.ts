// ── Secure password hashing using WebCrypto (SHA-256) ─────────────────────
// No external dependency needed — WebCrypto is built into all modern browsers.
// NOTE: This is client-side hashing for the frontend-only phase.
//       When the backend is added, move auth entirely server-side (bcrypt/argon2).

const SALT = 'PAKFROST_WMS_SALT_v1_2025';

/**
 * Hash a plain-text password with SHA-256 + salt.
 * Returns a 64-character lowercase hex string.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a plain-text password against a stored hash.
 * Also handles legacy plaintext passwords (migration path):
 *   - If stored value is 64-char hex → compare as hash
 *   - Otherwise → compare as plaintext (then caller should upgrade)
 */
export async function verifyPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  if (isHashedPassword(stored)) {
    const computed = await hashPassword(plain);
    return computed === stored;
  }
  // Legacy plaintext comparison (migration)
  return plain === stored;
}

/**
 * Returns true if the stored value looks like a SHA-256 hex hash.
 */
export function isHashedPassword(value: string): boolean {
  return value.length === 64 && /^[0-9a-f]+$/.test(value);
}
