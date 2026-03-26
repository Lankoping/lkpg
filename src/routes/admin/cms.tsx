'use client'

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getHeroContentFn,
  updateHeroContentFn,
  getTeamMembersFn,
  createTeamMemberFn,
  updateTeamMemberFn,
  deleteTeamMemberFn,
  getInfoSectionsFn,
  createInfoSectionFn,
  updateInfoSectionFn,
  deleteInfoSectionFn,
} from '../../server/functions/cms'
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react'

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
  const { heroContent, teamMembers: initialTeamMembers, infoSections: initialInfoSections } = Route.useLoaderData()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('hero')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers)
  const [infoSections, setInfoSections] = useState(initialInfoSections)
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
  const [editingInfoId, setEditingInfoId] = useState<number | null>(null)

  const [heroForm, setHeroForm] = useState({
    eyebrow: heroContent?.eyebrow || '',
    headline: heroContent?.headline || '',
    tagline: heroContent?.tagline || '',
    description: heroContent?.description || '',
    primaryButtonText: heroContent?.primaryButtonText || '',
    primaryButtonLink: heroContent?.primaryButtonLink || '',
    secondaryButtonText: heroContent?.secondaryButtonText || '',
    secondaryButtonLink: heroContent?.secondaryButtonLink || '',
  })

  const [teamForm, setTeamForm] = useState({
    name: '',
    role: '',
    description: '',
    icon: 'Crown',
    sortOrder: 0,
  })

  const [infoForm, setInfoForm] = useState({
    slug: '',
    icon: 'Star',
    title: '',
    description: '',
    sortOrder: 0,
  })

  // HERO SECTION
  const handleHeroSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      await updateHeroContentFn({ data: heroForm })
      setMessage('Hero content updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // TEAM SECTION
  const handleTeamSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (editingTeamId) {
        await updateTeamMemberFn({ data: { id: editingTeamId, ...teamForm, isActive: true } })
        setTeamMembers(prev => prev.map(m => m.id === editingTeamId ? { ...m, ...teamForm } : m))
        setMessage('Team member updated!')
      } else {
        const created = await createTeamMemberFn({ data: teamForm })
        setTeamMembers(prev => [...prev, created])
        setMessage('Team member created!')
      }
      setTeamForm({ name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
      setEditingTeamId(null)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTeamDelete = async (id: number) => {
    if (!confirm('Delete this team member?')) return
    
    try {
      await deleteTeamMemberFn({ data: id })
      setTeamMembers(prev => prev.filter(m => m.id !== id))
      setMessage('Team member deleted!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleTeamEdit = (member: typeof teamMembers[0]) => {
    setTeamForm({
      name: member.name,
      role: member.role,
      description: member.description,
      icon: member.icon,
      sortOrder: member.sortOrder,
    })
    setEditingTeamId(member.id)
  }

  // INFO SECTIONS
  const handleInfoSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (editingInfoId) {
        await updateInfoSectionFn({ data: { id: editingInfoId, ...infoForm, isActive: true } })
        setInfoSections(prev => prev.map(s => s.id === editingInfoId ? { ...s, ...infoForm } : s))
        setMessage('Info section updated!')
      } else {
        const created = await createInfoSectionFn({ data: infoForm })
        setInfoSections(prev => [...prev, created])
        setMessage('Info section created!')
      }
      setInfoForm({ slug: '', icon: 'Star', title: '', description: '', sortOrder: 0 })
      setEditingInfoId(null)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInfoDelete = async (id: number) => {
    if (!confirm('Delete this info section?')) return
    
    try {
      await deleteInfoSectionFn({ data: id })
      setInfoSections(prev => prev.filter(s => s.id !== id))
      setMessage('Info section deleted!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleInfoEdit = (section: typeof infoSections[0]) => {
    setInfoForm({
      slug: section.slug,
      icon: section.icon,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
    })
    setEditingInfoId(section.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-3xl tracking-wide text-foreground mb-2">Content Management System</h2>
        <p className="text-muted-foreground">Manage all your site content in one place</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'hero', label: 'Hero Section' },
            { id: 'info', label: 'Info Sections' },
            { id: 'team', label: 'Team Members' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded border ${message.includes('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message}
        </div>
      )}

      {/* HERO SECTION */}
      {activeTab === 'hero' && (
        <div className="bg-card border border-border rounded p-6 space-y-6">
          <div>
            <h3 className="font-display text-2xl text-foreground mb-4">Hero Section</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Manage the main hero banner that appears on your homepage
            </p>
          </div>

          <form onSubmit={handleHeroSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Eyebrow (Swedish)</label>
              <input
                type="text"
                value={heroForm.eyebrow}
                onChange={(e) => setHeroForm(prev => ({ ...prev, eyebrow: e.target.value }))}
                placeholder="e.g., LAN-Event i Norrköping"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-translated to English</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Headline (Swedish)</label>
              <input
                type="text"
                value={heroForm.headline}
                onChange={(e) => setHeroForm(prev => ({ ...prev, headline: e.target.value }))}
                placeholder="e.g., Lanköping"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tagline (Swedish)</label>
              <input
                type="text"
                value={heroForm.tagline}
                onChange={(e) => setHeroForm(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g., Gaming Community"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description (Swedish)</label>
              <textarea
                value={heroForm.description}
                onChange={(e) => setHeroForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Main description text..."
                rows={4}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-vertical"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Primary Button Text</label>
                <input
                  type="text"
                  value={heroForm.primaryButtonText}
                  onChange={(e) => setHeroForm(prev => ({ ...prev, primaryButtonText: e.target.value }))}
                  placeholder="e.g., Join Discord"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Primary Button Link</label>
                <input
                  type="text"
                  value={heroForm.primaryButtonLink}
                  onChange={(e) => setHeroForm(prev => ({ ...prev, primaryButtonLink: e.target.value }))}
                  placeholder="https://discord.gg/..."
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Secondary Button Text (Optional)</label>
                <input
                  type="text"
                  value={heroForm.secondaryButtonText}
                  onChange={(e) => setHeroForm(prev => ({ ...prev, secondaryButtonText: e.target.value }))}
                  placeholder="e.g., Watch Videos"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Secondary Button Link</label>
                <input
                  type="text"
                  value={heroForm.secondaryButtonLink}
                  onChange={(e) => setHeroForm(prev => ({ ...prev, secondaryButtonLink: e.target.value }))}
                  placeholder="https://youtube.com/..."
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Hero Content
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INFO SECTIONS */}
      {activeTab === 'info' && (
        <div className="bg-card border border-border rounded p-6 space-y-6">
          <div>
            <h3 className="font-display text-2xl text-foreground mb-4">Info Sections</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The 3 feature boxes that appear below the hero banner (Location, Community, LAN Party)
            </p>
          </div>

          <form onSubmit={handleInfoSave} className="space-y-4 bg-background border border-border rounded p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Slug</label>
                <input
                  type="text"
                  value={infoForm.slug}
                  onChange={(e) => setInfoForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="e.g., location"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
                <select
                  value={infoForm.icon}
                  onChange={(e) => setInfoForm(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
                >
                  {AVAILABLE_ICONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Title (Swedish)</label>
              <input
                type="text"
                value={infoForm.title}
                onChange={(e) => setInfoForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Location"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description (Swedish)</label>
              <textarea
                value={infoForm.description}
                onChange={(e) => setInfoForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Section description..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-vertical"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Sort Order</label>
              <input
                type="number"
                value={infoForm.sortOrder}
                onChange={(e) => setInfoForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingInfoId ? 'Update' : 'Add'} Section
              </button>
              {editingInfoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingInfoId(null)
                    setInfoForm({ slug: '', icon: 'Star', title: '', description: '', sortOrder: 0 })
                  }}
                  className="px-4 py-2 border border-border text-foreground font-medium text-sm rounded hover:bg-background transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {infoSections.map((section) => (
              <div key={section.id} className="flex items-center justify-between p-3 bg-background border border-border rounded">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{section.title}</p>
                  <p className="text-xs text-muted-foreground">{section.description.substring(0, 60)}...</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInfoEdit(section)}
                    className="p-2 hover:bg-secondary rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={() => handleInfoDelete(section.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TEAM MEMBERS */}
      {activeTab === 'team' && (
        <div className="bg-card border border-border rounded p-6 space-y-6">
          <div>
            <h3 className="font-display text-2xl text-foreground mb-4">Team Members</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Manage the team members displayed on the team page
            </p>
          </div>

          <form onSubmit={handleTeamSave} className="space-y-4 bg-background border border-border rounded p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Nauticalis"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
                <select
                  value={teamForm.icon}
                  onChange={(e) => setTeamForm(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
                >
                  {AVAILABLE_ICONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Role (Swedish)</label>
              <input
                type="text"
                value={teamForm.role}
                onChange={(e) => setTeamForm(prev => ({ ...prev, role: e.target.value }))}
                placeholder="e.g., Organisator"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description (Swedish)</label>
              <textarea
                value={teamForm.description}
                onChange={(e) => setTeamForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Team member description..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors resize-vertical"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Sort Order</label>
              <input
                type="number"
                value={teamForm.sortOrder}
                onChange={(e) => setTeamForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingTeamId ? 'Update' : 'Add'} Member
              </button>
              {editingTeamId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeamId(null)
                    setTeamForm({ name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
                  }}
                  className="px-4 py-2 border border-border text-foreground font-medium text-sm rounded hover:bg-background transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-background border border-border rounded">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTeamEdit(member)}
                    className="p-2 hover:bg-secondary rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={() => handleTeamDelete(member.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
