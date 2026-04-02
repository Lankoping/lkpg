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
  Home,
  Users,
  Layers,
  Globe,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  FileText,
  Settings,
  Palette,
} from 'lucide-react'

type CmsTabId = 'overview' | 'hero' | 'team' | 'sections' | 'navigation' | 'pages' | 'settings'

interface CMSPageClientProps {
  initialData: {
    heroContent: any
    teamMembers: any[]
    infoSections: any[]
    navigationItems?: any[]
    pages?: any[]
    settings?: any
  }
  availableIcons: string[]
  initialTab?: CmsTabId
}

// Alert Component
function Alert({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-4 border shadow-lg animate-in slide-in-from-top-2 ${
      type === 'success' 
        ? 'bg-card border-green-200 text-green-800' 
        : 'bg-card border-destructive/50 text-destructive'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <AlertCircle className="w-5 h-5 text-destructive" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-secondary/50 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function CMSPageClient({ initialData, availableIcons, initialTab = 'overview' }: CMSPageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<CmsTabId>(initialTab)

  const navigateToTab = (tab: CmsTabId, extra?: () => void) => {
    setActiveTab(tab)
    router.navigate({ to: '/admin/cms', search: { tab }, replace: true })
    extra?.()
  }
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [teamMembers, setTeamMembers] = useState(initialData.teamMembers || [])
  const [infoSections, setInfoSections] = useState(initialData.infoSections || [])
  const [navigationItems, setNavigationItems] = useState(initialData.navigationItems || [])
  const [pages, setPages] = useState(initialData.pages || [])
  const [settings, setSettings] = useState(initialData.settings || {})

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
      showAlert('Hero-innehåll uppdaterat!', 'success')
    } catch (error) {
      showAlert('Kunde inte uppdatera hero-innehåll', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Team Member Handlers
  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamForm.name || !teamForm.role) {
      showAlert('Namn och roll krävs', 'error')
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
        showAlert('Teammedlem uppdaterad!', 'success')
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
        showAlert('Teammedlem tillagd!', 'success')
      }
      resetTeamForm()
    } catch (error) {
      showAlert('Kunde inte spara teammedlem', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTeamMember = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna teammedlem?')) return
    setLoading(true)
    try {
      await deleteTeamMemberFn({ data: id })
      setTeamMembers(teamMembers.filter((t: any) => t.id !== id))
      showAlert('Teammedlem borttagen!', 'success')
    } catch (error) {
      showAlert('Kunde inte ta bort teammedlem', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Info Section Handlers
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!infoForm.slug || !infoForm.title) {
      showAlert('Slug och titel krävs', 'error')
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
        showAlert('Sektion uppdaterad!', 'success')
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
        showAlert('Sektion tillagd!', 'success')
      }
      resetInfoForm()
    } catch (error) {
      showAlert('Kunde inte spara sektion', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInfoSection = async (id: number) => {
    if (!confirm('Är du säker på att du vill ta bort denna sektion?')) return
    setLoading(true)
    try {
      await deleteInfoSectionFn({ data: id })
      setInfoSections(infoSections.filter((i: any) => i.id !== id))
      showAlert('Sektion borttagen!', 'success')
    } catch (error) {
      showAlert('Kunde inte ta bort sektion', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: CmsTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Översikt', icon: <Globe className="w-4 h-4" /> },
    { id: 'hero', label: 'Hero', icon: <Home className="w-4 h-4" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
    { id: 'sections', label: 'Sektioner', icon: <Layers className="w-4 h-4" /> },
    { id: 'navigation', label: 'Navigation', icon: <Globe className="w-4 h-4" /> },
    { id: 'pages', label: 'Sidor', icon: <FileText className="w-4 h-4" /> },
    { id: 'settings', label: 'Inställningar', icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Alert */}
      {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

      {/* Page Header */}
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Innehållshantering</p>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-5xl text-foreground">CMS</h1>
            <p className="text-muted-foreground mt-2">Hantera allt innehåll på webbplatsen</p>
          </div>
          <a href="/" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
            <Eye className="w-4 h-4" />
            Förhandsgranska
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10"><Home className="w-4 h-4 text-primary" /></div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Hero</span>
          </div>
          <p className="font-display text-3xl text-foreground">1</p>
        </div>
        <div className="bg-card border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10"><Users className="w-4 h-4 text-primary" /></div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Team</span>
          </div>
          <p className="font-display text-3xl text-foreground">{teamMembers.length}</p>
        </div>
        <div className="bg-card border border-border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10"><Layers className="w-4 h-4 text-primary" /></div>
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Sektioner</span>
          </div>
          <p className="font-display text-3xl text-foreground">{infoSections.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigateToTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-[2px] ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 bg-primary" />
                <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Snabbåtgärder</span>
              </div>
              <h3 className="font-display text-xl text-foreground">Genvägar</h3>
            </div>
            <div className="p-4 space-y-2">
              {[
                { label: 'Redigera Hero', desc: 'Uppdatera startsidan', onClick: () => navigateToTab('hero'), icon: Home },
                { label: 'Lägg till teammedlem', desc: 'Ny person i teamet', onClick: () => navigateToTab('team', () => setShowTeamForm(true)), icon: Users },
                { label: 'Ny sektion', desc: 'Skapa informationssektion', onClick: () => navigateToTab('sections', () => setShowInfoForm(true)), icon: Layers },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className="w-full flex items-center gap-4 p-4 text-left border border-border hover:border-primary/50 transition-all group"
                >
                  <div className="p-2 bg-secondary group-hover:bg-primary/10 transition-colors">
                    <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Recent Team Members */}
          <div className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-primary" />
                  <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Team</span>
                </div>
                <h3 className="font-display text-xl text-foreground">Teammedlemmar</h3>
              </div>
              <button onClick={() => navigateToTab('team')} className="text-xs font-medium text-primary hover:text-foreground transition-colors">
                Visa alla
              </button>
            </div>
            <div className="p-4 space-y-2">
              {teamMembers.slice(0, 4).map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-3 border border-border hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-display text-lg">{member.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Inga teammedlemmar än</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Tab */}
      {activeTab === 'hero' && (
        <div className="bg-card border border-border">
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10">
                <Home className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary" />
                  <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Sektion</span>
                </div>
                <h3 className="font-display text-xl text-foreground">Hero</h3>
              </div>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleHeroSubmit} className="space-y-6">
              {/* Text Content */}
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Textinnehåll</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Eyebrow</label>
                    <input
                      type="text"
                      value={heroForm.eyebrow || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, eyebrow: e.target.value })}
                      placeholder="t.ex. Välkommen till"
                      className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Rubrik</label>
                    <input
                      type="text"
                      value={heroForm.headline || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, headline: e.target.value })}
                      placeholder="Huvudrubrik"
                      className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tagline</label>
                  <input
                    type="text"
                    value={heroForm.tagline || ''}
                    onChange={(e) => setHeroForm({ ...heroForm, tagline: e.target.value })}
                    placeholder="En fängslande tagline"
                    className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Beskrivning</label>
                  <textarea
                    value={heroForm.description || ''}
                    onChange={(e) => setHeroForm({ ...heroForm, description: e.target.value })}
                    placeholder="Beskriv vad din sida handlar om..."
                    rows={4}
                    className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Knappar</p>
                <div className="grid sm:grid-cols-2 gap-6 p-5 bg-secondary/30 border border-border">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-foreground">Primär knapp</p>
                    <input
                      type="text"
                      value={heroForm.primaryButtonText || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, primaryButtonText: e.target.value })}
                      placeholder="Kom igång"
                      className="w-full px-3 py-2 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <input
                      type="text"
                      value={heroForm.primaryButtonLink || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, primaryButtonLink: e.target.value })}
                      placeholder="/registrera"
                      className="w-full px-3 py-2 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-foreground">Sekundär knapp</p>
                    <input
                      type="text"
                      value={heroForm.secondaryButtonText || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, secondaryButtonText: e.target.value })}
                      placeholder="Läs mer"
                      className="w-full px-3 py-2 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <input
                      type="text"
                      value={heroForm.secondaryButtonLink || ''}
                      onChange={(e) => setHeroForm({ ...heroForm, secondaryButtonLink: e.target.value })}
                      placeholder="/om-oss"
                      className="w-full px-3 py-2 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Spara ändringar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl text-foreground">Teammedlemmar</h3>
              <p className="text-sm text-muted-foreground">{teamMembers.length} medlem{teamMembers.length !== 1 ? 'mar' : ''}</p>
            </div>
            <button 
              onClick={() => { resetTeamForm(); setShowTeamForm(true) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ny medlem
            </button>
          </div>

          {/* Form */}
          {showTeamForm && (
            <div className="bg-card border-2 border-primary/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display text-lg text-foreground">
                  {teamForm.id ? 'Redigera medlem' : 'Ny teammedlem'}
                </h4>
                <button onClick={resetTeamForm} className="p-1 hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Namn *</label>
                    <input
                      type="text"
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      placeholder="Förnamn Efternamn"
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Roll *</label>
                    <input
                      type="text"
                      value={teamForm.role}
                      onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })}
                      placeholder="t.ex. Utvecklare"
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Beskrivning</label>
                  <textarea
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Kort bio..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Ikon</label>
                    <select
                      value={teamForm.icon}
                      onChange={(e) => setTeamForm({ ...teamForm, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    >
                      {availableIcons.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Sorteringsordning</label>
                    <input
                      type="number"
                      value={teamForm.sortOrder}
                      onChange={(e) => setTeamForm({ ...teamForm, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetTeamForm} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 transition-colors">
                    Avbryt
                  </button>
                  <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {teamForm.id ? 'Uppdatera' : 'Lägg till'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          <div className="bg-card border border-border">
            {teamMembers.length > 0 ? (
              <div className="divide-y divide-border">
                {teamMembers.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors group">
                    <div className="p-1 text-muted-foreground cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="w-10 h-10 bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-display">{member.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{member.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
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
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeamMember(member.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">Inga teammedlemmar</h3>
                <p className="text-sm text-muted-foreground mb-4">Lägg till din första teammedlem.</p>
                <button
                  onClick={() => setShowTeamForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ny medlem
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl text-foreground">Infosektioner</h3>
              <p className="text-sm text-muted-foreground">{infoSections.length} sektion{infoSections.length !== 1 ? 'er' : ''}</p>
            </div>
            <button 
              onClick={() => { resetInfoForm(); setShowInfoForm(true) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ny sektion
            </button>
          </div>

          {/* Form */}
          {showInfoForm && (
            <div className="bg-card border-2 border-primary/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display text-lg text-foreground">
                  {infoForm.id ? 'Redigera sektion' : 'Ny infosektion'}
                </h4>
                <button onClick={resetInfoForm} className="p-1 hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleInfoSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Titel *</label>
                    <input
                      type="text"
                      value={infoForm.title}
                      onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
                      placeholder="Sektionstitel"
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                    <input
                      type="text"
                      value={infoForm.slug}
                      onChange={(e) => setInfoForm({ ...infoForm, slug: e.target.value })}
                      placeholder="sektion-slug"
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Beskrivning</label>
                  <textarea
                    value={infoForm.description}
                    onChange={(e) => setInfoForm({ ...infoForm, description: e.target.value })}
                    placeholder="Sektionsinnehåll..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Ikon</label>
                    <select
                      value={infoForm.icon}
                      onChange={(e) => setInfoForm({ ...infoForm, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    >
                      {availableIcons.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Sorteringsordning</label>
                    <input
                      type="number"
                      value={infoForm.sortOrder}
                      onChange={(e) => setInfoForm({ ...infoForm, sortOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetInfoForm} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-primary/30 transition-colors">
                    Avbryt
                  </button>
                  <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {infoForm.id ? 'Uppdatera' : 'Lägg till'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          <div className="bg-card border border-border">
            {infoSections.length > 0 ? (
              <div className="divide-y divide-border">
                {infoSections.map((section: any) => (
                  <div key={section.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors group">
                    <div className="p-1 text-muted-foreground cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="p-2 bg-primary/10 flex-shrink-0">
                      <Layers className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{section.title}</h4>
                      <p className="text-xs text-muted-foreground truncate">/{section.slug}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
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
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInfoSection(section.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">Inga sektioner</h3>
                <p className="text-sm text-muted-foreground mb-4">Lägg till din första infosektion.</p>
                <button
                  onClick={() => setShowInfoForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ny sektion
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tab */}
      {activeTab === 'navigation' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl text-foreground">Navigation</h3>
              <p className="text-sm text-muted-foreground">{navigationItems.length} menyval</p>
            </div>
          </div>

          {/* List */}
          <div className="bg-card border border-border">
            {navigationItems.length > 0 ? (
              <div className="divide-y divide-border">
                {navigationItems.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors group">
                    <div className="p-1 text-muted-foreground cursor-grab">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="p-2 bg-primary/10 flex-shrink-0">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{item.label}</h4>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        {item.href}
                        <ArrowRight className="w-3 h-3" />
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">Ingen navigation</h3>
                <p className="text-sm text-muted-foreground mb-4">Lägg till navigationsmenyval för webbplatsen.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pages Tab */}
      {activeTab === 'pages' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl text-foreground">Sidor</h3>
              <p className="text-sm text-muted-foreground">{pages.length} sida{pages.length !== 1 ? 'or' : ''}</p>
            </div>
          </div>

          {/* List */}
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
                          <EyeOff className="w-3.5 h-3.5" /> Inte publicerad
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">Inga sidor</h3>
                <p className="text-sm text-muted-foreground">Lägg till statiska sidor för webbplatsen.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl text-foreground">Inställningar</h3>
              <p className="text-sm text-muted-foreground">Konfigurera webbplatsinställningar</p>
            </div>
            <button 
              onClick={async () => {
                setLoading(true)
                try {
                  await updateSiteSettingsFn({ data: settings })
                  showAlert('Inställningar sparade!', 'success')
                } catch (error) {
                  showAlert('Kunde inte spara inställningar', 'error')
                  console.error(error)
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Spara ändringar
            </button>
          </div>

          {/* Settings Form */}
          <div className="bg-card border border-border p-6 space-y-6">
            {/* General Settings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10"><Globe className="w-4 h-4 text-primary" /></div>
                <h4 className="font-display text-lg text-foreground">Allmänt</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Webbplatsnamn</label>
                  <input
                    type="text"
                    value={settings.siteName || ''}
                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                    placeholder="Min webbplats"
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Beskrivning</label>
                  <textarea
                    value={settings.siteDescription || ''}
                    onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                    placeholder="En kort beskrivning..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Kontakt-e-post</label>
                  <input
                    type="email"
                    value={settings.contactEmail || ''}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    placeholder="kontakt@exempel.se"
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Appearance Settings */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-primary/10"><Palette className="w-4 h-4 text-primary" /></div>
                <h4 className="font-display text-lg text-foreground">Utseende</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Primärfärg</label>
                  <input
                    type="color"
                    value={settings.primaryColor || '#D64A35'}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="w-full h-10 border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Logotyp URL</label>
                  <input
                    type="text"
                    value={settings.logoUrl || ''}
                    onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                    placeholder="/logo.png"
                    className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
