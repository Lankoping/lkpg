import { createFileRoute } from '@tanstack/react-router'
import { getSiteSettingsFn, updateSiteSettingsFn } from '../../../server/functions/cms'
import { useState } from 'react'
import { Settings, Save, Globe, Palette, Bell, Shield, Loader2 } from 'lucide-react'

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
      setMessage('Settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const settingGroups = [
    {
      id: 'general',
      label: 'General',
      icon: Globe,
      settings: [
        { key: 'siteName', label: 'Site Name', type: 'text', placeholder: 'My Website' },
        { key: 'siteDescription', label: 'Site Description', type: 'textarea', placeholder: 'A brief description...' },
        { key: 'contactEmail', label: 'Contact Email', type: 'email', placeholder: 'contact@example.com' },
      ]
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      settings: [
        { key: 'primaryColor', label: 'Primary Color', type: 'color', placeholder: '#3B82F6' },
        { key: 'logoUrl', label: 'Logo URL', type: 'text', placeholder: '/logo.png' },
      ]
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure your website settings</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.includes('Failed') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {settingGroups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <group.icon className="w-4 h-4 text-slate-600" />
              </div>
              <h2 className="font-semibold text-slate-900">{group.label}</h2>
            </div>
            <div className="p-6 space-y-4">
              {group.settings.map((setting) => (
                <div key={setting.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {setting.label}
                  </label>
                  {setting.type === 'textarea' ? (
                    <textarea
                      value={settings[setting.key] || ''}
                      onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                      placeholder={setting.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : setting.type === 'color' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings[setting.key] || '#3B82F6'}
                        onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                        className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings[setting.key] || ''}
                        onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                        placeholder={setting.placeholder}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <input
                      type={setting.type}
                      value={settings[setting.key] || ''}
                      onChange={(e) => setSettings({ ...settings, [setting.key]: e.target.value })}
                      placeholder={setting.placeholder}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
