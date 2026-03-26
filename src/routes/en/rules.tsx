import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ShieldAlert, MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/en/rules')({
  component: RulesPage,
})

function RulesPage() {
  const eventRules = [
    'No alcohol or drugs. Bringing, using, or selling narcotics or intoxicants during the event is not allowed.',
    'Zero tolerance for harassment. No hate, threats, discrimination, bullying, or sexual harassment. Respect personal boundaries.',
    'Be kind and considerate. Keep a good tone both on-site and online (for example in Discord).',
    'Follow organizer instructions. If an organizer gives instructions, they apply immediately.',
    'Take care of the venue. No vandalism. Keep your area clean and use trash bins.',
    'Respect other people\'s equipment. Do not touch other setups without permission.',
    'Safety first. Keep aisles and emergency exits clear. Route cables safely.',
    'Sound levels. Use headphones while gaming. Speakers only with organizer approval.',
    'Photo and video. Ask before filming or photographing others. Respect a no.',
    'Consequences. Rule violations can lead to warnings, suspension, or contact with police in serious incidents.',
  ]

  const discordRules = [
    'Same rules as on-site. Zero tolerance for harassment, hate, threats, and discrimination.',
    'Use the right channel. Keep messages and voice chat in the correct channels.',
    'No spoilers or NSFW. No sexual content, gore, or other inappropriate material.',
    'No spam. No mass pings, flooding, disruptive soundboard usage, or repeated disruptive memes.',
    'No advertising without approval. Do not promote servers, streams, or products unless approved.',
    'Respect privacy. Do not share personal data, IP addresses, doxxing, or private chats.',
    'No ticket/role bypassing. Attempts to bypass access controls can lead to suspension.',
    'Moderators have final say. The mod team may remove content, mute, kick, or ban when needed.',
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
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Guidelines</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Rules</h1>
          <p className="text-lg text-muted-foreground">
            {"For everyone's comfort and safety at Lanköping.se"}
          </p>
        </div>

        {/* Event Rules Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground">Event Rules</h2>
          </div>
          
          <div className="space-y-4">
            {eventRules.map((rule, i) => (
              <div 
                key={i} 
                className="flex gap-4 p-4 border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground text-sm font-medium">
                  {i + 1}
                </span>
                <p className="text-foreground/90 leading-relaxed pt-1">{rule}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Discord Rules Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary">
              <MessageSquareText className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground">Discord Rules</h2>
          </div>
          
          <div className="space-y-4">
            {discordRules.map((rule, i) => (
              <div 
                key={i} 
                className="flex gap-4 p-4 border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground text-sm font-medium">
                  {i + 1}
                </span>
                <p className="text-foreground/90 leading-relaxed pt-1">{rule}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 Lanköping.se — See you at the event!
          </p>
        </footer>
      </main>
    </div>
  )
}
