'use client'

import { Link } from '@tanstack/react-router'

type Locale = 'sv' | 'en'

interface ComingSoonProps {
  locale?: Locale
}

const contentByLocale = {
  sv: {
    eyebrow: 'LAN-Event i Norrkoping',
    headline: 'Lanköping',
    tagline: 'Gaming Community',
    description: 'Vi bygger en gemenskap for gamers i Ostergotland. Snart oppnar vi dorrar till vart forsta event.',
    rulesLabel: 'Regler',
    teamLabel: 'Team',
    privacyLabel: 'Integritet',
    rights: 'Alla rattigheter forbehallna',
  },
  en: {
    eyebrow: 'LAN Event in Norrkoping',
    headline: 'Lanköping',
    tagline: 'Gaming Community',
    description: 'We are building a community for gamers in Ostergotland. Soon we open doors to our first event.',
    rulesLabel: 'Rules',
    teamLabel: 'Team',
    privacyLabel: 'Privacy',
    rights: 'All rights reserved',
  },
} as const

export function ComingSoon({ locale = 'sv' }: ComingSoonProps) {
  const content = contentByLocale[locale]
  const basePath = locale === 'en' ? '/en' : ''

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-display text-2xl tracking-tight text-foreground">Lanköping</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link to={`${basePath}/rules`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {content.rulesLabel}
            </Link>
            <Link to={`${basePath}/team`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {content.teamLabel}
            </Link>
            <Link to={`${basePath}/privacy`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {content.privacyLabel}
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <a 
              href="https://discord.gg/h8wuaqyBwT" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-20">
        <section className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <p className="text-sm font-medium tracking-widest text-primary uppercase mb-6">
              {content.eyebrow}
            </p>
            
            {/* Main Headline */}
            <h1 className="font-display text-7xl md:text-9xl tracking-tight text-foreground mb-4">
              {content.headline}
            </h1>
            
            {/* Tagline */}
            <p className="font-serif text-2xl md:text-3xl italic text-muted-foreground mb-8">
              {content.tagline}
            </p>

            {/* Divider */}
            <div className="w-24 h-px bg-primary mx-auto mb-8" />
            
            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-12">
              {content.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="https://discord.gg/h8wuaqyBwT" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-8 py-3 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {locale === 'sv' ? 'Ga med i Discord' : 'Join Discord'}
              </a>
              <a 
                href="https://www.youtube.com/@LANKPNG" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-3 border border-border text-foreground font-medium hover:bg-secondary transition-colors"
              >
                YouTube
              </a>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="grid md:grid-cols-3 gap-12">
              <div>
                <div className="w-10 h-10 flex items-center justify-center bg-secondary mb-4">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2 text-foreground">
                  {locale === 'sv' ? 'NORRKOPING' : 'NORRKOPING'}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {locale === 'sv' 
                    ? 'Vart forsta event kommer hallas i Norrkoping, Ostergotland.'
                    : 'Our first event will be held in Norrkoping, Ostergotland.'}
                </p>
              </div>
              <div>
                <div className="w-10 h-10 flex items-center justify-center bg-secondary mb-4">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2 text-foreground">
                  {locale === 'sv' ? 'GEMENSKAP' : 'COMMUNITY'}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {locale === 'sv'
                    ? 'En plats for gamers att traffas, tavla och ha kul tillsammans.'
                    : 'A place for gamers to meet, compete and have fun together.'}
                </p>
              </div>
              <div>
                <div className="w-10 h-10 flex items-center justify-center bg-secondary mb-4">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2 text-foreground">
                  {locale === 'sv' ? 'LAN-PARTY' : 'LAN PARTY'}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {locale === 'sv'
                    ? 'Ta med din dator och njut av en helg fylld med gaming.'
                    : 'Bring your computer and enjoy a weekend full of gaming.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <span className="font-display text-lg text-foreground">Lanköping</span>
              <span className="text-muted-foreground text-sm">.se</span>
            </div>
            <nav className="flex items-center gap-6 md:hidden">
              <Link to={`${basePath}/rules`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {content.rulesLabel}
              </Link>
              <Link to={`${basePath}/team`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {content.teamLabel}
              </Link>
              <Link to={`${basePath}/privacy`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {content.privacyLabel}
              </Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              © 2026 Lankoping.se — {content.rights}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
