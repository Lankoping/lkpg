import { createFileRoute, redirect } from '@tanstack/react-router'
import { hostedHelpFaq, hostedHelpIntro } from '../../lib/hosted-help'
import { getSessionFn } from '../../server/functions/auth'

export const Route = createFileRoute('/hosted/faq')({
  loader: async () => {
    const user = await getSessionFn()

    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }

    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }

    return null
  },
  component: HostedFaqPage,
})

function HostedFaqPage() {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">FAQ</p>
        <h2 className="mt-1 font-display text-2xl text-foreground">Hosted help and answers</h2>
        <p className="mt-1 text-sm text-muted-foreground">{hostedHelpIntro}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Support tickets get an automatic AI first response that helps gather details, classify category, and set priority.
        </p>
      </div>

      <div className="space-y-2">
        {hostedHelpFaq.map((item) => (
          <details key={item.id} className="rounded-xl border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm text-foreground">{item.question}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
