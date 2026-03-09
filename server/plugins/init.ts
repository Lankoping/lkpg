// Nitro plugin for server initialization
// This runs when the Nitro server starts

import { initializeServer } from '../server/init'

export default defineNitroPlugin(() => {
  console.log('🔌 Nitro plugin: Initializing server...')
  initializeServer()
})
