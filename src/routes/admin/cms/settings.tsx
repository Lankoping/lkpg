import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/settings')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'settings' } })
  },
  component: () => null,
})
