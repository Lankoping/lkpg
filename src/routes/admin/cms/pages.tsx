import { createFileRoute } from '@tanstack/react-router'
import { getPagesFn } from '../../../server/functions/cms'
import { useState } from 'react'
import { FileText, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pages</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your static pages</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
          <Plus className="w-4 h-4" />
          New Page
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {pages.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {pages.map((page: any) => (
              <div key={page.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">{page.title}</h3>
                    <p className="text-xs text-slate-500">/{page.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {page.isPublished ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Eye className="w-3 h-3" /> Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <EyeOff className="w-3 h-3" /> Draft
                    </span>
                  )}
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No pages yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
