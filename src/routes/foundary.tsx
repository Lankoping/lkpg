import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/foundary')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
  component: () => null,
})
