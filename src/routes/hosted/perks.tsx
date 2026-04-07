import { createFileRoute, Outlet, redirect, useLocation, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Gauge, LockKeyhole, PlusCircle, FolderOpen, Link2, Settings, Search, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { getSessionFn } from '../../server/functions/auth'
import { activateStoragePerkFn, getMyStoragePerkFn, requestStoragePerkFn } from '../../server/functions/storage'
import { StoragePageShell, formatBytes, storageTabRoutes, type StorageState } from '../../components/storage-page-shell'

const EMPTY_STORAGE_STATE: StorageState = {
  organizationName: null,
  request: null,
  fileCount: 0,
  usedBytes: 0,
  reservedBytes: 0,
  remainingBytes: 5 * 1024 * 1024 * 1024,
  files: [],
  limitBytes: 5 * 1024 * 1024 * 1024,
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const Route = createFileRoute('/hosted/perks')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    try {
      const storage = await getMyStoragePerkFn()
      return { storage, storageLoadError: '' }
    } catch (error: unknown) {
      return {
        storage: EMPTY_STORAGE_STATE,
        storageLoadError: getErrorMessage(error, 'Could not load storage data'),
      }
    }
  },
  component: HostedPerksPage,
})

function HostedPerksPage() {
  const router = useRouter()
  const location = useLocation()
  const { storage, storageLoadError } = Route.useLoaderData()
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestReason, setRequestReason] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [requestError, setRequestError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [activationBusy, setActivationBusy] = useState(false)
  const [activationError, setActivationError] = useState('')
  const [activationMessage, setActivationMessage] = useState('')

  const isApproved = storage.request?.status === 'approved'
  const isActivated = Boolean(storage.request?.termsAcceptedAt)
  const isPending = storage.request?.status === 'pending'
  const isRejected = storage.request?.status === 'rejected'

  if (location.pathname !== '/hosted/perks') {
    return <Outlet />
  }

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault()
    setRequestError('')
    setRequestMessage('')

    try {
      await requestStoragePerkFn({ data: { reason: requestReason } })
      setRequestMessage('Storage request sent for admin review.')
      setRequestReason('')
      setRequestOpen(false)
      await router.invalidate()
    } catch (error: unknown) {
      setRequestError(getErrorMessage(error, 'Could not submit storage request'))
    }
  }

  const activateStorage = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!storage.organizationName) return

    setActivationBusy(true)
    setActivationError('')
    setActivationMessage('')

    try {
      await activateStoragePerkFn({
        data: {
          organizationName: storage.organizationName,
          acceptTerms: true,
        },
      })
      setActivationMessage('Storage activated successfully!')
      await router.invalidate()
    } catch (error: unknown) {
      setActivationError(getErrorMessage(error, 'Could not activate storage'))
    } finally {
      setActivationBusy(false)
    }
  }

  if (storageLoadError) {
    return (
      <StoragePageShell storage={storage} activeTab="overview">
        <div className="flex items-center justify-center rounded-2xl border border-red-400/30 bg-red-400/10 p-12">
          <p className="text-sm text-red-400">Storage failed to load: {storageLoadError}</p>
        </div>
      </StoragePageShell>
    )
  }

  if (!storage.organizationName) {
    return (
      <StoragePageShell storage={storage} activeTab="overview">
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">Join or create a hosted organization before requesting storage.</p>
        </div>
      </StoragePageShell>
    )
  }

  return (
    <StoragePageShell storage={storage} activeTab="overview">
      <div className="flex flex-col gap-4">
        {/* Top Action Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search in storage..."
                className="w-full rounded-full border border-border bg-background py-2 pl-10 pr-4 text-sm placeholder-muted-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {isActivated && (
              <>
                <a
                  href={storageTabRoutes.upload}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Upload</span>
                </a>
                <a
                  href={storageTabRoutes.explorer}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background/80"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Files</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {activationMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <p className="text-sm text-foreground">{activationMessage}</p>
          </div>
        )}

        {/* Request Pending */}
        {isPending && storage.request && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <Clock className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Request pending review</p>
              <p className="text-xs text-muted-foreground">{storage.request.reason}</p>
            </div>
          </div>
        )}

        {/* Request Rejected */}
        {isRejected && storage.request && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4">
            <XCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Request rejected</p>
              <p className="text-xs text-muted-foreground">{storage.request.reviewNotes || 'No review note was provided.'}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left Content Area */}
          <div className="space-y-4">
            {/* Storage Stats */}
            {isActivated && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground">Storage usage</p>
                <div className="mt-4 space-y-3">
                  {/* Usage Bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{formatBytes(storage.usedBytes)}</span>
                      <span className="text-muted-foreground">{formatBytes(storage.limitBytes)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(storage.usedBytes / storage.limitBytes) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBytes(storage.remainingBytes)} remaining</p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 pt-3">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Files</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{storage.fileCount}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Used</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{formatBytes(storage.usedBytes)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Free</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{formatBytes(storage.remainingBytes)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Request/Activation Section */}
            {!isApproved ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Request storage access</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Your organization needs admin approval to use shared storage. Request access and an admin will review it.
                    </p>
                  </div>
                </div>

                {!requestOpen && (
                  <button
                    type="button"
                    onClick={() => setRequestOpen(true)}
                    className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Request storage
                  </button>
                )}

                {requestOpen && (
                  <form onSubmit={submitRequest} className="mt-4 space-y-3">
                    <label className="block text-sm">
                      <span className="font-medium text-foreground">Why do you need storage?</span>
                      <textarea
                        required
                        minLength={10}
                        value={requestReason}
                        onChange={(event) => setRequestReason(event.target.value)}
                        placeholder="Describe your use case..."
                        className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                      />
                    </label>
                    {requestError && (
                      <div className="rounded-lg bg-red-400/10 p-3 text-sm text-red-400">{requestError}</div>
                    )}
                    {requestMessage && (
                      <div className="rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-400">{requestMessage}</div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Send request
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequestOpen(false)}
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background/80"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : !isActivated ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Storage approved!</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Your request has been approved. Review and accept the terms below to activate storage.
                    </p>
                  </div>
                </div>

                <form onSubmit={activateStorage} className="mt-4 space-y-3">
                  <div className="max-h-48 overflow-auto rounded-lg border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
                    <p className="font-medium text-foreground">Storage Terms</p>
                    <p className="mt-2">1. Storage is shared across your organization and limited to 5GB total.</p>
                    <p className="mt-2">2. You are responsible for all uploaded content and must have rights to distribute it.</p>
                    <p className="mt-2">3. Do not upload illegal content, malware, or personal/sensitive data.</p>
                    <p className="mt-2">4. Lan Foundary may suspend or remove files that violate policy or applicable law.</p>
                  </div>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="mt-1 h-5 w-5 accent-primary"
                    />
                    <span className="text-sm text-foreground">I accept the Storage terms</span>
                  </label>

                  {activationError && (
                    <div className="rounded-lg bg-red-400/10 p-3 text-sm text-red-400">{activationError}</div>
                  )}

                  <button
                    type="submit"
                    disabled={activationBusy || !termsAccepted}
                    className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {activationBusy ? 'Activating...' : 'Activate storage'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <Gauge className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Storage is live</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Your organization storage is ready to use. Upload files or browse existing content using the buttons above.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Links */}
            {isActivated && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="font-semibold text-foreground">Quick access</p>
                <div className="mt-3 grid gap-2">
                  <a
                    href={storageTabRoutes.cdn}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:bg-background/80"
                  >
                    <span className="flex items-center gap-2 text-foreground">
                      <Link2 className="h-4 w-4 text-primary" />
                      CDN links
                    </span>
                    <span className="text-xs text-muted-foreground">Share files</span>
                  </a>
                  <a
                    href={storageTabRoutes.limits}
                    className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:bg-background/80"
                  >
                    <span className="flex items-center gap-2 text-foreground">
                      <Settings className="h-4 w-4 text-primary" />
                      Storage limits
                    </span>
                    <span className="text-xs text-muted-foreground">Settings</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {isActivated && (
              <>
                {/* Shared Organization Info */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</p>
                  <p className="mt-2 truncate text-sm font-medium text-foreground">{storage.organizationName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Shared storage</p>
                </div>

                {/* Help/Info */}
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tips</p>
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Organize files in folders</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>Share via CDN links</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>5GB per organization</span>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </StoragePageShell>
  )
}
