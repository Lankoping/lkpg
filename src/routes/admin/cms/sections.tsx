import { createFileRoute } from '@tanstack/react-router'
import {
  getInfoSectionsFn,
  createInfoSectionFn,
  updateInfoSectionFn,
  deleteInfoSectionFn,
} from '../../../server/functions/cms'
import { InfoSectionsPageClient } from '../../../components/cms-sections-client'

export const Route = createFileRoute('/admin/cms/sections')({
  loader: async () => {
    try {
      const sections = await getInfoSectionsFn()
      return { sections }
    } catch {
      return { sections: [] }
    }
  },
  component: InfoSectionsPage,
})

function InfoSectionsPage() {
  const { sections } = Route.useLoaderData()
  return <InfoSectionsPageClient initialSections={sections} />
}
