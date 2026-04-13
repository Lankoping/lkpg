import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  deleteMyOrganizationAccountFn,
  deleteOrganizationFn,
  getMyFoundaryApplicationsFn,
  getMyOrganizationMembersFn,
  getHostedAccessControlFn,
  inviteOrganizationMemberFn,
  removeOrganizationMemberFn,
  transferOrganizationMemberFilesFn,
  updateOrganizationMemberAccessFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/hosted/team')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const [applications, members, accessControl] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyOrganizationMembersFn(),
      getHostedAccessControlFn(),
    ])

    return { applications, members, accessControl, currentUserId: user.id }
  },
  component: HostedTeamPage,
})

function HostedTeamPage() {
  const router = useRouter()
  const { applications, members, accessControl, currentUserId } = Route.useLoaderData()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [accessMessage, setAccessMessage] = useState('')
  const [savingAccessUserId, setSavingAccessUserId] = useState<number | null>(null)
  const [removingUserId, setRemovingUserId] = useState<number | null>(null)
  const [transferringUserId, setTransferringUserId] = useState<number | null>(null)
  const [transferTargets, setTransferTargets] = useState<Record<number, number>>({})
  const [dangerMessage, setDangerMessage] = useState('')
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('')
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState('')
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false)
  const [deleteOrgBusy, setDeleteOrgBusy] = useState(false)

  const primaryOrganization = accessControl.organizationName || applications[0]?.organizationName || ''
  const organizationState = accessControl.organizationState?.status || 'none'
  const canManageMembers = Boolean(accessControl.permissions?.canManageMembers)
  const ownerUserId = useMemo(() => {
    if (!primaryOrganization) return null
    const orgMembers = members
      .filter((member) => member.organizationName === primaryOrganization)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return orgMembers[0]?.userId ?? null
  }, [members, primaryOrganization])
  const isOwner = Boolean(ownerUserId && ownerUserId === currentUserId)
  const [memberAccessOverrides, setMemberAccessOverrides] = useState<
    Record<number, { canManageMembers: boolean; canRequestFunds: boolean; canManageTickets: boolean; canAccessStorage: boolean }>
  >({})

  const updateMemberAccess = async (
    userId: number,
    field: 'canManageMembers' | 'canRequestFunds' | 'canManageTickets' | 'canAccessStorage',
    checked: boolean,
  ) => {
    if (!primaryOrganization) return

    const member = members.find((row) => row.userId === userId && row.organizationName === primaryOrganization)
    if (!member) return
    if (ownerUserId && userId === ownerUserId) {
      setAccessMessage('Owner access cannot be modified.')
      return
    }

    const baselineAccess = {
      canManageMembers: Boolean(member.canManageMembers),
      canRequestFunds: Boolean(member.canRequestFunds),
      canManageTickets: Boolean(member.canManageTickets),
      canAccessStorage: Boolean(member.canAccessStorage),
    }
    const optimistic = {
      ...(memberAccessOverrides[userId] ?? baselineAccess),
      [field]: checked,
    }
    setMemberAccessOverrides((curr) => ({ ...curr, [userId]: optimistic }))

    setAccessMessage('')
    setSavingAccessUserId(userId)

    try {
      await updateOrganizationMemberAccessFn({
        data: {
          organizationName: primaryOrganization,
          userId,
          canManageMembers: field === 'canManageMembers' ? checked : Boolean(member.canManageMembers),
          canRequestFunds: field === 'canRequestFunds' ? checked : Boolean(member.canRequestFunds),
          canManageTickets: field === 'canManageTickets' ? checked : Boolean(member.canManageTickets),
          canAccessStorage: field === 'canAccessStorage' ? checked : Boolean(member.canAccessStorage),
        },
      })
      setAccessMessage('Access settings updated.')
      await router.invalidate()
    } catch (error: any) {
      setAccessMessage(error?.message || 'Could not update access settings')
      setMemberAccessOverrides((curr) => {
        const next = { ...curr }
        delete next[userId]
        return next
      })
    } finally {
      setSavingAccessUserId(null)
    }
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!primaryOrganization) return

    setInviteBusy(true)
    setInviteMessage('')

    try {
      const response = await inviteOrganizationMemberFn({
        data: {
          organizationName: primaryOrganization,
          email: inviteEmail,
        },
      })

      setInviteMessage(`Invite email sent to ${response.invitedEmail}.`)
      setInviteEmail('')
      await router.invalidate()
    } catch (inviteError: any) {
      setInviteMessage(inviteError?.message || 'Could not invite member')
    } finally {
      setInviteBusy(false)
    }
  }

  const handleRemoveMember = async (userId: number, email: string) => {
    if (!primaryOrganization || !isOwner) return

    const confirmed = window.confirm(
      `Remove ${email} from ${primaryOrganization}? Their uploaded files for this organization will also be deleted.`,
    )
    if (!confirmed) return

    setDangerMessage('')
    setRemovingUserId(userId)
    try {
      const response = await removeOrganizationMemberFn({
        data: {
          organizationName: primaryOrganization,
          userId,
        },
      })
      setDangerMessage(`Member removed. Deleted ${response.deletedFileCount} uploaded files.`)
      await router.invalidate()
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not remove member')
    } finally {
      setRemovingUserId(null)
    }
  }

  const handleTransferFiles = async (fromUserId: number) => {
    if (!primaryOrganization || !isOwner) return

    const toUserId = transferTargets[fromUserId]
    if (!toUserId) {
      setDangerMessage('Select a destination member before transferring files.')
      return
    }

    setDangerMessage('')
    setTransferringUserId(fromUserId)
    try {
      const result = await transferOrganizationMemberFilesFn({
        data: {
          organizationName: primaryOrganization,
          fromUserId,
          toUserId,
        },
      })

      setDangerMessage(`Transferred ${result.transferredFileCount} files to the selected member.`)
      await router.invalidate()
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not transfer file ownership')
    } finally {
      setTransferringUserId(null)
    }
  }

  const handleDeleteMyAccount = async () => {
    if (!primaryOrganization || deleteAccountConfirm !== 'DELETE MY ACCOUNT') return
    setDangerMessage('')
    setDeleteAccountBusy(true)
    try {
      await deleteMyOrganizationAccountFn({
        data: {
          organizationName: primaryOrganization,
        },
      })
      setDangerMessage('Your account was removed from this organization.')
      await router.invalidate()
      await router.navigate({ to: '/hosted' })
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not delete your account')
    } finally {
      setDeleteAccountBusy(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!primaryOrganization || !isOwner || deleteOrgConfirm !== `DELETE ${primaryOrganization}`) return
    setDangerMessage('')
    setDeleteOrgBusy(true)
    try {
      const result = await deleteOrganizationFn({
        data: {
          organizationName: primaryOrganization,
        },
      })
      setDangerMessage(
        `Organization deleted. Removed ${result.deletedMemberCount} members and ${result.deletedFileCount} files.`,
      )
      await router.invalidate()
      await router.navigate({ to: '/hosted' })
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not delete organization')
    } finally {
      setDeleteOrgBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Organization access</p>
        <p className="mt-2 text-sm text-muted-foreground">Configure who in your organization can manage members, funds, tickets, and storage.</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Organization state: {organizationState}
        </p>
      </div>

      {!primaryOrganization ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Submit at least one application first to create your organization workspace.
        </div>
      ) : canManageMembers ? (
        <form onSubmit={handleInvite} className="space-y-3">
          <label className="block text-sm text-muted-foreground">
            Invite by email
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
              placeholder="coworker@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={inviteBusy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {inviteBusy ? 'Sending invite...' : 'Invite member'}
          </button>
          {inviteMessage && <p className="text-sm text-muted-foreground">{inviteMessage}</p>}
        </form>
      ) : (
        <div className="rounded-xl border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
          You can view members, but only members with member-management access can invite or update permissions.
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-primary">Current members</p>
        {members.filter((member) => member.organizationName === primaryOrganization).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">No members added yet.</div>
        ) : (
          <div className="space-y-2">
            {members
              .filter((member) => member.organizationName === primaryOrganization)
              .map((member) => (
                <div key={`${member.organizationName}-${member.userId}`} className="rounded-xl border border-border bg-background px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.name || member.email}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {ownerUserId === member.userId ? 'Owner' : 'Member'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                      ['canManageMembers', 'Manage members'],
                      ['canRequestFunds', 'Request funds'],
                      ['canManageTickets', 'Tickets'],
                      ['canAccessStorage', 'Storage'],
                    ] as const).map(([field, label]) => (
                      <label
                        key={field}
                        className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                          Boolean((memberAccessOverrides[member.userId] ?? member as any)[field])
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean((memberAccessOverrides[member.userId] ?? member as any)[field])}
                          disabled={!canManageMembers || savingAccessUserId === member.userId || ownerUserId === member.userId}
                          onChange={(event) => updateMemberAccess(member.userId, field, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {ownerUserId === member.userId && (
                    <p className="mt-2 text-xs text-muted-foreground">Owner permissions are locked and cannot be changed.</p>
                  )}
                  {isOwner && ownerUserId !== member.userId && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 text-xs text-muted-foreground">Transfer this member's files before removal</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={transferTargets[member.userId] ?? ''}
                          onChange={(event) =>
                            setTransferTargets((curr) => ({
                              ...curr,
                              [member.userId]: Number(event.target.value),
                            }))
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
                        >
                          <option value="">Select destination member</option>
                          {members
                            .filter(
                              (candidate) =>
                                candidate.organizationName === primaryOrganization && candidate.userId !== member.userId,
                            )
                            .map((candidate) => (
                              <option key={candidate.userId} value={candidate.userId}>
                                {candidate.name || candidate.email}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={transferringUserId === member.userId || !transferTargets[member.userId]}
                          onClick={() => handleTransferFiles(member.userId)}
                          className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background disabled:opacity-50"
                        >
                          {transferringUserId === member.userId ? 'Transferring...' : 'Transfer files'}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={removingUserId === member.userId}
                        onClick={() => handleRemoveMember(member.userId, member.email)}
                        className="mt-2 rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {removingUserId === member.userId ? 'Removing...' : 'Delete member account'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
        {accessMessage && <p className="mt-2 text-sm text-muted-foreground">{accessMessage}</p>}
      </div>

      {primaryOrganization && (
        <div className="border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-700">Danger zone</p>
          <p className="mt-2 text-sm text-red-800">THIS action has consiquenses and can NOT be un-done.</p>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete your account from this organization</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This removes your organization membership and deletes files uploaded by your account in this organization.
              </p>
              <input
                value={deleteAccountConfirm}
                onChange={(event) => setDeleteAccountConfirm(event.target.value)}
                placeholder="Type DELETE MY ACCOUNT"
                className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-red-500/60"
              />
              <button
                type="button"
                disabled={deleteAccountBusy || deleteAccountConfirm !== 'DELETE MY ACCOUNT'}
                onClick={handleDeleteMyAccount}
                className="mt-2 rounded border border-red-500/40 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleteAccountBusy ? 'Deleting account...' : 'Delete my account'}
              </button>
            </div>

            {isOwner && (
              <div className="border-t border-red-500/30 pt-4">
                <p className="text-sm font-medium text-foreground">Delete organization</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This removes all team members, organization applications, invitations, and uploaded files.
                </p>
                <input
                  value={deleteOrgConfirm}
                  onChange={(event) => setDeleteOrgConfirm(event.target.value)}
                  placeholder={`Type DELETE ${primaryOrganization}`}
                  className="mt-2 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-red-500/60"
                />
                <button
                  type="button"
                  disabled={deleteOrgBusy || deleteOrgConfirm !== `DELETE ${primaryOrganization}`}
                  onClick={handleDeleteOrganization}
                  className="mt-2 rounded border border-red-500/40 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {deleteOrgBusy ? 'Deleting organization...' : 'Delete organization'}
                </button>
              </div>
            )}
          </div>

          {dangerMessage && <p className="mt-3 text-sm text-red-700">{dangerMessage}</p>}
        </div>
      )}
    </section>
  )
}
