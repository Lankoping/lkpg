import { createHash } from 'node:crypto'

export const TWO_FACTOR_TTL_MS = 10 * 60 * 1000
export const TWO_FACTOR_RESEND_COOLDOWN_MS = 60 * 1000

export const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const safeLocal = `${local.slice(0, 2)}***`
  return `${safeLocal}@${domain}`
}

export const hashTwoFactorCode = (code: string) => createHash('sha256').update(code).digest('hex')
