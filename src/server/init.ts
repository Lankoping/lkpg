// Server initialization - runs when the server starts

let initialized = false

export function initializeServer() {
  if (initialized) {
    console.log('⚠️  Server already initialized, skipping...')
    return
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║          🚀 Lanköping.se Server Starting...              ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  initialized = true
  console.log('✅ Server initialization complete\n')
}

// Auto-initialize on import in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT === 'true') {
  initializeServer()
}
