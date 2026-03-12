import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/se')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})