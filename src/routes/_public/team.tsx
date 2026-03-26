import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getTeamMembersFn } from '../../server/functions/cms'
import * as Icons from 'lucide-react'

// Map icon names to lucide-react components
function getIconByName(iconName: string) {
  const iconMap: Record<string, React.ComponentType<any>> = {
    Crown: Icons.Crown,
    Code: Icons.Code,
    Heart: Icons.Heart,
    Star: Icons.Star,
    Zap: Icons.Zap,
    Shield: Icons.Shield,
    Target: Icons.Target,
    Trophy: Icons.Trophy,
    Flame: Icons.Flame,
    Users: Icons.Users,
    Gamepad2: Icons.Gamepad2,
  }
  return iconMap[iconName] || Icons.User
}

export const Route = createFileRoute('/_public/team')({
  loader: async () => {
    try {
      const members = await getTeamMembersFn()
      return { teamMembers: members }
    } catch (error) {
      console.error('[v0] Error loading team members:', error)
      return { teamMembers: [] }
    }
  },
  component: TeamPage,
})

function TeamPage() {
  const { teamMembers } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            <span>Tillbaka</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Page Header */}
        <div className="mb-16">
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Vilka ar vi</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Teamet</h1>
          <p className="text-lg text-muted-foreground">
            Vilka ar vi som bygger Lanköping?
          </p>
        </div>

        {/* Intro */}
        <section className="mb-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl text-foreground mb-4">Tva personers passion</h2>
            <p className="text-muted-foreground leading-relaxed">
              Lanköping drivs av ett litet men dedikerat team som alskar att skapa digitala upplevelser och bygga community for gamers i Ostergotland.
            </p>
          </div>
        </section>

        {/* Team Members */}
        <section className="mb-16">
          {teamMembers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {teamMembers.map((member) => {
                const IconComponent = getIconByName(member.icon)
                return (
                  <div 
                    key={member.id}
                    className="p-8 border border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="w-12 h-12 flex items-center justify-center bg-secondary mb-6">
                      <IconComponent className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display text-2xl text-primary mb-1">{member.name}</h3>
                    <p className="text-sm text-muted-foreground uppercase tracking-wide mb-4">{member.role}</p>
                    <p className="text-foreground/80 leading-relaxed">{member.description}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 border border-border bg-card text-center text-muted-foreground">
              Inga teammedlemmar tillgangliga for tillfallet.
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 Lanköping.se — Skapat av el4s & nauticalis.
          </p>
        </footer>
      </main>
    </div>
  )
}
