import { createFileRoute } from '@tanstack/react-router'
import { getNavigationItemsFn } from '../../../server/functions/cms'
import { Navigation, Plus, Edit2, Trash2, GripVertical, ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/admin/cms/navigation')({
  loader: async () => {
    try {
      const items = await getNavigationItemsFn()
      return { items }
    } catch {
      return { items: [] }
    }
  },
  component: NavigationPage,
})

function NavigationPage() {
  const { items } = Route.useLoaderData()

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">CMS</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">Navigation</h1>
            <p className="text-muted-foreground mt-2">Hantera webbplatsens meny</p>
          </div>
          <button type="button" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Nytt menyval
          </button>
        </div>
      </div>

      <div className="bg-card border border-border">
        {items.length > 0 ? (
          <div className="divide-y divide-border">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors group">
                <div className="text-muted-foreground cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="p-2 bg-primary/10">
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">{item.label}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {item.href}
                    <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
              <Navigation className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl text-foreground mb-2">Inga menyval</h3>
            <p className="text-sm text-muted-foreground">Lägg till ditt första menyval.</p>
          </div>
        )}
      </div>
    </div>
  )
}
