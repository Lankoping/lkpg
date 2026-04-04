import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  createFoundaryApplicationTicketFn,
  deleteFoundaryApplicationFn,
  getFoundaryApplicationMessagesFn,
  getFoundaryApplicationsFn,
  postFoundaryApplicationMessageFn,
  updateFoundaryApplicationConfidentialityFn,
  updateFoundaryApplicationStatusFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/admin/applications')({
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
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const { applications, messages } = Route.useLoaderData()
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [activePanel, setActivePanel] = useState<'overview' | 'review' | 'thread'>('overview')
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({})
  const [adjustedFunds, setAdjustedFunds] = useState<Record<number, string>>({})
  const [messageDrafts, setMessageDrafts] = useState<Record<number, string>>({})
  const [actionError, setActionError] = useState('')
  const [ticketingApplicationId, setTicketingApplicationId] = useState<number | null>(null)
  const [deletingApplicationId, setDeletingApplicationId] = useState<number | null>(null)
  const [togglingConfidentialityId, setTogglingConfidentialityId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return applications
    return applications.filter((application) => application.status === filter)
  }, [applications, filter])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedApplicationId(null)
      return
    }

    if (!selectedApplicationId || !filtered.some((app) => app.id === selectedApplicationId)) {
      setSelectedApplicationId(filtered[0].id)
      setActivePanel('overview')
    }
  }, [filtered, selectedApplicationId])

  const selectedApplication = useMemo(() => {
    if (!filtered.length) return null
    return filtered.find((application) => application.id === selectedApplicationId) ?? filtered[0]
  }, [filtered, selectedApplicationId])

  const selectedMessages = useMemo(() => {
    if (!selectedApplication) return []
    return messages.filter((msg) => msg.applicationId === selectedApplication.id)
  }, [messages, selectedApplication])

  const hasThread = selectedMessages.some((msg) => msg.senderRole === 'organizer')

  useEffect(() => {
    if (activePanel === 'thread' && !hasThread) {
      setActivePanel('overview')
    }
  }, [activePanel, hasThread])

  const updateStatus = async (
    applicationId: number,
    status: 'pending' | 'approved' | 'rejected',
    options?: { withAdjustment?: boolean; requestMoreInfo?: boolean },
  ) => {
    const draftAdjustment = adjustedFunds[applicationId]?.trim()
    const draftMessage = messageDrafts[applicationId]?.trim()

    await updateFoundaryApplicationStatusFn({
      data: {
        applicationId,
        status,
        reviewNotes: reviewNotes[applicationId] || undefined,
        adjustedFundingAmount: options?.withAdjustment && draftAdjustment ? Number(draftAdjustment) : undefined,
        requestMoreInfoMessage: options?.requestMoreInfo ? draftMessage : undefined,
      },
    })

    if (options?.requestMoreInfo) {
      setMessageDrafts((current) => ({ ...current, [applicationId]: '' }))
    }

    await router.invalidate()
  }

  const sendReply = async (applicationId: number) => {
    const message = messageDrafts[applicationId]?.trim()
    if (!message) return

    await postFoundaryApplicationMessageFn({ data: { applicationId, message } })
    setMessageDrafts((current) => ({ ...current, [applicationId]: '' }))
    await router.invalidate()
  }

  const createTicket = async (applicationId: number) => {
    const message = messageDrafts[applicationId]?.trim()
    if (!message) {
      setActionError('Write a ticket message before creating a ticket.')
      return
    }

    setActionError('')
    setTicketingApplicationId(applicationId)
    try {
      await createFoundaryApplicationTicketFn({ data: { applicationId, message } })
      setMessageDrafts((current) => ({ ...current, [applicationId]: '' }))
      setActivePanel('thread')
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not create ticket')
    } finally {
      setTicketingApplicationId(null)
    }
  }

  const deleteApplication = async (applicationId: number) => {
    const confirmed = window.confirm('Delete this application and all thread messages? This cannot be undone.')
    if (!confirmed) return

    setActionError('')
    setDeletingApplicationId(applicationId)
    try {
      await deleteFoundaryApplicationFn({ data: { applicationId } })
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not delete application')
    } finally {
      setDeletingApplicationId(null)
    }
  }

  const toggleConfidentiality = async (applicationId: number, isConfidential: boolean) => {
    setActionError('')
    setTogglingConfidentialityId(applicationId)
    try {
      await updateFoundaryApplicationConfidentialityFn({
        data: {
          applicationId,
          isConfidential: !isConfidential,
        },
      })
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not update confidentiality')
    } finally {
      setTogglingConfidentialityId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Foundary</p>
        <h1 className="font-display text-3xl text-foreground">Applications</h1>
        <p className="text-muted-foreground mt-2">Review funding and perk requests from host organizations.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${filter === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center text-muted-foreground">
          No applications found.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid gap-0 md:grid-cols-[340px_1fr]">
            <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Tickets</p>
                <p className="mt-1 text-sm text-muted-foreground">Hosted funding requests</p>
              </div>
              <div className="max-h-[42rem] overflow-auto p-2">
                {filtered.map((application) => {
                  const appMessages = messages.filter((msg) => msg.applicationId === application.id)
                  const appHasThread = appMessages.some((msg) => msg.senderRole === 'organizer')
                  const selected = selectedApplication?.id === application.id

                  return (
                    <button
                      key={application.id}
                      type="button"
                      onClick={() => {
                        setSelectedApplicationId(application.id)
                        setActivePanel('overview')
                      }}
                      className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">#{application.id} {application.eventName}</p>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {application.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">${application.fundingRequestAmount} · {application.organizationName}</p>
                      {appHasThread && <p className="mt-1 text-[11px] text-amber-300">Needs hosted reply</p>}
                    </button>
                  )
                })}
              </div>
            </aside>

            {selectedApplication ? (
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-foreground">#{selectedApplication.id} {selectedApplication.eventName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedApplication.organizationName} · {selectedApplication.applicantName} · {selectedApplication.email}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {selectedApplication.status}
                  </span>
                </div>

                <div className="mt-4 inline-grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-1">
                  {(['overview', 'review', 'thread'] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() => {
                        if (panel === 'thread' && !hasThread) return
                        setActivePanel(panel)
                      }}
                      disabled={panel === 'thread' && !hasThread}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${
                        activePanel === panel
                          ? 'bg-primary text-primary-foreground'
                          : panel === 'thread' && !hasThread
                            ? 'cursor-not-allowed text-muted-foreground/50'
                            : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {panel}
                    </button>
                  ))}
                </div>

                {activePanel === 'overview' && (
                  <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Requested funds: ${selectedApplication.fundingRequestAmount} · Expected attendees: {selectedApplication.expectedAttendees}</p>
                    <p className="text-sm text-muted-foreground">Planned months: {selectedApplication.plannedMonths}</p>
                    <p className="text-sm text-muted-foreground">Location: {selectedApplication.cityCountry}</p>
                    <p className="text-sm text-muted-foreground">HCB: {selectedApplication.hasHcbAccount ? `Yes (${selectedApplication.hcbUsername || 'no ID supplied'})` : 'No'}</p>
                    <p className="pt-2 text-sm leading-6 text-foreground/85">{selectedApplication.briefEventDescription}</p>
                    <p className="text-sm leading-6 text-foreground/75">{selectedApplication.budgetJustification}</p>
                    {selectedApplication.reviewNotes && (
                      <div className="mt-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground/85">
                        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Review notes</p>
                        <p>{selectedApplication.reviewNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {activePanel === 'review' && (
                  <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Review notes</label>
                    <textarea
                      value={reviewNotes[selectedApplication.id] ?? selectedApplication.reviewNotes ?? ''}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [selectedApplication.id]: event.target.value }))}
                      className="min-h-28 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                      placeholder="Add internal notes..."
                    />

                    <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Adjust requested funds (USD)</label>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={adjustedFunds[selectedApplication.id] ?? selectedApplication.fundingRequestAmount}
                      onChange={(event) => setAdjustedFunds((current) => ({ ...current, [selectedApplication.id]: event.target.value }))}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                    />

                    <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">Reply / request more info</label>
                    <textarea
                      value={messageDrafts[selectedApplication.id] ?? ''}
                      onChange={(event) => setMessageDrafts((current) => ({ ...current, [selectedApplication.id]: event.target.value }))}
                      className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                      placeholder="Write a reply to hosted organization..."
                    />

                    <button
                      onClick={() => toggleConfidentiality(selectedApplication.id, selectedApplication.isConfidential)}
                      disabled={togglingConfidentialityId === selectedApplication.id}
                      className="w-full rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-xs text-violet-700 hover:bg-violet-400/20 disabled:opacity-60"
                    >
                      {togglingConfidentialityId === selectedApplication.id
                        ? 'Updating confidentiality...'
                        : selectedApplication.isConfidential
                          ? 'Confidential: ON (only creator can view replies)'
                          : 'Confidential: OFF (all members can view replies)'}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      {hasThread ? (
                        <button
                          onClick={() => sendReply(selectedApplication.id)}
                          className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Send reply
                        </button>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
                          Thread starts after "Request info"
                        </div>
                      )}
                      <button
                        onClick={() => createTicket(selectedApplication.id)}
                        disabled={ticketingApplicationId === selectedApplication.id}
                        className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs text-blue-700 hover:bg-blue-400/20 disabled:opacity-60"
                      >
                        {ticketingApplicationId === selectedApplication.id ? 'Creating ticket...' : 'Create ticket'}
                      </button>
                      <button
                        onClick={() => updateStatus(selectedApplication.id, 'pending', { requestMoreInfo: true })}
                        className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-700 hover:bg-amber-400/20"
                      >
                        Request info
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => updateStatus(selectedApplication.id, 'pending')} className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                        Pending
                      </button>
                      <button onClick={() => updateStatus(selectedApplication.id, 'approved', { withAdjustment: true })} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-400/20">
                        Approve
                      </button>
                      <button onClick={() => updateStatus(selectedApplication.id, 'rejected')} className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20">
                        Reject
                      </button>
                    </div>

                    {actionError && <p className="text-sm text-red-400">{actionError}</p>}

                    <button
                      onClick={() => deleteApplication(selectedApplication.id)}
                      disabled={deletingApplicationId === selectedApplication.id}
                      className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                    >
                      {deletingApplicationId === selectedApplication.id ? 'Deleting application...' : 'Delete application'}
                    </button>
                  </div>
                )}

                {activePanel === 'thread' && (
                  <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Thread</p>
                    {selectedMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No replies yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedMessages.map((msg) => (
                          <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}