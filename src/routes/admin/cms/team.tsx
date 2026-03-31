import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/team')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'team' } })
  },
  component: () => null,
})
