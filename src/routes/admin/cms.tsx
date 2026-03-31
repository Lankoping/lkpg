import { createFileRoute } from '@tanstack/react-router'
import {
  getHeroContentFn,
  getTeamMembersFn,
  getInfoSectionsFn,
} from '../../server/functions/cms'
import { CMSPageClient } from '@/components/cms-page-client'

const AVAILABLE_ICONS = [
  'Crown', 'Code', 'Heart', 'Star', 'Zap', 'Shield', 'Target', 'Trophy', 'Flame', 'Users', 'Gamepad2'
]

export const Route = createFileRoute('/admin/cms')({
  loader: async () => {
    try {
      const [heroContent, teamMembers, infoSections] = await Promise.all([
        getHeroContentFn(),
        getTeamMembersFn(),
        getInfoSectionsFn(),
      ])
      return { heroContent, teamMembers, infoSections }
    } catch (error) {
      console.error('[v0] Error loading CMS data:', error)
      return { heroContent: null, teamMembers: [], infoSections: [] }
    }
  },
  component: CMSPage,
})

function CMSPage() {
  const data = Route.useLoaderData()
  return <CMSPageClient initialData={data} availableIcons={AVAILABLE_ICONS} />
}
