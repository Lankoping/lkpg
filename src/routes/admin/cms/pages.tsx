import { createFileRoute } from '@tanstack/react-router'
import { getPagesFn } from '../../../server/functions/cms'
import { FileText, Plus, Edit2, Eye, EyeOff } from 'lucide-react'

export const Route = createFileRoute('/admin/cms/pages')({
  loader: async () => {
    try {
      const pages = await getPagesFn()
      return { pages }
    } catch {
      return { pages: [] }
    }
  },
  component: PagesPage,
})

function PagesPage() {
  const { pages } = Route.useLoaderData()

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">CMS</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">Sidor</h1>
            <p className="text-muted-foreground mt-2">Hantera statiska sidor</p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Ny sida
          </button>
        </div>
      </div>

      <div className="bg-card border border-border">
        {pages.length > 0 ? (
          <div className="divide-y divide-border">
            {pages.map((page: any) => (
              <div key={page.id} className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{page.title}</h3>
                    <p className="text-xs text-muted-foreground">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {page.isPublished ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-600">
                      <Eye className="w-3.5 h-3.5" /> Publicerad
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <EyeOff className="w-3.5 h-3.5" /> Utkast
                    </span>
                  )}
                  <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl text-foreground mb-2">Inga sidor</h3>
            <p className="text-sm text-muted-foreground">Lägg till din första sida.</p>
          </div>
        )}
      </div>
    </div>
  )
}
