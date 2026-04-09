import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../../server/functions/auth'

export const Route = createFileRoute('/admin/applications')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/foundary' })
    }

    throw redirect({ to: '/admin/tickets' })
  },
  component: AdminApplicationsRedirectPage,
})

function AdminApplicationsRedirectPage() {
  return null
}
