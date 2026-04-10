import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  getMyFoundaryApplicationsFn,
  getMyOrganizationMembersFn,
  getHostedAccessControlFn,
  inviteOrganizationMemberFn,
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

    return { applications, members, accessControl }
  },
  component: HostedTeamPage,
})

function HostedTeamPage() {
  const router = useRouter()
  const { applications, members, accessControl } = Route.useLoaderData()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [accessMessage, setAccessMessage] = useState('')
  const [savingAccessUserId, setSavingAccessUserId] = useState<number | null>(null)

  const primaryOrganization = accessControl.organizationName || applications[0]?.organizationName || ''
  const organizationState = accessControl.organizationState?.status || 'none'
  const canManageMembers = Boolean(accessControl.permissions?.canManageMembers)

  const updateMemberAccess = async (
    userId: number,
    field: 'canManageMembers' | 'canRequestFunds' | 'canManageTickets' | 'canAccessStorage',
    checked: boolean,
  ) => {
    if (!primaryOrganization) return

    const member = members.find((row) => row.userId === userId && row.organizationName === primaryOrganization)
    if (!member) return

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
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Member</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                      ['canManageMembers', 'Manage members'],
                      ['canRequestFunds', 'Request funds'],
                      ['canManageTickets', 'Tickets'],
                      ['canAccessStorage', 'Storage'],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean((member as any)[field])}
                          disabled={!canManageMembers || savingAccessUserId === member.userId}
                          onChange={(event) => updateMemberAccess(member.userId, field, event.target.checked)}
                          className="accent-primary"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
        {accessMessage && <p className="mt-2 text-sm text-muted-foreground">{accessMessage}</p>}
      </div>
    </section>
  )
}
