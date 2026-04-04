import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../server/functions/auth'

export const Route = createFileRoute('/foundary')({
  beforeLoad: async () => {
    const user = await getSessionFn()

    if (!user) {
      throw redirect({ to: '/hosted' })
    }

    if (user.role === 'organizer') {
      throw redirect({ to: '/admin/tickets' })
    }

    throw redirect({ to: '/hosted/tickets' })
  },
  component: () => null,
})
