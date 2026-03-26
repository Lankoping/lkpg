import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ShieldCheck, Info, Clock } from 'lucide-react'

export const Route = createFileRoute('/en/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  const collectionItems = [
    { 
      title: 'Email address', 
      desc: 'Used for login and important event communication.',
      icon: Info,
    },
    { 
      title: 'Manual details', 
      desc: 'For manual ticket purchases we may ask for name and contact details to verify your seat.',
      icon: Info,
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
          <p className="text-sm font-medium tracking-widest text-primary uppercase mb-3">Data Policy</p>
          <h1 className="font-display text-5xl md:text-6xl text-foreground mb-4">Privacy</h1>
          <p className="text-lg text-muted-foreground">
            How we handle your personal data for Lanköping.se
          </p>
        </div>

        {/* Data Collection Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground">Collected Personal Data</h2>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-8">
            To run a safe and well-organized event, we collect and process the following information from participants:
          </p>
          
          <div className="space-y-4">
            {collectionItems.map((item, i) => (
              <div 
                key={i} 
                className="flex gap-4 p-4 border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-secondary">
                  <item.icon className="w-4 h-4 text-primary" />
                </span>
                <div className="pt-1">
                  <p className="text-primary font-medium mb-1">{item.title}</p>
                  <p className="text-foreground/80 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Why We Collect Section */}
        <section className="mb-16">
          <h2 className="font-display text-2xl text-foreground mb-6">Why do we collect this?</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>The data is used only for event administration, safety measures, and ticket verification.</p>
            <p>Since ticket purchases are handled manually, no payment details are stored on this website.</p>
            <p>We never share your data with third parties for profit. Information may be shared with authorities in emergencies.</p>
          </div>
        </section>

        {/* After Event Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 flex items-center justify-center bg-secondary">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground">What happens after the event?</h2>
          </div>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p>
              If everything is clear (no rule violations), your personal data is removed from our servers.
              This means data is stored for <strong className="text-foreground">up to 30 days</strong> after the event.
            </p>
            
            <div className="p-6 border border-primary/30 bg-primary/5">
              <h3 className="font-display text-xl text-primary mb-3">Information we may retain</h3>
              <p className="text-foreground/80">
                We remove all data unless we need to keep specific records. For example, if you violated event rules,
                that information can be retained and may affect access to future events.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2026 Lanköping.se — Your privacy matters to us.
          </p>
        </footer>
      </main>
    </div>
  )
}
