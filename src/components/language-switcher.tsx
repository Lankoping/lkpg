import { Link, useRouterState } from '@tanstack/react-router'
import { Languages } from 'lucide-react'
import { getLanguageToggle } from '@/lib/language-paths'

export function LanguageSwitcher() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const toggle = getLanguageToggle(pathname)

  if (!toggle) {
    return null
  }

  return (
    <Link
      to={toggle.targetPath}
      className="fixed right-4 top-4 z-[60] inline-flex items-center gap-2 rounded-full border border-[#C04A2A]/50 bg-[#100E0C]/85 px-3 py-2 text-[11px] font-medium tracking-[0.18em] text-[#F0E8D8] backdrop-blur transition-colors hover:border-[#C04A2A] hover:text-[#C04A2A]"
      aria-label={`Switch language to ${toggle.label === 'EN' ? 'English' : 'Swedish'}`}
    >
      <Languages size={14} aria-hidden="true" />
      <span>{toggle.label}</span>
    </Link>
  )
}
