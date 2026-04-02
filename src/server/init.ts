// Server initialization - runs when the server starts
import { purgeExpiredRequestMetadata } from './functions/logs'

let initialized = false
let purgeInterval: ReturnType<typeof setInterval> | null = null

async function runRetentionPurge() {
  try {
    const updated = await purgeExpiredRequestMetadata(7)
    if (updated > 0) {
      console.log(`🧹 Purged request metadata from ${updated} activity log entries (older than 7 days)`)
    }
  } catch (error) {
    console.error('⚠️  Failed to run activity log retention purge', error)
  }
}

export async function initializeServer() {
  if (initialized) {
    console.log('⚠️  Server already initialized, skipping...')
    return
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║          🚀 Lanköping.se Server Starting...              ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  initialized = true

  await runRetentionPurge()

  if (!purgeInterval) {
    purgeInterval = setInterval(() => {
      void runRetentionPurge()
    }, 6 * 60 * 60 * 1000)
  }

  console.log('✅ Server initialization complete\n')
}

// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT === 'true') {
  void initializeServer()
}
