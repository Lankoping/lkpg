// Server initialization - runs when the server starts
import { startPerformanceCron } from './functions/cron.js'

let initialized = false

export function initializeServer() {
  if (initialized) {
    console.log('⚠️  Server already initialized, skipping...')
    return
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║          🚀 Lankoping.se Server Starting...              ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Start performance testing cron job
  if (process.env.LT_USERNAME && process.env.LT_ACCESS_KEY) {
    startPerformanceCron()
  } else {
    console.log('⚠️  LambdaTest credentials not found - cron job disabled')
    console.log('   Add LT_USERNAME and LT_ACCESS_KEY to .env to enable\n')
  }

  initialized = true
  console.log('✅ Server initialization complete\n')
}

// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT === 'true') {
  initializeServer()
}
