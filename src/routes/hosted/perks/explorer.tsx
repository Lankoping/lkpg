import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowUpDown, Copy, ExternalLink, FolderOpen, Search, Trash2 } from 'lucide-react'
import { getSessionFn } from '../../../server/functions/auth'
import { deleteStorageFileFn, getMyStoragePerkFn } from '../../../server/functions/storage'
import {
  StoragePageShell,
  detectFileCategory,
  formatBytes,
  formatDate,
  storageTabRoutes,
  type StorageState,
} from '../../../components/storage-page-shell'

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const Route = createFileRoute('/hosted/perks/explorer')({
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
      return { storage: EMPTY_STORAGE_STATE, storageLoadError: getErrorMessage(error, 'Could not load storage data') }
    }
  },
  component: StorageExplorerPage,
})

function StorageExplorerPage() {
  const router = useRouter()
  const { storage, storageLoadError } = Route.useLoaderData()
  const [explorerQuery, setExplorerQuery] = useState('')
  const [explorerSort, setExplorerSort] = useState<ExplorerSort>('newest')
  const [explorerFilter, setExplorerFilter] = useState<ExplorerFilter>('all')
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const explorerFiles = useMemo(() => {
    const normalizedQuery = explorerQuery.trim().toLowerCase()
    const filtered = storage.files.filter((file) => {
      const category = detectFileCategory(file.fileName, file.contentType)
      if (explorerFilter !== 'all' && category !== explorerFilter) return false
      if (!normalizedQuery) return true
      return [file.fileName, file.contentType || '', file.uploadedByName || '', file.uploadedByEmail || '']
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })

    filtered.sort((a, b) => {
      switch (explorerSort) {
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'name-asc': return a.fileName.localeCompare(b.fileName)
        case 'name-desc': return b.fileName.localeCompare(a.fileName)
        case 'size-asc': return a.sizeBytes - b.sizeBytes
        case 'size-desc': return b.sizeBytes - a.sizeBytes
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return filtered
  }, [explorerFilter, explorerQuery, explorerSort, storage.files])

  const explorerTabCounts = useMemo(() => {
    const counts: Record<ExplorerFilter, number> = { all: storage.files.length, image: 0, video: 0, audio: 0, document: 0, archive: 0, code: 0, other: 0 }
    for (const file of storage.files) counts[detectFileCategory(file.fileName, file.contentType)] += 1
    return counts
  }, [storage.files])

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage(successMessage)
      window.setTimeout(() => setCopyMessage(''), 1800)
    } catch {
      setErrorMessage('Could not copy to clipboard')
    }
  }

  const removeFile = async (fileId: number) => {
    setDeleteBusyId(fileId)
    setErrorMessage('')
    try {
      await deleteStorageFileFn({ data: { fileId } })
      await router.invalidate()
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Could not delete file'))
    } finally {
      setDeleteBusyId(null)
    }
  }

  if (storageLoadError) {
    return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">Storage failed to load: {storageLoadError}</div>
  }

  return (
    <StoragePageShell storage={storage} activeTab="explorer">
      <div className="rounded-3xl border border-border bg-background/90 p-6 shadow-sm backdrop-blur md:p-7 scroll-mt-24">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary">File explorer</p>
              <h3 className="mt-1 font-display text-2xl text-foreground md:text-3xl">Browse and manage uploaded files</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">Search, filter, sort, and inspect files in one wider workspace.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left sm:min-w-[20rem]">
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Files</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{storage.files.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Used</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatBytes(storage.usedBytes)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Free</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatBytes(storage.remainingBytes)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={explorerQuery} onChange={(event) => setExplorerQuery(event.target.value)} placeholder="Search files, MIME types, uploader" className="w-full rounded-2xl border border-border bg-card py-3 pl-9 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:bg-background" />
              </label>

              <label className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" />
                <select value={explorerSort} onChange={(event) => setExplorerSort(event.target.value as ExplorerSort)} className="w-full bg-transparent text-foreground outline-none">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="size-desc">Largest first</option>
                  <option value="size-asc">Smallest first</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(EXPLORER_TAB_LABELS) as ExplorerFilter[]).map((key) => (
                <button key={key} type="button" onClick={() => setExplorerFilter(key)} className={`rounded-2xl border px-4 py-2.5 text-sm transition-colors ${explorerFilter === key ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground'}`}>
                  {EXPLORER_TAB_LABELS[key]} ({explorerTabCounts[key]})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>Showing {explorerFiles.length} of {storage.files.length} files</span>
              {copyMessage && <span className="text-emerald-600">{copyMessage}</span>}
            </div>

            {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

            <div className="space-y-4">
              {explorerFiles.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card/50 px-4 py-14 text-center text-base text-muted-foreground">{storage.files.length === 0 ? 'No files uploaded yet.' : 'No files match your current explorer filters.'}</div>
              ) : (
                explorerFiles.map((file) => (
                  <div key={file.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="min-w-0 break-words text-base font-medium text-foreground md:text-lg">{file.fileName}</p>
                          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{detectFileCategory(file.fileName, file.contentType)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{formatBytes(file.sizeBytes)} · {file.contentType || 'unknown type'}</p>
                        <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Uploaded</p>
                            <p className="mt-1 text-foreground">{formatDate(file.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Uploaded by</p>
                            <p className="mt-1 break-words text-foreground">{file.uploadedByName || file.uploadedByEmail || 'unknown user'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Object key</p>
                            <p className="mt-1 break-all text-foreground">{file.objectKey}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <button type="button" onClick={() => copyToClipboard(file.publicUrl, 'CDN URL copied')} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"><Copy className="h-4 w-4" />Copy URL</button>
                        <button type="button" onClick={() => copyToClipboard(file.objectKey, 'Object key copied')} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"><Copy className="h-4 w-4" />Copy key</button>
                        <a href={file.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-primary transition-colors hover:border-primary/30 hover:text-primary/80"><ExternalLink className="h-4 w-4" />Open</a>
                        <button type="button" onClick={() => removeFile(file.id)} disabled={deleteBusyId === file.id} className="inline-flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-400/20 disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleteBusyId === file.id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Workspace summary</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                  <span className="text-muted-foreground">All files</span>
                  <span className="font-medium text-foreground">{explorerTabCounts.all}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                  <span className="text-muted-foreground">Images</span>
                  <span className="font-medium text-foreground">{explorerTabCounts.image}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium text-foreground">{explorerTabCounts.document}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                  <span className="text-muted-foreground">Archives</span>
                  <span className="font-medium text-foreground">{explorerTabCounts.archive}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Quick actions</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the wider layout to move between upload, explorer, CDN links, and limits without leaving storage.</p>
              <div className="mt-4 flex flex-col gap-2">
                <a href={storageTabRoutes.upload} className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Upload file</a>
                <a href={storageTabRoutes.cdn} className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30">CDN and links</a>
                <a href={storageTabRoutes.limits} className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30">View limits</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </StoragePageShell>
  )
}
