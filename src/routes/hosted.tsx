import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getSessionFn, logoutFn } from '../server/functions/auth'
import { acceptOrganizationInviteFn } from '../server/functions/foundary'
import {
  LayoutDashboard,
  Ticket,
  HardDrive,
  Users,
  HandCoins,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  ChevronLeft,
  Upload,
  FolderOpen,
  MonitorSmartphone,
  Link2,
  Gauge,
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

    return { user }
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

interface HostedStorageNavItemProps extends HostedNavItemProps {
  badge?: string
}

function HostedStorageNavItem({ href, label, icon, isActive, badge }: HostedStorageNavItemProps) {
  return (
    <HostedNavItem
      href={href}
      label={
        <span className="flex w-full items-center justify-between gap-2">
          <span>{label}</span>
          {badge ? <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{badge}</span> : null}
        </span>
      }
      icon={icon}
      isActive={isActive}
    />
  )
}

function HostedLayout() {
  const { user } = Route.useLoaderData()
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
  const currentHash = location.hash
  const isStoragePath = currentPath.startsWith('/hosted/perks')
  const currentPageLabel =
    currentPath.includes('/hosted/request-funds')
      ? 'Request funds'
      : currentPath.includes('/hosted/tickets')
        ? 'Tickets'
      : currentPath.includes('/hosted/team')
        ? 'Team'
        : currentPath.includes('/hosted/perks/upload')
          ? 'Upload file'
          : currentPath.includes('/hosted/perks/explorer')
            ? 'File explorer'
            : currentPath.includes('/hosted/perks/cdn')
              ? 'CDN and links'
              : currentPath.includes('/hosted/perks/limits')
                ? 'Limits'
                : currentPath.includes('/hosted/perks')
                  ? 'Storage'
                  : currentPath.includes('/hosted/applications')
                    ? 'Applications'
                    : 'Sign in'

  const isStorageActive = (path: string) => currentPath === path

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
        } lg:translate-x-0 lg:static lg:inset-auto`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-5 border-b border-border">
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
            {isStoragePath ? (
              <div className="mb-6">
                <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Storage</p>
                <a
                  href="/hosted/applications"
                  className="mb-2 mx-2 flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to hosted
                </a>
                <HostedStorageNavItem
                  href="/hosted/perks"
                  label="Overview"
                  icon={<Gauge className="w-5 h-5" />}
                  isActive={isStorageActive('/hosted/perks')}
                />
                <HostedStorageNavItem
                  href="/hosted/perks/upload"
                  label="Upload file"
                  icon={<Upload className="w-5 h-5" />}
                  isActive={isStorageActive('/hosted/perks/upload')}
                />
                <HostedStorageNavItem
                  href="/hosted/perks/explorer"
                  label="File explorer"
                  icon={<FolderOpen className="w-5 h-5" />}
                  isActive={isStorageActive('/hosted/perks/explorer')}
                />
                <HostedStorageNavItem
                  href="/hosted/perks/cdn"
                  label="CDN and links"
                  icon={<Link2 className="w-5 h-5" />}
                  isActive={isStorageActive('/hosted/perks/cdn')}
                />
                <HostedStorageNavItem
                  href="/hosted/perks/limits"
                  label="Limits"
                  icon={<MonitorSmartphone className="w-5 h-5" />}
                  isActive={isStorageActive('/hosted/perks/limits')}
                />
              </div>
            ) : (
              <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Main</p>
              <HostedNavItem
                href="/hosted/applications"
                label="Applications"
                icon={<LayoutDashboard className="w-5 h-5" />}
                isActive={currentPath === '/hosted/applications'}
              />
              <HostedNavItem
                href="/hosted/tickets"
                label="Tickets"
                icon={<Ticket className="w-5 h-5" />}
                isActive={currentPath === '/hosted/tickets'}
              />
              <HostedNavItem
                href="/hosted/perks"
                label="Storage"
                icon={<HardDrive className="w-5 h-5" />}
                isActive={currentPath === '/hosted/perks'}
              />
              </div>
            )}

            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Management</p>
              <HostedNavItem
                href="/hosted/team"
                label="Team"
                icon={<Users className="w-5 h-5" />}
                isActive={currentPath === '/hosted/team'}
              />
              <HostedNavItem
                href="/hosted/request-funds"
                label="Request funds"
                icon={<HandCoins className="w-5 h-5" />}
                isActive={currentPath === '/hosted/request-funds'}
              />
            </div>
          </nav>

          <div className="p-4 border-t border-border">
            <div className="p-4 bg-secondary/50 rounded">
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
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
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
              <a href="/hosted/applications" className="text-muted-foreground hover:text-foreground transition-colors">
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
                className="flex items-center gap-2 p-1.5 hover:bg-secondary/50 rounded transition-colors"
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
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded shadow-lg py-2 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">ID: {user.id}</p>
                    </div>

                    <div className="border-t border-border p-2">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
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
          <div className={`mx-auto w-full space-y-4 ${currentPath.includes('/hosted/perks/explorer') ? 'max-w-7xl' : 'max-w-5xl'}`}>
            {inviteAcceptMessage && (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
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
