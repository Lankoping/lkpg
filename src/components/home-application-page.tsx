import { CalendarDays, CircleDollarSign, FileText, Shield, Users } from 'lucide-react'

export function HomeApplicationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-card">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Lan Foundary</p>
            <h1 className="font-display text-2xl text-foreground">Host application portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="/hosted" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Hosted sign in
            </a>
            <a href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Staff sign in
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Lan Foundary</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-foreground md:text-5xl">
              Funding applications for LAN and community events.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              This portal helps organizers request support for upcoming events. Applications are reviewed manually by staff.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">Funding support</p>
                <p className="mt-1 text-sm text-muted-foreground">Request event funding with clear budget and attendance details.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <Users className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">Hosted access</p>
                <p className="mt-1 text-sm text-muted-foreground">Track application progress and follow staff review notes after submission.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/apply" className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Go to application form
              </a>
              <a href="/hosted" className="rounded-2xl border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground">
                Open hosted portal
              </a>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">Submission timing</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Submit at least two months before your event date to allow for full review.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">Manual review</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Approvals are not automatic. Staff manually checks eligibility and budget context.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Before you apply</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Prepare organization details, attendee estimate, and event schedule.</span>
              </div>
              <div className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Include requested amount and a clear budget justification.</span>
              </div>
              <div className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Approval is manual and can include follow-up questions.</span>
              </div>
              <div className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>After submission, use Hosted to track status and updates.</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Storage perk</p>
                <span className="rounded-full border border-amber-500/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                  Available on request
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Request up to 5GB of hosted storage after approval. Upload access is disabled until staff approves and terms are accepted.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
