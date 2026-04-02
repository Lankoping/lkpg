import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64

function parseScryptHash(value: string) {
  const parts = value.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return null
  }

  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = parts[4]
  const digestBase64 = parts[5]

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !digestBase64) {
    return null
  }

  return { n, r, p, salt, digestBase64 }
}

export function isHashedPassword(value: string) {
  return parseScryptHash(value) !== null
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64')
  const digest = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R + KEY_LENGTH,
  })

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${digest.toString('base64')}`
}

export function verifyPassword(password: string, storedPassword: string) {
  const parsed = parseScryptHash(storedPassword)

  // Backward compatibility for existing plaintext rows.
  if (!parsed) {
    return password === storedPassword
  }

  const derived = scryptSync(password, parsed.salt, KEY_LENGTH, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
    maxmem: 128 * parsed.n * parsed.r + KEY_LENGTH,
  })

  const expected = Buffer.from(parsed.digestBase64, 'base64')
  if (expected.length !== derived.length) {
    return false
  }

  return timingSafeEqual(derived, expected)
}
