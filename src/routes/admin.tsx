import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { getSessionFn, logoutFn, updateProfileFn } from '../server/functions/auth'
import { useState } from 'react'
import {
  LayoutDashboard,
  Ticket,
  Users,
  LogOut,
  Settings,
  History,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  HardDrive,
  GitBranch,
  Building2,
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

    if (user.role !== 'organizer') {
      throw redirect({ to: '/hosted' })
    }

    const isDemoTester = Boolean((user as { isDemoTester?: boolean }).isDemoTester)
    const isContentManagementPath =
      location.pathname === '/admin' ||
      location.pathname === '/admin/' ||
      location.pathname === '/admin/applications'

    if (isDemoTester && isContentManagementPath) {
      throw redirect({ to: '/admin/users' })
    }

    return { user }
  },
  loader: async ({ context: { user } }) => {
    return { user }
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
  const active = isActive ?? false

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

function AdminLayout() {
  const { user } = Route.useLoaderData()
  const router = useRouter()
  const location = useLocation()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name || '')
  const [savingName, setSavingName] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutFn({ data: {} })
      await router.invalidate()
      window.location.replace('/hosted')
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

  const roleLabel = 'Staff'
  const currentPath = location.pathname

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
                <span className="font-display text-xl tracking-wide text-foreground">Lan Foundary</span>
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
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Main</p>
              <NavItem
                href="/admin"
                label="Overview"
                icon={<LayoutDashboard className="w-5 h-5" />}
                isActive={currentPath === '/admin' || currentPath === '/admin/'}
              />
              <NavItem
                href="/admin/tickets"
                label="Tickets"
                icon={<Ticket className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/tickets')}
              />
              <NavItem
                href="/admin/storage-perks"
                label="Storage"
                icon={<HardDrive className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/storage-perks')}
              />
              <NavItem
                href="/admin/transfers"
                label="Transfers"
                icon={<GitBranch className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/transfers')}
              />
            </div>

            {/* Management */}
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Management</p>
              <NavItem
                href="/admin/users"
                label="Members"
                icon={<Users className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/users')}
              />
              <NavItem
                href="/admin/organizations"
                label="Organizations"
                icon={<Building2 className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/organizations')}
              />
            </div>

            {/* System */}
            <div className="mb-6">
              <p className="px-5 mb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">System</p>
              <NavItem
                href="/admin/logs"
                label="Activity log"
                icon={<History className="w-5 h-5" />}
                isActive={currentPath.startsWith('/admin/logs')}
              />
            </div>
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
                  <p className="text-sm font-medium text-foreground truncate">{user.name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
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
                {currentPath === '/admin' || currentPath === '/admin/' ? 'Overview' :
                 currentPath.includes('/tickets') ? 'Tickets' :
                  currentPath.includes('/storage-perks') ? 'Storage' :
                 currentPath.includes('/transfers') ? 'Transfers' :
                 currentPath.includes('/organizations') ? 'Organizations' :
                 currentPath.includes('/users') ? 'Members' :
                 currentPath.includes('/logs') ? 'Activity log' :
                 'Page'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <a href="/foundary" target="_blank" className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
                      <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed'}</p>
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
                            placeholder="Enter name"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveName}
                              disabled={savingName}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90 disabled:opacity-50"
                            >
                              {savingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => { setEditingName(false); setName(user.name || '') }}
                              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded hover:bg-secondary/50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingName(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Edit profile
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
                        {loggingOut ? 'Signing out...' : 'Sign out'}
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
