import { createFileRoute } from '@tanstack/react-router'
import { getSiteSettingsFn, updateSiteSettingsFn } from '../../../server/functions/cms'
import { useState } from 'react'
import { Settings, Save, Globe, Palette, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/admin/cms/settings')({
  loader: async () => {
    try {
      const settings = await getSiteSettingsFn()
      return { settings }
    } catch {
      return { settings: {} }
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { settings: initialSettings } = Route.useLoaderData()
  const [settings, setSettings] = useState<any>(initialSettings || {})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateSiteSettingsFn({ data: settings })
      setMessage('Inställningar sparade!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Kunde inte spara inställningar')
    } finally {
      setLoading(false)
    }
  }

  const settingGroups = [
    {
      id: 'general',
      label: 'Allmänt',
      icon: Globe,
      settings: [
        { key: 'siteName', label: 'Webbplatsnamn', type: 'text', placeholder: 'Min webbplats' },
        { key: 'siteDescription', label: 'Beskrivning', type: 'textarea', placeholder: 'En kort beskrivning...' },
        { key: 'contactEmail', label: 'Kontakt-e-post', type: 'email', placeholder: 'kontakt@exempel.se' },
      ]
    },
    {
      id: 'appearance',
      label: 'Utseende',
      icon: Palette,
      settings: [
        { key: 'primaryColor', label: 'Primärfärg', type: 'color', placeholder: '#D64A35' },
        { key: 'logoUrl', label: 'Logotyp URL', type: 'text', placeholder: '/logo.png' },
      ]
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">CMS</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground">Inställningar</h1>
            <p className="text-muted-foreground mt-2">Konfigurera webbplatsinställningar</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Spara ändringar
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 border ${message.includes('Kunde') ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {settingGroups.map((group) => (
          <div key={group.id} className="bg-card border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="p-2 bg-primary/10">
                <group.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary" />
                <span className="text-[10px] font-medium tracking-widest text-primary uppercase">{group.label}</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {group.settings.map((setting) => (
                <div key={setting.key}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    {setting.label}
                  </label>
                  {setting.type === 'textarea' ? (
                    <textarea
                      value={settings[setting.key] || ''}
                      onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                      placeholder={setting.placeholder}
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                    />
                  ) : setting.type === 'color' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings[setting.key] || '#D64A35'}
                        onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                        className="w-12 h-10 border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings[setting.key] || ''}
                        onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                        placeholder={setting.placeholder}
                        className="flex-1 px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  ) : (
                    <input
                      type={setting.type}
                      value={settings[setting.key] || ''}
                      onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                      placeholder={setting.placeholder}
                      className="w-full px-3 py-2.5 text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
