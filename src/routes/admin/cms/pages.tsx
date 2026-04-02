import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/cms/pages')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/cms', search: { tab: 'pages' } })
  },
  component: () => null,
})
