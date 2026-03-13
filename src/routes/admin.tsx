import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
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

function AdminLayout() {
  const { user, pendingCount, agreementPendingCount } = Route.useLoaderData()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user.name || '')
  const [savingName, setSavingName] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const isOrganizer = user.role === 'organizer'

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

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#100E0C] text-[#F0E8D8] font-sans">
      {/* Sidebar / Topbar */}
      <div className="w-full md:w-64 bg-[#141210] p-4 md:p-6 border-b md:border-b-0 md:border-r border-[#C04A2A]/20 flex md:flex-col items-center md:items-start justify-between">
        <h2 className="font-display tracking-widest text-xl md:text-3xl text-[#C04A2A] md:mb-12">Admin</h2>
        
        <nav className="flex md:flex-col space-x-6 md:space-x-0 md:space-y-6 md:flex-1 w-full md:w-full overflow-x-auto justify-end md:justify-start items-center md:items-start ml-4 md:ml-0 scrollbar-hide">
          {isOrganizer && <a href="/admin" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Översikt</a>}
          {isOrganizer && <a href="/admin/posts" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Inlägg</a>}
          {isOrganizer && <a href="/admin/users" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Användare</a>}
          {isOrganizer && <a href="/admin/stadgar" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Stadgar</a>}
          <a href="/admin/avgang" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">
            Avgång
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#C04A2A] text-white text-[8px] font-bold rounded-full leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </a>
          <a href="/admin/avtal" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">
            Avtal
            {agreementPendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#C04A2A] text-white text-[8px] font-bold rounded-full leading-none">
                {agreementPendingCount > 9 ? '9+' : agreementPendingCount}
              </span>
            )}
          </a>
          {isOrganizer && <a href="/admin/logs" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Loggar</a>}
          <a href="/admin/tickets" className="block text-[11px] uppercase tracking-[0.1em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors whitespace-nowrap">Biljetter</a>
          <div className="hidden md:block flex-1" />
          <button onClick={handleLogout} disabled={loggingOut} className="text-[11px] uppercase tracking-[0.1em] text-red-500/70 hover:text-red-400 block w-full text-left transition-colors whitespace-nowrap disabled:opacity-40">
            {loggingOut ? 'Loggar ut...' : 'Logga ut'}
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-10 lg:p-16 overflow-y-auto bg-[#100E0C] relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#C04A2A11_1px,transparent_1px),linear-gradient(to_bottom,#C04A2A11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <header className="relative flex flex-col sm:flex-row justify-between sm:items-end mb-8 sm:mb-12 pb-4 border-b border-[#C04A2A]/20 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-2">Inloggad som</p>
            <h1 className="font-display text-4xl tracking-wide text-[#F0E8D8]">{user.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#F0E8D8]/45">
              <span>{user.role}</span>
              <span>ID {user.id}</span>
              <button onClick={handleCopyId} className="text-[#C04A2A] hover:text-[#F0E8D8] transition-colors">
                {copied ? 'Kopierat' : 'Kopiera ID'}
              </button>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:min-w-80 bg-[#141210]/70 border border-[#C04A2A]/20 rounded-sm p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Konto</p>
            {editingName ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 p-2.5 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-sm text-[#F0E8D8] outline-none focus:border-[#C04A2A]/60" />
                <button onClick={handleSaveName} disabled={savingName} className="px-4 py-2 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.15em] rounded-sm disabled:opacity-50">
                  {savingName ? 'Sparar' : 'Spara'}
                </button>
                <button onClick={() => { setEditingName(false); setName(user.name || '') }} className="px-4 py-2 border border-[#F0E8D8]/20 text-[#F0E8D8]/60 text-[10px] uppercase tracking-[0.15em] rounded-sm">
                  Avbryt
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)} className="text-[11px] uppercase tracking-[0.15em] text-[#F0E8D8]/70 hover:text-[#C04A2A] transition-colors">
                Ändra visningsnamn
              </button>
            )}
          </div>
        </header>
        <div className="relative">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
