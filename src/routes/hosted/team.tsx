import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  getMyFoundaryApplicationsFn,
  getMyOrganizationMembersFn,
  inviteOrganizationMemberFn,
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

    const [applications, members] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyOrganizationMembersFn(),
    ])

    return { applications, members }
  },
  component: HostedTeamPage,
})

function HostedTeamPage() {
  const router = useRouter()
  const { applications, members } = Route.useLoaderData()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

  const primaryOrganization = applications[0]?.organizationName || ''

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
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Invite co-members</p>
        <p className="mt-2 text-sm text-muted-foreground">Invite people to access the same organization and LAN applications.</p>
      </div>

      {!primaryOrganization ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Submit at least one application first to create your organization workspace.
        </div>
      ) : (
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
                <div key={`${member.organizationName}-${member.userId}`} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Member</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  )
}
