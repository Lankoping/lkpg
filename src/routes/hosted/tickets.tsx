import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  closeMyHostedSupportTicketFn,
  closeHostedApplicationTicketFn,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [supportDraft, setSupportDraft] = useState('')
  const [applicationActionError, setApplicationActionError] = useState('')
  const [supportActionError, setSupportActionError] = useState('')
  const [supportSuccessMessage, setSupportSuccessMessage] = useState('')
  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [creatingSupportTicket, setCreatingSupportTicket] = useState(false)
  const [closingSupportTicketId, setClosingSupportTicketId] = useState<number | null>(null)
  const [closingApplicationId, setClosingApplicationId] = useState<number | null>(null)

  const formatDateTime = (value: string | Date | null | undefined) => {
    if (!value) return 'Unknown date'
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

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
    const byStatus =
      filter === 'all'
        ? applications
        : filter === 'open'
          ? applications.filter((application) => !application.ticketClosed)
          : applications.filter((application) => application.ticketClosed)

    const q = searchQuery.trim().toLowerCase()
    if (!q) return byStatus

    return byStatus.filter((application) => {
      const haystack = `${application.id} ${application.eventName} ${application.organizationName}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [applications, filter, searchQuery])

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

  const applicationStats = useMemo(() => {
    let waitingForStaff = 0
    let waitingForYou = 0

    for (const application of applications) {
      if (application.ticketClosed) continue
      const thread = messagesByApplication.get(application.id) ?? []
      if (thread.length === 0) continue
      const latest = thread[0]
      if (latest.senderRole === 'organizer') {
        waitingForYou += 1
      } else {
        waitingForStaff += 1
      }
    }

    return {
      total: applications.length,
      open: applications.filter((application) => !application.ticketClosed).length,
      closed: applications.filter((application) => application.ticketClosed).length,
      waitingForStaff,
      waitingForYou,
    }
  }, [applications, messagesByApplication])

  const submitTicketMessage = async (applicationId: number) => {
    const message = replyDrafts[applicationId]?.trim()
    if (!message) return

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setApplicationActionError('This ticket is closed.')
      return
    }

    setApplicationActionError('')
    setBusyApplicationId(applicationId)
    try {
      if (!hasAnyMessages) {
        setApplicationActionError('Use Create ticket to open the thread first.')
        return
      } else if (hasOrganizerThread) {
        await postFoundaryApplicationMessageFn({ data: { applicationId, message } })
      } else {
        setApplicationActionError('Ticket already created. Please wait for staff to reply.')
        return
      }

      setReplyDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setApplicationActionError(error?.message || 'Could not send ticket message')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const createTicket = async (applicationId: number) => {
    const message = replyDrafts[applicationId]?.trim()
    if (!message) {
      setApplicationActionError('Write a message before creating a ticket.')
      return
    }

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setApplicationActionError('This ticket is closed.')
      return
    }

    const existingMessages = (messagesByApplication.get(applicationId) ?? []).length > 0
    if (existingMessages) {
      setApplicationActionError('Ticket already created for this request.')
      return
    }

    setApplicationActionError('')
    setBusyApplicationId(applicationId)
    try {
      await createHostedApplicationTicketFn({ data: { applicationId, message } })
      setReplyDrafts((current) => ({ ...current, [applicationId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setApplicationActionError(error?.message || 'Could not create ticket')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const closeApplicationTicket = async (applicationId: number) => {
    setApplicationActionError('')
    setClosingApplicationId(applicationId)
    try {
      await closeHostedApplicationTicketFn({ data: { applicationId } })
      await router.invalidate()
    } catch (error: any) {
      setApplicationActionError(error?.message || 'Could not close ticket')
    } finally {
      setClosingApplicationId(null)
    }
  }

  const createSupportTicket = async () => {
    const message = supportDraft.trim()
    if (!message) {
      setSupportActionError('Write a message before creating a ticket.')
      return
    }

    setSupportActionError('')
    setSupportSuccessMessage('')
    setCreatingSupportTicket(true)
    try {
      if (!canCreateSupportTicket) {
        setSupportActionError('You already have 3 open tickets. Close one to create a new ticket.')
        return
      }
      await createHostedSupportTicketFn({ data: { message } })
      setSupportDraft('')
      setSupportSuccessMessage('Ticket created. Staff will follow up in this inbox.')
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not create ticket')
    } finally {
      setCreatingSupportTicket(false)
    }
  }

  const closeSupportTicket = async (ticketId: number) => {
    setSupportActionError('')
    setSupportSuccessMessage('')
    setClosingSupportTicketId(ticketId)
    try {
      await closeMyHostedSupportTicketFn({ data: { ticketId } })
      setSupportSuccessMessage('Ticket closed.')
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not close ticket')
    } finally {
      setClosingSupportTicketId(null)
    }
  }

  const supportPanel = (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Support desk</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">General support tickets</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create operational tickets outside application-specific threads.</p>
        </div>
        <div className="min-w-56 rounded-xl border border-border bg-background px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Capacity</p>
          <p className="mt-1 text-sm text-foreground">{openSupportTickets.length} of 3 open</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${Math.min((openSupportTickets.length / 3) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">New ticket message</label>
          <textarea
            value={supportDraft}
            onChange={(event) => setSupportDraft(event.target.value)}
            placeholder="Describe issue, urgency, and expected outcome..."
            className="mt-2 min-h-28 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
          />

          {supportActionError && <p className="mt-2 text-sm text-red-400">{supportActionError}</p>}
          {supportSuccessMessage && <p className="mt-2 text-sm text-emerald-400">{supportSuccessMessage}</p>}

          <button
            type="button"
            onClick={createSupportTicket}
            disabled={creatingSupportTicket || !canCreateSupportTicket}
            className="mt-3 rounded-xl border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            {creatingSupportTicket ? 'Creating...' : canCreateSupportTicket ? 'Create ticket' : 'Max 3 open tickets'}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Recent support tickets</p>
          <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
            {supportTickets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No support tickets yet.
              </p>
            ) : (
              supportTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">SUP-{ticket.id}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
                        ticket.status === 'open'
                          ? 'border-emerald-500/30 text-emerald-300'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Created {formatDateTime(ticket.createdAt)}</p>
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
        </div>
      </div>
    </section>
  )

  if (applications.length === 0) {
    return (
      <section className="space-y-4">
        {supportPanel}
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Application tickets appear here automatically when your applications are active.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {supportPanel}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-3 border-b border-border bg-background/40 px-4 py-3 md:grid-cols-5">
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total tickets</p>
            <p className="mt-1 text-lg text-foreground">{applicationStats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Open</p>
            <p className="mt-1 text-lg text-foreground">{applicationStats.open}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Closed</p>
            <p className="mt-1 text-lg text-foreground">{applicationStats.closed}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Waiting for staff</p>
            <p className="mt-1 text-lg text-foreground">{applicationStats.waitingForStaff}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Waiting for you</p>
            <p className="mt-1 text-lg text-foreground">{applicationStats.waitingForYou}</p>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[320px_1fr]">
          <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Application inbox</p>
              <p className="mt-1 text-sm text-muted-foreground">Track status and collaborate with staff</p>
            </div>

            <div className="px-4 py-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by id, event, org..."
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              />

              <div className="mt-3 inline-grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-1">
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
                    setApplicationActionError('')
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
                const latest = thread[0]

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
                      <p className="text-sm font-medium text-foreground">APP-{application.id}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                          application.ticketClosed
                            ? 'border-border text-muted-foreground'
                            : 'border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {application.ticketClosed ? 'closed' : 'open'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground">{application.eventName}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{application.organizationName}</p>
                    {latest && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {latest.senderRole === 'organizer' ? 'Staff' : 'You'}: {latest.message}
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-foreground">APP-{selectedApplication.id}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedApplication.organizationName} · {selectedApplication.eventName}
                  </p>
                </div>

                {!selectedApplication.ticketClosed && (
                  <button
                    type="button"
                    onClick={() => closeApplicationTicket(selectedApplication.id)}
                    disabled={closingApplicationId === selectedApplication.id}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground disabled:opacity-60"
                  >
                    {closingApplicationId === selectedApplication.id ? 'Closing...' : 'Close ticket'}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
                {selectedMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  [...selectedMessages]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((msg) => (
                      <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail} ·{' '}
                          {formatDateTime(msg.createdAt)}
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

              {applicationActionError && <p className="mt-3 text-sm text-red-400">{applicationActionError}</p>}

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
              <h2 className="font-display text-2xl text-foreground">Application tickets</h2>
              <p className="mt-2 text-sm text-muted-foreground">No ticket selected for this filter.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Show all
                </button>
                {firstCreatableApplicationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilter('open')
                      setSelectedApplicationId(firstCreatableApplicationId)
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {createTicketButtonLabel}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </section>
  )
}
