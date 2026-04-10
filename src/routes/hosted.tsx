import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getSessionFn, logoutFn } from '../server/functions/auth'
import { acceptOrganizationInviteFn, getHostedAccessControlFn } from '../server/functions/foundary'
import {
  Ticket,
  Sparkles,
  ChevronLeft,
  Users,
  HandCoins,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  Gauge,
  Upload,
  FolderOpen,
  Link2,
  MonitorSmartphone,
} from 'lucide-react'

export const Route = createFileRoute('/hosted')({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === 'string' ? search.invite : undefined,
  }),
  loader: async () => {
    const user = await getSessionFn()

    if (user?.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const accessControl = user ? await getHostedAccessControlFn() : null

    return { user, accessControl }
  },
  component: HostedLayout,
})

interface HostedNavItemProps {
  href: string
  label: React.ReactNode
  icon: React.ReactNode
  isActive?: boolean
}

function HostedNavItem({ href, label, icon, isActive }: HostedNavItemProps) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-[2px] pl-[14px]'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      }`}
    >
      <span className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
    </a>
  )
}

function HostedLayout() {
  const { user, accessControl } = Route.useLoaderData()
  const search = Route.useSearch()
  const location = useLocation()
  const inviteToken = search.invite
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [inviteAcceptMessage, setInviteAcceptMessage] = useState('')

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutFn({ data: {} })
      await router.invalidate()
      window.location.replace('/hosted')
    } finally {
      setLoggingOut(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      if (!user || !inviteToken) return
      try {
        const result = await acceptOrganizationInviteFn({ data: { token: inviteToken } })
        setInviteAcceptMessage(
          result.alreadyAccepted
            ? `Invite already accepted for ${result.organizationName}.`
            : `Invite accepted. You now have access to ${result.organizationName}.`,
        )
        await router.invalidate()
      } catch (err: any) {
        setInviteAcceptMessage(err?.message || 'Could not accept invite')
      }
    }

    run()
  }, [inviteToken, router, user])

  const currentPath = location.pathname
  const canManageMembers = Boolean(accessControl?.permissions?.canManageMembers)
  const canRequestFunds = Boolean(accessControl?.permissions?.canRequestFunds)
  const canManageTickets = Boolean(accessControl?.permissions?.canManageTickets)
  const canAccessStorage = Boolean(accessControl?.permissions?.canAccessStorage)
  const inStorageSection = currentPath.startsWith('/hosted/perks/storage')
  const currentPageLabel =
    currentPath.includes('/hosted/request-funds')
      ? 'Request funds'
      : currentPath.includes('/hosted/tickets')
        ? 'Tickets'
        : currentPath.includes('/hosted/team')
          ? 'Team'
          : currentPath.includes('/hosted/perks/storage/upload')
            ? 'Upload file'
            : currentPath.includes('/hosted/perks/storage/explorer')
              ? 'File explorer'
              : currentPath.includes('/hosted/perks/storage/cdn')
                ? 'CDN and links'
                : currentPath.includes('/hosted/perks/storage/limits')
                  ? 'Limits'
                  : currentPath.includes('/hosted/perks-hub')
                    ? 'Perks'
                    : currentPath.includes('/hosted/perks/storage')
                      ? 'Storage'
                      : currentPath.includes('/hosted/tickets')
                        ? 'Tickets'
                        : 'Sign in'

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <header className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Hosted portal</p>
              <h1 className="font-display text-3xl text-foreground">Application status</h1>
            </div>
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back to application
            </a>
          </header>

          <main className="mt-8">
            <Outlet />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:inset-auto`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
            <a href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display text-lg">L</span>
              </div>
              <div>
                <span className="font-display text-xl tracking-wide text-foreground">Lan Foundary</span>
                <span className="block text-[10px] text-muted-foreground uppercase tracking-widest">Hosted</span>
              </div>
            </a>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 py-4 overflow-y-auto">
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Perks</p>
              {canAccessStorage && inStorageSection && (
                <HostedNavItem
                  href="/hosted/perks-hub"
                  label="Back to perks"
                  icon={<ChevronLeft className="w-5 h-5" />}
                />
              )}
              {!inStorageSection && (
                <HostedNavItem
                  href="/hosted/perks-hub"
                  label="Perks hub"
                  icon={<Sparkles className="w-5 h-5" />}
                  isActive={currentPath === '/hosted/perks-hub'}
                />
              )}
              {canAccessStorage && (
                <HostedNavItem
                  href="/hosted/perks/storage"
                  label="Storage"
                  icon={<Gauge className="w-5 h-5" />}
                  isActive={currentPath === '/hosted/perks/storage' || currentPath.startsWith('/hosted/perks/storage/')}
                />
              )}
              {inStorageSection && (
                <>
                  <HostedNavItem
                    href="/hosted/perks/storage/upload"
                    label="Upload file"
                    icon={<Upload className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/perks/storage/upload'}
                  />
                  <HostedNavItem
                    href="/hosted/perks/storage/explorer"
                    label="File explorer"
                    icon={<FolderOpen className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/perks/storage/explorer'}
                  />
                  <HostedNavItem
                    href="/hosted/perks/storage/cdn"
                    label="CDN and links"
                    icon={<Link2 className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/perks/storage/cdn'}
                  />
                  <HostedNavItem
                    href="/hosted/perks/storage/limits"
                    label="Limits"
                    icon={<MonitorSmartphone className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/perks/storage/limits'}
                  />
                </>
              )}
            </div>

            {!inStorageSection && (
              <div className="mb-6">
                <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Management</p>
                <HostedNavItem
                  href="/hosted/team"
                  label={canManageMembers ? 'Team' : 'Team (read-only)'}
                  icon={<Users className="w-5 h-5" />}
                  isActive={currentPath === '/hosted/team'}
                />
                {canRequestFunds && (
                  <HostedNavItem
                    href="/hosted/request-funds"
                    label="Request funds"
                    icon={<HandCoins className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/request-funds'}
                  />
                )}
              </div>
            )}

            {!inStorageSection && (
              <div className="mt-8">
                <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Get help</p>
                {canManageTickets && (
                  <HostedNavItem
                    href="/hosted/tickets"
                    label="Tickets"
                    icon={<Ticket className="w-5 h-5" />}
                    isActive={currentPath === '/hosted/tickets'}
                  />
                )}
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-border shrink-0 bg-card">
            <div className="border border-border bg-secondary/50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display text-lg">
                    {(user.name || user.email || 'H').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name || user.email || 'Hosted'}</p>
                  <p className="text-xs text-muted-foreground">Hosted</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-3 w-full flex items-center justify-center gap-2 border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-sm">
              <a href={canManageTickets ? '/hosted/tickets' : '/hosted/team'} className="text-muted-foreground hover:text-foreground transition-colors">
                Hosted
              </a>
              <span className="text-muted">/</span>
              <span className="text-foreground font-medium">{currentPageLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/foundary"
              target="_blank"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open site
            </a>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 border border-transparent p-1.5 hover:border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="w-8 h-8 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display text-sm">
                    {(user.name || user.email || 'H').charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border py-2 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">ID: {user.id}</p>
                    </div>

                    <div className="border-t border-border p-2">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2 border border-transparent px-3 py-2 text-sm text-destructive hover:border-border hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? 'Signing out...' : 'Sign out'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className={`w-full space-y-4 ${currentPath.includes('/hosted/perks/storage/explorer') ? 'max-w-none' : 'mx-auto max-w-5xl'}`}>
            {inviteAcceptMessage && (
              <div className="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {inviteAcceptMessage}
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
