import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { getSessionFn } from '../../../../server/functions/auth'
import { createStorageUploadReservationFn, getMyStoragePerkFn } from '../../../../server/functions/storage'
import { StoragePageShell, formatBytes, type StorageState } from '../../../../components/storage-page-shell'

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

export const Route = createFileRoute('/hosted/perks/storage/upload')({
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
  component: StorageUploadPage,
})

function StorageUploadPage() {
  const router = useRouter()
  const { storage, storageLoadError } = Route.useLoaderData()
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState('')

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

  const isLikelyHtml404 = (response: Response) => response.status === 404 && (response.headers.get('content-type') || '').toLowerCase().includes('text/html')
  const buildUploadUrlFallback = (uploadUrl: string) => (uploadUrl.startsWith('/api/') ? `/_server${uploadUrl}` : null)

  const uploadSelectedFile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (uploadFiles.length === 0 || !storage.organizationName) return

    setUploadBusy(true)
    setUploadError('')
    setUploadMessage('')

    try {
      let successCount = 0
      const failures: string[] = []

      for (const uploadFile of uploadFiles) {
        const uploadContentType = uploadFile.type || 'application/octet-stream'

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
            const candidateResult = await fetch(uploadTargets[index], {
              method: 'PUT',
              headers: { 'Content-Type': uploadContentType },
              body: uploadFile,
            })

            if (index < uploadTargets.length - 1 && isLikelyHtml404(candidateResult)) {
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

          successCount += 1
        } catch (error: unknown) {
          failures.push(`${uploadFile.name}: ${getErrorMessage(error, 'Upload failed')}`)
        }
      }

      if (successCount > 0) {
        setUploadMessage(`${successCount} file${successCount === 1 ? '' : 's'} uploaded successfully.`)
      }

      if (failures.length > 0) {
        setUploadError(failures.join('\n'))
      }

      if (successCount === uploadFiles.length) {
        setUploadFiles([])
      }

      await router.invalidate()
    } finally {
      setUploadBusy(false)
    }
  }

  if (storageLoadError) {
    return <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">Storage failed to load: {storageLoadError}</div>
  }

  return (
    <StoragePageShell storage={storage} activeTab="upload">
      <div className="rounded-3xl border border-border bg-background p-6 md:p-7 scroll-mt-24">
        <div className="flex items-center gap-4">
          <Upload className="h-6 w-6 text-primary" />
          <div>
            <p className="text-base font-medium text-foreground">Upload a file</p>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">Files are uploaded to S3 and exposed through the CDN URL.</p>
          </div>
        </div>

        <label className="mt-5 block text-sm text-muted-foreground">
          Select files
          <input
            type="file"
            multiple
            required
            onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
            className="mt-2 block w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-primary-foreground"
          />
        </label>

        {uploadFiles.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="text-foreground">{uploadFiles.length} file{uploadFiles.length === 1 ? '' : 's'} selected</p>
            <p className="mt-1 text-base">
              {formatBytes(uploadFiles.reduce((sum, file) => sum + file.size, 0))}
            </p>
            <div className="mt-2 max-h-36 space-y-1 overflow-auto">
              {uploadFiles.map((file) => (
                <p key={`${file.name}-${file.size}-${file.lastModified}`} className="text-xs text-muted-foreground">
                  {file.name} ({formatBytes(file.size)})
                </p>
              ))}
            </div>
          </div>
        )}

        {uploadError && <p className="mt-3 whitespace-pre-wrap text-sm text-red-400">{uploadError}</p>}
        {uploadMessage && <p className="mt-3 text-sm text-emerald-400">{uploadMessage}</p>}

        <button
          type="button"
          onClick={uploadSelectedFile}
          disabled={uploadBusy || uploadFiles.length === 0}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploadBusy ? 'Uploading...' : 'Upload files to storage'}
        </button>
      </div>
    </StoragePageShell>
  )
}
