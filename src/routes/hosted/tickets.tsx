import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  closeMyHostedSupportTicketFn,
  closeHostedApplicationTicketFn,
  createHostedApplicationTicketFn,
  createHostedSupportTicketFn,
  getMyHostedSupportTicketsFn,
  getMyHostedSupportTicketMessagesFn,
  getMyFoundaryApplicationMessagesFn,
  getMyFoundaryApplicationsFn,
  postMyHostedSupportTicketMessageFn,
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

    const [applications, messages, supportTickets, supportMessages] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyFoundaryApplicationMessagesFn(),
      getMyHostedSupportTicketsFn(),
      getMyHostedSupportTicketMessagesFn(),
    ])

    return { applications, messages, supportTickets, supportMessages }
  },
  component: HostedTicketsPage,
})

type UnifiedTicket = {
  key: string
  type: 'application' | 'support'
  status: 'open' | 'closed'
  idLabel: string
  title: string
  subtitle: string
  preview: string
  createdAt: string | Date | null | undefined
  applicationId?: number
  supportTicketId?: number
  ticketPriority?: 'low' | 'normal' | 'high' | 'urgent'
  ticketLabels?: string
  assignedToUserId?: number | null
}

const priorityOptions: Array<{ value: 'low' | 'normal' | 'high' | 'urgent'; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function normalizeTicketLabelsInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ).join(', ')
}

function splitTicketLabels(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function PriorityBadge({ priority }: { priority: 'low' | 'normal' | 'high' | 'urgent' }) {
  const className =
    priority === 'urgent'
      ? 'border-red-500/30 text-red-300'
      : priority === 'high'
        ? 'border-orange-500/30 text-orange-300'
        : priority === 'normal'
          ? 'border-border text-muted-foreground'
          : 'border-sky-500/30 text-sky-300'

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${className}`}>{priority}</span>
}

function HostedTicketsPage() {
  const { applications, messages, supportTickets, supportMessages } = Route.useLoaderData()
  const router = useRouter()

  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTicketKey, setSelectedTicketKey] = useState<string | null>(null)

  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<number, string>>({})
  const [supportDraft, setSupportDraft] = useState('')
  const [supportPriority, setSupportPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [supportLabels, setSupportLabels] = useState('')

  const [applicationActionError, setApplicationActionError] = useState('')
  const [supportActionError, setSupportActionError] = useState('')
  const [supportSuccessMessage, setSupportSuccessMessage] = useState('')

  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [closingApplicationId, setClosingApplicationId] = useState<number | null>(null)
  const [creatingSupportTicket, setCreatingSupportTicket] = useState(false)
  const [closingSupportTicketId, setClosingSupportTicketId] = useState<number | null>(null)
  const [busySupportTicketId, setBusySupportTicketId] = useState<number | null>(null)

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

  const messagesByApplication = useMemo(() => {
    const grouped = new Map<number, typeof messages>()
    for (const message of messages) {
      const current = grouped.get(message.applicationId) ?? []
      current.push(message)
      grouped.set(message.applicationId, current)
    }
    return grouped
  }, [messages])

  const messagesBySupportTicket = useMemo(() => {
    const grouped = new Map<number, typeof supportMessages>()
    for (const message of supportMessages) {
      const current = grouped.get(message.ticketId) ?? []
      current.push(message)
      grouped.set(message.ticketId, current)
    }
    return grouped
  }, [supportMessages])

  const openSupportTickets = useMemo(() => supportTickets.filter((ticket) => ticket.status === 'open'), [supportTickets])
  const canCreateSupportTicket = openSupportTickets.length < 3

  const firstCreatableApplicationId = useMemo(() => {
    for (const application of applications) {
      if (application.ticketClosed) continue
      const threadCount = (messagesByApplication.get(application.id) ?? []).length
      if (threadCount === 0) return application.id
    }
    return null
  }, [applications, messagesByApplication])

  const unifiedTickets = useMemo<UnifiedTicket[]>(() => {
    const applicationItems: UnifiedTicket[] = applications.map((application) => {
      const thread = messagesByApplication.get(application.id) ?? []
      const latest = thread[0]
      return {
        key: `app:${application.id}`,
        type: 'application',
        status: application.ticketClosed ? 'closed' : 'open',
        idLabel: `APP-${application.id}`,
        title: application.eventName,
        subtitle: application.organizationName,
        preview: latest ? `${latest.senderRole === 'organizer' ? 'Staff' : 'You'}: ${latest.message}` : 'No messages yet',
        createdAt: application.createdAt,
        applicationId: application.id,
      }
    })

    const supportItems: UnifiedTicket[] = supportTickets.map((ticket) => ({
      key: `sup:${ticket.id}`,
      type: 'support',
      status: ticket.status === 'open' ? 'open' : 'closed',
      idLabel: `SUP-${ticket.id}`,
      title: 'General support',
      subtitle: 'Hosted support desk',
      preview: ticket.message,
      createdAt: ticket.createdAt,
      supportTicketId: ticket.id,
      ticketPriority: ticket.ticketPriority,
      ticketLabels: ticket.ticketLabels,
      assignedToUserId: ticket.assignedToUserId,
    }))

    return [...applicationItems, ...supportItems].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    )
  }, [applications, supportTickets, messagesByApplication])

  const filteredTickets = useMemo(() => {
    const byStatus =
      filter === 'all' ? unifiedTickets : unifiedTickets.filter((ticket) => (filter === 'open' ? ticket.status === 'open' : ticket.status === 'closed'))

    const q = searchQuery.trim().toLowerCase()
    if (!q) return byStatus

    return byStatus.filter((ticket) => {
      const haystack = `${ticket.idLabel} ${ticket.title} ${ticket.subtitle} ${ticket.preview} ${ticket.ticketLabels || ''} ${ticket.ticketPriority || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [unifiedTickets, filter, searchQuery])

  useEffect(() => {
    if (!filteredTickets.length) {
      setSelectedTicketKey(null)
      return
    }

    if (!selectedTicketKey || !filteredTickets.some((ticket) => ticket.key === selectedTicketKey)) {
      setSelectedTicketKey(filteredTickets[0].key)
    }
  }, [filteredTickets, selectedTicketKey])

  const selectedTicket = useMemo(() => {
    if (!selectedTicketKey) return null
    return unifiedTickets.find((ticket) => ticket.key === selectedTicketKey) ?? null
  }, [unifiedTickets, selectedTicketKey])

  const selectedApplication = useMemo(() => {
    if (!selectedTicket || selectedTicket.type !== 'application' || !selectedTicket.applicationId) return null
    return applications.find((application) => application.id === selectedTicket.applicationId) ?? null
  }, [applications, selectedTicket])

  const selectedSupportTicket = useMemo(() => {
    if (!selectedTicket || selectedTicket.type !== 'support' || !selectedTicket.supportTicketId) return null
    return supportTickets.find((ticket) => ticket.id === selectedTicket.supportTicketId) ?? null
  }, [supportTickets, selectedTicket])

  const selectedSupportMessages = selectedSupportTicket
    ? (messagesBySupportTicket.get(selectedSupportTicket.id) ?? [])
    : []

  const selectedMessages = selectedApplication ? (messagesByApplication.get(selectedApplication.id) ?? []) : []
  const hasOrganizerThread = selectedMessages.some((msg) => msg.senderRole === 'organizer')
  const hasAnyMessages = selectedMessages.length > 0

  const submitTicketMessage = async (applicationId: number) => {
    const message = replyDrafts[applicationId]?.trim()
    if (!message) return

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setApplicationActionError('This ticket is closed.')
      return
    }

    const thread = messagesByApplication.get(applicationId) ?? []
    const hasAnyThreadMessages = thread.length > 0
    const hasOrganizerInThread = thread.some((msg) => msg.senderRole === 'organizer')

    setApplicationActionError('')
    setBusyApplicationId(applicationId)
    try {
      if (!hasAnyThreadMessages) {
        setApplicationActionError('Use Create ticket to open the thread first.')
        return
      }
      if (hasOrganizerInThread) {
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

  const createApplicationTicket = async (applicationId: number) => {
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
      await createHostedSupportTicketFn({
        data: {
          message,
          priority: supportPriority,
          labels: normalizeTicketLabelsInput(supportLabels),
        },
      })
      setSupportDraft('')
      setSupportLabels('')
      setSupportPriority('normal')
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

  const submitSupportTicketReply = async (ticketId: number) => {
    const message = supportReplyDrafts[ticketId]?.trim()
    if (!message) {
      setSupportActionError('Write a message before replying.')
      return
    }

    const ticket = supportTickets.find((item) => item.id === ticketId)
    if (!ticket) return

    if (ticket.status !== 'open') {
      setSupportActionError('This ticket is closed.')
      return
    }

    setSupportActionError('')
    setBusySupportTicketId(ticketId)
    try {
      await postMyHostedSupportTicketMessageFn({ data: { ticketId, message } })
      setSupportReplyDrafts((current) => ({ ...current, [ticketId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not send reply')
    } finally {
      setBusySupportTicketId(null)
    }
  }

  const stats = useMemo(
    () => ({
      total: unifiedTickets.length,
      open: unifiedTickets.filter((ticket) => ticket.status === 'open').length,
      closed: unifiedTickets.filter((ticket) => ticket.status === 'closed').length,
    }),
    [unifiedTickets],
  )

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Tickets</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">All tickets in one place</h2>
            <p className="mt-1 text-sm text-muted-foreground">Application tickets and support tickets are now managed in a single inbox.</p>
          </div>
          <div className="min-w-56 rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Support capacity</p>
            <p className="mt-1 text-sm text-foreground">{openSupportTickets.length} of 3 open</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${Math.min((openSupportTickets.length / 3) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Create support ticket</label>
          <textarea
            value={supportDraft}
            onChange={(event) => setSupportDraft(event.target.value)}
            placeholder="Describe issue, urgency, and expected outcome..."
            className="mt-2 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
          />

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Priority</span>
              <select
                value={supportPriority}
                onChange={(event) => setSupportPriority(event.target.value as 'low' | 'normal' | 'high' | 'urgent')}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Labels</span>
              <input
                value={supportLabels}
                onChange={(event) => setSupportLabels(event.target.value)}
                placeholder="billing, bug, onboarding"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </label>
          </div>

          {supportActionError && <p className="mt-2 text-sm text-red-400">{supportActionError}</p>}
          {supportSuccessMessage && <p className="mt-2 text-sm text-emerald-400">{supportSuccessMessage}</p>}

          <button
            type="button"
            onClick={createSupportTicket}
            disabled={creatingSupportTicket || !canCreateSupportTicket}
            className="mt-3 rounded-xl border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            {creatingSupportTicket ? 'Creating...' : canCreateSupportTicket ? 'Create support ticket' : 'Max 3 open tickets'}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-3 border-b border-border bg-background/40 px-4 py-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total</p>
            <p className="mt-1 text-lg text-foreground">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Open</p>
            <p className="mt-1 text-lg text-foreground">{stats.open}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Closed</p>
            <p className="mt-1 text-lg text-foreground">{stats.closed}</p>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[340px_1fr]">
          <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Unified inbox</p>
              <p className="mt-1 text-sm text-muted-foreground">Support and application tickets together</p>
            </div>

            <div className="px-4 py-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by id, title, org, message..."
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
                    setSelectedTicketKey(`app:${firstCreatableApplicationId}`)
                    setApplicationActionError('')
                  }}
                  className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open next application ticket
                </button>
              )}
            </div>

            <div className="max-h-[42rem] overflow-auto p-2">
              {filteredTickets.map((ticket) => {
                const selected = selectedTicket?.key === ticket.key
                return (
                  <button
                    key={ticket.key}
                    type="button"
                    onClick={() => setSelectedTicketKey(ticket.key)}
                    className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{ticket.idLabel}</p>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                            ticket.status === 'open'
                              ? 'border-emerald-500/30 text-emerald-300'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {ticket.status}
                        </span>
                        {ticket.type === 'support' && <PriorityBadge priority={ticket.ticketPriority ?? 'normal'} />}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-foreground">{ticket.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{ticket.subtitle}</p>
                    {ticket.type === 'support' && splitTicketLabels(ticket.ticketLabels).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {splitTicketLabels(ticket.ticketLabels).map((label) => (
                          <span key={label} className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{ticket.preview}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{ticket.type}</p>
                  </button>
                )
              })}

              {filteredTickets.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  No tickets found.
                </div>
              )}
            </div>
          </aside>

          <div className="p-5">
            {selectedApplication ? (
              <>
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
                            {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail} · {formatDateTime(msg.createdAt)}
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
                      onClick={() => createApplicationTicket(selectedApplication.id)}
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
              </>
            ) : selectedSupportTicket ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">SUP-{selectedSupportTicket.id}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">General support ticket · Created {formatDateTime(selectedSupportTicket.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <PriorityBadge priority={selectedSupportTicket.ticketPriority ?? 'normal'} />
                      {splitTicketLabels(selectedSupportTicket.ticketLabels).map((label) => (
                        <span key={label} className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedSupportTicket.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => closeSupportTicket(selectedSupportTicket.id)}
                      disabled={closingSupportTicketId === selectedSupportTicket.id}
                      className="rounded-xl border border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground disabled:opacity-60"
                    >
                      {closingSupportTicketId === selectedSupportTicket.id ? 'Closing...' : 'Close ticket'}
                    </button>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conversation</p>
                  {selectedSupportMessages.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {[...selectedSupportMessages]
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((msg) => (
                          <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail} · {formatDateTime(msg.createdAt)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.message}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {selectedSupportTicket.status === 'open' && (
                  <>
                    <textarea
                      value={supportReplyDrafts[selectedSupportTicket.id] ?? ''}
                      onChange={(event) =>
                        setSupportReplyDrafts((current) => ({
                          ...current,
                          [selectedSupportTicket.id]: event.target.value,
                        }))
                      }
                      placeholder="Reply to this support ticket..."
                      className="mt-4 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                    />

                    <button
                      type="button"
                      onClick={() => submitSupportTicketReply(selectedSupportTicket.id)}
                      disabled={busySupportTicketId === selectedSupportTicket.id}
                      className="mt-3 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                    >
                      {busySupportTicketId === selectedSupportTicket.id ? 'Sending...' : 'Send reply'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div>
                <h2 className="font-display text-2xl text-foreground">Tickets</h2>
                <p className="mt-2 text-sm text-muted-foreground">No ticket selected for this filter.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
