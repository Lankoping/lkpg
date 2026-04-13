import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  closeFoundaryApplicationFn,
  closeFoundaryApplicationTicketFn,
  closeHostedSupportTicketFromAdminFn,
  createFoundaryApplicationTicketFn,
  deleteHostedSupportTicketFromAdminFn,
  decideFoundaryApplicationFundingFromTicketFn,
  getFoundaryApplicationMessagesFn,
  getFoundaryApplicationsFn,
  getHostedSupportTicketMessagesForAdminFn,
  getHostedSupportTicketsForAdminFn,
  getOrganizerUsersFn,
  postHostedSupportTicketMessageFromAdminFn,
  postFoundaryApplicationMessageFn,
  updateFoundaryApplicationTicketMetadataFn,
  updateHostedSupportTicketMetadataFn,
} from '../../server/functions/foundary'

function isNanoMessage(message: { senderRole: string; message: string }) {
  if (message.senderRole !== 'organizer') return false
  const body = message.message
  return (
    body.includes('[AI First Responder]') ||
    body.startsWith('Hi, my name is Nano and I will be assisting you today.') ||
    body.startsWith('Nano:') ||
    (body.includes('Summary:') && body.includes('Category:') && body.includes('Priority:'))
  )
}

function getMessageSenderLabel(message: { senderRole: string; senderName?: string | null; senderEmail?: string | null; message: string }) {
  if (isNanoMessage(message)) return 'Nano'
  return message.senderName || message.senderEmail || (message.senderRole === 'organizer' ? 'Staff' : 'Hosted')
}

function extractAiSummary(thread: Array<{ senderRole: string; message: string }>) {
  for (const message of thread) {
    if (!isNanoMessage(message)) continue

    const summaryLine = message.message
      .split('\n')
      .find((line) => line.toLowerCase().startsWith('summary:'))

    if (summaryLine) {
      return summaryLine.slice('summary:'.length).trim()
    }
  }

  return ''
}

export const Route = createFileRoute('/admin/tickets')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }
  },
  loader: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }

    const [applications, messages, supportTickets, supportMessages, organizers] = await Promise.all([
      getFoundaryApplicationsFn(),
      getFoundaryApplicationMessagesFn(),
      getHostedSupportTicketsForAdminFn(),
      getHostedSupportTicketMessagesForAdminFn(),
      getOrganizerUsersFn(),
    ])
    return { applications, messages, supportTickets, supportMessages, organizers, currentOrganizerId: user.id }
  },
  component: AdminTicketsPage,
})

function AdminTicketsPage() {
  const { applications, messages, supportTickets, supportMessages, organizers, currentOrganizerId } = Route.useLoaderData()
  const router = useRouter()

  type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

  const priorityOptions: Array<{ value: TicketPriority; label: string }> = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  const normalizeTicketLabelsInput = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[\n,;]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).join(', ')

  const splitTicketLabels = (value: string | null | undefined) => {
    if (!value) return []
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const priorityRank = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return 0
      case 'high':
        return 1
      case 'normal':
        return 2
      case 'low':
        return 3
    }
  }

  const [queueType, setQueueType] = useState<'applications' | 'support'>('applications')
  const [applicationFilter, setApplicationFilter] = useState<'all' | 'open' | 'closed' | 'waiting-hosted' | 'waiting-staff' | 'assigned' | 'unassigned'>('open')
  const [supportFilter, setSupportFilter] = useState<'all' | 'open' | 'closed' | 'assigned' | 'unassigned'>('open')
  const [applicationNeedsActionOnly, setApplicationNeedsActionOnly] = useState(false)
  const [applicationAssignedToMeOnly, setApplicationAssignedToMeOnly] = useState(false)
  const [supportNeedsActionOnly, setSupportNeedsActionOnly] = useState(false)
  const [supportAssignedToMeOnly, setSupportAssignedToMeOnly] = useState(false)
  const [applicationQuery, setApplicationQuery] = useState('')
  const [supportQuery, setSupportQuery] = useState('')

  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<number | null>(supportTickets[0]?.id ?? null)

  const [messageDrafts, setMessageDrafts] = useState<Record<number, string>>({})
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<number, string>>({})
  const [decisionDrafts, setDecisionDrafts] = useState<Record<number, string>>({})
  const [applicationMetadataDrafts, setApplicationMetadataDrafts] = useState<
    Record<number, { priority: TicketPriority; labels: string; assignedToUserId: string }>
  >({})
  const [supportMetadataDrafts, setSupportMetadataDrafts] = useState<
    Record<number, { priority: TicketPriority; labels: string; assignedToUserId: string }>
  >({})
  const [applicationActionError, setApplicationActionError] = useState('')
  const [supportActionError, setSupportActionError] = useState('')

  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [closingApplicationId, setClosingApplicationId] = useState<number | null>(null)
  const [closingWholeApplicationId, setClosingWholeApplicationId] = useState<number | null>(null)
  const [decidingApplicationId, setDecidingApplicationId] = useState<number | null>(null)
  const [updatingApplicationMetadataId, setUpdatingApplicationMetadataId] = useState<number | null>(null)
  const [closedApplicationIds, setClosedApplicationIds] = useState<Record<number, boolean>>({})
  const [closingSupportTicketId, setClosingSupportTicketId] = useState<number | null>(null)
  const [replyingSupportTicketId, setReplyingSupportTicketId] = useState<number | null>(null)
  const [deletingSupportTicketId, setDeletingSupportTicketId] = useState<number | null>(null)
  const [updatingSupportMetadataId, setUpdatingSupportMetadataId] = useState<number | null>(null)

  const organizerUsers = useMemo(
    () => organizers as Array<{ id: number; name: string | null; email: string | null }>,
    [organizers],
  )

  const organizerById = useMemo(() => new Map(organizerUsers.map((user) => [user.id, user])), [organizerUsers])

  const replyTemplates = [
    'Thanks for the update. Please share any missing details so we can continue reviewing this request.',
    'We need a little more information before making a decision. Please reply with the missing details.',
    'Your request is under review. We will respond here once we have an update.',
    'This looks good. We are closing the ticket after this update.',
  ]

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

  const supportReplyTemplates = [
    'Thanks for reaching out. We have received your ticket and started reviewing it.',
    'Could you share more details, screenshots, and exact steps to reproduce?',
    'We have identified the issue and are working on a fix. We will update you shortly.',
    'This is now resolved. Please confirm everything works on your side.',
  ]

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

  const isTicketClosed = (applicationId: number) =>
    Boolean(closedApplicationIds[applicationId] || applications.find((app) => app.id === applicationId)?.ticketClosed)

  const getApplicationQueueState = (applicationId: number): 'new' | 'waiting-hosted' | 'waiting-staff' | 'closed' => {
    if (isTicketClosed(applicationId)) return 'closed'
    const thread = messagesByApplication.get(applicationId) ?? []
    if (thread.length === 0) return 'new'
    const latest = thread[0]
    return latest.senderRole === 'organizer' ? 'waiting-hosted' : 'waiting-staff'
  }

  const filteredApplications = useMemo(() => {
    let scoped = applications
    if (applicationFilter === 'open') {
      scoped = applications.filter((application) => !isTicketClosed(application.id))
    } else if (applicationFilter === 'closed') {
      scoped = applications.filter((application) => isTicketClosed(application.id))
    } else if (applicationFilter === 'waiting-hosted') {
      scoped = applications.filter((application) => getApplicationQueueState(application.id) === 'waiting-hosted')
    } else if (applicationFilter === 'waiting-staff') {
      scoped = applications.filter((application) => getApplicationQueueState(application.id) === 'waiting-staff')
    } else if (applicationFilter === 'assigned') {
      scoped = applications.filter((application) => application.assignedToUserId != null)
    } else if (applicationFilter === 'unassigned') {
      scoped = applications.filter((application) => application.assignedToUserId == null)
    }

    if (applicationNeedsActionOnly) {
      scoped = scoped.filter((application) => {
        const state = getApplicationQueueState(application.id)
        return state === 'new' || state === 'waiting-staff'
      })
    }

    if (applicationAssignedToMeOnly) {
      scoped = scoped.filter((application) => application.assignedToUserId === currentOrganizerId)
    }

    const q = applicationQuery.trim().toLowerCase()
    const filtered = !q
      ? scoped
      : scoped.filter((application) => {
      const haystack = `${application.id} ${application.eventName} ${application.organizationName} ${application.applicantName} ${application.ticketPriority || ''} ${application.ticketLabels || ''} ${organizerById.get(application.assignedToUserId ?? -1)?.name || ''}`.toLowerCase()
      return haystack.includes(q)
      })

    return [...filtered].sort(
      (a, b) =>
        priorityRank(a.ticketPriority ?? 'normal') - priorityRank(b.ticketPriority ?? 'normal') ||
        new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime(),
    )
  }, [applicationAssignedToMeOnly, applicationFilter, applicationNeedsActionOnly, applicationQuery, applications, closedApplicationIds, currentOrganizerId, messagesByApplication])

  const filteredSupportTickets = useMemo(() => {
    let scoped = supportTickets
    if (supportFilter === 'open') {
      scoped = supportTickets.filter((ticket) => ticket.status === 'open')
    } else if (supportFilter === 'closed') {
      scoped = supportTickets.filter((ticket) => ticket.status === 'closed')
    } else if (supportFilter === 'assigned') {
      scoped = supportTickets.filter((ticket) => ticket.assignedToUserId != null)
    } else if (supportFilter === 'unassigned') {
      scoped = supportTickets.filter((ticket) => ticket.assignedToUserId == null)
    }

    if (supportNeedsActionOnly) {
      scoped = scoped.filter((ticket) => ticket.status === 'open' && (ticket.assignedToUserId == null || ticket.assignedToUserId === currentOrganizerId))
    }

    if (supportAssignedToMeOnly) {
      scoped = scoped.filter((ticket) => ticket.assignedToUserId === currentOrganizerId)
    }

    const q = supportQuery.trim().toLowerCase()
    const filtered = !q
      ? scoped
      : scoped.filter((ticket) => {
      const thread = messagesBySupportTicket.get(ticket.id) ?? []
      const latest = thread[0]
      const haystack = `${ticket.id} ${ticket.reporterName || ''} ${ticket.reporterEmail || ''} ${ticket.message || ''} ${latest?.message || ''} ${ticket.ticketPriority || ''} ${ticket.ticketLabels || ''} ${organizerById.get(ticket.assignedToUserId ?? -1)?.name || ''}`.toLowerCase()
      return haystack.includes(q)
      })

    return [...filtered].sort(
      (a, b) =>
        priorityRank(a.ticketPriority ?? 'normal') - priorityRank(b.ticketPriority ?? 'normal') ||
        new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime(),
    )
  }, [currentOrganizerId, messagesBySupportTicket, supportAssignedToMeOnly, supportFilter, supportNeedsActionOnly, supportQuery, supportTickets])

  const openNextApplicationNeedsAction = () => {
    const next = filteredApplications.find((application) => {
      const state = getApplicationQueueState(application.id)
      return state === 'new' || state === 'waiting-staff'
    })
    if (next) {
      setSelectedApplicationId(next.id)
    }
  }

  const openNextSupportNeedsAction = () => {
    const next = filteredSupportTickets.find(
      (ticket) => ticket.status === 'open' && (ticket.assignedToUserId == null || ticket.assignedToUserId === currentOrganizerId),
    )
    if (next) {
      setSelectedSupportTicketId(next.id)
    }
  }

  useEffect(() => {
    if (filteredApplications.length === 0) {
      setSelectedApplicationId(null)
      return
    }
    if (!selectedApplicationId || !filteredApplications.some((application) => application.id === selectedApplicationId)) {
      setSelectedApplicationId(filteredApplications[0].id)
    }
  }, [filteredApplications, selectedApplicationId])

  useEffect(() => {
    if (filteredSupportTickets.length === 0) {
      setSelectedSupportTicketId(null)
      return
    }
    if (!selectedSupportTicketId || !filteredSupportTickets.some((ticket) => ticket.id === selectedSupportTicketId)) {
      setSelectedSupportTicketId(filteredSupportTickets[0].id)
    }
  }, [filteredSupportTickets, selectedSupportTicketId])

  const selectedApplication = useMemo(() => {
    if (!selectedApplicationId) return null
    return applications.find((application) => application.id === selectedApplicationId) ?? null
  }, [applications, selectedApplicationId])

  useEffect(() => {
    if (!selectedApplication) return
    setApplicationMetadataDrafts((current) => {
      if (current[selectedApplication.id]) return current
      return {
        ...current,
        [selectedApplication.id]: {
          priority: selectedApplication.ticketPriority ?? 'normal',
          labels: selectedApplication.ticketLabels ?? '',
          assignedToUserId: selectedApplication.assignedToUserId ? String(selectedApplication.assignedToUserId) : '',
        },
      }
    })
  }, [selectedApplication])

  const selectedSupportTicket = useMemo(() => {
    if (!selectedSupportTicketId) return null
    return supportTickets.find((ticket) => ticket.id === selectedSupportTicketId) ?? null
  }, [supportTickets, selectedSupportTicketId])

  useEffect(() => {
    if (!selectedSupportTicket) return
    setSupportMetadataDrafts((current) => {
      if (current[selectedSupportTicket.id]) return current
      return {
        ...current,
        [selectedSupportTicket.id]: {
          priority: selectedSupportTicket.ticketPriority ?? 'normal',
          labels: selectedSupportTicket.ticketLabels ?? '',
          assignedToUserId: selectedSupportTicket.assignedToUserId ? String(selectedSupportTicket.assignedToUserId) : '',
        },
      }
    })
  }, [selectedSupportTicket])

  const selectedSupportMessages = selectedSupportTicket
    ? (messagesBySupportTicket.get(selectedSupportTicket.id) ?? [])
    : []

  const selectedMessages = selectedApplication ? (messagesByApplication.get(selectedApplication.id) ?? []) : []
  const hasOrganizerThread = selectedMessages.some((msg) => msg.senderRole === 'organizer')
  const canDirectlyDecideSelectedApplication = Boolean(selectedApplication?.isApplicationTicket || hasOrganizerThread)

  const applicationStats = useMemo(() => {
    return {
      total: applications.length,
      open: applications.filter((application) => !isTicketClosed(application.id)).length,
      waitingHosted: applications.filter((application) => getApplicationQueueState(application.id) === 'waiting-hosted').length,
      waitingStaff: applications.filter((application) => getApplicationQueueState(application.id) === 'waiting-staff').length,
      closed: applications.filter((application) => isTicketClosed(application.id)).length,
    }
  }, [applications, closedApplicationIds, messagesByApplication])

  const supportStats = useMemo(() => {
    return {
      total: supportTickets.length,
      open: supportTickets.filter((ticket) => ticket.status === 'open').length,
      closed: supportTickets.filter((ticket) => ticket.status === 'closed').length,
    }
  }, [supportTickets])

  const submitTicketMessage = async (applicationId: number) => {
    const message = messageDrafts[applicationId]?.trim()
    if (!message) {
      setApplicationActionError('Write a message before sending.')
      return
    }

    const application = applications.find((item) => item.id === applicationId)
    if (!application) return

    if (application.ticketClosed) {
      setApplicationActionError('This ticket is closed.')
      return
    }

    const hasAnyMessages = (messagesByApplication.get(applicationId)?.length ?? 0) > 0

    setApplicationActionError('')
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
      setApplicationActionError(error?.message || 'Could not send ticket message')
    } finally {
      setBusyApplicationId(null)
    }
  }

  const closeApplicationTicket = async (applicationId: number) => {
    setApplicationActionError('')
    setClosingApplicationId(applicationId)
    setClosedApplicationIds((current) => ({ ...current, [applicationId]: true }))
    try {
      await closeFoundaryApplicationTicketFn({ data: { applicationId } })
      await router.invalidate()
    } catch (error: any) {
      setClosedApplicationIds((current) => {
        const next = { ...current }
        delete next[applicationId]
        return next
      })
      setApplicationActionError(error?.message || 'Could not close ticket')
    } finally {
      setClosingApplicationId(null)
    }
  }

  const closeApplication = async (applicationId: number) => {
    setApplicationActionError('')
    setClosingWholeApplicationId(applicationId)
    setClosedApplicationIds((current) => ({ ...current, [applicationId]: true }))
    try {
      await closeFoundaryApplicationFn({ data: { applicationId } })
      await router.invalidate()
    } catch (error: any) {
      setClosedApplicationIds((current) => {
        const next = { ...current }
        delete next[applicationId]
        return next
      })
      setApplicationActionError(error?.message || 'Could not close application')
    } finally {
      setClosingWholeApplicationId(null)
    }
  }

  const decideFunding = async (applicationId: number, decision: 'approved' | 'rejected') => {
    const reason = decisionDrafts[applicationId]?.trim()
    if (decision === 'rejected' && !reason) {
      setApplicationActionError('Please provide a rejection reason before rejecting.')
      return
    }

    setApplicationActionError('')
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
      setApplicationActionError(error?.message || 'Could not apply decision')
    } finally {
      setDecidingApplicationId(null)
    }
  }

  const closeSupportTicketFromAdmin = async (ticketId: number) => {
    setSupportActionError('')
    setClosingSupportTicketId(ticketId)
    try {
      await closeHostedSupportTicketFromAdminFn({ data: { ticketId } })
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not close support ticket')
    } finally {
      setClosingSupportTicketId(null)
    }
  }

  const replyToSupportTicketFromAdmin = async (ticketId: number) => {
    const message = supportReplyDrafts[ticketId]?.trim()
    if (!message) {
      setSupportActionError('Write a message before sending reply.')
      return
    }

    setSupportActionError('')
    setReplyingSupportTicketId(ticketId)
    try {
      await postHostedSupportTicketMessageFromAdminFn({ data: { ticketId, message } })
      setSupportReplyDrafts((current) => ({ ...current, [ticketId]: '' }))
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not send support reply')
    } finally {
      setReplyingSupportTicketId(null)
    }
  }

  const updateApplicationMetadata = async (applicationId: number) => {
    const draft = applicationMetadataDrafts[applicationId]
    if (!draft) return

    setApplicationActionError('')
    setUpdatingApplicationMetadataId(applicationId)
    try {
      await updateFoundaryApplicationTicketMetadataFn({
        data: {
          applicationId,
          priority: draft.priority,
          labels: normalizeTicketLabelsInput(draft.labels),
          assignedToUserId: draft.assignedToUserId ? Number(draft.assignedToUserId) : null,
        },
      })
      await router.invalidate()
    } catch (error: any) {
      setApplicationActionError(error?.message || 'Could not update application metadata')
    } finally {
      setUpdatingApplicationMetadataId(null)
    }
  }

  const updateSupportMetadata = async (ticketId: number) => {
    const draft = supportMetadataDrafts[ticketId]
    if (!draft) return

    setSupportActionError('')
    setUpdatingSupportMetadataId(ticketId)
    try {
      await updateHostedSupportTicketMetadataFn({
        data: {
          ticketId,
          priority: draft.priority,
          labels: normalizeTicketLabelsInput(draft.labels),
          assignedToUserId: draft.assignedToUserId ? Number(draft.assignedToUserId) : null,
        },
      })
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not update support metadata')
    } finally {
      setUpdatingSupportMetadataId(null)
    }
  }

  const deleteSupportTicketFromAdmin = async (ticketId: number) => {
    setSupportActionError('')
    setDeletingSupportTicketId(ticketId)
    try {
      await deleteHostedSupportTicketFromAdminFn({ data: { ticketId } })
      await router.invalidate()
    } catch (error: any) {
      setSupportActionError(error?.message || 'Could not delete support ticket')
    } finally {
      setDeletingSupportTicketId(null)
    }
  }

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Internal support console</p>
            <h2 className="mt-1 font-display text-2xl text-foreground">Ticket operations</h2>
          </div>
          <div className="inline-flex rounded-xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setQueueType('applications')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${
                queueType === 'applications' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Applications
            </button>
            <button
              type="button"
              onClick={() => setQueueType('support')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${
                queueType === 'support' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Hosted support
            </button>
          </div>
        </div>
      </section>

      {queueType === 'applications' ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid gap-3 border-b border-border bg-background/40 px-4 py-3 md:grid-cols-5">
            <StatTile label="Total" value={applicationStats.total} />
            <StatTile label="Open" value={applicationStats.open} />
            <StatTile label="Waiting hosted" value={applicationStats.waitingHosted} />
            <StatTile label="Waiting staff" value={applicationStats.waitingStaff} />
            <StatTile label="Closed" value={applicationStats.closed} />
          </div>

          <div className="grid gap-0 md:grid-cols-[340px_1fr]">
            <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Application queue</p>
                <p className="mt-1 text-sm text-muted-foreground">GitHub-style triage by latest responder</p>
              </div>

              <div className="px-4 py-3">
                <input
                  value={applicationQuery}
                  onChange={(event) => setApplicationQuery(event.target.value)}
                  placeholder="Search ticket, event, org, applicant..."
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    ['all', 'All'],
                    ['open', 'Open'],
                    ['closed', 'Closed'],
                    ['waiting-hosted', 'Waiting hosted'],
                    ['waiting-staff', 'Waiting staff'],
                    ['assigned', 'Assigned'],
                    ['unassigned', 'Unassigned'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setApplicationFilter(value)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
                        applicationFilter === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={applicationNeedsActionOnly}
                      onChange={(event) => setApplicationNeedsActionOnly(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Needs staff action only
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={applicationAssignedToMeOnly}
                      onChange={(event) => setApplicationAssignedToMeOnly(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Assigned to me only
                  </label>
                  <button
                    type="button"
                    onClick={openNextApplicationNeedsAction}
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  >
                    Open next actionable
                  </button>
                </div>
              </div>

              <div className="max-h-[42rem] overflow-auto p-2">
                {filteredApplications.map((application) => {
                  const thread = messagesByApplication.get(application.id) ?? []
                  const selected = selectedApplication?.id === application.id
                  const latest = thread[0]
                  const state = getApplicationQueueState(application.id)

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
                        <p className="text-sm font-medium text-foreground">#{application.id}</p>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <QueueStateBadge state={state} />
                          <PriorityBadge priority={application.ticketPriority ?? 'normal'} />
                          {application.assignedToUserId != null && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              {organizerById.get(application.assignedToUserId)?.name?.trim() || 'Assigned'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-foreground">{application.eventName}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{application.organizationName}</p>
                      {application.isApplicationTicket && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-blue-300">Hosted application ticket</p>
                      )}
                      {splitTicketLabels(application.ticketLabels).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {splitTicketLabels(application.ticketLabels).map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      {latest && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {isNanoMessage(latest) ? 'AI' : latest.senderRole === 'organizer' ? 'Staff' : 'Hosted'}: {latest.message}
                        </p>
                      )}
                    </button>
                  )
                })}

                {filteredApplications.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No tickets found for this filter.
                  </p>
                )}
              </div>
            </aside>

            <div className="p-5">
              {selectedApplication ? (
                <>
                  <h3 className="font-display text-2xl text-foreground">#{selectedApplication.id}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedApplication.organizationName} · {selectedApplication.eventName}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Funding status: {selectedApplication.status}
                  </p>
                  {selectedApplication.isApplicationTicket && (
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-blue-300">
                      Hosted application intake ticket
                    </p>
                  )}

                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ticket metadata</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Priority</span>
                        <select
                          value={applicationMetadataDrafts[selectedApplication.id]?.priority ?? 'normal'}
                          onChange={(event) =>
                            setApplicationMetadataDrafts((current) => ({
                              ...current,
                              [selectedApplication.id]: {
                                ...(current[selectedApplication.id] ?? {
                                  priority: selectedApplication.ticketPriority ?? 'normal',
                                  labels: selectedApplication.ticketLabels ?? '',
                                  assignedToUserId: selectedApplication.assignedToUserId ? String(selectedApplication.assignedToUserId) : '',
                                }),
                                priority: event.target.value as TicketPriority,
                              },
                            }))
                          }
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
                          value={applicationMetadataDrafts[selectedApplication.id]?.labels ?? ''}
                          onChange={(event) =>
                            setApplicationMetadataDrafts((current) => ({
                              ...current,
                              [selectedApplication.id]: {
                                ...(current[selectedApplication.id] ?? {
                                  priority: selectedApplication.ticketPriority ?? 'normal',
                                  labels: selectedApplication.ticketLabels ?? '',
                                  assignedToUserId: selectedApplication.assignedToUserId ? String(selectedApplication.assignedToUserId) : '',
                                }),
                                labels: event.target.value,
                              },
                            }))
                          }
                          placeholder="bug, billing, follow-up"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                        />
                      </label>

                      <label className="space-y-1 text-sm md:col-span-2">
                        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assigned to</span>
                        <select
                          value={applicationMetadataDrafts[selectedApplication.id]?.assignedToUserId ?? ''}
                          onChange={(event) =>
                            setApplicationMetadataDrafts((current) => ({
                              ...current,
                              [selectedApplication.id]: {
                                ...(current[selectedApplication.id] ?? {
                                  priority: selectedApplication.ticketPriority ?? 'normal',
                                  labels: selectedApplication.ticketLabels ?? '',
                                  assignedToUserId: selectedApplication.assignedToUserId ? String(selectedApplication.assignedToUserId) : '',
                                }),
                                assignedToUserId: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                        >
                          <option value="">Unassigned</option>
                          {organizerUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name?.trim() || user.email || `User ${user.id}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => updateApplicationMetadata(selectedApplication.id)}
                          disabled={updatingApplicationMetadataId === selectedApplication.id}
                          className="w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          {updatingApplicationMetadataId === selectedApplication.id ? 'Saving...' : 'Save metadata'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
                    {selectedMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet. Send a message to open a thread.</p>
                    ) : (
                      [...selectedMessages]
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((msg) => (
                          <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {isNanoMessage(msg) ? 'AI' : msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {getMessageSenderLabel(msg)} · {formatDateTime(msg.createdAt)}
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
                    placeholder="Write response..."
                    className="mt-4 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />

                  <div className="mt-3 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Quick replies</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {replyTemplates.map((template) => (
                        <button
                          key={template}
                          type="button"
                          onClick={() =>
                            setMessageDrafts((current) => ({
                              ...current,
                              [selectedApplication.id]: template,
                            }))
                          }
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={decisionDrafts[selectedApplication.id] ?? ''}
                    onChange={(event) =>
                      setDecisionDrafts((current) => ({
                        ...current,
                        [selectedApplication.id]: event.target.value,
                      }))
                    }
                    placeholder="Decision note (required for reject)"
                    className="mt-3 min-h-20 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />

                  <div className="mt-3 space-y-3 rounded-xl border border-border bg-background p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reject reasons</p>
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
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approval notes</p>
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

                  {applicationActionError && <p className="mt-3 text-sm text-red-400">{applicationActionError}</p>}

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => submitTicketMessage(selectedApplication.id)}
                      disabled={busyApplicationId === selectedApplication.id || isTicketClosed(selectedApplication.id)}
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
                      onClick={() => closeApplicationTicket(selectedApplication.id)}
                      disabled={closingApplicationId === selectedApplication.id || isTicketClosed(selectedApplication.id)}
                      className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                    >
                      {closingApplicationId === selectedApplication.id
                        ? 'Closing...'
                        : isTicketClosed(selectedApplication.id)
                          ? 'Ticket closed'
                          : 'Close ticket'}
                    </button>
                  </div>

                  {!isTicketClosed(selectedApplication.id) && (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => closeApplication(selectedApplication.id)}
                        disabled={closingWholeApplicationId === selectedApplication.id}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-700 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        {closingWholeApplicationId === selectedApplication.id ? 'Closing application...' : 'Close application'}
                      </button>
                    </div>
                  )}

                  {selectedApplication.status === 'pending' && !isTicketClosed(selectedApplication.id) && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => decideFunding(selectedApplication.id, 'approved')}
                        disabled={decidingApplicationId === selectedApplication.id}
                        className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60"
                      >
                        {decidingApplicationId === selectedApplication.id ? 'Applying...' : 'Approve application'}
                      </button>
                      <button
                        type="button"
                        onClick={() => decideFunding(selectedApplication.id, 'rejected')}
                        disabled={decidingApplicationId === selectedApplication.id}
                        className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                      >
                        {decidingApplicationId === selectedApplication.id ? 'Applying...' : 'Reject application'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No application ticket selected.</p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid gap-3 border-b border-border bg-background/40 px-4 py-3 md:grid-cols-3">
            <StatTile label="Total" value={supportStats.total} />
            <StatTile label="Open" value={supportStats.open} />
            <StatTile label="Closed" value={supportStats.closed} />
          </div>

          <div className="grid gap-0 md:grid-cols-[340px_1fr]">
            <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Hosted support queue</p>
                <p className="mt-1 text-sm text-muted-foreground">General support tickets from hosted users</p>
              </div>

              <div className="px-4 py-3">
                <input
                  value={supportQuery}
                  onChange={(event) => setSupportQuery(event.target.value)}
                  placeholder="Search by id, reporter, email..."
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <div className="mt-3 inline-grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-1">
                  {(['all', 'open', 'closed', 'assigned', 'unassigned'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSupportFilter(value)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] ${
                        supportFilter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={supportNeedsActionOnly}
                      onChange={(event) => setSupportNeedsActionOnly(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Needs action (open + mine/unassigned)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={supportAssignedToMeOnly}
                      onChange={(event) => setSupportAssignedToMeOnly(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Assigned to me only
                  </label>
                  <button
                    type="button"
                    onClick={openNextSupportNeedsAction}
                    className="w-full rounded-lg border border-border px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  >
                    Open next actionable
                  </button>
                </div>
              </div>

              <div className="max-h-[42rem] overflow-auto p-2">
                {filteredSupportTickets.map((ticket) => {
                  const selected = selectedSupportTicket?.id === ticket.id
                  const thread = messagesBySupportTicket.get(ticket.id) ?? []
                  const latest = thread[0]
                  const summaryPreview = ticket.message?.trim() || 'No summary yet'
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedSupportTicketId(ticket.id)}
                      className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">#{ticket.id}</p>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                              ticket.status === 'open' ? 'border-emerald-500/30 text-emerald-300' : 'border-border text-muted-foreground'
                            }`}
                          >
                            {ticket.status}
                          </span>
                          <PriorityBadge priority={ticket.ticketPriority ?? 'normal'} />
                          {ticket.assignedToUserId != null && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              {organizerById.get(ticket.assignedToUserId)?.name?.trim() || 'Assigned'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{ticket.reporterName || ticket.reporterEmail}</p>
                      {splitTicketLabels(ticket.ticketLabels).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {splitTicketLabels(ticket.ticketLabels).map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 truncate text-[11px] text-foreground/80">{summaryPreview}</p>
                      {latest?.message && latest.message !== ticket.message && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">Latest: {latest.message}</p>
                      )}
                    </button>
                  )
                })}

                {filteredSupportTickets.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No support tickets found.
                  </p>
                )}
              </div>
            </aside>

            <div className="p-5">
              {selectedSupportTicket ? (
                <>
                  <h3 className="font-display text-2xl text-foreground">#{selectedSupportTicket.id}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reporter: {selectedSupportTicket.reporterName || 'Unknown'} ({selectedSupportTicket.reporterEmail || 'No email'})
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Created: {formatDateTime(selectedSupportTicket.createdAt)}
                  </p>

                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ticket metadata</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Priority</span>
                        <select
                          value={supportMetadataDrafts[selectedSupportTicket.id]?.priority ?? 'normal'}
                          onChange={(event) =>
                            setSupportMetadataDrafts((current) => ({
                              ...current,
                              [selectedSupportTicket.id]: {
                                ...(current[selectedSupportTicket.id] ?? {
                                  priority: selectedSupportTicket.ticketPriority ?? 'normal',
                                  labels: selectedSupportTicket.ticketLabels ?? '',
                                  assignedToUserId: selectedSupportTicket.assignedToUserId ? String(selectedSupportTicket.assignedToUserId) : '',
                                }),
                                priority: event.target.value as TicketPriority,
                              },
                            }))
                          }
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
                          value={supportMetadataDrafts[selectedSupportTicket.id]?.labels ?? ''}
                          onChange={(event) =>
                            setSupportMetadataDrafts((current) => ({
                              ...current,
                              [selectedSupportTicket.id]: {
                                ...(current[selectedSupportTicket.id] ?? {
                                  priority: selectedSupportTicket.ticketPriority ?? 'normal',
                                  labels: selectedSupportTicket.ticketLabels ?? '',
                                  assignedToUserId: selectedSupportTicket.assignedToUserId ? String(selectedSupportTicket.assignedToUserId) : '',
                                }),
                                labels: event.target.value,
                              },
                            }))
                          }
                          placeholder="urgent, account, bug"
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                        />
                      </label>

                      <label className="space-y-1 text-sm md:col-span-2">
                        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assigned to</span>
                        <select
                          value={supportMetadataDrafts[selectedSupportTicket.id]?.assignedToUserId ?? ''}
                          onChange={(event) =>
                            setSupportMetadataDrafts((current) => ({
                              ...current,
                              [selectedSupportTicket.id]: {
                                ...(current[selectedSupportTicket.id] ?? {
                                  priority: selectedSupportTicket.ticketPriority ?? 'normal',
                                  labels: selectedSupportTicket.ticketLabels ?? '',
                                  assignedToUserId: selectedSupportTicket.assignedToUserId ? String(selectedSupportTicket.assignedToUserId) : '',
                                }),
                                assignedToUserId: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                        >
                          <option value="">Unassigned</option>
                          {organizerUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name?.trim() || user.email || `User ${user.id}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => updateSupportMetadata(selectedSupportTicket.id)}
                          disabled={updatingSupportMetadataId === selectedSupportTicket.id}
                          className="w-full rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          {updatingSupportMetadataId === selectedSupportTicket.id ? 'Saving...' : 'Save metadata'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Conversation</p>
                    {selectedSupportMessages.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {[...selectedSupportMessages]
                          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                          .map((msg) => (
                            <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                  {isNanoMessage(msg) ? 'AI' : msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {getMessageSenderLabel(msg)} · {formatDateTime(msg.createdAt)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.message}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {selectedSupportTicket.status === 'open' && (
                    <>
                      <div className="mt-3 rounded-xl border border-border bg-background p-4">
                        <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quick support template</label>
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            const selectedTemplate = event.target.value
                            if (!selectedTemplate) return
                            setSupportReplyDrafts((current) => ({
                              ...current,
                              [selectedSupportTicket.id]: selectedTemplate,
                            }))
                            event.currentTarget.value = ''
                          }}
                          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                        >
                          <option value="">Select a template...</option>
                          {supportReplyTemplates.map((template) => (
                            <option key={template} value={template}>
                              {template}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        value={supportReplyDrafts[selectedSupportTicket.id] ?? ''}
                        onChange={(event) =>
                          setSupportReplyDrafts((current) => ({
                            ...current,
                            [selectedSupportTicket.id]: event.target.value,
                          }))
                        }
                        placeholder="Write a reply to the hosted user..."
                        className="mt-3 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                      />
                    </>
                  )}

                  {supportActionError && <p className="mt-3 text-sm text-red-400">{supportActionError}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSupportTicket.status === 'open' && (
                      <>
                        <button
                          type="button"
                          onClick={() => replyToSupportTicketFromAdmin(selectedSupportTicket.id)}
                          disabled={replyingSupportTicketId === selectedSupportTicket.id}
                          className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                          {replyingSupportTicketId === selectedSupportTicket.id ? 'Sending...' : 'Send reply'}
                        </button>

                        <button
                          type="button"
                          onClick={() => closeSupportTicketFromAdmin(selectedSupportTicket.id)}
                          disabled={closingSupportTicketId === selectedSupportTicket.id}
                          className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                        >
                          {closingSupportTicketId === selectedSupportTicket.id ? 'Closing...' : 'Close ticket'}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteSupportTicketFromAdmin(selectedSupportTicket.id)}
                      disabled={deletingSupportTicketId === selectedSupportTicket.id}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {deletingSupportTicketId === selectedSupportTicket.id ? 'Deleting...' : 'Delete ticket'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No support ticket selected.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </section>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg text-foreground">{value}</p>
    </div>
  )
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

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${className}`}>
      {priority}
    </span>
  )
}

function QueueStateBadge({ state }: { state: 'new' | 'waiting-hosted' | 'waiting-staff' | 'closed' }) {
  if (state === 'closed') {
    return <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">closed</span>
  }
  if (state === 'new') {
    return <span className="rounded-full border border-blue-500/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-blue-300">new</span>
  }
  if (state === 'waiting-hosted') {
    return <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-300">waiting hosted</span>
  }
  return <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-300">waiting staff</span>
}
