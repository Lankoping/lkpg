import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/navigation')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'navigation' } })
  },
  component: () => null,
})

