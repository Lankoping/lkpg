import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Gauge, LockKeyhole, PlusCircle, FolderOpen, Link2, MonitorSmartphone } from 'lucide-react'
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
      setActivationMessage('Storage activated. Use the tabs above to open the dedicated upload and explorer pages.')
      await router.invalidate()
    } catch (error: unknown) {
      setActivationError(getErrorMessage(error, 'Could not activate storage'))
    } finally {
      setActivationBusy(false)
    }
  }

  if (storageLoadError) {
    return <section className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">Storage failed to load: {storageLoadError}</section>
  }

  if (!storage.organizationName) {
    return <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Join or create a hosted organization before requesting storage.</section>
  }

  return (
    <StoragePageShell storage={storage} activeTab="overview">
      <div className="space-y-5 rounded-3xl border border-border bg-background p-6 md:p-7">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Files</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{storage.fileCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Uploaded files</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Used</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatBytes(storage.usedBytes)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Stored data</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Remaining</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatBytes(storage.remainingBytes)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Before the 5GB limit</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <a href={storageTabRoutes.upload} className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <PlusCircle className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Upload file</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Open the upload page for S3 transfer and malicious-file blocking.</p>
          </a>
          <a href={storageTabRoutes.explorer} className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">File explorer</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Search, filter, sort, and delete uploaded files on a dedicated page.</p>
          </a>
          <a href={storageTabRoutes.cdn} className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">CDN and links</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">See CDN URLs and copy direct links for delivery.</p>
          </a>
          <a href={storageTabRoutes.limits} className="rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Limits</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Read the storage quota, usage, and rules in one place.</p>
          </a>
        </div>

        {!isApproved ? (
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Request storage</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Request access before you can upload files or use the explorer.</p>
            {!requestOpen && (
              <button type="button" onClick={() => setRequestOpen(true)} className="mt-4 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Request storage</button>
            )}
            {requestOpen && (
              <form onSubmit={submitRequest} className="mt-4 space-y-3">
                <label className="block text-sm text-muted-foreground">
                  Reason for storage access
                  <textarea required minLength={10} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary/60" />
                </label>
                {requestError && <p className="text-sm text-red-400">{requestError}</p>}
                {requestMessage && <p className="text-sm text-emerald-400">{requestMessage}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Send for review</button>
                  <button type="button" onClick={() => setRequestOpen(false)} className="rounded-2xl border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </form>
            )}

            {isPending && storage.request && <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-foreground">Request pending review: {storage.request.reason}</p>}
            {isRejected && storage.request && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-foreground">Request rejected: {storage.request.reviewNotes || 'No review note was provided.'}</p>}
          </div>
        ) : !isActivated ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-sm font-medium text-foreground">Storage approved</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Activate storage to unlock the upload and explorer pages.</p>
            <form onSubmit={activateStorage} className="mt-4 space-y-3">
              <div className="max-h-56 overflow-auto rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                <p>1. Storage is limited to 5GB per organization.</p>
                <p className="mt-3">2. You are responsible for all uploaded content and must have rights to distribute it.</p>
                <p className="mt-3">3. Do not upload illegal content, malware, or private data you are not authorized to store.</p>
                <p className="mt-3">4. Lan Foundary may suspend or remove files that violate policy or applicable law.</p>
              </div>

              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
                <span className="text-base leading-6">I accept the Storage terms.</span>
              </label>

              {activationError && <p className="text-sm text-red-400">{activationError}</p>}
              {activationMessage && <p className="text-sm text-emerald-400">{activationMessage}</p>}

              <button type="submit" disabled={activationBusy || !termsAccepted} className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {activationBusy ? 'Activating...' : 'Activate storage'}
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Storage live</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the dedicated pages above instead of the single-page layout.</p>
          </div>
        )}
      </div>
    </StoragePageShell>
  )
}
