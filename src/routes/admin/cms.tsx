import { createFileRoute } from '@tanstack/react-router'
import {
  getHeroContentFn,
  getTeamMembersFn,
  getInfoSectionsFn,
  getNavigationItemsFn,
  getPagesFn,
  getSiteSettingsFn,
} from '../../server/functions/cms'
import { CMSPageClient } from '@/components/cms-page-client'

const AVAILABLE_ICONS = [
  'Crown', 'Code', 'Heart', 'Star', 'Zap', 'Shield', 'Target', 'Trophy', 'Flame', 'Users', 'Gamepad2'
]

const VALID_TABS = ['overview', 'hero', 'team', 'sections', 'navigation', 'pages', 'settings'] as const
type TabId = typeof VALID_TABS[number]

export const Route = createFileRoute('/admin/cms')({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = search.tab as string | undefined
    return {
      tab: (VALID_TABS.includes(tab as TabId) ? tab : 'overview') as TabId,
    }
  },
  loader: async () => {
    try {
      const [heroContent, teamMembers, infoSections, navigationItems, pages, settings] = await Promise.all([
        getHeroContentFn(),
        getTeamMembersFn(),
        getInfoSectionsFn(),
        getNavigationItemsFn(),
        getPagesFn(),
        getSiteSettingsFn(),
      ])
      return { heroContent, teamMembers, infoSections, navigationItems, pages, settings }
    } catch (error) {
      console.error('[v0] Error loading CMS data:', error)
      return { heroContent: null, teamMembers: [], infoSections: [], navigationItems: [], pages: [], settings: {} }
    }
  },
  component: CMSPage,
})

function CMSPage() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  return <CMSPageClient initialData={data} availableIcons={AVAILABLE_ICONS} initialTab={tab} />
}
