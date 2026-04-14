import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  getNamespaceTransferMonitorForAdminFn,
  getNamespaceTransfersForAdminFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/admin/transfers')({
  loader: async () => {
    const transfers = await getNamespaceTransfersForAdminFn()
    return { transfers }
  },
  component: AdminTransfersPage,
})

type TransferSummary = Awaited<ReturnType<typeof getNamespaceTransfersForAdminFn>>[number]
type TransferMonitor = Awaited<ReturnType<typeof getNamespaceTransferMonitorForAdminFn>>

type NamespaceTransferDetails = {
  oldOrganizationName: string
  newOrganizationName: string
  durationSeconds: number
  speedSummary: string
  stats: {
    sourceMembers: number
    sourceInvitations: number
    sourceApplications: number
    sourceStorageFiles: number
    sourceStorageReservations: number
    sourceStoragePerkRequests: number
    movedStorageObjects: number
    movedReservationObjectKeys: number
    renamedMembers: number
    renamedInvitations: number
    renamedApplications: number
    renamedStoragePerkRequests: number
    renamedStorageReservations: number
    renamedStorageFiles: number
    notificationEmailsSent: number
  }
}

function parseTransferDetails(detailsJson: string | null | undefined): NamespaceTransferDetails | null {
  if (!detailsJson) return null
  try {
    return JSON.parse(detailsJson) as NamespaceTransferDetails
  } catch {
    return null
  }
}

function formatDateTime(value: Date | string | null) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatTransferDuration(startedAt: Date | string | null, completedAt: Date | string | null) {
  if (!startedAt) return '-'
  const startMs = new Date(startedAt).getTime()
  const endMs = completedAt ? new Date(completedAt).getTime() : Date.now()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return '-'

  const totalSeconds = Math.floor((endMs - startMs) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

function AdminTransfersPage() {
  const { transfers: initialTransfers } = Route.useLoaderData()
  const [transfers, setTransfers] = useState<TransferSummary[]>(initialTransfers)
  const [selectedTransferId, setSelectedTransferId] = useState<number | null>(initialTransfers[0]?.id ?? null)
  const [selectedMonitor, setSelectedMonitor] = useState<TransferMonitor | null>(null)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [refreshError, setRefreshError] = useState('')

  const selectedTransfer = useMemo(
    () => transfers.find((transfer) => transfer.id === selectedTransferId) ?? null,
    [selectedTransferId, transfers],
  )

  const selectedTransferDetails = useMemo(() => {
    return parseTransferDetails(selectedMonitor?.transfer?.detailsJson ?? selectedTransfer?.detailsJson)
  }, [selectedMonitor?.transfer?.detailsJson, selectedTransfer?.detailsJson])

  useEffect(() => {
    let stopped = false

    const refresh = async () => {
      try {
        const list = await getNamespaceTransfersForAdminFn()
        if (stopped) return
        setTransfers(list)

        const preferredId = selectedTransferId ?? list[0]?.id ?? null
        setSelectedTransferId((current) => {
          if (current != null && list.some((item) => item.id === current)) return current
          return preferredId
        })

        if (preferredId != null) {
          const monitor = await getNamespaceTransferMonitorForAdminFn({ data: { transferId: preferredId } })
          if (!stopped) {
            setSelectedMonitor(monitor)
          }
        } else if (!stopped) {
          setSelectedMonitor(null)
        }

        if (!stopped) {
          setRefreshError('')
          setRefreshMessage(`Live DB poll: ${new Date().toLocaleTimeString()}`)
        }
      } catch (error: any) {
        if (!stopped) {
          setRefreshError(error?.message || 'Failed to poll transfer monitor')
        }
      }
    }

    refresh()
    const interval = window.setInterval(refresh, 1500)

    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [selectedTransferId])

  const selectTransfer = async (transferId: number) => {
    setSelectedTransferId(transferId)
    setRefreshError('')
    try {
      const monitor = await getNamespaceTransferMonitorForAdminFn({ data: { transferId } })
      setSelectedMonitor(monitor)
      setRefreshMessage(`Live DB poll: ${new Date().toLocaleTimeString()}`)
    } catch (error: any) {
      setRefreshError(error?.message || 'Failed to load transfer details')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Transfers</p>
        <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">Namespace Transfer Monitor</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select a transfer task and watch live DB state as it changes.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">Transfer tasks</p>
            <p className="text-xs text-muted-foreground">Click any transfer to monitor DB details.</p>
          </div>

          {transfers.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No transfers found.</div>
          ) : (
            <div className="divide-y divide-border">
              {transfers.map((transfer) => {
                const isSelected = transfer.id === selectedTransferId
                return (
                  <button
                    key={transfer.id}
                    type="button"
                    onClick={() => selectTransfer(transfer.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-secondary/40'}`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      #{transfer.id} {transfer.organizationName} -&gt; {transfer.newOrganizationName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {transfer.status} | {transfer.progressPercent}% | {transfer.completedSteps}/{transfer.totalSteps}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(transfer.startedAt)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-medium text-foreground">Live monitor</p>
            <p className="mt-1 text-xs text-muted-foreground">{refreshMessage || 'Waiting for first DB poll...'}</p>
            {refreshError && <p className="mt-1 text-xs text-red-700">{refreshError}</p>}
          </div>

          {!selectedTransfer ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">Select a transfer task on the left.</div>
          ) : (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">Transfer state</p>
                <p className="mt-2 text-sm text-muted-foreground">Old organisation name: {selectedTransfer.organizationName}</p>
                <p className="mt-1 text-sm text-muted-foreground">New organisation name: {selectedTransfer.newOrganizationName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total transfer duration: {formatTransferDuration(selectedTransfer.startedAt, selectedTransfer.completedAt)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {selectedTransfer.status} | Step {selectedTransfer.completedSteps} of {selectedTransfer.totalSteps} | {selectedTransfer.progressPercent}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current step: {selectedTransfer.currentStep || 'Unknown'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Started: {formatDateTime(selectedTransfer.startedAt)} | Completed: {formatDateTime(selectedTransfer.completedAt)}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">Live DB snapshot</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-border p-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Source org</p>
                    <p className="mt-1 text-xs text-muted-foreground">Members: {selectedMonitor?.snapshot.source.members ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Invitations: {selectedMonitor?.snapshot.source.invitations ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Applications: {selectedMonitor?.snapshot.source.applications ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Storage files: {selectedMonitor?.snapshot.source.storageFiles ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Upload reservations: {selectedMonitor?.snapshot.source.storageReservations ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Storage perk requests: {selectedMonitor?.snapshot.source.storagePerkRequests ?? 0}</p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Target org</p>
                    <p className="mt-1 text-xs text-muted-foreground">Members: {selectedMonitor?.snapshot.target.members ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Invitations: {selectedMonitor?.snapshot.target.invitations ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Applications: {selectedMonitor?.snapshot.target.applications ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Storage files: {selectedMonitor?.snapshot.target.storageFiles ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Upload reservations: {selectedMonitor?.snapshot.target.storageReservations ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Storage perk requests: {selectedMonitor?.snapshot.target.storagePerkRequests ?? 0}</p>
                  </div>
                </div>
              </div>

              {selectedTransferDetails && (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">Completion summary</p>
                  <p className="mt-2 text-xs text-muted-foreground">Speed explanation: {selectedTransferDetails.speedSummary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Duration: {selectedTransferDetails.durationSeconds}s</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-border p-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Source totals</p>
                      <p className="mt-1 text-xs text-muted-foreground">Members: {selectedTransferDetails.stats.sourceMembers}</p>
                      <p className="text-xs text-muted-foreground">Invitations: {selectedTransferDetails.stats.sourceInvitations}</p>
                      <p className="text-xs text-muted-foreground">Applications: {selectedTransferDetails.stats.sourceApplications}</p>
                      <p className="text-xs text-muted-foreground">Storage files: {selectedTransferDetails.stats.sourceStorageFiles}</p>
                      <p className="text-xs text-muted-foreground">Upload reservations: {selectedTransferDetails.stats.sourceStorageReservations}</p>
                      <p className="text-xs text-muted-foreground">Storage perk requests: {selectedTransferDetails.stats.sourceStoragePerkRequests}</p>
                    </div>
                    <div className="rounded border border-border p-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Transfer operations</p>
                      <p className="mt-1 text-xs text-muted-foreground">Moved storage objects: {selectedTransferDetails.stats.movedStorageObjects}</p>
                      <p className="text-xs text-muted-foreground">Moved reservation keys: {selectedTransferDetails.stats.movedReservationObjectKeys}</p>
                      <p className="text-xs text-muted-foreground">Renamed members: {selectedTransferDetails.stats.renamedMembers}</p>
                      <p className="text-xs text-muted-foreground">Renamed invitations: {selectedTransferDetails.stats.renamedInvitations}</p>
                      <p className="text-xs text-muted-foreground">Renamed applications: {selectedTransferDetails.stats.renamedApplications}</p>
                      <p className="text-xs text-muted-foreground">Renamed storage perk requests: {selectedTransferDetails.stats.renamedStoragePerkRequests}</p>
                      <p className="text-xs text-muted-foreground">Renamed storage reservations: {selectedTransferDetails.stats.renamedStorageReservations}</p>
                      <p className="text-xs text-muted-foreground">Renamed storage files: {selectedTransferDetails.stats.renamedStorageFiles}</p>
                      <p className="text-xs text-muted-foreground">Notification emails sent: {selectedTransferDetails.stats.notificationEmailsSent}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">Raw DB transfer payload</p>
                <pre className="mt-2 overflow-auto rounded bg-secondary/50 p-3 text-xs text-foreground">
                  {JSON.stringify(selectedMonitor?.transfer ?? selectedTransfer, null, 2)}
                </pre>
                {selectedMonitor?.transfer.errorMessage && (
                  <div className="mt-2 rounded border border-red-500/40 bg-red-500/5 p-2">
                    <p className="whitespace-pre-wrap text-xs text-red-700">{selectedMonitor.transfer.errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
