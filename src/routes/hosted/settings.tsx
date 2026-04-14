import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import {
  cancelOrganizationNamespaceTransferFn,
  deleteMyOrganizationAccountFn,
  getHostedAccessControlFn,
  getNamespaceTransferEstimateFn,
  getMyOrganizationNamespaceTransferStatusFn,
  getMyFoundaryApplicationsFn,
  getMyOrganizationMembersFn,
  requestOrganizationDeletionApprovalFn,
  renameOrganizationFn,
} from '../../server/functions/foundary'

export const Route = createFileRoute('/hosted/settings')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    const [applications, members, accessControl, transferStatus] = await Promise.all([
      getMyFoundaryApplicationsFn(),
      getMyOrganizationMembersFn(),
      getHostedAccessControlFn(),
      getMyOrganizationNamespaceTransferStatusFn(),
    ])

    const organizationName = accessControl.organizationName || applications[0]?.organizationName || ''
    const transferEstimate = organizationName ? await getNamespaceTransferEstimateFn({ data: { organizationName } }) : null

    return { user, applications, members, accessControl, transferStatus, transferEstimate }
  },
  component: HostedSettingsPage,
})

type NamespaceTransferDetails = {
  durationSeconds: number
  speedSummary: string
  stats: {
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

function HostedSettingsPage() {
  const router = useRouter()
  const { user, applications, members, accessControl, transferStatus: initialTransferStatus, transferEstimate } = Route.useLoaderData()

  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameMessage, setRenameMessage] = useState('')
  const [transferStatus, setTransferStatus] = useState(initialTransferStatus)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelMessage, setCancelMessage] = useState('')
  const [deleteOrgBusy, setDeleteOrgBusy] = useState(false)
  const [deleteOrgMessage, setDeleteOrgMessage] = useState('')

  const organizationName = accessControl.organizationName || applications[0]?.organizationName || ''

  const ownerUserId = useMemo(() => {
    if (!organizationName) return null
    const orgMembers = members
      .filter((member) => member.organizationName === organizationName)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return orgMembers[0]?.userId ?? null
  }, [members, organizationName])

  const isOwner = Boolean(ownerUserId && ownerUserId === user.id)

  const transferStartedAtMs = transferStatus?.startedAt ? new Date(transferStatus.startedAt).getTime() : null
  const transferElapsedMs = transferStartedAtMs && Number.isFinite(transferStartedAtMs) ? Date.now() - transferStartedAtMs : null
  const isStuckAtStart =
    transferStatus?.status === 'in_progress' &&
    (transferStatus.progressPercent ?? 0) <= 0 &&
    (transferStatus.completedSteps ?? 0) <= 0 &&
    transferElapsedMs != null &&
    transferElapsedMs > 2 * 60 * 1000

  const transferErrorStep =
    transferStatus?.status === 'failed'
      ? transferStatus.currentStep || 'Unknown step'
      : isStuckAtStart
        ? transferStatus?.currentStep || 'Starting namespace transfer'
        : null

  const transferErrorDetails =
    transferStatus?.status === 'failed'
      ? transferStatus.errorMessage || 'No details were provided by the server.'
      : isStuckAtStart
        ? 'No progress was detected for more than 2 minutes. The transfer likely failed to start; refresh and retry rename.'
        : null

  const transferDetails = parseTransferDetails(transferStatus?.detailsJson)

  const formatTransferDuration = (startedAt: Date | string | null | undefined, completedAt: Date | string | null | undefined) => {
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

  useEffect(() => {
    let stopped = false

    const refreshTransferStatus = async () => {
      try {
        const latest = await getMyOrganizationNamespaceTransferStatusFn()
        if (!stopped) {
          setTransferStatus(latest)
        }
      } catch {
        // Keep current status if refresh fails.
      }
    }

    refreshTransferStatus()
    const interval = window.setInterval(refreshTransferStatus, 3000)

    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [])

  const onRename = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organizationName || !renameValue.trim()) return

    setRenameMessage('')
    setRenameBusy(true)

    try {
      const response = await renameOrganizationFn({
        data: {
          organizationName,
          newOrganizationName: renameValue.trim(),
        },
      })

      setRenameMessage(response.notice)
      setRenameValue('')
      await router.invalidate()
    } catch (error: any) {
      setRenameMessage(error?.message || 'Could not rename organization')
    } finally {
      setRenameBusy(false)
    }
  }

  const onDeleteMyAccount = async () => {
    if (!organizationName) return

    setDeleteMessage('')
    setDeleteBusy(true)

    try {
      const response = await deleteMyOrganizationAccountFn({
        data: { organizationName },
      })

      setDeleteMessage(
        response.deactivated
          ? 'Your account was deleted and you have been signed out.'
          : 'Your membership was removed. Any remaining memberships are still active.',
      )
      await router.invalidate()
      if (response.deactivated) {
        window.location.replace('/hosted')
      }
    } catch (error: any) {
      setDeleteMessage(error?.message || 'Could not delete your account')
    } finally {
      setDeleteBusy(false)
    }
  }

  const onCancelNamespaceTransfer = async () => {
    if (!organizationName) return

    setCancelMessage('')
    setCancelBusy(true)

    try {
      const response = await cancelOrganizationNamespaceTransferFn({
        data: { organizationName },
      })
      setCancelMessage(response.notice)
      await router.invalidate()
    } catch (error: any) {
      setCancelMessage(error?.message || 'Could not cancel namespace transfer')
    } finally {
      setCancelBusy(false)
    }
  }

  const onDeleteOrganization = async () => {
    if (!organizationName || !isOwner) return

    setDeleteOrgMessage('')
    setDeleteOrgBusy(true)

    try {
      const response = await requestOrganizationDeletionApprovalFn({
        data: { organizationName },
      })

      setDeleteOrgMessage(response.notice)
      await router.invalidate()
    } catch (error: any) {
      setDeleteOrgMessage(error?.message || 'Could not request organization deletion')
    } finally {
      setDeleteOrgBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Settings</p>
        <p className="mt-2 text-sm text-muted-foreground">Manage organization details and your account lifecycle from one place.</p>
      </div>

      {!organizationName ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Organization settings are available after your first application is linked to an organization.
        </div>
      ) : (
        <>
          {transferStatus && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Namespace transfer status</p>
              <p className="mt-2 text-sm text-muted-foreground">Old organisation name: {transferStatus.organizationName}</p>
              <p className="mt-1 text-sm text-muted-foreground">New organisation name: {transferStatus.newOrganizationName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Total transfer duration: {formatTransferDuration(transferStatus.startedAt, transferStatus.completedAt)}
              </p>
              <p className="mt-1 text-sm text-foreground">Current step: {transferStatus.currentStep || 'Starting...'}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {transferStatus.status} · {transferStatus.progressPercent}% · Step {transferStatus.completedSteps} of {transferStatus.totalSteps}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, transferStatus.progressPercent || 0))}%` }} />
              </div>

              {transferErrorStep && transferErrorDetails && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                  <p className="text-sm font-medium text-red-700">Error on step: {transferErrorStep}</p>
                  <p className="mt-1 text-sm text-red-700">Details: {transferErrorDetails}</p>
                </div>
              )}

              {transferDetails && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">Transfer summary</p>
                  <p className="mt-1 text-sm text-muted-foreground">Why it was this fast: {transferDetails.speedSummary}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Duration: {transferDetails.durationSeconds}s</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Storage objects moved: {transferDetails.stats.movedStorageObjects} · Reservation keys moved: {transferDetails.stats.movedReservationObjectKeys}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Records renamed: members {transferDetails.stats.renamedMembers}, invitations {transferDetails.stats.renamedInvitations}, applications {transferDetails.stats.renamedApplications}, perk requests {transferDetails.stats.renamedStoragePerkRequests}, reservations {transferDetails.stats.renamedStorageReservations}, files {transferDetails.stats.renamedStorageFiles}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Notification emails sent: {transferDetails.stats.notificationEmailsSent}</p>
                </div>
              )}

              {isOwner && transferStatus.status !== 'completed' && (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={cancelBusy}
                    onClick={onCancelNamespaceTransfer}
                    className="rounded border border-amber-500/50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {cancelBusy ? 'Cancelling...' : 'Cancel name change and undo changes'}
                  </button>
                  {cancelMessage && <p className="mt-2 text-sm text-muted-foreground">{cancelMessage}</p>}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Organization settings</p>
            <p className="mt-2 text-sm text-muted-foreground">Current organization: {organizationName}</p>

            {transferEstimate && (
              <div className="mt-3 rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium text-foreground">Pre-transfer estimate</p>
                <p className="mt-1 text-sm text-muted-foreground">{transferEstimate.speedSummary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Members: {transferEstimate.memberCount} · Invitations: {transferEstimate.invitationCount} · Applications: {transferEstimate.applicationCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Storage files: {transferEstimate.storageFileCount} · Upload reservations: {transferEstimate.storageReservationCount} · Storage perk requests: {transferEstimate.storagePerkRequestCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Storage objects to move: {transferEstimate.totalStorageObjectCount}</p>
              </div>
            )}

            {isOwner ? (
              <form onSubmit={onRename} className="mt-3 space-y-3">
                <label className="block text-sm text-muted-foreground">
                  Rename organization
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/60"
                    placeholder="New organization name"
                  />
                </label>
                <button
                  type="submit"
                  disabled={renameBusy}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {renameBusy ? 'Renaming...' : 'Rename organization'}
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Only the organization owner can rename the organization.</p>
            )}

            {renameMessage && <p className="mt-3 text-sm text-muted-foreground">{renameMessage}</p>}
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-700">Profile settings</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete your own organization account from here. This removes your membership and deletes your uploaded files.
            </p>

            {isOwner && (
              <p className="mt-2 text-sm text-red-700">
                Owners cannot self-delete while they still own the organization. Use Delete organization below.
              </p>
            )}

            <button
              type="button"
              disabled={deleteBusy}
              onClick={onDeleteMyAccount}
              className="mt-3 rounded border border-red-500/40 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting account...' : 'Delete my account'}
            </button>

            {deleteMessage && <p className="mt-3 text-sm text-red-700">{deleteMessage}</p>}
          </div>

          {isOwner && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-800">Organization danger zone</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Request deletion of the entire organization. An admin must approve before members, storage data, invitations, and applications are removed.
              </p>

              <button
                type="button"
                disabled={deleteOrgBusy}
                onClick={onDeleteOrganization}
                className="mt-3 rounded border border-red-600/50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleteOrgBusy ? 'Submitting request...' : 'Request organization deletion'}
              </button>

              {deleteOrgMessage && <p className="mt-2 text-sm text-red-800">{deleteOrgMessage}</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
