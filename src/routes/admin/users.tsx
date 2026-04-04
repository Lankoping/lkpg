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
      await changePasswordFn({ data: { userId, newPassword } })
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
    if (!window.confirm('Are you sure you want to delete this user?')) return
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
      await createUserFn({ data: { email, password, name: name || undefined, role } })
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
        data: { userId, name: editingName || 'Unnamed user', role: editingRole, active: editingActive },
      })
      setEditingUserId(null)
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Could not update user')
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
    const q = searchQuery.toLowerCase()
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.role?.toLowerCase().includes(q)
    )
  })

  const hasDemoAccounts = demoAccounts.length > 0
  const activeDemoCount = demoAccounts.filter((a) => a.active !== false).length
  const inactiveDemoCount = demoAccounts.length - activeDemoCount
  const isAnyDemoActive = activeDemoCount > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground">Members</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Create organizers and hosts, rename users, and copy IDs for digital signing.
        </p>
      </div>

      {/* Demo accounts */}
      <div className="bg-card border border-border p-5 rounded">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Demo accounts</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active: {activeDemoCount} · Inactive: {inactiveDemoCount}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => handleSetDemoAccountsActive(false)}
              disabled={isTogglingDemo || !hasDemoAccounts || !isAnyDemoActive}
              className="px-4 py-2 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
            >
              {isTogglingDemo ? 'Working...' : 'Disable demo'}
            </button>
            <button
              type="button"
              onClick={() => handleSetDemoAccountsActive(true)}
              disabled={isTogglingDemo || !hasDemoAccounts || isAnyDemoActive}
              className="px-4 py-2 text-sm border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
            >
              {isTogglingDemo ? 'Working...' : 'Enable demo'}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {demoAccounts.map((account) => (
            <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border border-border bg-background rounded">
              <div>
                <p className="text-sm text-foreground font-medium">{account.name || 'Demo account'}</p>
                <p className="text-xs text-muted-foreground font-mono">{account.email}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${account.active === false ? 'border-red-200 text-red-600 bg-red-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}`}>
                {account.active === false ? 'Inactive' : 'Active'}
              </span>
            </div>
          ))}
          {!hasDemoAccounts && <p className="text-sm text-muted-foreground">No demo accounts found.</p>}
          {demoToggleError && <p className="text-red-500 text-sm">{demoToggleError}</p>}
        </div>
      </div>

      {/* Create user */}
      <form onSubmit={handleCreateUser} className="bg-card border border-border p-5 rounded">
        <h3 className="font-medium text-foreground mb-4">Create new user</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'organizer' | 'volunteer')}
              className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
            >
              <option value="volunteer">Host</option>
              <option value="organizer">Organizer</option>
            </select>
          </div>
          <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-border gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {isSaving ? 'Creating...' : 'Create user'}
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        </div>
      </form>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2.5 pl-9 bg-background border border-border rounded text-foreground text-sm transition-colors placeholder:text-muted-foreground outline-none focus:border-primary/60"
        />
        <span className="absolute left-3 top-2.5 text-muted-foreground text-base">⌕</span>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-card border border-border hover:border-primary/30 rounded transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-foreground">{user.name || 'Unnamed user'}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>ID {user.id}</span>
                  <span>·</span>
                  <button type="button" onClick={() => handleCopyId(user.id)} className="text-primary hover:underline transition-colors">
                    {copiedId === user.id ? 'Copied!' : 'Copy ID'}
                  </button>
                  {user.active === false && <span className="text-red-500 font-medium">· Locked</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-medium border border-primary/30 text-primary bg-primary/5 rounded">
                  {user.role === 'organizer' ? 'Organizer' : 'Host'}
                </span>
                <button
                  type="button"
                  onClick={() => handleStartEdit(user)}
                  className="px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 rounded transition-colors"
                >
                  Edit
                </button>
                {(user.role !== 'organizer' || user.id === currentUser?.id) && (
                  <button
                    type="button"
                    onClick={() => { setChangingPasswordId(user.id); setNewPassword(''); setChangePasswordError('') }}
                    className="px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 rounded transition-colors"
                  >
                    Change password
                  </button>
                )}
                {user.id !== currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={isDeletingId === user.id}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  >
                    {isDeletingId === user.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>

            {editingUserId === user.id && (
              <div className="px-4 pb-4 border-t border-border space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full p-2.5 bg-background border border-border rounded text-sm text-foreground outline-none focus:border-primary/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Role</label>
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as 'organizer' | 'volunteer')}
                      disabled={user.id === currentUser?.id}
                      className="w-full p-2.5 bg-background border border-border rounded text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-50"
                    >
                      <option value="volunteer">Host</option>
                      <option value="organizer">Organizer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Account</label>
                    <label className="flex items-center gap-2 p-2.5 border border-border rounded text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingActive}
                        onChange={(e) => setEditingActive(e.target.checked)}
                        disabled={user.id === currentUser?.id}
                        className="accent-primary"
                      />
                      Active account
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateUser(user.id)}
                    disabled={isUpdatingId === user.id}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isUpdatingId === user.id ? 'Saving...' : 'Save user'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="px-4 py-2 border border-border text-muted-foreground text-sm rounded hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {changingPasswordId === user.id && (
              <form onSubmit={(e) => handleChangePassword(user.id, e)} className="px-4 pb-4 border-t border-border pt-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1.5">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full p-2.5 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors font-mono"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isChangingPassword ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangingPasswordId(null)}
                      className="flex-1 sm:flex-none px-4 py-2.5 border border-border text-muted-foreground text-sm rounded hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                {changePasswordError && <p className="text-red-500 text-sm mt-2">{changePasswordError}</p>}
              </form>
            )}
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded">
            <p>{users.length === 0 ? 'No users found.' : 'No users matched your search.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
