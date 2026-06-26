import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify<string, Buffer, number, ScryptOptions, Buffer>(scrypt);

// scrypt cost parameters. N=16384 → ~16MB memory (di bawah default maxmem 32MB).
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Hash password → "scrypt$N$r$p$saltHex$hashHex". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verifikasi password terhadap hash tersimpan, timing-safe. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  const derived = (await scryptAsync(password, salt, expected.length, {
    N: Number(nStr), r: Number(rStr), p: Number(pStr),
  })) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
