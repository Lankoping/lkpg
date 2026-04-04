import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { loginFn } from '../server/functions/auth'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [awaitingTwoFactor, setAwaitingTwoFactor] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const res = await loginFn({
        data: {
          email,
          passwordHash: password,
          challengeId: awaitingTwoFactor ? challengeId : undefined,
          twoFactorCode: awaitingTwoFactor ? twoFactorCode : undefined,
        },
      })

      if (res.requiresTwoFactor) {
        setAwaitingTwoFactor(true)
        setChallengeId(res.challengeId)
        setMaskedEmail(res.email)
        return
      }

      if (res.success) {
        window.location.href = res.user.role === 'organizer' ? '/admin' : '/hosted'
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wide text-foreground mb-2">Staff sign in</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Admin portal {awaitingTwoFactor ? '· 2FA required' : ''}</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={awaitingTwoFactor}
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {awaitingTwoFactor && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Verification code</label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit code"
                className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              />
              <p className="mt-1 text-xs text-muted-foreground">Code sent to {maskedEmail || email}</p>
            </div>
          )}

          <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed pt-1">
            <input
              type="checkbox"
              checked={acceptedPolicy}
              onChange={(e) => setAcceptedPolicy(e.target.checked)}
              className="mt-0.5 rounded accent-primary"
              required
            />
            <span>
              I accept the privacy policy and terms.
            </span>
          </label>

          <button
            type="submit"
            disabled={!acceptedPolicy || (awaitingTwoFactor && twoFactorCode.length !== 6)}
            className="w-full py-2.5 mt-6 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {awaitingTwoFactor ? 'Verify and sign in' : 'Sign in'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to application</a>
        </div>
      </div>
    </div>
  )
}
