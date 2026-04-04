import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  getMyFoundaryApplicationMessagesFn,
  getMyFoundaryApplicationsFn,
  postFoundaryApplicationMessageFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/hosted/applications')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const [applications, messages] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyFoundaryApplicationMessagesFn(),
    ])

    return { applications, messages }
  },
  component: HostedApplicationsPage,
})

function HostedApplicationsPage() {
  const { applications, messages } = Route.useLoaderData()
  const router = useRouter()
  const [applicationReplies, setApplicationReplies] = useState<Record<number, string>>({})
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(applications[0]?.id ?? null)
  const [applicationTab, setApplicationTab] = useState<'overview' | 'thread'>('overview')

  const safeMessages = messages ?? []

  const messagesByApplication = useMemo(() => {
    const grouped = new Map<number, typeof safeMessages>()
    for (const message of safeMessages) {
      const current = grouped.get(message.applicationId) ?? []
      current.push(message)
      grouped.set(message.applicationId, current)
    }
    return grouped
  }, [safeMessages])

  const selectedApplication = useMemo(() => {
    if (!applications.length) return null
    return applications.find((application) => application.id === selectedApplicationId) ?? applications[0]
  }, [applications, selectedApplicationId])

  const selectedApplicationMessages = selectedApplication ? (messagesByApplication.get(selectedApplication.id) ?? []) : []
  const hasStaffFeedbackThread = selectedApplicationMessages.some((msg) => msg.senderRole === 'organizer')

  useEffect(() => {
    if (!applications.length) {
      setSelectedApplicationId(null)
      return
    }

    const currentSelectionStillExists = selectedApplicationId
      ? applications.some((application) => application.id === selectedApplicationId)
      : false

    if (!currentSelectionStillExists) {
      setSelectedApplicationId(applications[0].id)
    }
  }, [applications, selectedApplicationId])

  useEffect(() => {
    if (!hasStaffFeedbackThread && applicationTab === 'thread') {
      setApplicationTab('overview')
    }
  }, [applicationTab, hasStaffFeedbackThread])

  const sendApplicationReply = async (applicationId: number) => {
    const message = applicationReplies[applicationId]?.trim()
    if (!message) return

    await postFoundaryApplicationMessageFn({ data: { applicationId, message } })
    setApplicationReplies((current) => ({ ...current, [applicationId]: '' }))
    await router.invalidate()
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-muted-foreground">
        No applications found for this account yet.
      </div>
    )
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="grid gap-0 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-border bg-background md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Tickets</p>
            <p className="mt-1 text-sm text-muted-foreground">Funding requests from your organization</p>
          </div>
          <div className="max-h-[36rem] overflow-auto p-2">
            {applications.map((application) => {
              const appMessages = messagesByApplication.get(application.id) ?? []
              const needsReply = appMessages.some((msg) => msg.senderRole === 'organizer')
              const selected = selectedApplication?.id === application.id

              return (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => {
                    setSelectedApplicationId(application.id)
                    setApplicationTab('overview')
                  }}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">#{application.id} {application.eventName}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {application.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">${application.fundingRequestAmount} · {application.plannedMonths}</p>
                  {needsReply && <p className="mt-1 text-[11px] text-muted-foreground">Staff requested more info</p>}
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
                  {selectedApplication.organizationName} · Requested funds: ${selectedApplication.fundingRequestAmount}
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {selectedApplication.status}
              </span>
            </div>

            <div className="mt-4 inline-grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setApplicationTab('overview')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${
                  applicationTab === 'overview'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => hasStaffFeedbackThread && setApplicationTab('thread')}
                disabled={!hasStaffFeedbackThread}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${
                  applicationTab === 'thread'
                    ? 'bg-primary text-primary-foreground'
                    : hasStaffFeedbackThread
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'cursor-not-allowed text-muted-foreground/50'
                }`}
              >
                Thread
              </button>
            </div>

            {applicationTab === 'overview' ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-border bg-background p-4">
                {selectedApplication.status === 'approved' && (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-800">
                    <p className="font-medium">Funding approved</p>
                    <p className="mt-1">Your request has been approved. {selectedApplication.reviewNotes ? `Note: ${selectedApplication.reviewNotes}` : ''}</p>
                  </div>
                )}
                {selectedApplication.status === 'rejected' && (
                  <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-800">
                    <p className="font-medium">Funding request rejected</p>
                    <p className="mt-1">{selectedApplication.reviewNotes || 'No reason was provided.'}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Planned months: {selectedApplication.plannedMonths}</p>
                <p className="text-sm text-muted-foreground">Expected attendees: {selectedApplication.expectedAttendees}</p>
                <p className="text-sm text-muted-foreground">Status: {selectedApplication.status}</p>
                {selectedApplication.reviewNotes && (
                  <div className="mt-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground/85">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Review notes</p>
                    <p>{selectedApplication.reviewNotes}</p>
                  </div>
                )}
                {!hasStaffFeedbackThread && (
                  <p className="pt-2 text-sm text-muted-foreground">
                    No feedback thread yet. A thread will appear if staff requests more information.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Thread</p>

                {selectedApplicationMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedApplicationMessages.map((msg) => (
                      <div key={msg.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {msg.senderRole === 'organizer' ? 'Staff' : 'Hosted'} · {msg.senderName || msg.senderEmail}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-foreground/90">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  value={applicationReplies[selectedApplication.id] ?? ''}
                  onChange={(event) =>
                    setApplicationReplies((current) => ({
                      ...current,
                      [selectedApplication.id]: event.target.value,
                    }))
                  }
                  placeholder="Reply to staff or provide further info..."
                  className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                />
                <button
                  type="button"
                  onClick={() => sendApplicationReply(selectedApplication.id)}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Send reply
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
