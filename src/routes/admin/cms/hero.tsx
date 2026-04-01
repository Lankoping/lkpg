import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/hero')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'hero' } })
  },
  component: () => null,
})
