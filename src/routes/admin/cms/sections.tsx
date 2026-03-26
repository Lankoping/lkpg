'use client'

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getInfoSectionsFn,
  createInfoSectionFn,
  updateInfoSectionFn,
  deleteInfoSectionFn,
} from '../../server/functions/cms'
import { Loader2, Trash2, Edit2, Plus } from 'lucide-react'

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

interface InfoSection {
  id: number
  slug: string
  icon: string
  title: string
  titleEn?: string
  description: string
  descriptionEn?: string
  sortOrder: number
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

const ICON_NAMES = [
  'MapPin',
  'Users',
  'Cpu',
  'Zap',
  'Trophy',
  'Heart',
  'Star',
  'Rocket',
  'Wifi',
  'Code',
  'Crown',
  'Shield',
]

function InfoSectionsPage() {
  const { sections: initialSections } = Route.useLoaderData()
  const router = useRouter()
  const [sections, setSections] = useState<InfoSection[]>(initialSections)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    slug: '',
    icon: 'Star',
    title: '',
    description: '',
    sortOrder: 0,
  })

  const resetForm = () => {
    setFormData({
      slug: '',
      icon: 'Star',
      title: '',
      description: '',
      sortOrder: 0,
    })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (section: InfoSection) => {
    setFormData({
      slug: section.slug,
      icon: section.icon,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
    })
    setEditingId(section.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (editingId) {
        const updated = await updateInfoSectionFn({
          data: {
            id: editingId,
            icon: formData.icon,
            title: formData.title,
            description: formData.description,
            sortOrder: formData.sortOrder,
            isActive: true,
          },
        })
        setSections(sections.map(s => (s.id === editingId ? updated : s)))
        setMessage('Section updated successfully!')
      } else {
        const created = await createInfoSectionFn({
          data: {
            slug: formData.slug,
            icon: formData.icon,
            title: formData.title,
            description: formData.description,
            sortOrder: formData.sortOrder,
          },
        })
        setSections([...sections, created])
        setMessage('Section created successfully!')
      }
      setTimeout(() => {
        resetForm()
        setMessage('')
      }, 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return

    setLoading(true)
    try {
      await deleteInfoSectionFn({ data: id })
      setSections(sections.filter(s => s.id !== id))
      setMessage('Section deleted successfully!')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-foreground mb-2">Info Sections</h2>
          <p className="text-muted-foreground">Manage homepage info sections</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Section
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded border ${message.includes('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded p-6 space-y-4">
          <h3 className="font-display text-xl text-foreground">{editingId ? 'Edit' : 'Create'} Section</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  disabled={!!editingId}
                  placeholder="section-slug"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                >
                  {ICON_NAMES.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Section title"
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Section description"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm resize-vertical"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-border rounded hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {sections.map(section => (
          <div key={section.id} className="bg-card border border-border rounded p-4 flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1">{section.title}</h3>
              <p className="text-sm text-muted-foreground mb-2">{section.description}</p>
              <div className="text-xs text-muted-foreground">
                Icon: {section.icon} · Sort: {section.sortOrder}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(section)}
                className="p-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(section.id)}
                disabled={loading}
                className="p-2 text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {sections.length === 0 && !showForm && (
          <div className="bg-card border border-dashed border-border rounded p-8 text-center text-muted-foreground">
            No sections yet. Create your first one!
          </div>
        )}
      </div>
    </div>
  )
}
