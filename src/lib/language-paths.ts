const swedishStaticPaths = new Set(['/', '/rules', '/team', '/privacy', '/blogs', '/nyheter'])
const englishStaticPaths = new Set(['/en', '/en/rules', '/en/team', '/en/privacy', '/en/blogs', '/en/nyheter'])

function isSwedishContentPath(pathname: string): boolean {
  if (swedishStaticPaths.has(pathname)) return true
  if (pathname.startsWith('/blogs/')) return true
  if (pathname.startsWith('/nyheter/')) return true
  return false
}

function isEnglishContentPath(pathname: string): boolean {
  if (englishStaticPaths.has(pathname)) return true
  if (pathname.startsWith('/en/blogs/')) return true
  if (pathname.startsWith('/en/nyheter/')) return true
  return false
}

function toEnglishPath(pathname: string): string {
  if (pathname === '/') return '/en'
  return `/en${pathname}`
}

function toSwedishPath(pathname: string): string {
  if (pathname === '/en') return '/'
  return pathname.replace(/^\/en/, '') || '/'
}

export function getLanguageToggle(pathname: string): { targetPath: string; label: 'EN' | 'SV' } | null {
  if (isSwedishContentPath(pathname)) {
    return {
      targetPath: toEnglishPath(pathname),
      label: 'EN',
    }
  }

  if (isEnglishContentPath(pathname)) {
    return {
      targetPath: toSwedishPath(pathname),
      label: 'SV',
    }
  }

  return null
}
