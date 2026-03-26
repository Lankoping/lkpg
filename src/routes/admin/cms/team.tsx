import { createFileRoute } from '@tanstack/react-router'
import {
  getTeamMembersFn,
  createTeamMemberFn,
  updateTeamMemberFn,
  deleteTeamMemberFn,
} from '../../../server/functions/cms'
import { TeamPageClient } from '../../../components/cms-team-client'

export const Route = createFileRoute('/admin/cms/team')({
  loader: async () => {
    try {
      const members = await getTeamMembersFn()
      return { members }
    } catch {
      return { members: [] }
    }
  },
  component: TeamPage,
})

function TeamPage() {
  const { members } = Route.useLoaderData()
  return <TeamPageClient initialMembers={members} />
}
