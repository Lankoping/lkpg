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
      <div className="rounded-3xl border border-border bg-background p-6 md:p-7 scroll-mt-24">
        <div className="flex items-center gap-4">
          <FolderOpen className="h-6 w-6 text-primary" />
          <div>
            <p className="text-base font-medium text-foreground">File explorer</p>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">Search, filter, sort, and manage uploaded files.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={explorerQuery} onChange={(event) => setExplorerQuery(event.target.value)} placeholder="Search files, MIME types, uploader" className="w-full rounded-2xl border border-border bg-card py-3 pl-9 pr-4 text-sm text-foreground outline-none focus:border-primary/60" />
          </label>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            <select value={explorerSort} onChange={(event) => setExplorerSort(event.target.value as ExplorerSort)} className="bg-transparent text-foreground outline-none">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="size-desc">Largest first</option>
              <option value="size-asc">Smallest first</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(EXPLORER_TAB_LABELS) as ExplorerFilter[]).map((key) => (
            <button key={key} type="button" onClick={() => setExplorerFilter(key)} className={`rounded-2xl border px-4 py-3 text-sm ${explorerFilter === key ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
              {EXPLORER_TAB_LABELS[key]} ({explorerTabCounts[key]})
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <span>Showing {explorerFiles.length} of {storage.files.length} files</span>
          {copyMessage && <span className="text-emerald-600">{copyMessage}</span>}
        </div>

        {errorMessage && <p className="mt-3 text-sm text-red-400">{errorMessage}</p>}

        <div className="mt-5 space-y-4">
          {explorerFiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-base text-muted-foreground">{storage.files.length === 0 ? 'No files uploaded yet.' : 'No files match your current explorer filters.'}</div>
          ) : (
            explorerFiles.map((file) => (
              <div key={file.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-base font-medium text-foreground md:text-lg">{file.fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.sizeBytes)} · {file.contentType || 'unknown type'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Uploaded {formatDate(file.createdAt)} by {file.uploadedByName || file.uploadedByEmail || 'unknown user'}</p>
                    <p className="mt-2 break-all text-xs text-muted-foreground">{file.objectKey}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <button type="button" onClick={() => copyToClipboard(file.publicUrl, 'CDN URL copied')} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" />Copy URL</button>
                    <button type="button" onClick={() => copyToClipboard(file.objectKey, 'Object key copied')} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" />Copy key</button>
                    <a href={file.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-primary hover:text-primary/80"><ExternalLink className="h-4 w-4" />Open</a>
                    <button type="button" onClick={() => removeFile(file.id)} disabled={deleteBusyId === file.id} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-700 hover:bg-red-400/20 disabled:opacity-50"><Trash2 className="h-4 w-4" />{deleteBusyId === file.id ? 'Deleting...' : 'Delete'}</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </StoragePageShell>
  )
}
