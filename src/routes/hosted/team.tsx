import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  getMyFoundaryApplicationsFn,
  getMyOrganizationMembersFn,
  getHostedAccessControlFn,
  inviteOrganizationMemberFn,
  updateOrganizationMemberAccessFn,
  getOrganizationMemberStorageFilesFn,
  transferSelectedOrganizationFilesFn,
  removeOrganizationMemberFn,
} from '../../server/functions/foundary'

type MemberFile = {
  id: number
  fileName: string
  sizeBytes: number
  createdAt: string | Date
  objectKey: string
}

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

  const [dangerMessage, setDangerMessage] = useState('')
  const [dangerMemberUserId, setDangerMemberUserId] = useState<number | null>(null)
  const [loadingFilesUserId, setLoadingFilesUserId] = useState<number | null>(null)
  const [transferringUserId, setTransferringUserId] = useState<number | null>(null)
  const [removingUserId, setRemovingUserId] = useState<number | null>(null)
  const [memberFiles, setMemberFiles] = useState<Record<number, MemberFile[]>>({})
  const [selectedFileIds, setSelectedFileIds] = useState<Record<number, number[]>>({})

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

  const openDeleteMemberModal = async (userId: number) => {
    if (!primaryOrganization || !isOwner) return

    setDangerMessage('')
    setDangerMemberUserId(userId)
    setLoadingFilesUserId(userId)

    try {
      const files = await getOrganizationMemberStorageFilesFn({
        data: {
          organizationName: primaryOrganization,
          userId,
        },
      })

      setMemberFiles((curr) => ({ ...curr, [userId]: files }))
      setSelectedFileIds((curr) => ({ ...curr, [userId]: files.map((file) => file.id) }))
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not load member files')
    } finally {
      setLoadingFilesUserId(null)
    }
  }

  const closeDeleteMemberModal = () => {
    setDangerMemberUserId(null)
    setDangerMessage('')
  }

  const toggleSelectedFile = (userId: number, fileId: number, checked: boolean) => {
    setSelectedFileIds((curr) => {
      const previous = curr[userId] ?? []
      const next = checked ? Array.from(new Set([...previous, fileId])) : previous.filter((id) => id !== fileId)
      return { ...curr, [userId]: next }
    })
  }

  const transferSelectedFilesToMe = async (fromUserId: number) => {
    if (!primaryOrganization || !isOwner) return 0

    const fileIds = selectedFileIds[fromUserId] ?? []
    if (fileIds.length === 0) {
      setDangerMessage('Select at least one file to transfer.')
      return 0
    }

    setDangerMessage('')
    setTransferringUserId(fromUserId)

    try {
      const result = await transferSelectedOrganizationFilesFn({
        data: {
          organizationName: primaryOrganization,
          fromUserId,
          toUserId: currentUserId,
          fileIds,
        },
      })

      setDangerMessage(`Transferred ${result.transferredFileCount} files to you.`)
      setMemberFiles((curr) => ({
        ...curr,
        [fromUserId]: (curr[fromUserId] ?? []).filter((file) => !fileIds.includes(file.id)),
      }))
      setSelectedFileIds((curr) => ({ ...curr, [fromUserId]: [] }))
      await router.invalidate()
      return result.transferredFileCount
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not transfer selected files')
      return 0
    } finally {
      setTransferringUserId(null)
    }
  }

  const deleteMember = async (userId: number, transferredFileCount = 0) => {
    if (!primaryOrganization || !isOwner) return

    setDangerMessage('')
    setRemovingUserId(userId)

    try {
      const response = await removeOrganizationMemberFn({
        data: {
          organizationName: primaryOrganization,
          userId,
          transferredFileCount,
        },
      })

      setDangerMessage(`Member removed. Deleted ${response.deletedFileCount} remaining uploaded files.`)
      closeDeleteMemberModal()
      await router.invalidate()
    } catch (error: any) {
      setDangerMessage(error?.message || 'Could not remove member')
    } finally {
      setRemovingUserId(null)
    }
  }

  const dangerMember =
    dangerMemberUserId != null
      ? members.find((member) => member.organizationName === primaryOrganization && member.userId === dangerMemberUserId) ?? null
      : null

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Organization access</p>
        <p className="mt-2 text-sm text-muted-foreground">Configure who in your organization can manage members, funds, tickets, and storage.</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Organization state: {organizationState}</p>
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
                          Boolean((memberAccessOverrides[member.userId] ?? (member as any))[field])
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean((memberAccessOverrides[member.userId] ?? (member as any))[field])}
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
                      <button
                        type="button"
                        disabled={removingUserId === member.userId}
                        onClick={() => openDeleteMemberModal(member.userId)}
                        className="rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Delete member account
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {accessMessage && <p className="mt-2 text-sm text-muted-foreground">{accessMessage}</p>}
      </div>

      {dangerMember && primaryOrganization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl border border-red-500/40 bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-700">Danger zone</p>
              <button type="button" onClick={closeDeleteMemberModal} className="text-xs text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>

            <p className="mt-2 text-sm text-red-800">THIS action has consiquenses and can NOT be un-done.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              WHen a member is deleted they will not be able to: Login to their account, Acsess their files.
            </p>

            <div className="mt-4 space-y-3 rounded border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-sm font-medium text-foreground">Delete member and transsfer the selected files to me.</p>
              <p className="text-xs text-muted-foreground">Select the files you want to keep before deleting this member account.</p>

              <div className="max-h-56 space-y-2 overflow-auto rounded border border-border bg-background p-2">
                {loadingFilesUserId === dangerMember.userId ? (
                  <p className="p-2 text-xs text-muted-foreground">Loading files...</p>
                ) : (memberFiles[dangerMember.userId] ?? []).length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">No files found for this member.</p>
                ) : (
                  (memberFiles[dangerMember.userId] ?? []).map((file) => (
                    <label key={file.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={(selectedFileIds[dangerMember.userId] ?? []).includes(file.id)}
                        onChange={(event) => toggleSelectedFile(dangerMember.userId, file.id, event.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="truncate">{file.fileName}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={transferringUserId === dangerMember.userId}
                  onClick={() => transferSelectedFilesToMe(dangerMember.userId)}
                  className="rounded border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background disabled:opacity-50"
                >
                  {transferringUserId === dangerMember.userId ? 'Transferring...' : 'Transfer selected files to me'}
                </button>

                <button
                  type="button"
                  disabled={removingUserId === dangerMember.userId}
                  onClick={() => deleteMember(dangerMember.userId, 0)}
                  className="rounded border border-red-500/40 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {removingUserId === dangerMember.userId ? 'Removing...' : 'Delete member account'}
                </button>

                <button
                  type="button"
                  disabled={transferringUserId === dangerMember.userId || removingUserId === dangerMember.userId}
                  onClick={async () => {
                    const transferredCount = await transferSelectedFilesToMe(dangerMember.userId)
                    await deleteMember(dangerMember.userId, transferredCount)
                  }}
                  className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Delete member and transsfer the selected files to me
                </button>
              </div>
            </div>

            {dangerMessage && <p className="mt-3 text-sm text-red-700">{dangerMessage}</p>}
          </div>
        </div>
      )}
    </section>
  )
}
