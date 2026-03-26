import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ShieldAlert, MessageSquareText } from 'lucide-react'

export const Route = createFileRoute('/_public/rules')({
  component: RulesPage,
})

function RulesPage() {
  const eventRules = [
    'Ingen alkohol eller droger. Det ar inte tillatet att ta med, anvanda eller salja droger eller andra berusningsmedel under eventet.',
    'Nolltolerans mot trakasserier. Inget hat, hot, diskriminering, mobbning eller sexuella trakasserier. Respektera allas granser.',
    'Var schysst och visa hansyn. Hall en trevlig ton, bade pa plats och online (till exempel i Discord).',
    'Folj arrangorernas instruktioner. Om en arrangor sager till, sa galler det direkt.',
    'Ta hand om lokalen. Ingen skadegorelse. Hall rent efter dig och anvand soptunnor.',
    'Respektera andras utrustning. Ror inte andras datorer, skarmar eller kablar utan att fraga.',
    'Sakerhet forst. Hall gangar och nodutgangar fria. Dra kablar sa att ingen snubblar.',
    'Ljudniva. Anvand horlurar vid spel. Hogtalare endast om arrangorerna godkanner det.',
    'Foto och film. Fraga innan du fotar eller filmar nagon. Respektera om nagon sager nej.',
    'Konsekvenser. Vid regelbrott kan du fa varning, bli avstangd fran eventet och vid allvarliga incidenter kan polis kontaktas.',
  ]

  const discordRules = [
    'Samma regler som pa plats. Nolltolerans mot trakasserier, hat, hot och diskriminering.',
    'Hall dig till ratt kanal. Skriv i ratt textkanal och hall rostsamtal i ratt voice.',
    'Inga spoilers eller NSFW. Inget sexuellt innehall, gore eller annat olampligt material.',
    'Ingen spam. Inga mass-pings, flood, soundboards pa max, eller upprepade memes som stor.',
    'Ingen reklam utan OK. Ingen reklam for servrar, streams eller produkter utan att arrangorerna sagt ja.',
    'Respektera integritet. Dela inte personuppgifter, IP-adresser, doxxing eller privata chattar.',
    'Ticket/roller = inga genvagar. Forsok inte kringa roller eller atkomst. Missbruk kan leda till avstangning.',
    'Mod-teamet har sista ordet. Moddar kan ta bort innehall, mute:a eller kicka/ban:a vid behov.',
  ]

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
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Riktlinjer</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Regler</h1>
          <p className="text-lg text-muted-foreground">
            For allas trivsel och sakerhet under Lanköping.se
          </p>
        </div>

        {/* Event Rules Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground">Event Regler</h2>
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
            <h2 className="font-display text-2xl text-foreground">Discord Regler</h2>
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
            © 2026 Lanköping.se — Vi ses pa eventet!
          </p>
        </footer>
      </main>
    </div>
  )
}
