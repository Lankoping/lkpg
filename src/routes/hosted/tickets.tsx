import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  closeMyHostedSupportTicketFn,
  createHostedApplicationTicketFn,
  createHostedSupportTicketFn,
  getMyHostedSupportTicketsFn,
  getMyFoundaryApplicationMessagesFn,
  getMyFoundaryApplicationsFn,
  postFoundaryApplicationMessageFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/hosted/tickets')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const [applications, messages, supportTickets] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyFoundaryApplicationMessagesFn(),
      getMyHostedSupportTicketsFn(),
    ])

    return { applications, messages, supportTickets }
  },
  component: HostedTicketsPage,
})

function HostedTicketsPage() {
  const { applications, messages, supportTickets } = Route.useLoaderData()
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [supportDraft, setSupportDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [supportSuccessMessage, setSupportSuccessMessage] = useState('')
  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [creatingSupportTicket, setCreatingSupportTicket] = useState(false)
  const [closingSupportTicketId, setClosingSupportTicketId] = useState<number | null>(null)

  const openSupportTickets = useMemo(
    () => supportTickets.filter((ticket) => ticket.status === 'open'),
    [supportTickets],
  )
  const canCreateSupportTicket = openSupportTickets.length < 3

  const messagesByApplication = useMemo(() => {
    const grouped = new Map<number, typeof messages>()
    for (const message of messages) {
      const current = grouped.get(message.applicationId) ?? []
      current.push(message)
      grouped.set(message.applicationId, current)
    }
    return grouped
  }, [messages])

  const filteredApplications = useMemo(() => {
    if (filter === 'all') return applications
    if (filter === 'open') return applications.filter((application) => !application.ticketClosed)
    return applications.filter((application) => application.ticketClosed)
  }, [applications, filter])

  useEffect(() => {
    if (!filteredApplications.length) {
      setSelectedApplicationId(null)
      return
    }

    if (!selectedApplicationId || !filteredApplications.some((application) => application.id === selectedApplicationId)) {
      setSelectedApplicationId(filteredApplications[0].id)
    }
  }, [filteredApplications, selectedApplicationId])

  const selectedApplication = useMemo(() => {
    if (!filteredApplications.length) return null
    if (!selectedApplicationId) return filteredApplications[0]
    return filteredApplications.find((application) => application.id === selectedApplicationId) ?? filteredApplications[0]
  }, [filteredApplications, selectedApplicationId])

  const selectedMessages = selectedApplication ? (messagesByApplication.get(selectedApplication.id) ?? []) : []
  const hasOrganizerThread = selectedMessages.some((msg) => msg.senderRole === 'organizer')
  const hasAnyMessages = selectedMessages.length > 0

  const firstCreatableApplicationId = useMemo(() => {
    for (const application of applications) {
      if (application.ticketClosed) continue
      const threadCount = (messagesByApplication.get(application.id) ?? []).length
      if (threadCount === 0) return application.id
    }
    return null
  }, [applications, messagesByApplication])

  const createTicketButtonLabel = useMemo(() => {
    if (applications.length === 0) return 'No applications'
    const openApplications = applications.filter((application) => !application.ticketClosed)
    if (openApplications.length === 0) return 'No open applications'
    if (!firstCreatableApplicationId) return 'Ticket already exists'
    return 'Create ticket'
  }, [applications, firstCreatableApplicationId])

  const submitTicketMessage = async (applicationId: number) => {
    const message = replyDrafts[applicationId]?.trim()
    if (!message) return

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setActionError('This ticket is closed.')
      return
    }

    setActionError('')
    setBusyApplicationId(applicationId)
    try {
      if (!hasAnyMessages) {
        setActionError('Use Create ticket to open the thread first.')
        return
      } else if (hasOrganizerThread) {
        await postFoundaryApplicationMessageFn({ data: { applicationId, message } })
      } else {
        setActionError('Ticket already created. Please wait for staff to reply.')
        return
      }

      setReplyDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not send ticket message')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const createTicket = async (applicationId: number) => {
    const message = replyDrafts[applicationId]?.trim()
    if (!message) {
      setActionError('Write a message before creating a ticket.')
      return
    }

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setActionError('This ticket is closed.')
      return
    }

    const existingMessages = (messagesByApplication.get(applicationId) ?? []).length > 0
    if (existingMessages) {
      setActionError('Ticket already created for this request.')
      return
    }

    setActionError('')
    setBusyApplicationId(applicationId)
    try {
      await createHostedApplicationTicketFn({ data: { applicationId, message } })
      setReplyDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not create ticket')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const createSupportTicket = async () => {
    const message = supportDraft.trim()
    if (!message) {
      setActionError('Write a message before creating a ticket.')
      return
    }

    setActionError('')
    setSupportSuccessMessage('')
    setCreatingSupportTicket(true)
    try {
      if (!canCreateSupportTicket) {
        setActionError('You already have 3 open tickets. Close one to create a new ticket.')
        return
      }
      await createHostedSupportTicketFn({ data: { message } })
      setSupportDraft('')
      setSupportSuccessMessage('Ticket created. Staff will follow up in this inbox.')
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not create ticket')
    } finally {
      setCreatingSupportTicket(false)
    }
  }

  const closeSupportTicket = async (ticketId: number) => {
    setActionError('')
    setSupportSuccessMessage('')
    setClosingSupportTicketId(ticketId)
    try {
      await closeMyHostedSupportTicketFn({ data: { ticketId } })
      setSupportSuccessMessage('Ticket closed.')
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not close ticket')
    } finally {
      setClosingSupportTicketId(null)
    }
  }

  const supportPanel = (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Support tickets</h2>
      <p className="mt-2 text-xs text-muted-foreground">Open tickets: {openSupportTickets.length}/3</p>

      <textarea
        value={supportDraft}
        onChange={(event) => setSupportDraft(event.target.value)}
        placeholder="Describe what you need help with..."
        className="mt-3 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
      />

      {actionError && <p className="mt-2 text-sm text-red-400">{actionError}</p>}
      {supportSuccessMessage && <p className="mt-2 text-sm text-emerald-400">{supportSuccessMessage}</p>}

      <button
        type="button"
        onClick={createSupportTicket}
        disabled={creatingSupportTicket || !canCreateSupportTicket}
        className="mt-3 rounded-xl border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      >
        {creatingSupportTicket
          ? 'Creating...'
          : canCreateSupportTicket
            ? 'Create ticket'
            : 'Max 3 open tickets'}
      </button>

      <div className="mt-4 space-y-2">
        {supportTickets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No support tickets yet.</p>
        ) : (
          supportTickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Support #{ticket.id}</p>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {ticket.status}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p>
              {ticket.status === 'open' && (
                <button
                  type="button"
                  onClick={() => closeSupportTicket(ticket.id)}
                  disabled={closingSupportTicketId === ticket.id}
                  className="mt-2 rounded-lg border border-border px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {closingSupportTicketId === ticket.id ? 'Closing...' : 'Close ticket'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )

  if (applications.length === 0) {
    return (
      supportPanel
    )
  }

  return (
    <section className="space-y-4">
      {supportPanel}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-0 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Tickets</p>
            <p className="mt-1 text-sm text-muted-foreground">Create and follow support tickets for your requests</p>
          </div>

          <div className="px-4 py-3">
            <div className="inline-grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-1">
              {(['all', 'open', 'closed'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                    filter === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {firstCreatableApplicationId && (
              <button
                type="button"
                onClick={() => {
                  setFilter('open')
                  setSelectedApplicationId(firstCreatableApplicationId)
                  setActionError('')
                }}
                className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {createTicketButtonLabel}
              </button>
            )}
          </div>

          <div className="max-h-[42rem] overflow-auto p-2">
            {filteredApplications.map((application) => {
              const thread = messagesByApplication.get(application.id) ?? []
              const selected = selectedApplication?.id === application.id
              const lastMessage = thread[0]
              const hasThread = thread.some((msg) => msg.senderRole === 'organizer')

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
                      {application.ticketClosed ? 'Closed' : hasThread ? 'Open' : 'No reply yet'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{application.organizationName}</p>
                  {lastMessage && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      Latest: {lastMessage.message}
                    </p>
                  )}
                </button>
              )
            })}

            {filteredApplications.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No {filter} tickets found.
              </div>
            )}
          </div>
        </aside>

        {selectedApplication ? (
          <div className="p-5">
            <h2 className="font-display text-2xl text-foreground">Ticket #{selectedApplication.id}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedApplication.organizationName} · {selectedApplication.eventName}
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
              {selectedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
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
              value={replyDrafts[selectedApplication.id] ?? ''}
              onChange={(event) =>
                setReplyDrafts((current) => ({
                  ...current,
                  [selectedApplication.id]: event.target.value,
                }))
              }
              placeholder="Reply to this ticket..."
              className="mt-4 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
            />

            {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}

            <div className="mt-3">
              {!hasAnyMessages ? (
                <button
                  type="button"
                  onClick={() => createTicket(selectedApplication.id)}
                  disabled={busyApplicationId === selectedApplication.id || selectedApplication.ticketClosed}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {busyApplicationId === selectedApplication.id
                    ? 'Creating...'
                    : selectedApplication.ticketClosed
                      ? 'Ticket closed'
                      : 'Create ticket'}
                </button>
              ) : hasOrganizerThread ? (
                <button
                  type="button"
                  onClick={() => submitTicketMessage(selectedApplication.id)}
                  disabled={busyApplicationId === selectedApplication.id || selectedApplication.ticketClosed}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {busyApplicationId === selectedApplication.id ? 'Sending...' : 'Send reply'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground opacity-60"
                >
                  Waiting for staff reply
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <h2 className="font-display text-2xl text-foreground">Tickets</h2>
            <p className="mt-2 text-sm text-muted-foreground">No ticket is selected for this filter.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!firstCreatableApplicationId) return
                  setFilter('open')
                  setSelectedApplicationId(firstCreatableApplicationId)
                }}
                disabled={!firstCreatableApplicationId}
                className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {createTicketButtonLabel}
              </button>
            </div>
          </div>
        )}
        </div>
      </section>
    </section>
  )
}
