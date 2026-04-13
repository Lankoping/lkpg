import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import { forceOrganizationStatusForAdminFn, getOrganizationsForAdminFn } from '../../server/functions/foundary'

export const Route = createFileRoute('/admin/organizations')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }
  },
  loader: async () => {
    const organizations = await getOrganizationsForAdminFn()
    return { organizations }
  },
  component: AdminOrganizationsPage,
})

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function AdminOrganizationsPage() {
  const { organizations } = Route.useLoaderData()
  const router = useRouter()
  const [selectedOrganizationName, setSelectedOrganizationName] = useState<string | null>(organizations[0]?.organizationName ?? null)
  const [busyOrganizationName, setBusyOrganizationName] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [statusDrafts, setStatusDrafts] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({})
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({})

  const selectedOrganization = useMemo(() => {
    if (!selectedOrganizationName) return organizations[0] ?? null
    return organizations.find((item) => item.organizationName === selectedOrganizationName) ?? organizations[0] ?? null
  }, [organizations, selectedOrganizationName])

  const pendingCount = organizations.filter((organization) => organization.status === 'pending').length

  const forceStatus = async () => {
    if (!selectedOrganization) return

    const nextStatus = statusDrafts[selectedOrganization.organizationName] ?? selectedOrganization.status
    const nextReviewNotes = notesDrafts[selectedOrganization.organizationName] ?? selectedOrganization.reviewNotes ?? ''

    setActionError('')
    setActionMessage('')
    setBusyOrganizationName(selectedOrganization.organizationName)

    try {
      const response = await forceOrganizationStatusForAdminFn({
        data: {
          organizationName: selectedOrganization.organizationName,
          status: nextStatus,
          reviewNotes: nextReviewNotes || undefined,
        },
      })

      setActionMessage(`Forced ${response.organizationName} to ${response.status}.`)
      await router.invalidate()
    } catch (error: any) {
      setActionError(error?.message || 'Could not force organization status')
    } finally {
      setBusyOrganizationName(null)
    }
  }

  if (organizations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
        No organizations with applications found.
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 md:grid-cols-[340px_1fr]">
        <aside className="border-b border-border bg-background/50 md:border-b-0 md:border-r">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Organizations</p>
            <p className="mt-1 text-sm text-muted-foreground">Force-fix limbo states (pending/approval issues)</p>
            <p className="mt-1 text-xs text-muted-foreground">Pending: {pendingCount}</p>
          </div>

          <div className="max-h-[42rem] overflow-auto p-2">
            {organizations.map((organization) => {
              const selected = selectedOrganization?.organizationName === organization.organizationName
              return (
                <button
                  key={organization.organizationName}
                  type="button"
                  onClick={() => setSelectedOrganizationName(organization.organizationName)}
                  className={`mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40 hover:bg-background'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{organization.organizationName}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {organization.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Last event: {organization.eventName}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Updated: {formatDateTime(organization.updatedAt)}</p>
                </button>
              )
            })}
          </div>
        </aside>

        {selectedOrganization ? (
          <div className="p-5">
            <h2 className="font-display text-2xl text-foreground">{selectedOrganization.organizationName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Applicant: {selectedOrganization.applicantName} ({selectedOrganization.email})
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Latest app #{selectedOrganization.applicationId} · Created: {formatDateTime(selectedOrganization.createdAt)}
            </p>

            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Manual state override</p>

              <label className="mt-3 block text-sm text-muted-foreground">
                Force status
                <select
                  value={statusDrafts[selectedOrganization.organizationName] ?? selectedOrganization.status}
                  onChange={(event) =>
                    setStatusDrafts((current) => ({
                      ...current,
                      [selectedOrganization.organizationName]: event.target.value as 'pending' | 'approved' | 'rejected',
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>

              <label className="mt-3 block text-sm text-muted-foreground">
                Review notes
                <textarea
                  value={notesDrafts[selectedOrganization.organizationName] ?? selectedOrganization.reviewNotes ?? ''}
                  onChange={(event) =>
                    setNotesDrafts((current) => ({
                      ...current,
                      [selectedOrganization.organizationName]: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  placeholder="Explain why the status was force-changed"
                />
              </label>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={forceStatus}
                  disabled={busyOrganizationName === selectedOrganization.organizationName}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {busyOrganizationName === selectedOrganization.organizationName ? 'Saving...' : 'Force change status'}
                </button>
              </div>

              {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
              {actionMessage && <p className="mt-3 text-sm text-emerald-400">{actionMessage}</p>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
