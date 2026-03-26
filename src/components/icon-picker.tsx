import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import * as Icons from 'lucide-react'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  icons?: string[]
}

const DEFAULT_ICONS = [
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
  'Lock',
  'Unlock',
  'Bell',
  'AlertCircle',
  'CheckCircle',
  'XCircle',
  'Info',
  'HelpCircle',
  'Settings',
  'Search',
  'Home',
  'Mail',
  'Phone',
  'Calendar',
  'Clock',
  'Download',
  'Upload',
  'Share2',
  'MessageSquare',
]

const iconMap = Object.entries(Icons).reduce((acc, [name, icon]) => {
  if (typeof icon === 'function' && DEFAULT_ICONS.includes(name)) {
    acc[name] = icon as React.ComponentType<{ className?: string }>
  }
  return acc
}, {} as Record<string, React.ComponentType<{ className?: string }>>)

export function IconPicker({ value, onChange, icons = DEFAULT_ICONS }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const selectedIcon = iconMap[value]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-background border border-border rounded text-sm hover:border-primary/60 transition-colors"
      >
        {selectedIcon && <selectedIcon className="w-4 h-4 text-primary" />}
        <span className="flex-1 text-left">{value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg z-50 p-3 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2">
            {icons.map(iconName => {
              const Icon = iconMap[iconName]
              return Icon ? (
                <button
                  key={iconName}
                  onClick={() => {
                    onChange(iconName)
                    setOpen(false)
                  }}
                  className={`p-2 rounded border transition-colors flex items-center justify-center ${
                    value === iconName
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                  title={iconName}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ) : null
            })}
          </div>
        </div>
      )}
    </div>
  )
}
