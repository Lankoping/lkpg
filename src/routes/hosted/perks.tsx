import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HardDrive, Trash2, Upload } from 'lucide-react'
import { getSessionFn } from '../../server/functions/auth'
import {
  activateStoragePerkFn,
  createStorageUploadReservationFn,
  deleteStorageFileFn,
  getMyStoragePerkFn,
  requestStoragePerkFn,
} from '../../server/functions/storage'

const EMPTY_STORAGE_STATE = {
  organizationName: null,
  request: null,
  fileCount: 0,
  usedBytes: 0,
  reservedBytes: 0,
  remainingBytes: 5 * 1024 * 1024 * 1024,
  files: [],
  limitBytes: 5 * 1024 * 1024 * 1024,
} as const

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
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false)
  const [activationBusy, setActivationBusy] = useState(false)
  const [activationError, setActivationError] = useState('')
  const [activationMessage, setActivationMessage] = useState('')
  const [storageServiceError, setStorageServiceError] = useState('')

  const storageOutageMessage = 'Our servers are curently experiencing connection issues please dont upload any files.'

  const readUploadErrorBody = async (response: Response) => {
    try {
      const body = (await response.text()).trim()
      if (!body) return ''

      const compact = body.replace(/\s+/g, ' ')
      const messageMatch = compact.match(/<Message>(.*?)<\/Message>/i)
      const codeMatch = compact.match(/<Code>(.*?)<\/Code>/i)

      if (messageMatch?.[1]) {
        const codePrefix = codeMatch?.[1] ? `${codeMatch[1]}: ` : ''
        return `${codePrefix}${messageMatch[1]}`
      }

      return compact.slice(0, 400)
    } catch {
      return ''
    }
  }

  const progressPercent = useMemo(() => {
    if (!storage.limitBytes) return 0
    return Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100))
  }, [storage.limitBytes, storage.usedBytes])

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

  const uploadSelectedFile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!uploadFile || !storage.organizationName) return
    const uploadContentType = uploadFile.type || 'application/octet-stream'

    setUploadBusy(true)
    setUploadError('')
    setUploadMessage('')

    try {
      const reservation = await createStorageUploadReservationFn({
        data: {
          organizationName: storage.organizationName,
          fileName: uploadFile.name,
          contentType: uploadContentType,
          sizeBytes: uploadFile.size,
        },
      })

      const putResult = await fetch(reservation.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadContentType },
        body: uploadFile,
      })

      if (!putResult.ok) {
        const bodyDetails = await readUploadErrorBody(putResult)
        const details = bodyDetails ? ` - ${bodyDetails}` : ''
        throw new Error(`S3 upload failed (${putResult.status} ${putResult.statusText})${details}`)
      }

      setUploadMessage('File uploaded successfully.')
      setUploadFile(null)
      setStorageServiceError('')
      await router.invalidate()
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not upload file')
      setUploadError(message)
      if (message === storageOutageMessage) {
        setStorageServiceError(message)
      }
    } finally {
      setUploadBusy(false)
    }
  }

  const removeFile = async (fileId: number) => {
    setDeleteBusyId(fileId)
    setUploadError('')
    try {
      await deleteStorageFileFn({ data: { fileId } })
      await router.invalidate()
    } catch (error: unknown) {
      setUploadError(getErrorMessage(error, 'Could not delete file'))
    } finally {
      setDeleteBusyId(null)
    }
  }

  const isApproved = storage.request?.status === 'approved'
  const isActivated = Boolean(storage.request?.termsAcceptedAt)
  const isPending = storage.request?.status === 'pending'
  const isRejected = storage.request?.status === 'rejected'

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
      setActivationMessage('Storage activated. Uploads are now enabled.')
      await router.invalidate()
    } catch (error: unknown) {
      setActivationError(getErrorMessage(error, 'Could not activate storage'))
    } finally {
      setActivationBusy(false)
    }
  }

  if (storageLoadError) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Perks</p>
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Storage failed to load: {storageLoadError}
        </div>
      </section>
    )
  }

  if (!storage.organizationName) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Perks</p>
        <p className="mt-3 text-sm text-muted-foreground">Join or create a hosted organization before requesting storage.</p>
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="rounded-2xl border border-border bg-background p-5">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Perks</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-foreground">Storage</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Request 5GB of hosted storage for uploads, assets, and CDN-backed files.
            </p>
          </div>
          <div className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {isApproved ? 'Approved' : isPending ? 'Pending review' : isRejected ? 'Rejected' : 'Not requested'}
          </div>
        </div>
      </div>

      {!isApproved ? (
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Activate storage</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us why your organization needs storage and a staff member will review the request.
              </p>
            </div>
            {!requestOpen && (
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Activate storage
              </button>
            )}
          </div>

          {requestOpen && (
            <form onSubmit={submitRequest} className="mt-4 space-y-3">
              <label className="block text-sm text-muted-foreground">
                Reason for storage access
                <textarea
                  required
                  minLength={10}
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                  className="mt-1 min-h-28 w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/60"
                  placeholder="Explain what you will store and why the organization needs CDN-backed storage."
                />
              </label>
              {requestError && <p className="text-sm text-red-400">{requestError}</p>}
              {requestMessage && <p className="text-sm text-emerald-400">{requestMessage}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Send for review
                </button>
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {isPending && storage.request && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-foreground">
              <p className="font-medium">Request pending review</p>
              <p className="mt-1 text-muted-foreground">{storage.request.reason}</p>
            </div>
          )}

          {isRejected && storage.request && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-foreground">
              <p className="font-medium">Request rejected</p>
              <p className="mt-1 text-muted-foreground">{storage.request.reviewNotes || 'No review note was provided.'}</p>
              {!requestOpen && (
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="mt-3 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Request again
                </button>
              )}
            </div>
          )}
        </div>
      ) : !isActivated ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-sm font-medium text-foreground">Storage approved</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your organization has been approved. Press Activate storage, then scroll through the terms and accept them to unlock uploads.
            </p>
          </div>

          <form onSubmit={activateStorage} className="rounded-2xl border border-border bg-background p-5">
            <p className="text-sm font-medium text-foreground">Storage terms</p>
            <div
              className="mt-3 max-h-56 overflow-auto rounded-xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground"
              onScroll={(event) => {
                const target = event.currentTarget
                const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 8
                if (reachedBottom) {
                  setTermsScrolledToBottom(true)
                }
              }}
            >
              <p>1. Storage is limited to 5GB per organization. Uploads beyond that limit are blocked automatically.</p>
              <p className="mt-3">2. You are responsible for all uploaded content and must have rights to distribute it.</p>
              <p className="mt-3">3. Do not upload illegal content, malware, or private data you are not authorized to store.</p>
              <p className="mt-3">4. Lan Foundary may suspend or remove files that violate policy or applicable law.</p>
              <p className="mt-3">5. Keep your team accounts secure. Any uploaded content is attributable to your organization.</p>
              <p className="mt-3">6. CDN URLs are public and should be treated as public links unless additional access controls are added by your integration.</p>
            </div>

            <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>I have scrolled through and accept the Storage terms.</span>
            </label>

            {!termsScrolledToBottom && (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-600">Scroll to the end of terms to continue.</p>
            )}

            {activationError && <p className="mt-3 text-sm text-red-400">{activationError}</p>}
            {activationMessage && <p className="mt-3 text-sm text-emerald-400">{activationMessage}</p>}

            <button
              type="submit"
              disabled={activationBusy || !termsAccepted || !termsScrolledToBottom}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {activationBusy ? 'Activating...' : 'Activate storage'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Storage enabled</p>
                <p className="mt-1 text-sm text-muted-foreground">Organization: {storage.organizationName}</p>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-700">
                Live
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>Used storage</span>
                <span>{Math.round((storage.usedBytes / 1024 / 1024) * 10) / 10} MB of 5120 MB</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-border bg-card">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {Math.max(0, storage.remainingBytes)} bytes remaining before the 5GB hard limit blocks new uploads.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={uploadSelectedFile} className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Upload a file</p>
                  <p className="text-sm text-muted-foreground">Files are uploaded to S3 and exposed through the CDN URL.</p>
                </div>
              </div>

              <label className="mt-4 block text-sm text-muted-foreground">
                Select file
                <input
                  type="file"
                  required
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-xl border border-border bg-card px-3 py-2 text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
                />
              </label>

              {uploadFile && (
                <div className="mt-3 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                  <p className="text-foreground">{uploadFile.name}</p>
                  <p className="mt-1">{uploadFile.size} bytes</p>
                </div>
              )}

              {storageServiceError && <p className="mt-3 text-sm text-red-400">{storageServiceError}</p>}
              {!storageServiceError && uploadError && <p className="mt-3 text-sm text-red-400">{uploadError}</p>}
              {uploadMessage && <p className="mt-3 text-sm text-emerald-400">{uploadMessage}</p>}

              <button
                type="submit"
                disabled={uploadBusy || !uploadFile || Boolean(storageServiceError)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploadBusy ? 'Uploading...' : 'Upload to storage'}
              </button>
            </form>

            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">File viewer</p>
                  <p className="text-sm text-muted-foreground">Browse uploaded files and copy their CDN links.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {storage.files.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    No files uploaded yet.
                  </div>
                ) : (
                  storage.files.map((file) => (
                    <div key={file.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{file.sizeBytes} bytes · {file.contentType || 'unknown type'}</p>
                          <a href={file.publicUrl} target="_blank" className="mt-1 block text-xs text-primary hover:underline">
                            Open CDN URL
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          disabled={deleteBusyId === file.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-700 hover:bg-red-400/20 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteBusyId === file.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-sm font-medium text-foreground">Integration details</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the CDN URL for public delivery. Uploads are blocked once the organization reaches 5GB of stored files.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Current usage: {storage.usedBytes} bytes</p>
          </div>
        </div>
      )}
    </section>
  )
}
