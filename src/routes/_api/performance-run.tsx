import { createFileRoute } from '@tanstack/react-router'
import { runPerformanceTestManually } from '../../server/functions/cron'

export const Route = createFileRoute('/_api/performance-run')({
  server: {
    handlers: {
      GET: async () => {
        const result = await runPerformanceTestManually()
        
        return Response.json(result, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      },
    },
  },
})
