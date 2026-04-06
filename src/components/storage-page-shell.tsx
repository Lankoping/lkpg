import { ChevronLeft } from 'lucide-react'

export type StorageFileRecord = {
  id: number
  fileName: string
  contentType: string | null
  objectKey: string
  sizeBytes: number
  createdAt: Date | string
  uploadedByUserId: number
  uploadedByName?: string | null
  uploadedByEmail?: string | null
  publicUrl: string
}

export type StorageState = {
  organizationName: string | null
  request: {
    status: 'pending' | 'approved' | 'rejected'
    reason: string
    reviewNotes: string | null
    termsAcceptedAt: Date | string | null
  } | null
  fileCount: number
  usedBytes: number
  reservedBytes: number
  remainingBytes: number
  files: StorageFileRecord[]
  limitBytes: number
}

export type StorageTab = 'overview' | 'upload' | 'explorer' | 'cdn' | 'limits'

export const storageTabRoutes: Record<StorageTab, string> = {
  overview: '/hosted/perks',
  upload: '/hosted/perks/upload',
  explorer: '/hosted/perks/explorer',
  cdn: '/hosted/perks/cdn',
  limits: '/hosted/perks/limits',
}

export const storageTabLabels: Record<StorageTab, string> = {
  overview: 'Overview',
  upload: 'Upload file',
  explorer: 'Explorer',
  cdn: 'CDN and links',
  limits: 'Limits',
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  const fixed = value >= 100 || exponent === 0 ? 0 : 1
  return `${value.toFixed(fixed)} ${units[exponent]}`
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Unknown date'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString()
}

export function detectFileCategory(fileName: string, contentType: string | null | undefined) {
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

export function StoragePageShell({
  storage,
  activeTab,
  children,
}: {
  storage: StorageState
  activeTab: StorageTab
  children: React.ReactNode
}) {
  return (
    <section data-active-tab={activeTab} className="space-y-6 rounded-3xl border border-border bg-card p-6 md:p-8">
      <div className="sticky top-4 z-20 rounded-3xl border border-border bg-background/95 p-6 shadow-sm backdrop-blur scroll-mt-24 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Storage</p>
            <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">{storage.organizationName}</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Use the left sidebar to move between overview, upload, explorer, CDN links, and limits.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Account</p>
            <p className="mt-1 text-sm font-medium text-foreground">{storage.organizationName}</p>
          </div>
        </div>
      </div>

      {children}

      <div className="rounded-3xl border border-border bg-background p-6 md:p-7">
        <a href="/hosted/applications" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to hosted
        </a>
      </div>
    </section>
  )
}