import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowUpDown, Copy, ExternalLink, HardDrive, Search, Trash2, Upload } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const fixed = value >= 100 || exponent === 0 ? 0 : 1
  return `${value.toFixed(fixed)} ${units[exponent]}`
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Unknown date'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString()
}

function detectFileCategory(fileName: string, contentType: string | null | undefined) {
  const lowerName = fileName.toLowerCase()
  const extension = lowerName.includes('.') ? lowerName.split('.').pop() || '' : ''
  const type = (contentType || '').toLowerCase()

  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.includes('pdf') || type.includes('word') || type.includes('excel') || type.includes('powerpoint')) return 'document'

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension)) return 'image'
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) return 'audio'
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(extension)) return 'archive'
  if (['pdf', 'txt', 'md', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) return 'document'
  if (['json', 'yaml', 'yml', 'xml', 'csv', 'ts', 'tsx', 'js', 'jsx', 'css', 'html'].includes(extension)) return 'code'

  return 'other'
}

type ExplorerSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'
type ExplorerFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other'

const EXPLORER_TAB_LABELS: Record<ExplorerFilter, string> = {
  all: 'All files',
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
  archive: 'Archives',
  code: 'Code',
  other: 'Other',
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
  const [explorerQuery, setExplorerQuery] = useState('')
  const [explorerSort, setExplorerSort] = useState<ExplorerSort>('newest')
  const [explorerFilter, setExplorerFilter] = useState<ExplorerFilter>('all')
  const [copyMessage, setCopyMessage] = useState('')

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

  const isLikelyHtml404 = (response: Response) => {
    if (response.status !== 404) return false
    const contentType = response.headers.get('content-type') || ''
    return contentType.toLowerCase().includes('text/html')
  }

  const buildUploadUrlFallback = (uploadUrl: string) => {
    if (!uploadUrl.startsWith('/api/')) return null
    return `/_server${uploadUrl}`
  }

  const progressPercent = useMemo(() => {
    if (!storage.limitBytes) return 0
    return Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100))
  }, [storage.limitBytes, storage.usedBytes])

  const explorerFiles = useMemo(() => {
    const normalizedQuery = explorerQuery.trim().toLowerCase()

    const filtered = storage.files.filter((file) => {
      const category = detectFileCategory(file.fileName, file.contentType)
      if (explorerFilter !== 'all' && category !== explorerFilter) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return [file.fileName, file.contentType || '', file.uploadedByName || '', file.uploadedByEmail || '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })

    filtered.sort((a, b) => {
      switch (explorerSort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'name-asc':
          return a.fileName.localeCompare(b.fileName)
        case 'name-desc':
          return b.fileName.localeCompare(a.fileName)
        case 'size-asc':
          return a.sizeBytes - b.sizeBytes
        case 'size-desc':
          return b.sizeBytes - a.sizeBytes
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return filtered
  }, [explorerFilter, explorerQuery, explorerSort, storage.files])

  const explorerTabCounts = useMemo(() => {
    const counts: Record<ExplorerFilter, number> = {
      all: storage.files.length,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      code: 0,
      other: 0,
    }

    for (const file of storage.files) {
      const category = detectFileCategory(file.fileName, file.contentType)
      counts[category] += 1
    }

    return counts
  }, [storage.files])

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(successMessage)
      window.setTimeout(() => {
        setCopyMessage('')
      }, 1800)
    } catch {
      setUploadError('Could not copy to clipboard')
    }
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

      const uploadTargets = [reservation.uploadUrl]
      const fallbackUploadUrl = buildUploadUrlFallback(reservation.uploadUrl)
      if (fallbackUploadUrl) {
        uploadTargets.push(fallbackUploadUrl)
      }

      let putResult: Response | null = null
      for (let index = 0; index < uploadTargets.length; index += 1) {
        const target = uploadTargets[index]
        const candidateResult = await fetch(target, {
          method: 'PUT',
          headers: { 'Content-Type': uploadContentType },
          body: uploadFile,
        })

        const hasMoreTargets = index < uploadTargets.length - 1
        if (hasMoreTargets && isLikelyHtml404(candidateResult)) {
          continue
        }

        putResult = candidateResult
        break
      }

      if (!putResult) {
        throw new Error('Upload failed before receiving a response')
      }

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
    <section className="space-y-6 rounded-3xl border border-border bg-card p-6 md:p-8">
      <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Perks</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-foreground md:text-4xl">Storage</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Request 5GB of hosted storage for uploads, assets, and CDN-backed files.
            </p>
          </div>
          <div className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {isApproved ? 'Approved' : isPending ? 'Pending review' : isRejected ? 'Rejected' : 'Not requested'}
          </div>
        </div>
      </div>

      {!isApproved ? (
        <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-medium text-foreground">Activate storage</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
                Tell us why your organization needs storage and a staff member will review the request.
              </p>
            </div>
            {!requestOpen && (
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                  className="mt-2 min-h-32 w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:border-primary/60"
                  placeholder="Explain what you will store and why the organization needs CDN-backed storage."
                />
              </label>
              {requestError && <p className="text-sm text-red-400">{requestError}</p>}
              {requestMessage && <p className="text-sm text-emerald-400">{requestMessage}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Send for review
                </button>
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="rounded-2xl border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {isPending && storage.request && (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-foreground">
              <p className="font-medium">Request pending review</p>
              <p className="mt-1 text-muted-foreground">{storage.request.reason}</p>
            </div>
          )}

          {isRejected && storage.request && (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-foreground">
              <p className="font-medium">Request rejected</p>
              <p className="mt-1 text-muted-foreground">{storage.request.reviewNotes || 'No review note was provided.'}</p>
              {!requestOpen && (
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="mt-4 rounded-2xl border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Request again
                </button>
              )}
            </div>
          )}
        </div>
      ) : !isActivated ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 md:p-7">
            <p className="text-base font-medium text-foreground">Storage approved</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
              Your organization has been approved. Press Activate storage, then scroll through the terms and accept them to unlock uploads.
            </p>
          </div>

          <form onSubmit={activateStorage} className="rounded-3xl border border-border bg-background p-6 md:p-7">
            <p className="text-base font-medium text-foreground">Storage terms</p>
            <div
              className="mt-4 max-h-64 overflow-auto rounded-2xl border border-border bg-card p-5 text-sm leading-7 text-muted-foreground"
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
                className="mt-1 h-5 w-5 accent-primary"
              />
              <span className="text-base leading-6">I have scrolled through and accept the Storage terms.</span>
            </label>

            {!termsScrolledToBottom && (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-600">Scroll to the end of terms to continue.</p>
            )}

            {activationError && <p className="mt-3 text-sm text-red-400">{activationError}</p>}
            {activationMessage && <p className="mt-3 text-sm text-emerald-400">{activationMessage}</p>}

            <button
              type="submit"
              disabled={activationBusy || !termsAccepted || !termsScrolledToBottom}
              className="mt-5 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {activationBusy ? 'Activating...' : 'Activate storage'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium text-foreground">Storage enabled</p>
                <p className="mt-2 text-sm text-muted-foreground md:text-base">Organization: {storage.organizationName}</p>
              </div>
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-emerald-700">
                Live
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground md:text-sm">
                <span>Used storage</span>
                <span>{Math.round((storage.usedBytes / 1024 / 1024) * 10) / 10} MB of 5120 MB</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full border border-border bg-card">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-sm leading-6 text-muted-foreground md:text-base">
                {Math.max(0, storage.remainingBytes)} bytes remaining before the 5GB hard limit blocks new uploads.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={uploadSelectedFile} className="rounded-3xl border border-border bg-background p-6 md:p-7">
              <div className="flex items-center gap-4">
                <Upload className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-base font-medium text-foreground">Upload a file</p>
                  <p className="text-sm leading-6 text-muted-foreground md:text-base">Files are uploaded to S3 and exposed through the CDN URL.</p>
                </div>
              </div>

              <label className="mt-5 block text-sm text-muted-foreground">
                Select file
                <input
                  type="file"
                  required
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-primary-foreground"
                />
              </label>

              {uploadFile && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  <p className="text-foreground">{uploadFile.name}</p>
                  <p className="mt-1 text-base">{formatBytes(uploadFile.size)}</p>
                </div>
              )}

              {storageServiceError && <p className="mt-3 text-sm text-red-400">{storageServiceError}</p>}
              {!storageServiceError && uploadError && <p className="mt-3 text-sm text-red-400">{uploadError}</p>}
              {uploadMessage && <p className="mt-3 text-sm text-emerald-400">{uploadMessage}</p>}

              <button
                type="submit"
                disabled={uploadBusy || !uploadFile || Boolean(storageServiceError)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {uploadBusy ? 'Uploading...' : 'Upload to storage'}
              </button>
            </form>

            <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
              <div className="flex items-center gap-4">
                <HardDrive className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-base font-medium text-foreground">File explorer</p>
                  <p className="text-sm leading-6 text-muted-foreground md:text-base">Search, filter, sort, and manage uploaded files.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={explorerQuery}
                    onChange={(event) => setExplorerQuery(event.target.value)}
                    placeholder="Search files, MIME types, uploader"
                    className="w-full rounded-2xl border border-border bg-card py-3 pl-9 pr-4 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </label>

                <label className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  <ArrowUpDown className="h-4 w-4" />
                  <select
                    value={explorerSort}
                    onChange={(event) => setExplorerSort(event.target.value as ExplorerSort)}
                    className="bg-transparent text-foreground outline-none"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="size-desc">Largest first</option>
                    <option value="size-asc">Smallest first</option>
                  </select>
                </label>

              </div>

              <Tabs value={explorerFilter} onValueChange={(value) => setExplorerFilter(value as ExplorerFilter)} className="mt-4">
                <TabsList className="h-auto w-full flex-wrap gap-2 bg-transparent p-0">
                  {(Object.keys(EXPLORER_TAB_LABELS) as ExplorerFilter[]).map((key) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="h-11 rounded-2xl border border-border bg-card px-4 text-sm data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <span>{EXPLORER_TAB_LABELS[key]}</span>
                      <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground data-[state=active]:bg-primary-foreground/15 data-[state=active]:text-primary-foreground">
                        {explorerTabCounts[key]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>
                  Showing {explorerFiles.length} of {storage.files.length} files
                </span>
                {copyMessage && <span className="text-emerald-600">{copyMessage}</span>}
              </div>

              <div className="mt-5 space-y-4">
                {explorerFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-base text-muted-foreground">
                    {storage.files.length === 0 ? 'No files uploaded yet.' : 'No files match your current explorer filters.'}
                  </div>
                ) : (
                  explorerFiles.map((file) => (
                    <div key={file.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="text-base font-medium text-foreground md:text-lg">{file.fileName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatBytes(file.sizeBytes)} · {file.contentType || 'unknown type'}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Uploaded {formatDate(file.createdAt)} by {file.uploadedByName || file.uploadedByEmail || 'unknown user'}
                          </p>
                          <p className="mt-2 break-all text-xs text-muted-foreground">{file.objectKey}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(file.publicUrl, 'CDN URL copied')}
                            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-4 w-4" />
                            Copy URL
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(file.objectKey, 'Object key copied')}
                            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-4 w-4" />
                            Copy key
                          </button>
                          <a
                            href={file.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => removeFile(file.id)}
                            disabled={deleteBusyId === file.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-700 hover:bg-red-400/20 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deleteBusyId === file.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
            <p className="text-base font-medium text-foreground">Integration details</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
              Use the CDN URL for public delivery. Uploads are blocked once the organization reaches 5GB of stored files.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Current usage: {formatBytes(storage.usedBytes)}</p>
          </div>
        </div>
      )}
    </section>
  )
}
