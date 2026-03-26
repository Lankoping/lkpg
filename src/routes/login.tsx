import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { loginFn } from '../server/functions/auth'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedPolicy, setAcceptedPolicy] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await loginFn({ data: { email, passwordHash: password } }) // Simplified hash
      if (res.success) {
        window.location.href = '/admin' // Force reload to pick up cookie
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err?.message || 'Login failed')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md p-8 bg-card border border-border rounded">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wide text-foreground mb-2">Inloggning</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Lanköping Admin</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">E-post</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="namn@exempel.se"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed pt-1">
            <input
              type="checkbox"
              checked={acceptedPolicy}
              onChange={(e) => setAcceptedPolicy(e.target.checked)}
              className="mt-0.5 rounded accent-primary"
              required
            />
            <span>
              Jag accepterar vår{' '}
              <a href="/privacy" className="text-primary hover:underline transition-colors">datapolicy</a>
              {' '}och användarvillkor.
            </span>
          </label>

          <button
            type="submit"
            disabled={!acceptedPolicy}
            className="w-full py-2.5 mt-6 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Logga in
          </button>
        </form>
        
        <div className="mt-6 text-center">
           <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Tillbaka till startsida</a>
        </div>
      </div>
    </div>
  )
}
