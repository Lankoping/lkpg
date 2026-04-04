import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  decideFoundaryApplicationFundingFromTicketFn,
  closeFoundaryApplicationTicketFn,
  createFoundaryApplicationTicketFn,
  getFoundaryApplicationMessagesFn,
  getFoundaryApplicationsFn,
  postFoundaryApplicationMessageFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/admin/tickets')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }
  },
  loader: async () => {
    const [applications, messages] = await Promise.all([getFoundaryApplicationsFn(), getFoundaryApplicationMessagesFn()])
    return { applications, messages }
  },
  component: AdminTicketsPage,
})

function AdminTicketsPage() {
  const { applications, messages } = Route.useLoaderData()
  const router = useRouter()

  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [messageDrafts, setMessageDrafts] = useState<Record<number, string>>({})
  const [decisionDrafts, setDecisionDrafts] = useState<Record<number, string>>({})
  const [actionError, setActionError] = useState('')
  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [closingApplicationId, setClosingApplicationId] = useState<number | null>(null)
  const [decidingApplicationId, setDecidingApplicationId] = useState<number | null>(null)

  const rejectionReasons = [
    'The request is missing key budget details.',
    'The event scope is not clear enough to approve funding.',
    'The request does not align with current funding priorities.',
    'Duplicate request already handled in a previous ticket.',
    'We need more information before reconsidering this request.',
  ]

  const approvalNotes = [
    'Approved as requested.',
    'Approved with thanks for the additional details.',
    'Approved and ticket closed.',
  ]

  const messagesByApplication = useMemo(() => {
    const grouped = new Map<number, typeof messages>()
    for (const message of messages) {
      const current = grouped.get(message.applicationId) ?? []
      current.push(message)
      grouped.set(message.applicationId, current)
    }
    return grouped
  }, [messages])

  const selectedApplication = useMemo(() => {
    if (!applications.length) return null
    if (!selectedApplicationId) return applications[0]
    return applications.find((application) => application.id === selectedApplicationId) ?? applications[0]
  }, [applications, selectedApplicationId])

  const selectedMessages = selectedApplication ? (messagesByApplication.get(selectedApplication.id) ?? []) : []
  const hasOrganizerThread = selectedMessages.some((msg) => msg.senderRole === 'organizer')

  const submitTicketMessage = async (applicationId: number) => {
    const message = messageDrafts[applicationId]?.trim()
    if (!message) {
      setActionError('Write a message before sending.')
      return
    }

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setActionError('This ticket is closed.')
      return
    }

    const hasAnyMessages = (messagesByApplication.get(applicationId)?.length ?? 0) > 0

    setActionError('')
    setBusyApplicationId(applicationId)
    try {
      if (!hasAnyMessages) {
        await createFoundaryApplicationTicketFn({ data: { applicationId, message } })
      } else {
        await postFoundaryApplicationMessageFn({ data: { applicationId, message } })
      }

      setMessageDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not send ticket message')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const closeTicket = async (applicationId: number) => {
    setActionError('')
    setClosingApplicationId(applicationId)
    try {
      await closeFoundaryApplicationTicketFn({ data: { applicationId } })
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not close ticket')
    } finally {
      setClosingApplicationId(null)
    }
  }

  const decideFunding = async (applicationId: number, decision: 'approved' | 'rejected') => {
    const reason = decisionDrafts[applicationId]?.trim()

    if (decision === 'rejected' && !reason) {
      setActionError('Please provide a rejection reason before rejecting.')
      return
    }

    setActionError('')
    setDecidingApplicationId(applicationId)
    try {
      await decideFoundaryApplicationFundingFromTicketFn({
        data: {
          applicationId,
          decision,
          reason,
        },
      })
      setDecisionDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not apply decision')
    } finally {
      setDecidingApplicationId(null)
    }
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
        No applications found.
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 md:grid-cols-[340px_1fr]">
        <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Tickets</p>
            <p className="mt-1 text-sm text-muted-foreground">General ticket thread by application</p>
          </div>
          <div className="max-h-[42rem] overflow-auto p-2">
            {applications.map((application) => {
              const thread = messagesByApplication.get(application.id) ?? []
              const selected = selectedApplication?.id === application.id
              const lastMessage = thread[0]

              return (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => setSelectedApplicationId(application.id)}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">#{application.id} {application.eventName}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {application.ticketClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{application.organizationName}</p>
                  {lastMessage && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">Latest: {lastMessage.message}</p>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {selectedApplication ? (
          <div className="p-5">
            <h2 className="font-display text-2xl text-foreground">Ticket #{selectedApplication.id}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedApplication.organizationName} · {selectedApplication.eventName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Funding status: {selectedApplication.status}
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
              {selectedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Send a message to create a ticket thread.</p>
              ) : (
                selectedMessages.map((msg) => (
                  <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            <textarea
              value={messageDrafts[selectedApplication.id] ?? ''}
              onChange={(event) =>
                setMessageDrafts((current) => ({
                  ...current,
                  [selectedApplication.id]: event.target.value,
                }))
              }
              placeholder="Write a general ticket message..."
              className="mt-4 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            />

            <textarea
              value={decisionDrafts[selectedApplication.id] ?? ''}
              onChange={(event) =>
                setDecisionDrafts((current) => ({
                  ...current,
                  [selectedApplication.id]: event.target.value,
                }))
              }
              placeholder="Decision note (required for rejection, optional for approval)"
              className="mt-3 min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            />

            <div className="mt-3 space-y-3 rounded-xl border border-border bg-background p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Premade reject reasons</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rejectionReasons.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() =>
                        setDecisionDrafts((current) => ({
                          ...current,
                          [selectedApplication.id]: reason,
                        }))
                      }
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-red-400/40 hover:text-red-700"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Premade approval notes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {approvalNotes.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() =>
                        setDecisionDrafts((current) => ({
                          ...current,
                          [selectedApplication.id]: note,
                        }))
                      }
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-emerald-400/40 hover:text-emerald-700"
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => submitTicketMessage(selectedApplication.id)}
                disabled={busyApplicationId === selectedApplication.id || selectedApplication.ticketClosed}
                className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {busyApplicationId === selectedApplication.id
                  ? 'Sending...'
                  : selectedMessages.length === 0
                    ? 'Create ticket'
                    : 'Send reply'}
              </button>

              <button
                type="button"
                onClick={() => closeTicket(selectedApplication.id)}
                disabled={closingApplicationId === selectedApplication.id || selectedApplication.ticketClosed}
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
              >
                {closingApplicationId === selectedApplication.id
                  ? 'Closing...'
                  : selectedApplication.ticketClosed
                    ? 'Ticket closed'
                    : 'Close ticket'}
              </button>
            </div>

            {selectedApplication.status === 'pending' && hasOrganizerThread && !selectedApplication.ticketClosed && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => decideFunding(selectedApplication.id, 'approved')}
                  disabled={decidingApplicationId === selectedApplication.id}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {decidingApplicationId === selectedApplication.id ? 'Applying...' : 'Approve funding'}
                </button>
                <button
                  type="button"
                  onClick={() => decideFunding(selectedApplication.id, 'rejected')}
                  disabled={decidingApplicationId === selectedApplication.id}
                  className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                >
                  {decidingApplicationId === selectedApplication.id ? 'Applying...' : 'Reject fund request & close ticket'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
