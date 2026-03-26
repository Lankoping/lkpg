import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { getSessionFn, logoutFn, updateProfileFn } from '../server/functions/auth'
import { getMyPendingSignaturesFn } from '../server/functions/avgang'
import { getMyPendingAgreementSignaturesFn } from '../server/functions/agreements'
import { useState } from 'react'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    if (user.role !== 'organizer' && user.role !== 'volunteer') {
      throw redirect({ to: '/' })
    }

    if (user.role === 'volunteer' && (location.pathname === '/admin' || location.pathname === '/admin/')) {
      throw redirect({ to: '/admin/avgang' })
    }

    const isDemoTester = Boolean((user as { isDemoTester?: boolean }).isDemoTester)
    const isContentManagementPath =
      location.pathname === '/admin' ||
      location.pathname === '/admin/' ||
      location.pathname === '/admin/posts' ||
      location.pathname === '/admin/new' ||
      location.pathname.startsWith('/admin/edit/')

    if (isDemoTester && isContentManagementPath) {
      throw redirect({ to: '/admin/users' })
    }

    return { user }
  },
  loader: async ({ context: { user } }) => {
    const [pendingCount, agreementPendingCount] = await Promise.all([
      getMyPendingSignaturesFn().then(r => r.length).catch(() => 0),
      getMyPendingAgreementSignaturesFn().then(r => r.length).catch(() => 0),
    ])
    return { user, pendingCount, agreementPendingCount }
  },
  component: AdminLayout,
})

function NavItem({
  href,
  label,
  badge,
}: {
  href: string
  label: string
  badge?: number
}) {
  const isActive = typeof window !== 'undefined' && window.location.pathname === href

  return (
    <a
      href={href}
      className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </a>
  )
}

function AdminLayout() {
  const { user, pendingCount, agreementPendingCount } = Route.useLoaderData()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name || '')
  const [savingName, setSavingName] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const isOrganizer = user.role === 'organizer'
  const isDemoTester = Boolean((user as { isDemoTester?: boolean }).isDemoTester)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutFn({ data: {} })
      await router.invalidate()
      window.location.replace('/')
    } catch (error) {
      console.error('Logout failed:', error)
      setLoggingOut(false)
      alert('Kunde inte logga ut')
    }
  }

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(String(user.id))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleSaveName = async () => {
    if (!name.trim()) return
    setSavingName(true)
    try {
      await updateProfileFn({ data: { name: name.trim() } })
      setEditingName(false)
      await router.invalidate()
    } finally {
      setSavingName(false)
    }
  }

  const navItems = [
    ...(isOrganizer && !isDemoTester ? [{ href: '/admin', label: 'Översikt' }] : []),
    ...(isOrganizer && !isDemoTester ? [{ href: '/admin/posts', label: 'Inlägg' }] : []),
    ...(isOrganizer ? [{ href: '/admin/users', label: 'Användare' }] : []),
    ...(isOrganizer ? [{ href: '/admin/stadgar', label: 'Stadgar' }] : []),
    { href: '/admin/avgang', label: 'Avgång', badge: pendingCount },
    { href: '/admin/avtal', label: 'Avtal', badge: agreementPendingCount },
    ...(isOrganizer ? [{ href: '/admin/logs', label: 'Loggar' }] : []),
    { href: '/admin/tickets', label: 'Biljetter' },
  ]

  const roleLabel = user.role === 'organizer' ? 'Organisatör' : 'Volontär'

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-card">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <a href="/" className="font-display text-xl tracking-tight text-foreground hover:text-primary transition-colors">
            Lanköping
          </a>
          <p className="text-xs text-muted-foreground mt-0.5">Adminpanel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.href} href={item.href} label={item.label} badge={item.badge} />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-border space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground truncate">{user.name || 'Namnlös'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {loggingOut ? 'Loggar ut...' : 'Logga ut'}
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border flex items-center justify-between px-4 py-3">
        <a href="/" className="font-display text-lg tracking-tight text-foreground">Lanköping</a>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Öppna meny"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileNavOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-card border-b border-border p-4 space-y-1" onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <NavItem key={item.href} href={item.href} label={item.label} badge={item.badge} />
            ))}
            <div className="pt-3 border-t border-border mt-3">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full text-left text-sm text-red-500 hover:text-red-400 py-2 px-3 transition-colors disabled:opacity-40"
              >
                {loggingOut ? 'Loggar ut...' : 'Logga ut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-14">
        {/* Top header bar */}
        <header className="border-b border-border bg-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Inloggad som</p>
            <h1 className="font-display text-xl tracking-wide text-foreground">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="capitalize">{roleLabel}</span>
              <span>·</span>
              <span>ID {user.id}</span>
              <span>·</span>
              <button onClick={handleCopyId} className="text-primary hover:underline transition-colors">
                {copied ? 'Kopierat!' : 'Kopiera ID'}
              </button>
            </div>
          </div>

          <div className="bg-background border border-border rounded p-3 sm:min-w-72">
            <p className="text-xs text-muted-foreground mb-1.5">Konto</p>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded text-sm text-foreground outline-none focus:border-primary/60 transition-colors"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingName ? 'Sparar...' : 'Spara'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setName(user.name || '') }}
                  className="px-3 py-1.5 border border-border text-muted-foreground text-xs rounded hover:text-foreground transition-colors"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Ändra visningsnamn
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
