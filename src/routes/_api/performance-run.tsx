import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { runPerformanceTestManually } from '../../server/functions/cron'

export const Route = createAPIFileRoute('/_api/performance-run')({
  GET: async ({ request }) => {
    const result = await runPerformanceTestManually()
    
    return json(result, {
      status: result.success ? 200 : 500,
    })
  },
})
