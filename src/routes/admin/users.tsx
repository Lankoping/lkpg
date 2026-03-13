import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  createUserFn,
  getUsersFn,
  changePasswordFn,
  deleteUserFn,
  getSessionFn,
  updateUserFn,
  getDemoAccountsFn,
  setDemoAccountsActiveFn,
} from '../../server/functions/auth'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/admin' })
    }
  },
  loader: async () => {
    return {
      users: await getUsersFn(),
      currentUser: await getSessionFn(),
      demoAccounts: await getDemoAccountsFn(),
    }
  },
  component: AdminUsers,
})

function AdminUsers() {
  const router = useRouter()
  const { users, currentUser, demoAccounts } = Route.useLoaderData()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'organizer' | 'volunteer'>('volunteer')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  
  const [changingPasswordId, setChangingPasswordId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [changePasswordError, setChangePasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingRole, setEditingRole] = useState<'organizer' | 'volunteer'>('volunteer')
  const [editingActive, setEditingActive] = useState(true)
  const [isUpdatingId, setIsUpdatingId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isTogglingDemo, setIsTogglingDemo] = useState(false)
  const [demoToggleError, setDemoToggleError] = useState('')

  const handleChangePassword = async (userId: number, e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError('')
    setIsChangingPassword(true)

    try {
      await changePasswordFn({
        data: {
          userId,
          newPassword,
        },
      })
      setChangingPasswordId(null)
      setNewPassword('')
      await router.invalidate()
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Could not change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Är du säker på att du vill ta bort den här användaren?')) return;
    setIsDeletingId(userId)
    try {
      await deleteUserFn({ data: { userId } })
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Could not delete user')
    } finally {
      setIsDeletingId(null)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)

    try {
      await createUserFn({
        data: {
          email,
          password,
          name: name || undefined,
          role,
        },
      })

      setEmail('')
      setPassword('')
      setName('')
      setRole('volunteer')
      await router.invalidate()
    } catch (err: any) {
      setError(err?.message || 'Could not create user')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyId = async (userId: number) => {
    await navigator.clipboard.writeText(String(userId))
    setCopiedId(userId)
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  const handleStartEdit = (user: (typeof users)[number]) => {
    setEditingUserId(user.id)
    setEditingName(user.name || '')
    setEditingRole(user.role as 'organizer' | 'volunteer')
    setEditingActive(user.active !== false)
  }

  const handleUpdateUser = async (userId: number) => {
    setIsUpdatingId(userId)
    try {
      await updateUserFn({
        data: {
          userId,
          name: editingName || 'Unnamed user',
          role: editingRole,
          active: editingActive,
        },
      })
      setEditingUserId(null)
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Kunde inte uppdatera användaren')
    } finally {
      setIsUpdatingId(null)
    }
  }

  const handleSetDemoAccountsActive = async (active: boolean) => {
    setDemoToggleError('')
    setIsTogglingDemo(true)
    try {
      await setDemoAccountsActiveFn({ data: { active } })
      await router.invalidate()
    } catch (err: any) {
      setDemoToggleError(err?.message || 'Could not update demo accounts')
    } finally {
      setIsTogglingDemo(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  const hasDemoAccounts = demoAccounts.length > 0
  const activeDemoCount = demoAccounts.filter((account) => account.active !== false).length
  const inactiveDemoCount = demoAccounts.length - activeDemoCount
  const isAnyDemoActive = activeDemoCount > 0

  return (
    <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-2">Hantera</p>
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2">Användare</h2>
        <p className="text-xs text-[#F0E8D8]/50">Skapa organisatörer och volontärer, byt namn och kopiera ID för digital signering.</p>
      </div>

      <div className="mb-8 p-5 sm:p-6 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Demo-konton</p>
            <p className="text-xs text-[#F0E8D8]/60">
              Aktiva: {activeDemoCount} · Inaktiva: {inactiveDemoCount}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
              type="button"
              onClick={() => handleSetDemoAccountsActive(false)}
              disabled={isTogglingDemo || !hasDemoAccounts || !isAnyDemoActive}
              className="px-4 py-2 text-[10px] uppercase tracking-[0.15em] font-medium border border-red-900/40 text-red-400/80 hover:text-red-300 hover:border-red-400/60 rounded-sm transition-colors disabled:opacity-40"
            >
              {isTogglingDemo ? 'Arbetar...' : 'Inaktivera demo'}
            </button>
            <button
              type="button"
              onClick={() => handleSetDemoAccountsActive(true)}
              disabled={isTogglingDemo || !hasDemoAccounts || isAnyDemoActive}
              className="px-4 py-2 text-[10px] uppercase tracking-[0.15em] font-medium border border-emerald-900/40 text-emerald-300/90 hover:text-emerald-200 hover:border-emerald-300/60 rounded-sm transition-colors disabled:opacity-40"
            >
              {isTogglingDemo ? 'Arbetar...' : 'Aktivera demo'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {demoAccounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border border-[#C04A2A]/15 bg-[#100E0C]/70 rounded-sm">
              <div>
                <p className="text-xs text-[#F0E8D8] font-medium">{account.name || 'Demo-konto'}</p>
                <p className="text-[11px] text-[#F0E8D8]/45 font-mono">{account.email}</p>
              </div>
              <span className={`px-2 py-1 text-[10px] uppercase tracking-[0.15em] border rounded-sm ${account.active === false ? 'border-red-400/30 text-red-300/80 bg-red-900/20' : 'border-emerald-400/30 text-emerald-200/90 bg-emerald-900/20'}`}>
                {account.active === false ? 'Inaktivt' : 'Aktivt'}
              </span>
            </div>
          ))}

          {!hasDemoAccounts && (
            <p className="text-xs text-[#F0E8D8]/50">Inga demo-konton hittades.</p>
          )}

          {demoToggleError && (
            <p className="text-red-400/80 text-[11px] tracking-wide uppercase font-medium">{demoToggleError}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleCreateUser} className="mb-12 grid gap-4 lg:grid-cols-2 p-5 sm:p-6 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm relative group">
        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#C04A2A]/50 to-transparent" />
        
        <div className="relative">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">E-post</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="namn@exempel.se"
            className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm placeholder:text-[#F0E8D8]/20 transition-all font-mono"
            required
          />
        </div>
        
        <div className="relative">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Lösenord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm placeholder:text-[#F0E8D8]/20 transition-all font-mono"
            required
          />
        </div>

        <div className="relative">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Namn</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Visningsnamn (frivilligt)"
            className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm placeholder:text-[#F0E8D8]/20 transition-all"
          />
        </div>

        <div className="relative">
          <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Behörighet</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'organizer' | 'volunteer')}
            className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-[11px] uppercase tracking-[0.2em]"
          >
            <option value="volunteer">Volontär</option>
            <option value="organizer">Organisatör</option>
          </select>
        </div>
        
        <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between mt-2 pt-4 border-t border-[#C04A2A]/10 gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(192,74,42,0.3)] disabled:opacity-50 disabled:hover:scale-100 w-full sm:w-auto"
          >
            {isSaving ? 'Skapar...' : 'Skapa användare'}
          </button>
          {error && <p className="text-red-400/80 text-[11px] tracking-wide uppercase font-medium">{error}</p>}
        </div>
      </form>

      <div className="mb-6 p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Sök på namn, e-post eller behörighet..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 pl-10 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all placeholder:text-[#F0E8D8]/30"
          />
          <span className="absolute left-3 top-[10px] text-[#C04A2A]/50 text-lg">⌕</span>
        </div>
      </div>

      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="relative group p-4 sm:p-6 bg-[#1A1816]/50 border border-[#C04A2A]/20 hover:border-[#C04A2A]/50 rounded-sm transition-all hover:bg-[#1C1A18]">
            <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-[#C04A2A] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-display text-xl tracking-wide text-[#F0E8D8] mb-1">{user.name || 'Namnlös användare'}</p>
                <p className="text-xs text-[#F0E8D8]/40 font-mono tracking-tight">{user.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/35">
                  <span>ID {user.id}</span>
                  <button type="button" onClick={() => handleCopyId(user.id)} className="text-[#C04A2A] hover:text-[#F0E8D8] transition-colors">
                    {copiedId === user.id ? 'Kopierat' : 'Kopiera ID'}
                  </button>
                  {user.active === false && <span className="text-red-400">Låst</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handleStartEdit(user)}
                  className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-[#C04A2A]/30 text-[#C04A2A] hover:border-[#C04A2A]/60 transition-colors"
                >
                  Redigera
                </button>
                {(user.role !== 'organizer' || user.id === currentUser?.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPasswordId(user.id)
                      setNewPassword('')
                      setChangePasswordError('')
                    }}
                    className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-[#F0E8D8]/20 text-[#F0E8D8]/60 hover:text-[#C04A2A] hover:border-[#C04A2A]/50 transition-colors"
                  >
                    Byt lösenord
                  </button>
                )}
                {user.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={isDeletingId === user.id}
                    className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-red-900/40 text-red-500/70 hover:text-red-500 hover:border-red-500/50 transition-colors disabled:opacity-50"
                  >
                    {isDeletingId === user.id ? 'Tar bort...' : 'Ta bort'}
                  </button>
                )}
                <span className="px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-[#C04A2A]/30 text-[#C04A2A] bg-[#C04A2A]/10">
                  {user.role}
                </span>
              </div>
            </div>

            {editingUserId === user.id && (
              <div className="mt-4 pt-4 border-t border-[#C04A2A]/10 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Namn</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full p-2 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-sm text-[#F0E8D8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Roll</label>
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as 'organizer' | 'volunteer')}
                      disabled={user.id === currentUser?.id}
                      className="w-full p-2 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-sm text-[#F0E8D8] disabled:opacity-50"
                    >
                      <option value="volunteer">Volunteer</option>
                      <option value="organizer">Organizer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2">Konto</label>
                    <label className="flex items-center gap-2 p-2 border border-[#C04A2A]/20 rounded-sm text-sm text-[#F0E8D8]">
                      <input type="checkbox" checked={editingActive} onChange={(e) => setEditingActive(e.target.checked)} disabled={user.id === currentUser?.id} className="accent-[#C04A2A]" />
                      Aktivt konto
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateUser(user.id)}
                    disabled={isUpdatingId === user.id}
                    className="px-4 py-2 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.15em] rounded-sm disabled:opacity-50"
                  >
                    {isUpdatingId === user.id ? 'Sparar...' : 'Spara anvandare'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="px-4 py-2 border border-[#F0E8D8]/20 text-[#F0E8D8]/60 text-[10px] uppercase tracking-[0.15em] rounded-sm"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
            
            {changingPasswordId === user.id && (
              <form onSubmit={(e) => handleChangePassword(user.id, e)} className="mt-4 pt-4 border-t border-[#C04A2A]/10">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-[#C04A2A] mb-2 sm:mb-2 mt-1 sm:mt-0">Nytt lösenord</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nytt lösenord"
                      className="w-full p-2 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm transition-all font-mono"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="flex-1 sm:flex-none px-4 py-2 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] transition-all disabled:opacity-50 text-center"
                    >
                      {isChangingPassword ? 'Sparar...' : 'Spara'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangingPasswordId(null)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-transparent text-[#F0E8D8]/60 text-[10px] uppercase tracking-[0.15em] font-medium rounded-sm border border-[#F0E8D8]/20 hover:text-[#F0E8D8] hover:border-[#F0E8D8]/40 transition-all text-center"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
                {changePasswordError && <p className="text-red-400/80 text-[10px] tracking-wide uppercase font-medium mt-2">{changePasswordError}</p>}
              </form>
            )}
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="text-center py-16 text-[#F0E8D8]/50 bg-[#1A1816]/30 border border-dashed border-[#C04A2A]/30 rounded-sm">
            <p className="font-serif italic text-lg mb-4">
              {users.length === 0 ? "Inga användare hittades." : "Inga användare matchade din sökning."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
