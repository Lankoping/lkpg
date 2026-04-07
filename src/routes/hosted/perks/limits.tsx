import { createFileRoute, redirect } from '@tanstack/react-router'
import { Gauge, ShieldAlert } from 'lucide-react'
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

export const Route = createFileRoute('/hosted/perks/limits')({
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
  component: StorageLimitsPage,
})

function StorageLimitsPage() {
  const { storage, storageLoadError } = Route.useLoaderData()

  if (storageLoadError) {
    return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">Storage failed to load: {storageLoadError}</div>
  }

  return (
    <StoragePageShell storage={storage} activeTab="limits">
      <div className="rounded-3xl border border-border bg-background p-6 md:p-7 scroll-mt-24">
        <div className="flex items-center gap-4">
          <Gauge className="h-6 w-6 text-primary" />
          <div>
            <p className="text-base font-medium text-foreground">Limits</p>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">What the storage quota means and what happens when it fills up.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Limit</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatBytes(storage.limitBytes)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Used</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatBytes(storage.usedBytes)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Remaining</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatBytes(storage.remainingBytes)}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-foreground">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4" />
            Storage terms summary
          </div>
          <p className="mt-2 leading-6">Uploads are limited to 5GB per organization. Keep your content legal, authorized, and public-link safe when using the CDN.</p>
        </div>
      </div>
    </StoragePageShell>
  )
}
