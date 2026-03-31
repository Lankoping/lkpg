import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/sections')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'sections' } })
  },
  component: () => null,
})
