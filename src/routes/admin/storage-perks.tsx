import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getSessionFn } from '../../server/functions/auth'
import { getStoragePerkRequestsFn, reviewStoragePerkRequestFn } from '../../server/functions/storage'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const Route = createFileRoute('/admin/storage-perks')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }
  },
  loader: async () => {
    try {
      const requests = await getStoragePerkRequestsFn()
      return { requests, loadError: '' }
    } catch (error: unknown) {
      return {
        requests: [],
        loadError: error instanceof Error ? error.message : 'Could not load storage requests',
      }
    }
  },
  component: AdminStoragePerksPage,
})

function AdminStoragePerksPage() {
  const { requests, loadError } = Route.useLoaderData()
  const router = useRouter()
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(requests[0]?.id ?? null)
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({})
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null)
  const [completedRequestId, setCompletedRequestId] = useState<number | null>(null)
  const [completedDecision, setCompletedDecision] = useState<'approved' | 'rejected' | null>(null)

  const selectedRequest = useMemo(() => {
    if (!requests.length) return null
    if (!selectedRequestId) return requests[0]
    return requests.find((request) => request.id === selectedRequestId) ?? requests[0]
  }, [requests, selectedRequestId])

  const reviewRequest = async (requestId: number, status: 'approved' | 'rejected') => {
    setActionError('')
    setActionMessage('')
    setBusyRequestId(requestId)
    try {
      await reviewStoragePerkRequestFn({
        data: {
          requestId,
          status,
          reviewNotes: reviewNotes[requestId] || undefined,
        },
      })
      setCompletedRequestId(requestId)
      setCompletedDecision(status)
      setActionMessage(
        `${selectedRequest?.organizationName || 'Storage request'} ${status === 'approved' ? 'approved' : 'rejected'} successfully. Notification email sent.`,
      )
      toast.success(
        `${selectedRequest?.organizationName || 'Storage request'} ${status === 'approved' ? 'approved' : 'rejected'}. Notification email sent.`,
      )
      await router.invalidate()
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not review storage request')
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyRequestId(null)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-6 py-5 text-sm text-red-200">
        Storage requests failed to load: {loadError}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
        No storage requests yet.
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 md:grid-cols-[340px_1fr]">
        <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Storage perks</p>
            <p className="mt-1 text-sm text-muted-foreground">Review request access for hosted organizations</p>
          </div>
          <div className="max-h-[42rem] overflow-auto p-2">
            {requests.map((request) => {
              const selected = selectedRequest?.id === request.id

              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedRequestId(request.id)}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{request.organizationName}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.reason}</p>
                </button>
              )
            })}
          </div>
        </aside>

        {selectedRequest ? (
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-foreground">{selectedRequest.organizationName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Requested by {selectedRequest.requestedByName || selectedRequest.requestedByEmail || 'Unknown'}
                </p>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {selectedRequest.status}
              </span>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Request reason</p>
                <p className="mt-2 text-sm leading-6 text-foreground/85">{selectedRequest.reason}</p>
              </div>

              <textarea
                value={reviewNotes[selectedRequest.id] ?? selectedRequest.reviewNotes ?? ''}
                onChange={(event) => setReviewNotes((current) => ({ ...current, [selectedRequest.id]: event.target.value }))}
                className="min-h-28 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                placeholder="Add review notes for the organization..."
              />

              {selectedRequest.reviewNotes && (
                <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground/85">
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Existing review notes</p>
                  <p>{selectedRequest.reviewNotes}</p>
                </div>
              )}

              {actionError && <p className="text-sm text-red-400">{actionError}</p>}
              {actionMessage && <p className="text-sm text-emerald-400">{actionMessage}</p>}

              {selectedRequest.status === 'pending' && completedRequestId !== selectedRequest.id ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => reviewRequest(selectedRequest.id, 'approved')}
                    disabled={busyRequestId === selectedRequest.id}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-400/20 disabled:opacity-60"
                  >
                    {busyRequestId === selectedRequest.id ? 'Saving...' : 'Approve storage'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(selectedRequest.id, 'rejected')}
                    disabled={busyRequestId === selectedRequest.id}
                    className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-60"
                  >
                    {busyRequestId === selectedRequest.id ? 'Saving...' : 'Reject storage'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  {completedRequestId === selectedRequest.id
                    ? `This request was ${completedDecision} and the requester has been notified.`
                    : `This request is ${selectedRequest.status}.`}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status guide</p>
              <p className="mt-2">Approved organizations can upload files until the 5GB limit is reached.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}