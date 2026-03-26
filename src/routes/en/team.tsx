import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Crown, Code } from 'lucide-react'

export const Route = createFileRoute('/en/team')({
  component: TeamPage,
})

function TeamPage() {
  const teamMembers = [
    {
      name: 'Nauticalis',
      role: 'Organizer',
      desc: 'Leads the vision and coordinates the Lanköping work.',
      icon: Crown,
    },
    {
      name: 'El4s',
      role: 'Organizer',
      desc: 'Main architect behind the code and website platform.',
      icon: Code,
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/en" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Page Header */}
        <div className="mb-16">
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Who we are</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Team</h1>
          <p className="text-lg text-muted-foreground">
            Who are we behind Lanköping?
          </p>
        </div>

        {/* Intro */}
        <section className="mb-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl text-foreground mb-4">A two-person passion</h2>
            <p className="text-muted-foreground leading-relaxed">
              Lanköping is built by a small but dedicated team that loves creating digital experiences and building community for gamers in Ostergotland.
            </p>
          </div>
        </section>

        {/* Team Members */}
        <section className="mb-16">
          <div className="grid gap-6 md:grid-cols-2">
            {teamMembers.map((member) => (
              <div 
                key={member.name}
                className="p-8 border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 flex items-center justify-center bg-secondary mb-6">
                  <member.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-2xl text-primary mb-1">{member.name}</h3>
                <p className="text-sm text-muted-foreground uppercase tracking-wide mb-4">{member.role}</p>
                <p className="text-foreground/80 leading-relaxed">{member.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 Lanköping.se — Built with love by el4s & nauticalis.
          </p>
        </footer>
      </main>
    </div>
  )
}
