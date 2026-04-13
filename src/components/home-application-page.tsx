import { Calendar, DollarSign, HelpCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export function HomeApplicationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-foreground">Lan Foundary</h1>
          <div className="flex items-center gap-6 text-sm">
            <a href="/hosted" className="text-muted-foreground hover:text-foreground transition-colors">
              Track application
            </a>
            <a href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Staff portal
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Overview Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Event Funding Application</h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl mb-6">
            This portal allows organizers of LAN events and community activities to apply for funding support. All applications are reviewed manually by our team based on organizational details, event scope, and budget justification.
          </p>
          <div className="flex gap-3">
            <a href="/apply" className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Submit application
            </a>
            <a href="/hosted" className="px-4 py-2 border border-border text-sm font-medium hover:bg-card">
              Track your application
            </a>
          </div>
        </section>

        {/* Quick Facts */}
        <section className="mb-12 grid gap-4 md:grid-cols-3">
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Timeline</h3>
            </div>
            <p className="text-sm text-muted-foreground">Submit at least 2 months before your event date for full review consideration.</p>
          </div>
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Requirements</h3>
            </div>
            <p className="text-sm text-muted-foreground">Include event schedule, attendee estimates, organization details, and detailed budget breakdown.</p>
          </div>
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Review Process</h3>
            </div>
            <p className="text-sm text-muted-foreground">Manual review by staff. Decisions may include follow-up questions or requests for clarification.</p>
          </div>
        </section>

        {/* Application Process */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-foreground mb-3">Application Process</h3>

          <div className="border border-border divide-y divide-border">
            <div className="p-3">
              <div className="flex gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center border border-border text-[10px] font-semibold">1</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Prepare Your Information</p>
                  <p className="text-xs text-muted-foreground">2-3 hours. Collect organization details, event info, attendance estimate, and budget.</p>
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="flex gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center border border-border text-[10px] font-semibold">2</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Submit Application</p>
                  <p className="text-xs text-muted-foreground">Submit at least 2 months before the event with complete and specific details.</p>
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="flex gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center border border-border text-[10px] font-semibold">3</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Staff Review</p>
                  <p className="text-xs text-muted-foreground">2-4 weeks. Manual review of impact, budget quality, and organizational readiness.</p>
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="flex gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center border border-border text-[10px] font-semibold">4</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Decision & Next Steps</p>
                  <p className="text-xs text-muted-foreground">Outcome is approved, conditional, or denied. Track updates in Hosted.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Required Information */}
        <section className="mb-12">
          <h3 className="text-xl font-bold text-foreground mb-4">Required Information</h3>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="border border-border p-4">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                Organization Details
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Organization name and contact</li>
                <li>• Event name and date</li>
                <li>• Venue information</li>
                <li>• Expected attendance</li>
              </ul>
            </div>
            <div className="border border-border p-4">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                Budget Information
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Total funding requested</li>
                <li>• Itemized budget breakdown</li>
                <li>• Cost justifications</li>
                <li>• Other funding sources (if any)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Storage Perk */}
        <section className="mb-12 border border-border bg-card p-6">
          <div className="flex gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-foreground">Storage Allocation</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            After your application is approved, you can request up to 5GB of hosted storage for event-related materials. Upload access will be provided once you accept the storage terms and conditions. This storage remains available to you for the duration specified in your agreement.
          </p>
        </section>

        {/* FAQ Section */}
        <section>
          <h3 className="text-xl font-bold text-foreground mb-6">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <details className="group border border-border p-4 cursor-pointer hover:bg-card transition-colors">
              <summary className="flex items-center justify-between font-semibold text-foreground">
                <span>What's the minimum advance notice required?</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3">We require a minimum of 2 months advance notice before your event. This allows our team sufficient time to review your application thoroughly and provide feedback if needed.</p>
            </details>
            <details className="group border border-border p-4 cursor-pointer hover:bg-card transition-colors">
              <summary className="flex items-center justify-between font-semibold text-foreground">
                <span>How long does the review process take?</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3">Review timelines vary depending on application complexity and current volume. Typically, you can expect a response within 2-4 weeks of submission. You can monitor your application status in the Hosted portal.</p>
            </details>
            <details className="group border border-border p-4 cursor-pointer hover:bg-card transition-colors">
              <summary className="flex items-center justify-between font-semibold text-foreground">
                <span>Can I use the funding for virtual events?</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3">This platform is designed for LAN events and in-person community activities. Virtual events have different funding considerations. Please contact staff if you're unsure whether your event qualifies.</p>
            </details>
            <details className="group border border-border p-4 cursor-pointer hover:bg-card transition-colors">
              <summary className="flex items-center justify-between font-semibold text-foreground">
                <span>What happens if my application is rejected?</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3">If your application is not approved, you'll receive feedback explaining the reasons and potential next steps. You may be able to reapply with modified details or at a future date.</p>
            </details>
            <details className="group border border-border p-4 cursor-pointer hover:bg-card transition-colors">
              <summary className="flex items-center justify-between font-semibold text-foreground">
                <span>Is this funding guaranteed?</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground group-open:hidden" />
              </summary>
              <p className="text-sm text-muted-foreground mt-3">No. All applications undergo a manual review process. Approval is not automatic and depends on various factors including eligibility, budget justification, and available resources.</p>
            </details>
          </div>
        </section>
      </main>
    </div>
  )
}
