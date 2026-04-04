import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getOrganizationInviteInfoFn, registerInvitedMemberFn } from '../server/functions/foundary'

export const Route = createFileRoute('/invite-register')({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === 'string' ? search.invite : '',
  }),
  component: InviteRegisterPage,
})

function InviteRegisterPage() {
  const navigate = useNavigate()
  const { invite: token } = Route.useSearch()
  const [invite, setInvite] = useState<{
    email: string
    organizationName: string
    isExpired: boolean
    isAccepted: boolean
  } | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setError('Missing invite token')
        setLoadingInvite(false)
        return
      }

      try {
        const data = await getOrganizationInviteInfoFn({ data: { token } })
        setInvite(data)
      } catch (err: any) {
        setError(err?.message || 'Could not load invitation')
      } finally {
        setLoadingInvite(false)
      }
    }

    run()
  }, [token])

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Missing invite token')
      return
    }

    if (!invite) {
      setError('Invitation not loaded')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setBusy(true)
    try {
      const result = await registerInvitedMemberFn({
        data: {
          token,
          name,
          password,
        },
      })
      setMessage(`Welcome! Your account is ready for ${result.organizationName}. Redirecting...`)
      setTimeout(() => {
        navigate({ to: '/hosted', search: { invite: undefined } })
      }, 900)
    } catch (registerError: any) {
      setError(registerError?.message || 'Could not create account from invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-7">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Lanfoundary invite</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Create account from invite</h1>

        {loadingInvite ? (
          <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">Loading invite...</div>
        ) : !invite ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error || 'Invitation not available'}</div>
        ) : (
          <>

            <div className="mt-4 space-y-1 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground">Organization:</span> {invite.organizationName}
              </p>
              <p>
                <span className="text-foreground">Invited email:</span> {invite.email}
              </p>
            </div>

            {invite.isAccepted ? (
              <div className="mt-5 rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                This invite has already been used. You can sign in at /hosted.
              </div>
            ) : invite.isExpired ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                This invite has expired. Ask your team to send a new invite.
              </div>
            ) : (
              <form onSubmit={handleRegister} className="mt-5 space-y-4">
            <label className="block text-sm text-muted-foreground">
              Full name
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                minLength={8}
                required
              />
            </label>

            <label className="block text-sm text-muted-foreground">
              Confirm password
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Creating account...' : 'Create account and join organization'}
            </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
