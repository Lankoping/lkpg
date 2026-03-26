'use client'

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  updateHeroContentFn,
  createTeamMemberFn,
  updateTeamMemberFn,
  deleteTeamMemberFn,
  createInfoSectionFn,
  updateInfoSectionFn,
  deleteInfoSectionFn,
} from '@/server/functions/cms'
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react'

interface CMSPageClientProps {
  initialData: {
    heroContent: any
    teamMembers: any[]
    infoSections: any[]
  }
  availableIcons: string[]
}

export function CMSPageClient({ initialData, availableIcons }: CMSPageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('hero')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const [teamMembers, setTeamMembers] = useState(initialData.teamMembers || [])
  const [infoSections, setInfoSections] = useState(initialData.infoSections || [])

  // Hero Form State
  const [heroForm, setHeroForm] = useState(initialData.heroContent || {
    eyebrow: '',
    headline: '',
    tagline: '',
    description: '',
    primaryButtonText: '',
    primaryButtonLink: '',
    secondaryButtonText: '',
    secondaryButtonLink: '',
  })

  // Team Member Form State
  const [teamForm, setTeamForm] = useState({
    id: null as number | null,
    name: '',
    role: '',
    description: '',
    icon: 'Crown',
    sortOrder: 0,
  })

  // Info Section Form State
  const [infoForm, setInfoForm] = useState({
    id: null as number | null,
    slug: '',
    icon: 'Crown',
    title: '',
    description: '',
    sortOrder: 0,
  })

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  // Hero Content Handlers
  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateHeroContentFn(heroForm)
      showMessage('Hero content updated successfully!')
    } catch (error) {
      showMessage('Failed to update hero content', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Team Member Handlers
  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamForm.name || !teamForm.role) {
      showMessage('Name and role are required', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await createTeamMemberFn({
        name: teamForm.name,
        role: teamForm.role,
        description: teamForm.description,
        icon: teamForm.icon,
        sortOrder: teamForm.sortOrder,
      })
      setTeamMembers([...teamMembers, result])
      setTeamForm({ id: null, name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
      showMessage('Team member added successfully!')
    } catch (error) {
      showMessage('Failed to add team member', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamForm.id || !teamForm.name || !teamForm.role) {
      showMessage('Name and role are required', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await updateTeamMemberFn({
        id: teamForm.id,
        name: teamForm.name,
        role: teamForm.role,
        description: teamForm.description,
        icon: teamForm.icon,
        sortOrder: teamForm.sortOrder,
        isActive: true,
      })
      setTeamMembers(teamMembers.map((t) => (t.id === teamForm.id ? result : t)))
      setTeamForm({ id: null, name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
      showMessage('Team member updated successfully!')
    } catch (error) {
      showMessage('Failed to update team member', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeamMember = async (id: number) => {
    if (!confirm('Are you sure?')) return
    setLoading(true)
    try {
      await deleteTeamMemberFn(id)
      setTeamMembers(teamMembers.filter((t) => t.id !== id))
      showMessage('Team member deleted successfully!')
    } catch (error) {
      showMessage('Failed to delete team member', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Info Section Handlers
  const handleAddInfoSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infoForm.slug || !infoForm.title) {
      showMessage('Slug and title are required', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await createInfoSectionFn({
        slug: infoForm.slug,
        icon: infoForm.icon,
        title: infoForm.title,
        description: infoForm.description,
        sortOrder: infoForm.sortOrder,
      })
      setInfoSections([...infoSections, result])
      setInfoForm({ id: null, slug: '', icon: 'Crown', title: '', description: '', sortOrder: 0 })
      showMessage('Info section added successfully!')
    } catch (error) {
      showMessage('Failed to add info section', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateInfoSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infoForm.id || !infoForm.slug || !infoForm.title) {
      showMessage('Slug and title are required', 'error')
      return
    }

    setLoading(true)
    try {
      const result = await updateInfoSectionFn({
        id: infoForm.id,
        slug: infoForm.slug,
        icon: infoForm.icon,
        title: infoForm.title,
        description: infoForm.description,
        sortOrder: infoForm.sortOrder,
        isActive: true,
      })
      setInfoSections(infoSections.map((i) => (i.id === infoForm.id ? result : i)))
      setInfoForm({ id: null, slug: '', icon: 'Crown', title: '', description: '', sortOrder: 0 })
      showMessage('Info section updated successfully!')
    } catch (error) {
      showMessage('Failed to update info section', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInfoSection = async (id: number) => {
    if (!confirm('Are you sure?')) return
    setLoading(true)
    try {
      await deleteInfoSectionFn(id)
      setInfoSections(infoSections.filter((i) => i.id !== id))
      showMessage('Info section deleted successfully!')
    } catch (error) {
      showMessage('Failed to delete info section', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">CMS Management</h1>
        <p className="text-muted-foreground">Manage all site content</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded border ${
            messageType === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border">
        {['hero', 'team', 'info'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'hero' ? 'Hero Section' : tab === 'team' ? 'Team Members' : 'Info Sections'}
          </button>
        ))}
      </div>

      {/* Hero Content Tab */}
      {activeTab === 'hero' && (
        <form onSubmit={handleHeroSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Eyebrow</label>
              <input
                type="text"
                value={heroForm.eyebrow}
                onChange={(e) => setHeroForm({ ...heroForm, eyebrow: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Headline</label>
              <input
                type="text"
                value={heroForm.headline}
                onChange={(e) => setHeroForm({ ...heroForm, headline: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tagline</label>
              <input
                type="text"
                value={heroForm.tagline}
                onChange={(e) => setHeroForm({ ...heroForm, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={heroForm.description}
              onChange={(e) => setHeroForm({ ...heroForm, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Button Text</label>
              <input
                type="text"
                value={heroForm.primaryButtonText}
                onChange={(e) => setHeroForm({ ...heroForm, primaryButtonText: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Button Link</label>
              <input
                type="text"
                value={heroForm.primaryButtonLink}
                onChange={(e) => setHeroForm({ ...heroForm, primaryButtonLink: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Button Text</label>
              <input
                type="text"
                value={heroForm.secondaryButtonText}
                onChange={(e) => setHeroForm({ ...heroForm, secondaryButtonText: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Button Link</label>
              <input
                type="text"
                value={heroForm.secondaryButtonLink}
                onChange={(e) => setHeroForm({ ...heroForm, secondaryButtonLink: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Hero Content
          </button>
        </form>
      )}

      {/* Team Members Tab */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-3 gap-8">
          <form onSubmit={teamForm.id ? handleUpdateTeamMember : handleAddTeamMember} className="col-span-1 space-y-4 bg-card p-6 border border-border rounded">
            <h3 className="font-semibold">{teamForm.id ? 'Edit Team Member' : 'Add Team Member'}</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={teamForm.name}
                onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <input
                type="text"
                value={teamForm.role}
                onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={teamForm.description}
                onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <select
                value={teamForm.icon}
                onChange={(e) => setTeamForm({ ...teamForm, icon: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              >
                {availableIcons.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <input
                type="number"
                value={teamForm.sortOrder}
                onChange={(e) => setTeamForm({ ...teamForm, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {teamForm.id ? 'Update' : 'Add'}
              </button>
              {teamForm.id && (
                <button
                  type="button"
                  onClick={() => setTeamForm({ id: null, name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })}
                  className="px-4 py-2 border border-border rounded hover:bg-secondary text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="col-span-2 space-y-3">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border border-border rounded bg-card">
                <div className="flex-1">
                  <h4 className="font-semibold">{member.name}</h4>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setTeamForm({
                        id: member.id,
                        name: member.name,
                        role: member.role,
                        description: member.description,
                        icon: member.icon,
                        sortOrder: member.sortOrder,
                      })
                    }
                    className="p-2 hover:bg-secondary rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeamMember(member.id)}
                    className="p-2 hover:bg-red-100 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Sections Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-3 gap-8">
          <form onSubmit={infoForm.id ? handleUpdateInfoSection : handleAddInfoSection} className="col-span-1 space-y-4 bg-card p-6 border border-border rounded">
            <h3 className="font-semibold">{infoForm.id ? 'Edit Info Section' : 'Add Info Section'}</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                value={infoForm.slug}
                onChange={(e) => setInfoForm({ ...infoForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={infoForm.title}
                onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={infoForm.description}
                onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <select
                value={infoForm.icon}
                onChange={(e) => setInfoForm({ ...infoForm, icon: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              >
                {availableIcons.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <input
                type="number"
                value={infoForm.sortOrder}
                onChange={(e) => setInfoForm({ ...infoForm, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-border rounded text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 text-sm flex items-center justify-center gap-1"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {infoForm.id ? 'Update' : 'Add'}
              </button>
              {infoForm.id && (
                <button
                  type="button"
                  onClick={() => setInfoForm({ id: null, slug: '', icon: 'Crown', title: '', description: '', sortOrder: 0 })}
                  className="px-4 py-2 border border-border rounded hover:bg-secondary text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="col-span-2 space-y-3">
            {infoSections.map((section) => (
              <div key={section.id} className="flex items-center justify-between p-4 border border-border rounded bg-card">
                <div className="flex-1">
                  <h4 className="font-semibold">{section.title}</h4>
                  <p className="text-sm text-muted-foreground">{section.slug}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setInfoForm({
                        id: section.id,
                        slug: section.slug,
                        icon: section.icon,
                        title: section.title,
                        description: section.description,
                        sortOrder: section.sortOrder,
                      })
                    }
                    className="p-2 hover:bg-secondary rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteInfoSection(section.id)}
                    className="p-2 hover:bg-red-100 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
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
