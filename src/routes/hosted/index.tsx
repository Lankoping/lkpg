import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionFn, loginFn } from '../../server/functions/auth'

export const Route = createFileRoute('/hosted/')({
  loader: async () => {
    const user = await getSessionFn()
    if (user) {
      throw redirect({ to: '/hosted/applications', search: { invite: undefined } })
    }
    return null
  },
  component: HostedLoginPage,
})

function HostedLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [awaitingTwoFactor, setAwaitingTwoFactor] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = await loginFn({
        data: {
          email,
          passwordHash: password,
          challengeId: awaitingTwoFactor ? challengeId : undefined,
          twoFactorCode: awaitingTwoFactor ? twoFactorCode : undefined,
        },
      })

      if (result.requiresTwoFactor) {
        setAwaitingTwoFactor(true)
        setChallengeId(result.challengeId)
        setMaskedEmail(result.email)
        return
      }

      if (result.user.role === 'organizer') {
        window.location.href = '/admin'
        return
      }

      await router.invalidate()
      window.location.href = '/hosted/applications'
    } catch (loginError: any) {
      setError(loginError?.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-2xl text-foreground">Hosted sign in</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Use the account created from the application form{awaitingTwoFactor ? ' and enter your 2FA code.' : '.'}
      </p>

      <form onSubmit={handleLogin} className="mt-5 space-y-4">
        <label className="block text-sm text-muted-foreground">
          Email
          <input
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted-foreground">
          Password
          <input
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={awaitingTwoFactor}
            required
          />
        </label>
        {awaitingTwoFactor && (
          <label className="block text-sm text-muted-foreground">
            Verification code
            <input
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
              type="text"
              value={twoFactorCode}
              onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="6-digit code"
              required
            />
            <span className="mt-1 block text-xs text-muted-foreground">Code sent to {maskedEmail || email}</span>
          </label>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || (awaitingTwoFactor && twoFactorCode.length !== 6)}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Signing in...' : awaitingTwoFactor ? 'Verify and sign in' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
