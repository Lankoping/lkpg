import { createFileRoute } from '@tanstack/react-router'
import { ApplyApplicationPage } from '../components/apply-application-page'

export const Route = createFileRoute('/apply')({
  component: ApplyApplicationPage,
})
