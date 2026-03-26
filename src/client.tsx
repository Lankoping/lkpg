import { StartClient } from '@tanstack/start'
import { createRoot } from 'react-dom/client'

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = createRoot(rootElement)
  root.render(<StartClient />)
}
