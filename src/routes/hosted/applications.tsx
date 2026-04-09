import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../../server/functions/auth'

export const Route = createFileRoute('/hosted/applications')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    throw redirect({ to: '/hosted/tickets', search: { invite: undefined } })
  },
  component: HostedApplicationsRedirectPage,
})

function HostedApplicationsRedirectPage() {
  return null
}
