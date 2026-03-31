import { createFileRoute, Link, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { getSessionFn, logoutFn, updateProfileFn } from '../server/functions/auth'
import { getMyPendingSignaturesFn } from '../server/functions/avgang'
import { getMyPendingAgreementSignaturesFn } from '../server/functions/agreements'
import { useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  Users,
  ScrollText,
  LogOut,
  Settings,
  Ticket,
  FileSignature,
  ClipboardList,
  History,
  ChevronDown,
  ChevronRight,
  Palette,
  Home,
  UsersRound,
  Layers,
  Menu,
  X,
  Globe,
  Navigation,
  ExternalLink
} from 'lucide-react'

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

interface NavItemProps {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
  isActive?: boolean
}

function NavItem({ href, label, icon, badge, isActive }: NavItemProps) {
  const active = isActive ?? (typeof window !== 'undefined' && window.location.pathname === href)

  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${
        active
          ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary -ml-[2px] pl-[14px]'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      }`}
    >
      <span className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
          active ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </a>
  )
}

interface NavGroupProps {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function NavGroup({ label, icon, children, defaultOpen = false }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-200"
      >
        <span className="w-5 h-5 text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {isOpen && (
        <div className="ml-8 space-y-0.5 border-l border-border pl-3">
          {children}
        </div>
      )}
    </div>
  )
}

function SubNavItem({ href, label, badge }: { href: string; label: string; badge?: number }) {
  const isActive = typeof window !== 'undefined' && window.location.pathname === href

  return (
    <a
      href={href}
      className={`flex items-center justify-between px-3 py-2 text-sm transition-all duration-200 ${
        isActive
          ? 'text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </a>
  )
}

function AdminLayout() {
  const { user, pendingCount, agreementPendingCount } = Route.useLoaderData()
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name || '')
  const [savingName, setSavingName] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
    }
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

  const roleLabel = user.role === 'organizer' ? 'Organisatör' : 'Volontär'
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const isCmsPath = currentPath.startsWith('/admin/cms')
  const isTicketsPath = currentPath.startsWith('/admin/tickets')

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out ${
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-auto`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-5 border-b border-border">
            <a href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-display text-lg">L</span>
              </div>
              <div>
                <span className="font-display text-xl tracking-wide text-foreground">Lanköping</span>
                <span className="block text-[10px] text-muted-foreground uppercase tracking-widest">Admin</span>
              </div>
            </a>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {/* Main Section */}
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Huvudmeny</p>
              {isOrganizer && !isDemoTester && (
                <NavItem href="/admin" label="Översikt" icon={<LayoutDashboard className="w-5 h-5" />} />
              )}
              {isOrganizer && !isDemoTester && (
                <NavItem href="/admin/posts" label="Inlägg" icon={<FileText className="w-5 h-5" />} />
              )}
            </div>

            {/* Content Management */}
            {isOrganizer && (
              <div className="mb-6">
                <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Innehåll</p>
                <NavGroup label="CMS" icon={<Palette className="w-5 h-5" />} defaultOpen={isCmsPath}>
                  <SubNavItem href="/admin/cms" label="Översikt" />
                  <SubNavItem href="/admin/cms/pages" label="Sidor" />
                  <SubNavItem href="/admin/cms/navigation" label="Navigation" />
                  <SubNavItem href="/admin/cms/settings" label="Inställningar" />
                </NavGroup>
              </div>
            )}

            {/* Management */}
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Hantering</p>
              {isOrganizer && (
                <NavItem href="/admin/users" label="Användare" icon={<Users className="w-5 h-5" />} />
              )}
              {isOrganizer && (
                <NavItem href="/admin/stadgar" label="Stadgar" icon={<ScrollText className="w-5 h-5" />} />
              )}
              <NavItem href="/admin/avgang" label="Avgång" icon={<FileSignature className="w-5 h-5" />} badge={pendingCount} />
              <NavItem href="/admin/avtal" label="Avtal" icon={<ClipboardList className="w-5 h-5" />} badge={agreementPendingCount} />
            </div>

            {/* Events & Tickets */}
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Event</p>
              <NavGroup label="Biljetter" icon={<Ticket className="w-5 h-5" />} defaultOpen={isTicketsPath}>
                <SubNavItem href="/admin/tickets" label="Översikt" />
                <SubNavItem href="/admin/tickets/events" label="Evenemang" />
                <SubNavItem href="/admin/tickets/types" label="Biljetttyper" />
                <SubNavItem href="/admin/tickets/new" label="Utfärda biljett" />
              </NavGroup>
            </div>

            {/* System */}
            {isOrganizer && (
              <div className="mb-6">
                <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">System</p>
                <NavItem href="/admin/logs" label="Aktivitetslogg" icon={<History className="w-5 h-5" />} />
              </div>
            )}
          </nav>

          {/* User Card */}
          <div className="p-4 border-t border-border">
            <div className="p-4 bg-secondary/50 rounded">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display text-lg">
                    {(user.name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name || 'Namnlös'}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Loggar ut...' : 'Logga ut'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile menu + Breadcrumb */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <a href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</a>
              <span className="text-muted">/</span>
              <span className="text-foreground font-medium">
                {currentPath === '/admin' || currentPath === '/admin/' ? 'Översikt' :
                 currentPath.includes('/cms') ? 'CMS' :
                 currentPath.includes('/users') ? 'Användare' :
                 currentPath.includes('/tickets') ? 'Biljetter' : 'Sida'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visa sida
            </a>
            
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 hover:bg-secondary/50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display text-sm">
                    {(user.name || 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded shadow-lg py-2 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{user.name || 'Namnlös'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">ID: {user.id}</p>
                    </div>
                    
                    <div className="p-2">
                      {editingName ? (
                        <div className="px-2 py-2 space-y-2">
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                            placeholder="Ange namn"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveName}
                              disabled={savingName}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 disabled:opacity-50"
                            >
                              {savingName ? 'Sparar...' : 'Spara'}
                            </button>
                            <button
                              onClick={() => { setEditingName(false); setName(user.name || '') }}
                              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded hover:bg-secondary/50"
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingName(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Redigera profil
                        </button>
                      )}
                    </div>
                    
                    <div className="border-t border-border p-2">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? 'Loggar ut...' : 'Logga ut'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
