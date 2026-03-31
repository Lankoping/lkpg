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
  getNavigationItemsFn,
  createNavigationItemFn,
  updateNavigationItemFn,
  deleteNavigationItemFn,
  getSiteSettingsFn,
  updateSiteSettingsFn,
} from '@/server/functions/cms'
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Edit2, 
  Save,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Settings,
  Home,
  Users,
  Layers,
  Navigation,
  Globe,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Palette,
  Type,
  Image,
  Link2,
  FileText
} from 'lucide-react'

interface CMSPageClientProps {
  initialData: {
    heroContent: any
    teamMembers: any[]
    infoSections: any[]
  }
  availableIcons: string[]
}

// Card Component
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  )
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}

// Input Component
function Input({ 
  label, 
  value, 
  onChange, 
  placeholder = '', 
  type = 'text',
  helpText,
  required = false,
  className = ''
}: { 
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  helpText?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
      {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
    </div>
  )
}

// Textarea Component
function Textarea({ 
  label, 
  value, 
  onChange, 
  placeholder = '', 
  rows = 3,
  helpText,
  className = ''
}: { 
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  helpText?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y"
      />
      {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
    </div>
  )
}

// Select Component
function Select({ 
  label, 
  value, 
  onChange, 
  options,
  className = ''
}: { 
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// Button Component
function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = ''
}: { 
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100'
  }

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

// Toast/Alert Component
function Alert({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-top-2 ${
      type === 'success' 
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
        : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-emerald-500" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/5 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Quick Stats Component
function QuickStats({ teamCount, sectionCount }: { teamCount: number; sectionCount: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Hero Section', value: '1', icon: Home, color: 'blue' },
        { label: 'Team Members', value: teamCount, icon: Users, color: 'purple' },
        { label: 'Info Sections', value: sectionCount, icon: Layers, color: 'amber' },
        { label: 'Navigation Items', value: '-', icon: Navigation, color: 'emerald' },
      ].map((stat, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${
              stat.color === 'blue' ? 'bg-blue-100' :
              stat.color === 'purple' ? 'bg-purple-100' :
              stat.color === 'amber' ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <stat.icon className={`w-5 h-5 ${
                stat.color === 'blue' ? 'text-blue-600' :
                stat.color === 'purple' ? 'text-purple-600' :
                stat.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Tab Navigation
function TabNav({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: { id: string; label: string; icon: React.ReactNode }[]
  activeTab: string
  onChange: (id: string) => void 
}) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all ${
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// Item List Card
function ItemCard({ 
  title, 
  subtitle, 
  meta,
  onEdit, 
  onDelete,
  isActive = true
}: { 
  title: string
  subtitle?: string
  meta?: string
  onEdit: () => void
  onDelete: () => void
  isActive?: boolean
}) {
  return (
    <div className={`group flex items-center gap-4 p-4 bg-white border rounded-lg hover:border-blue-200 hover:shadow-sm transition-all ${
      !isActive ? 'opacity-60' : ''
    }`}>
      <div className="p-1 text-slate-300 cursor-grab">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-slate-900 truncate">{title}</h4>
          {!isActive && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
              Hidden
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        {meta && <p className="text-[10px] text-slate-400 mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Empty State
function EmptyState({ icon: Icon, title, description, action }: { 
  icon: any
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4 max-w-xs">{description}</p>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          <Plus className="w-4 h-4" />
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function CMSPageClient({ initialData, availableIcons }: CMSPageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
  const [showTeamForm, setShowTeamForm] = useState(false)

  // Info Section Form State
  const [infoForm, setInfoForm] = useState({
    id: null as number | null,
    slug: '',
    icon: 'Crown',
    title: '',
    description: '',
    sortOrder: 0,
  })
  const [showInfoForm, setShowInfoForm] = useState(false)

  const showAlert = (message: string, type: 'success' | 'error') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  const resetTeamForm = () => {
    setTeamForm({ id: null, name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
    setShowTeamForm(false)
  }

  const resetInfoForm = () => {
    setInfoForm({ id: null, slug: '', icon: 'Crown', title: '', description: '', sortOrder: 0 })
    setShowInfoForm(false)
  }

  // Hero Content Handler
  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateHeroContentFn({ data: heroForm })
      showAlert('Hero content updated successfully!', 'success')
    } catch (error) {
      showAlert('Failed to update hero content', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Team Member Handlers
  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamForm.name || !teamForm.role) {
      showAlert('Name and role are required', 'error')
      return
    }

    setLoading(true)
    try {
      if (teamForm.id) {
        const result = await updateTeamMemberFn({
          data: {
            id: teamForm.id,
            name: teamForm.name,
            role: teamForm.role,
            description: teamForm.description,
            icon: teamForm.icon,
            sortOrder: teamForm.sortOrder,
            isActive: true,
          }
        })
        setTeamMembers(teamMembers.map((t: any) => (t.id === teamForm.id ? result : t)))
        showAlert('Team member updated successfully!', 'success')
      } else {
        const result = await createTeamMemberFn({
          data: {
            name: teamForm.name,
            role: teamForm.role,
            description: teamForm.description,
            icon: teamForm.icon,
            sortOrder: teamForm.sortOrder,
          }
        })
        setTeamMembers([...teamMembers, result])
        showAlert('Team member added successfully!', 'success')
      }
      resetTeamForm()
    } catch (error) {
      showAlert('Failed to save team member', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeamMember = async (id: number) => {
    if (!confirm('Are you sure you want to delete this team member?')) return
    setLoading(true)
    try {
      await deleteTeamMemberFn({ data: id })
      setTeamMembers(teamMembers.filter((t: any) => t.id !== id))
      showAlert('Team member deleted successfully!', 'success')
    } catch (error) {
      showAlert('Failed to delete team member', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Info Section Handlers
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infoForm.slug || !infoForm.title) {
      showAlert('Slug and title are required', 'error')
      return
    }

    setLoading(true)
    try {
      if (infoForm.id) {
        const result = await updateInfoSectionFn({
          data: {
            id: infoForm.id,
            slug: infoForm.slug,
            icon: infoForm.icon,
            title: infoForm.title,
            description: infoForm.description,
            sortOrder: infoForm.sortOrder,
            isActive: true,
          }
        })
        setInfoSections(infoSections.map((i: any) => (i.id === infoForm.id ? result : i)))
        showAlert('Info section updated successfully!', 'success')
      } else {
        const result = await createInfoSectionFn({
          data: {
            slug: infoForm.slug,
            icon: infoForm.icon,
            title: infoForm.title,
            description: infoForm.description,
            sortOrder: infoForm.sortOrder,
          }
        })
        setInfoSections([...infoSections, result])
        showAlert('Info section added successfully!', 'success')
      }
      resetInfoForm()
    } catch (error) {
      showAlert('Failed to save info section', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInfoSection = async (id: number) => {
    if (!confirm('Are you sure you want to delete this section?')) return
    setLoading(true)
    try {
      await deleteInfoSectionFn({ data: id })
      setInfoSections(infoSections.filter((i: any) => i.id !== id))
      showAlert('Info section deleted successfully!', 'success')
    } catch (error) {
      showAlert('Failed to delete info section', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Globe className="w-4 h-4" /> },
    { id: 'hero', label: 'Hero', icon: <Home className="w-4 h-4" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
    { id: 'sections', label: 'Sections', icon: <Layers className="w-4 h-4" /> },
  ]

  const iconOptions = availableIcons.map(icon => ({ value: icon, label: icon }))

  return (
    <div className="max-w-7xl mx-auto">
      {/* Alert */}
      {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Content Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all your website content in one place</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <a href="/" target="_blank">
              <Button variant="primary" size="sm">
                <Globe className="w-4 h-4" />
                View Site
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats teamCount={teamMembers.length} sectionCount={infoSections.length} />

      {/* Tabs */}
      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Quick Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Edit Hero Section', desc: 'Update homepage hero', onClick: () => setActiveTab('hero'), icon: Home },
                { label: 'Add Team Member', desc: 'Add new team member', onClick: () => { setActiveTab('team'); setShowTeamForm(true) }, icon: Users },
                { label: 'Add Info Section', desc: 'Create new section', onClick: () => { setActiveTab('sections'); setShowInfoForm(true) }, icon: Layers },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <action.icon className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{action.label}</p>
                    <p className="text-xs text-slate-500">{action.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Recent Team Members */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Team Members</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('team')}>
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {teamMembers.slice(0, 4).map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">{member.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{member.name}</p>
                    <p className="text-xs text-slate-500 truncate">{member.role}</p>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No team members yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hero Tab */}
      {activeTab === 'hero' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Hero Section</h3>
                <p className="text-xs text-slate-500">Edit your homepage hero content</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHeroSubmit} className="space-y-6">
              {/* Text Content */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Type className="w-4 h-4" />
                  Text Content
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Eyebrow Text"
                    value={heroForm.eyebrow || ''}
                    onChange={(v) => setHeroForm({ ...heroForm, eyebrow: v })}
                    placeholder="e.g., Welcome to"
                    helpText="Small text above the headline"
                  />
                  <Input
                    label="Headline"
                    value={heroForm.headline || ''}
                    onChange={(v) => setHeroForm({ ...heroForm, headline: v })}
                    placeholder="Your main headline"
                    required
                  />
                </div>
                <Input
                  label="Tagline"
                  value={heroForm.tagline || ''}
                  onChange={(v) => setHeroForm({ ...heroForm, tagline: v })}
                  placeholder="A catchy tagline"
                />
                <Textarea
                  label="Description"
                  value={heroForm.description || ''}
                  onChange={(v) => setHeroForm({ ...heroForm, description: v })}
                  placeholder="Describe what your site is about..."
                  rows={4}
                />
              </div>

              {/* Buttons */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Link2 className="w-4 h-4" />
                  Call to Action Buttons
                </div>
                <div className="grid sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Primary Button</p>
                    <Input
                      label="Button Text"
                      value={heroForm.primaryButtonText || ''}
                      onChange={(v) => setHeroForm({ ...heroForm, primaryButtonText: v })}
                      placeholder="Get Started"
                    />
                    <Input
                      label="Button Link"
                      value={heroForm.primaryButtonLink || ''}
                      onChange={(v) => setHeroForm({ ...heroForm, primaryButtonLink: v })}
                      placeholder="/signup"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Secondary Button</p>
                    <Input
                      label="Button Text"
                      value={heroForm.secondaryButtonText || ''}
                      onChange={(v) => setHeroForm({ ...heroForm, secondaryButtonText: v })}
                      placeholder="Learn More"
                    />
                    <Input
                      label="Button Link"
                      value={heroForm.secondaryButtonLink || ''}
                      onChange={(v) => setHeroForm({ ...heroForm, secondaryButtonLink: v })}
                      placeholder="/about"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" variant="primary" loading={loading}>
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Team Members</h3>
              <p className="text-sm text-slate-500">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => { resetTeamForm(); setShowTeamForm(true) }}>
              <Plus className="w-4 h-4" />
              Add Member
            </Button>
          </div>

          {/* Form Modal/Panel */}
          {showTeamForm && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="border-blue-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">
                    {teamForm.id ? 'Edit Team Member' : 'Add New Team Member'}
                  </h4>
                  <button onClick={resetTeamForm} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTeamSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      label="Name"
                      value={teamForm.name}
                      onChange={(v) => setTeamForm({ ...teamForm, name: v })}
                      placeholder="John Doe"
                      required
                    />
                    <Input
                      label="Role"
                      value={teamForm.role}
                      onChange={(v) => setTeamForm({ ...teamForm, role: v })}
                      placeholder="Developer"
                      required
                    />
                  </div>
                  <Textarea
                    label="Description"
                    value={teamForm.description}
                    onChange={(v) => setTeamForm({ ...teamForm, description: v })}
                    placeholder="Brief bio..."
                    rows={2}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select
                      label="Icon"
                      value={teamForm.icon}
                      onChange={(v) => setTeamForm({ ...teamForm, icon: v })}
                      options={iconOptions}
                    />
                    <Input
                      label="Sort Order"
                      type="number"
                      value={String(teamForm.sortOrder)}
                      onChange={(v) => setTeamForm({ ...teamForm, sortOrder: parseInt(v) || 0 })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={resetTeamForm}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={loading}>
                      {teamForm.id ? 'Update' : 'Add'} Member
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* List */}
          <Card>
            <CardContent className="p-2">
              {teamMembers.length > 0 ? (
                <div className="space-y-2">
                  {teamMembers.map((member: any) => (
                    <ItemCard
                      key={member.id}
                      title={member.name}
                      subtitle={member.role}
                      meta={`Icon: ${member.icon} · Order: ${member.sortOrder}`}
                      onEdit={() => {
                        setTeamForm({
                          id: member.id,
                          name: member.name,
                          role: member.role,
                          description: member.description || '',
                          icon: member.icon,
                          sortOrder: member.sortOrder,
                        })
                        setShowTeamForm(true)
                      }}
                      onDelete={() => handleDeleteTeamMember(member.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No team members"
                  description="Add your first team member to get started."
                  action={{ label: 'Add Member', onClick: () => setShowTeamForm(true) }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Info Sections</h3>
              <p className="text-sm text-slate-500">{infoSections.length} section{infoSections.length !== 1 ? 's' : ''}</p>
            </div>
            <Button variant="primary" size="sm" onClick={() => { resetInfoForm(); setShowInfoForm(true) }}>
              <Plus className="w-4 h-4" />
              Add Section
            </Button>
          </div>

          {/* Form Modal/Panel */}
          {showInfoForm && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="border-amber-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">
                    {infoForm.id ? 'Edit Info Section' : 'Add New Info Section'}
                  </h4>
                  <button onClick={resetInfoForm} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInfoSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input
                      label="Title"
                      value={infoForm.title}
                      onChange={(v) => setInfoForm({ ...infoForm, title: v })}
                      placeholder="Section Title"
                      required
                    />
                    <Input
                      label="Slug"
                      value={infoForm.slug}
                      onChange={(v) => setInfoForm({ ...infoForm, slug: v })}
                      placeholder="section-slug"
                      required
                      helpText="URL-friendly identifier"
                    />
                  </div>
                  <Textarea
                    label="Description"
                    value={infoForm.description}
                    onChange={(v) => setInfoForm({ ...infoForm, description: v })}
                    placeholder="Section content..."
                    rows={3}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select
                      label="Icon"
                      value={infoForm.icon}
                      onChange={(v) => setInfoForm({ ...infoForm, icon: v })}
                      options={iconOptions}
                    />
                    <Input
                      label="Sort Order"
                      type="number"
                      value={String(infoForm.sortOrder)}
                      onChange={(v) => setInfoForm({ ...infoForm, sortOrder: parseInt(v) || 0 })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={resetInfoForm}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={loading}>
                      {infoForm.id ? 'Update' : 'Add'} Section
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* List */}
          <Card>
            <CardContent className="p-2">
              {infoSections.length > 0 ? (
                <div className="space-y-2">
                  {infoSections.map((section: any) => (
                    <ItemCard
                      key={section.id}
                      title={section.title}
                      subtitle={`/${section.slug}`}
                      meta={`Icon: ${section.icon} · Order: ${section.sortOrder}`}
                      onEdit={() => {
                        setInfoForm({
                          id: section.id,
                          slug: section.slug,
                          icon: section.icon,
                          title: section.title,
                          description: section.description || '',
                          sortOrder: section.sortOrder,
                        })
                        setShowInfoForm(true)
                      }}
                      onDelete={() => handleDeleteInfoSection(section.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Layers}
                  title="No info sections"
                  description="Add your first info section to get started."
                  action={{ label: 'Add Section', onClick: () => setShowInfoForm(true) }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
