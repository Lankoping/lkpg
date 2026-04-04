import { createFileRoute } from '@tanstack/react-router'
import { HomeApplicationPage } from '../components/home-application-page'

export const Route = createFileRoute('/')({
  component: HomeApplicationPage,
})
