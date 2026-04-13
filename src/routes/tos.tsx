import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tos')({
  component: TosPage,
})

function TosPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-foreground">
      <h1 className="text-3xl font-display">Terms of Service</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: April 13, 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
        <p>By using Lan Foundary hosted services, you agree to provide accurate application and funding information.</p>
        <p>Funding approvals are manual and may require additional documentation before disbursement.</p>
        <p>Abuse, fraud, or misuse of hosted resources can result in suspension of access.</p>
        <p>Platform terms may be updated over time; continued use indicates acceptance of current terms.</p>
      </section>
    </main>
  )
}
