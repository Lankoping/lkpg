import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Copy, ExternalLink, Link2 } from 'lucide-react'
import { getSessionFn } from '../../../server/functions/auth'
import { getMyStoragePerkFn } from '../../../server/functions/storage'
import { StoragePageShell, formatBytes, type StorageState } from '../../../components/storage-page-shell'

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

export const Route = createFileRoute('/hosted/perks/storage/cdn')({
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
  component: StorageCdnPage,
})

function StorageCdnPage() {
  const router = useRouter()
  const { storage, storageLoadError } = Route.useLoaderData()
  const publicUrl = storage.files[0]?.publicUrl || ''

  const copyToClipboard = async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

  if (storageLoadError) {
    return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">Storage failed to load: {storageLoadError}</div>
  }

  return (
    <StoragePageShell storage={storage} activeTab="cdn">
      <div className="rounded-3xl border border-border bg-background p-6 md:p-7 scroll-mt-24">
        <div className="flex items-center gap-4">
          <Link2 className="h-6 w-6 text-primary" />
          <div>
            <p className="text-base font-medium text-foreground">CDN and links</p>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">Use public CDN URLs for delivery and copy them from here.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Public CDN base</p>
          <p className="mt-2 break-all text-sm text-foreground">{publicUrl || 'No uploaded files yet.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!publicUrl} onClick={() => copyToClipboard(publicUrl)} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
              <Copy className="h-4 w-4" /> Copy URL
            </button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-primary hover:text-primary/80">
                <ExternalLink className="h-4 w-4" /> Open
              </a>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Integration details</p>
          <p className="mt-2 leading-6">Use the CDN URL for public delivery. Uploaded files are served through the configured CDN domain.</p>
          <p className="mt-2 leading-6">Current storage used: {formatBytes(storage.usedBytes)} of {formatBytes(storage.limitBytes)}</p>
        </div>
      </div>
    </StoragePageShell>
  )
}
