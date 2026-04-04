import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Coins, Shield, Sparkles, Users } from 'lucide-react'
import { submitFoundaryApplicationFn } from '../server/functions/foundary'

export function HomeApplicationPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    applicantName: '',
    email: '',
    age: '',
    cityCountry: '',
    organizationName: '',
    organizationStatus: 'registered_nonprofit',
    hasHcbAccount: false,
    hcbUsername: '',
    preferredPaymentMethod: 'direct_hcb_transfer',
    eventName: '',
    plannedMonths: '',
    expectedAttendees: '',
    requestedFunds: '100',
    briefEventDescription: '',
    budgetJustification: '',
    accountPassword: '',
    termsAccepted: false,
  })

  const perks = useMemo(
    () => [
      'Apply for funding to host LANs and community events.',
      'Track your application status from pending to approved.',
      'Request access to perks provided by Lan Foundary staff.',
      'Free storage (5GB per hosted organization) is currently unavailable for your organization.',
      'Designed for multiple organizations, not only one local group.',
    ],
    [],
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setStatus('submitting')

    try {
      await submitFoundaryApplicationFn({
        data: {
          applicantName: formData.applicantName,
          email: formData.email,
          age: Number(formData.age),
          cityCountry: formData.cityCountry,
          organizationName: formData.organizationName,
          organizationStatus: formData.organizationStatus as
            | 'registered_nonprofit'
            | 'equivalent_in_my_country'
            | 'individual_group_for_reimbursements_only',
          hasHcbAccount: formData.hasHcbAccount,
          hcbUsername: formData.hcbUsername || undefined,
          preferredPaymentMethod: formData.preferredPaymentMethod as 'direct_hcb_transfer' | 'receipt_reimbursement',
          eventName: formData.eventName,
          plannedMonths: formData.plannedMonths,
          expectedAttendees: Number(formData.expectedAttendees),
          requestedFunds: Number(formData.requestedFunds),
          briefEventDescription: formData.briefEventDescription,
          budgetJustification: formData.budgetJustification,
          accountPassword: formData.accountPassword,
          termsAccepted: formData.termsAccepted,
        },
      })

      setStatus('submitted')
    } catch (submitError: any) {
      setError(submitError?.message || 'Could not submit your application')
      setStatus('idle')
    }
  }

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

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Multi-tenant event support</p>
            <h2 className="mt-4 font-display text-4xl leading-tight text-foreground md:text-5xl">
              Apply for funding, manage your LAN, and unlock perks.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Submitting an application creates your hosted account. Use the same email and password later on the hosted portal to track status.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <Coins className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">Funding requests</p>
                <p className="mt-1 text-sm text-muted-foreground">Ask for support when hosting LANs or related events.</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <Users className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">Hosted account access</p>
                <p className="mt-1 text-sm text-muted-foreground">Sign in via /hosted to view application progress and review notes.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">Plan ahead</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Submit applications at least two months before the event you want to host.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">Manual review</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Every application is reviewed by Lan Foundary staff before approval.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">How it works</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {perks.map((perk) => (
                <div key={perk} className="flex gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Free storage</p>
                <span className="rounded-full border border-amber-500/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200">
                  Not available for this organization
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">We offer each hosted organization 5GB of free storage.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          {status === 'submitted' ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h2 className="mt-4 font-display text-3xl text-foreground">Application pending</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Your hosted account is now ready. Sign in at /hosted with the email and password from this form to follow your application status.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Application and registration</p>
                <h2 className="mt-2 font-display text-3xl text-foreground">Apply for funding</h2>
                <p className="mt-2 text-sm text-muted-foreground">Fill in the form below. This also creates your hosted account.</p>
              </div>

              <Field label="Full name" required><input className={inputStyle} value={formData.applicantName} onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })} /></Field>
              <Field label="Email address" required><input className={inputStyle} type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Field>
              <Field label="Hosted account password" required>
                <input
                  className={inputStyle}
                  type="password"
                  minLength={8}
                  value={formData.accountPassword}
                  onChange={(e) => setFormData({ ...formData, accountPassword: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
              </Field>
              <Field label="Age" required><input className={inputStyle} type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} /></Field>
              <Field label="City and country" required><input className={inputStyle} value={formData.cityCountry} onChange={(e) => setFormData({ ...formData, cityCountry: e.target.value })} /></Field>
              <Field label="Organization or nonprofit status" required>
                <select className={inputStyle} value={formData.organizationStatus} onChange={(e) => setFormData({ ...formData, organizationStatus: e.target.value })}>
                  <option value="registered_nonprofit">Registered nonprofit</option>
                  <option value="equivalent_in_my_country">Equivalent in my country</option>
                  <option value="individual_group_for_reimbursements_only">Individual/group for reimbursements only</option>
                </select>
              </Field>
              <Field label="Organization name" required><input className={inputStyle} value={formData.organizationName} onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })} /></Field>
              <Field label="Do you have an HCB account?" required>
                <select className={inputStyle} value={String(formData.hasHcbAccount)} onChange={(e) => setFormData({ ...formData, hasHcbAccount: e.target.value === 'true' })}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              {formData.hasHcbAccount && <Field label="HCB username or ID" required><input className={inputStyle} value={formData.hcbUsername} onChange={(e) => setFormData({ ...formData, hcbUsername: e.target.value })} /></Field>}
              <Field label="Preferred payment method" required>
                <select className={inputStyle} value={formData.preferredPaymentMethod} onChange={(e) => setFormData({ ...formData, preferredPaymentMethod: e.target.value })}>
                  <option value="direct_hcb_transfer">Direct HCB transfer</option>
                  <option value="receipt_reimbursement">Receipt reimbursement</option>
                </select>
              </Field>
              <Field label="Event name" required><input className={inputStyle} value={formData.eventName} onChange={(e) => setFormData({ ...formData, eventName: e.target.value })} /></Field>
              <Field label="Planned month(s)" required><input className={inputStyle} value={formData.plannedMonths} onChange={(e) => setFormData({ ...formData, plannedMonths: e.target.value })} placeholder="e.g. March and April 2026" /></Field>
              <Field label="Expected attendees" required><input className={inputStyle} type="number" value={formData.expectedAttendees} onChange={(e) => setFormData({ ...formData, expectedAttendees: e.target.value })} /></Field>
              <Field label="Requested funds (USD)" required>
                <input
                  className={inputStyle}
                  type="number"
                  min={1}
                  max={100000}
                  value={formData.requestedFunds}
                  onChange={(e) => setFormData({ ...formData, requestedFunds: e.target.value })}
                />
              </Field>
              <p className="-mt-2 text-xs text-muted-foreground">Enter the total funds you are requesting for this application.</p>
              <Field label="Brief event description" required><textarea className={`${inputStyle} min-h-24`} value={formData.briefEventDescription} onChange={(e) => setFormData({ ...formData, briefEventDescription: e.target.value })} /></Field>
              <Field label="Budget justification" required><textarea className={`${inputStyle} min-h-24`} value={formData.budgetJustification} onChange={(e) => setFormData({ ...formData, budgetJustification: e.target.value })} /></Field>

              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input className="mt-1 accent-primary" type="checkbox" checked={formData.termsAccepted} onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })} required />
                <span>I agree to the terms: two-month notice, refund rules, manual approval, and up to 60-day reimbursements.</span>
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button type="submit" disabled={status === 'submitting'} className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                {status === 'submitting' ? 'Submitting...' : 'Create account and submit application'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

const inputStyle =
  'w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60'
