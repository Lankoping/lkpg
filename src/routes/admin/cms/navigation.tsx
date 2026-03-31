import { createFileRoute } from '@tanstack/react-router'
import { getNavigationItemsFn } from '../../../server/functions/cms'
import { useState } from 'react'
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Navigation</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your site navigation menu</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {items.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 group">
                <div className="text-slate-300 cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Navigation className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{item.label}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    {item.href}
                    <ExternalLink className="w-3 h-3" />
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Navigation className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No navigation items yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
