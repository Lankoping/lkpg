import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import { createHostedFundingRequestFn, getMyFoundaryApplicationsFn } from '../../server/functions/foundary'

export const Route = createFileRoute('/hosted/request-funds')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const applications = await getMyFoundaryApplicationsFn()
    return { applications }
  },
  component: HostedRequestFundsPage,
})

function HostedRequestFundsPage() {
  const router = useRouter()
  const { applications } = Route.useLoaderData()
  const [fundingBusy, setFundingBusy] = useState(false)
  const [fundingMessage, setFundingMessage] = useState('')
  const [fundingError, setFundingError] = useState('')
  const [fundingForm, setFundingForm] = useState({
    eventName: '',
    plannedMonths: '',
    expectedAttendees: '',
    requestedFunds: '100',
    briefEventDescription: '',
    budgetJustification: '',
  })

  const primaryOrganization = applications[0]?.organizationName || ''

  const handleFundingRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!primaryOrganization) return

    setFundingBusy(true)
    setFundingError('')
    setFundingMessage('')

    try {
      await createHostedFundingRequestFn({
        data: {
          organizationName: primaryOrganization,
          eventName: fundingForm.eventName,
          plannedMonths: fundingForm.plannedMonths,
          expectedAttendees: Number(fundingForm.expectedAttendees),
          requestedFunds: Number(fundingForm.requestedFunds),
          briefEventDescription: fundingForm.briefEventDescription,
          budgetJustification: fundingForm.budgetJustification,
        },
      })
      setFundingMessage('Funding request submitted and pending review.')
      setFundingForm({
        eventName: '',
        plannedMonths: '',
        expectedAttendees: '',
        requestedFunds: '100',
        briefEventDescription: '',
        budgetJustification: '',
      })
      await router.invalidate()
    } catch (requestError: any) {
      setFundingError(requestError?.message || 'Could not submit funding request')
    } finally {
      setFundingBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Request funds</p>
      <p className="mt-2 text-sm text-muted-foreground">Create a new funding request for your hosted organization.</p>

      {!primaryOrganization ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Submit one initial application first so your organization profile can be used for future requests.
        </div>
      ) : (
        <form onSubmit={handleFundingRequest} className="mt-4 space-y-4">
          <label className="block text-sm text-muted-foreground">
            LAN/Event name
            <input
              required
              value={fundingForm.eventName}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, eventName: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            />
          </label>

          <label className="block text-sm text-muted-foreground">
            Planned month(s)
            <input
              required
              value={fundingForm.plannedMonths}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, plannedMonths: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
              placeholder="e.g. June 2026"
            />
          </label>

          <label className="block text-sm text-muted-foreground">
            Expected attendees
            <input
              required
              type="number"
              min={1}
              value={fundingForm.expectedAttendees}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, expectedAttendees: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            />
          </label>

          <label className="block text-sm text-muted-foreground">
            Requested funds (USD)
            <input
              required
              type="number"
              min={1}
              max={100000}
              value={fundingForm.requestedFunds}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, requestedFunds: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            />
          </label>

          <p className="text-xs text-muted-foreground">Enter the total funding amount you want to request.</p>

          <label className="block text-sm text-muted-foreground">
            Brief event description
            <textarea
              required
              value={fundingForm.briefEventDescription}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, briefEventDescription: event.target.value }))}
              className="mt-1 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            />
          </label>

          <label className="block text-sm text-muted-foreground">
            Budget justification
            <textarea
              required
              value={fundingForm.budgetJustification}
              onChange={(event) => setFundingForm((curr) => ({ ...curr, budgetJustification: event.target.value }))}
              className="mt-1 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary/60"
            />
          </label>

          {fundingError && <p className="text-sm text-red-400">{fundingError}</p>}
          {fundingMessage && <p className="text-sm text-emerald-400">{fundingMessage}</p>}

          <button
            type="submit"
            disabled={fundingBusy}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {fundingBusy ? 'Submitting...' : 'Submit funding request'}
          </button>
        </form>
      )}
    </section>
  )
}
