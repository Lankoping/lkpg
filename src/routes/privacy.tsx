import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-foreground">
      <h1 className="text-3xl font-display">Privacy Policy</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: April 13, 2026</p>

      <section className="mt-8 space-y-4 text-sm leading-6 text-muted-foreground">
        <p>Lan Foundary stores submitted profile and application information to evaluate and manage funding requests.</p>
        <p>Information is used for review operations, account access, and communication related to applications.</p>
        <p>Access to application data is limited to authorized staff and relevant platform systems.</p>
        <p>You can request corrections to inaccurate profile or organization information through support channels.</p>
      </section>
    </main>
  )
}
