import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { getSessionFn } from '../server/functions/auth'
import { submitFoundaryApplicationFn, submitFoundaryApplicationForCurrentUserFn } from '../server/functions/foundary'

export function ApplyApplicationPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [sessionUser, setSessionUser] = useState<{ id: number; email: string; name?: string | null; role: string } | null>(null)
  const [formData, setFormData] = useState({
    applicantName: '',
    email: '',
    birthDate: '',
    city: '',
    country: '',
    organizationName: '',
    organizationStatus: 'registered_nonprofit_at_hackclub_bank',
    hasHcbAccount: false,
    hcbOrganizationLink: '',
    preferredPaymentMethod: 'direct_hcb_transfer',
    eventName: '',
    eventDescription: '',
    accountPassword: '',
    termsAccepted: false,
  })

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      try {
        const user = await getSessionFn()
        if (!cancelled && user && user.role !== 'organizer') {
          setSessionUser({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          })
          setFormData((current) => ({
            ...current,
            applicantName: current.applicantName || (user.name ?? ''),
            email: current.email || user.email,
          }))
        }
      } catch {
        // Continue with public apply flow if session lookup fails.
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  const isSignedInApply = Boolean(sessionUser)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setStatus('submitting')

    try {
      const baseData = {
        applicantName: formData.applicantName,
        age: calculateAge(formData.birthDate),
        cityCountry: `${formData.city}, ${formData.country}`,
        organizationName: formData.organizationName,
        organizationStatus: formData.organizationStatus as
          | 'registered_nonprofit_at_hackclub_bank'
          | 'individual_group_for_reimbursements_only',
        hasHcbAccount: formData.hasHcbAccount,
        hcbUsername: formData.hcbOrganizationLink || undefined,
        preferredPaymentMethod: formData.preferredPaymentMethod as 'direct_hcb_transfer' | 'receipt_reimbursement',
        eventName: formData.eventName,
        plannedMonths: 'Will be provided later in the Request Funding dashboard.',
        expectedAttendees: 1,
        requestedFunds: 1,
        briefEventDescription: formData.eventDescription,
        budgetJustification: 'Will be provided after the first application review',
        termsAccepted: formData.termsAccepted,
      }

      if (isSignedInApply) {
        await submitFoundaryApplicationForCurrentUserFn({
          data: baseData,
        })
      } else {
        await submitFoundaryApplicationFn({
          data: {
            ...baseData,
            email: formData.email,
            accountPassword: formData.accountPassword,
          },
        })
      }

      setStatus('submitted')
    } catch (submitError: any) {
      setError(submitError?.message || 'Could not submit your application')
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-card">
        <div className="mx-auto flex h-full max-w-4xl items-center justify-between px-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Lan Foundary</p>
            <h1 className="font-display text-2xl text-foreground">Application form</h1>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to info
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <section className="border border-border bg-card p-5">
          {status === 'submitted' ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <h2 className="mt-4 font-display text-3xl text-foreground">Application pending</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Your application ticket was created automatically.
                Open your dashboard to check status and respond to requests.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Application form</p>
                <h2 className="mt-2 font-display text-3xl text-foreground">Submit funding request</h2>
                <p className="mt-2 text-sm text-muted-foreground">Start with the basic details. Staff will follow up for funding timing, amount, and budget details if needed.</p>
                {isSignedInApply && (
                  <p className="mt-2 rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    Applying as signed-in account: {sessionUser?.email}. No password or account email input is required.
                  </p>
                )}
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {page} of 3</p>
              </div>

              {page === 1 && (
                <div className="space-y-5">
                  <Field label="Full name" required><input className={inputStyle} value={formData.applicantName} onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })} /></Field>
                  {!isSignedInApply && (
                    <Field label="Email address" required><input className={inputStyle} type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></Field>
                  )}
                  {!isSignedInApply && (
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
                  )}
                  <Field label="Date of birth" required><input className={inputStyle} type="date" value={formData.birthDate} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} /></Field>
                  <Field label="City" required><input className={inputStyle} value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></Field>
                  <Field label="Country" required>
                    <select className={inputStyle} value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })}>
                      <option value="">Select country</option>
                      <option value="Sweden">Sweden</option>
                      <option value="Norway">Norway</option>
                      <option value="Denmark">Denmark</option>
                      <option value="Finland">Finland</option>
                      <option value="Iceland">Iceland</option>
                      <option value="Germany">Germany</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                </div>
              )}

              {page === 2 && (
                <div className="space-y-5">
                  <Field label="Do you have an HCB account?" required>
                    <select
                      className={inputStyle}
                      value={String(formData.hasHcbAccount)}
                      onChange={(e) => {
                        const hasHcb = e.target.value === 'true'
                        setFormData({
                          ...formData,
                          hasHcbAccount: hasHcb,
                          hcbOrganizationLink: hasHcb ? formData.hcbOrganizationLink : '',
                          preferredPaymentMethod: hasHcb ? 'direct_hcb_transfer' : 'receipt_reimbursement',
                          organizationStatus: hasHcb
                            ? 'registered_nonprofit_at_hackclub_bank'
                            : 'individual_group_for_reimbursements_only',
                        })
                      }}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </Field>
                  <Field label="Organization or nonprofit status" required>
                    <select
                      className={inputStyle}
                      value={formData.organizationStatus}
                      onChange={(e) => {
                        const nextStatus = e.target.value
                        const hasHcb = nextStatus === 'registered_nonprofit_at_hackclub_bank'
                        setFormData({
                          ...formData,
                          organizationStatus: nextStatus,
                          hasHcbAccount: hasHcb,
                          hcbOrganizationLink: hasHcb ? formData.hcbOrganizationLink : '',
                          preferredPaymentMethod: hasHcb ? 'direct_hcb_transfer' : 'receipt_reimbursement',
                        })
                      }}
                    >
                      <option value="registered_nonprofit_at_hackclub_bank">Registered nonprofit at Hack Club Bank</option>
                      <option value="individual_group_for_reimbursements_only">Individual group for reimbursements only</option>
                    </select>
                  </Field>
                  <Field label="Organization name" required><input className={inputStyle} value={formData.organizationName} onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })} /></Field>
                  {formData.hasHcbAccount && (
                    <Field label="Link to your HCB organisation" required>
                      <input
                        className={inputStyle}
                        type="url"
                        placeholder="https://hcb.hackclub.com/..."
                        value={formData.hcbOrganizationLink}
                        onChange={(e) => setFormData({ ...formData, hcbOrganizationLink: e.target.value })}
                      />
                    </Field>
                  )}
                  {formData.hasHcbAccount ? (
                    <Field label="Preferred payment method" required>
                      <select className={inputStyle} value={formData.preferredPaymentMethod} onChange={(e) => setFormData({ ...formData, preferredPaymentMethod: e.target.value })}>
                        <option value="direct_hcb_transfer">Direct HCB transfer</option>
                        <option value="receipt_reimbursement">Receipt reimbursement</option>
                      </select>
                    </Field>
                  ) : (
                    <p className="text-xs text-muted-foreground">Payment method is set to receipt reimbursement since no HCB account is connected.</p>
                  )}
                </div>
              )}

              {page === 3 && (
                <div className="space-y-5">
                  <Field label="Event name" required><input className={inputStyle} value={formData.eventName} onChange={(e) => setFormData({ ...formData, eventName: e.target.value })} /></Field>
                  <Field label="What are your events going to be about?" required>
                    <textarea
                      className={`${inputStyle} min-h-24`}
                      value={formData.eventDescription}
                      onChange={(e) => setFormData({ ...formData, eventDescription: e.target.value })}
                      placeholder="Describe the purpose, audience, and format of your events"
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">You will still need to write a per event brief.</p>

                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input className="mt-1 accent-primary" type="checkbox" checked={formData.termsAccepted} onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })} required />
                    <span>
                      I agree to the <a href="/tos" className="text-foreground underline">terms</a> and <a href="/privacy" className="text-foreground underline">privacy policy</a>.
                    </span>
                  </label>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                {page > 1 && (
                  <button
                    type="button"
                    className="border border-border px-4 py-2 text-sm text-foreground"
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Back
                  </button>
                )}

                {page < 3 ? (
                  <button
                    type="button"
                    className="ml-auto bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                ) : (
                  <button type="submit" disabled={status === 'submitting'} className="ml-auto bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {status === 'submitting'
                      ? 'Submitting...'
                      : isSignedInApply
                        ? 'Submit application'
                        : 'Create account and submit application'}
                  </button>
                )}
              </div>
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
  'w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60'

function calculateAge(dateString: string) {
  const birthDate = new Date(dateString)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return Math.max(age, 0)
}
