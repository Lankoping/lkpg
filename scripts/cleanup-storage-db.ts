import 'dotenv/config'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { inArray } from 'drizzle-orm'
import { getDb } from '../src/server/db/runtime'
import { storageFiles } from '../src/server/db/schema'
import { formatStorageError, getStorageClient, getStorageConfig, isStorageMissingObjectError, logStorageError } from '../src/server/lib/s3-compatible'

type StorageRow = {
  id: number
  objectKey: string
}

async function withConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1

      if (index >= items.length) {
        return
      }

      results[index] = await worker(items[index])
    }
  })

  await Promise.all(runners)
  return results
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const dbOnly = process.argv.includes('--db-only')
  const force = process.argv.includes('--force')
  const config = getStorageConfig()
  const db = await getDb()

  if (dbOnly) {
    const rows = await db
      .select({ id: storageFiles.id })
      .from(storageFiles)

    const total = rows.length
    console.log(`[run:clean] DB-only mode: ${total} rows in storage_files.`)

    if (total === 0) {
      console.log('[run:clean] Nothing to delete.')
      return
    }

    if (dryRun) {
      console.log('[run:clean] Dry run enabled; no rows were deleted.')
      return
    }

    if (!force) {
      throw new Error('DB-only deletion is destructive. Re-run with --db-only --force to confirm.')
    }

    await db.delete(storageFiles)
    console.log(`[run:clean] Deleted ${total} rows from storage_files (DB-only mode).`)
    return
  }

  const s3 = getStorageClient(config)
  const rows = await db
    .select({ id: storageFiles.id, objectKey: storageFiles.objectKey })
    .from(storageFiles)

  if (rows.length === 0) {
    console.log('[run:clean] No rows in storage_files. Nothing to clean.')
    return
  }

  console.log(`[run:clean] Scanning ${rows.length} DB rows against bucket ${config.bucket}...`)

  let checked = 0
  const staleIds: number[] = []

  await withConcurrency<StorageRow, void>(rows as StorageRow[], 10, async (row) => {
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: row.objectKey,
        }),
      )
    } catch (error) {
      if (isStorageMissingObjectError(error)) {
        staleIds.push(row.id)
        return
      }

      logStorageError('cleanup-storage-db HeadObject', error, {
        objectKey: row.objectKey,
        bucket: config.bucket,
      })

      const status = (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode
      if (status === 403) {
        throw new Error(
          `Access denied when checking object ${row.objectKey}: ${formatStorageError(error)}. ` +
            `Required permission: s3:HeadObject on ${config.bucket}/*. ` +
            `For Datalix/S3-compatible endpoints verify S3_ENDPOINT and S3_FORCE_PATH_STYLE=true.`
        )
      }

      throw new Error(`Failed checking object ${row.objectKey}: ${formatStorageError(error)}`)
    } finally {
      checked += 1
      if (checked % 100 === 0 || checked === rows.length) {
        console.log(`[run:clean] Checked ${checked}/${rows.length}`)
      }
    }
  })

  if (staleIds.length === 0) {
    console.log('[run:clean] No stale DB rows found. Nothing to delete.')
    return
  }

  console.log(`[run:clean] Found ${staleIds.length} stale DB rows.`)

  if (dryRun) {
    console.log('[run:clean] Dry run enabled; no rows were deleted.')
    return
  }

  const chunkSize = 500
  for (let i = 0; i < staleIds.length; i += chunkSize) {
    const chunk = staleIds.slice(i, i + chunkSize)
    await db.delete(storageFiles).where(inArray(storageFiles.id, chunk))
  }

  console.log(`[run:clean] Deleted ${staleIds.length} stale DB rows from storage_files.`)
}

main().catch((error) => {
  console.error('[run:clean] Failed:', error instanceof Error ? error.message : error)
  console.error('[run:clean] Tip: use --db-only --dry-run (or --db-only --force) if S3 permissions are unavailable.')
  process.exitCode = 1
})
