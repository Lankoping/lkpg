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
  Bell,
  Search,
  Globe
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
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
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
      >
        <span className="w-5 h-5 text-slate-400">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {isOpen && (
        <div className="ml-8 space-y-1 border-l-2 border-slate-200 pl-3">
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
      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-200 ${
        isActive
          ? 'text-blue-600 font-medium bg-blue-50'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 lg:static lg:inset-auto`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Lanköping</span>
                <span className="block text-[10px] text-slate-400 -mt-0.5">Admin Panel</span>
              </div>
            </a>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {/* Main Section */}
            <div className="mb-6">
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main</p>
              {isOrganizer && !isDemoTester && (
                <NavItem href="/admin" label="Dashboard" icon={<LayoutDashboard className="w-5 h-5" />} />
              )}
              {isOrganizer && !isDemoTester && (
                <NavItem href="/admin/posts" label="Inlägg" icon={<FileText className="w-5 h-5" />} />
              )}
            </div>

            {/* Content Management */}
            {isOrganizer && (
              <div className="mb-6">
                <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Content</p>
                <NavGroup label="CMS" icon={<Palette className="w-5 h-5" />} defaultOpen={isCmsPath}>
                  <SubNavItem href="/admin/cms" label="Overview" />
                  <SubNavItem href="/admin/cms/hero" label="Hero Section" />
                  <SubNavItem href="/admin/cms/team" label="Team Members" />
                  <SubNavItem href="/admin/cms/sections" label="Info Sections" />
                  <SubNavItem href="/admin/cms/pages" label="Pages" />
                  <SubNavItem href="/admin/cms/navigation" label="Navigation" />
                  <SubNavItem href="/admin/cms/settings" label="Site Settings" />
                </NavGroup>
              </div>
            )}

            {/* Management */}
            <div className="mb-6">
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Management</p>
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
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Events</p>
              <NavGroup label="Biljetter" icon={<Ticket className="w-5 h-5" />} defaultOpen={isTicketsPath}>
                <SubNavItem href="/admin/tickets" label="Overview" />
                <SubNavItem href="/admin/tickets/events" label="Events" />
                <SubNavItem href="/admin/tickets/types" label="Ticket Types" />
                <SubNavItem href="/admin/tickets/scan" label="Scanner" />
                <SubNavItem href="/admin/tickets/new" label="Issue Ticket" />
              </NavGroup>
            </div>

            {/* System */}
            {isOrganizer && (
              <div className="mb-6">
                <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">System</p>
                <NavItem href="/admin/logs" label="Activity Logs" icon={<History className="w-5 h-5" />} />
              </div>
            )}
          </nav>

          {/* User Card */}
          <div className="p-3 border-t border-slate-200">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {(user.name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user.name || 'Unnamed'}</p>
                  <p className="text-xs text-slate-500">{roleLabel}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile menu + Breadcrumb */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <a href="/admin" className="text-slate-400 hover:text-slate-600">Admin</a>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-medium">
                {currentPath === '/admin' || currentPath === '/admin/' ? 'Dashboard' :
                 currentPath.includes('/cms') ? 'CMS' :
                 currentPath.includes('/users') ? 'Users' :
                 currentPath.includes('/tickets') ? 'Tickets' : 'Page'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              <Globe className="w-4 h-4" />
              View Site
            </a>
            
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs">
                    {(user.name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{user.name || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <p className="text-xs text-slate-400 mt-1">ID: {user.id}</p>
                    </div>
                    
                    <div className="p-2">
                      {editingName ? (
                        <div className="px-2 py-2 space-y-2">
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter name"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveName}
                              disabled={savingName}
                              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => { setEditingName(false); setName(user.name || '') }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingName(true)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md"
                        >
                          <Settings className="w-4 h-4" />
                          Edit Profile
                        </button>
                      )}
                    </div>
                    
                    <div className="border-t border-slate-100 p-2">
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? 'Logging out...' : 'Log out'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
