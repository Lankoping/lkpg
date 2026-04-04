import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../../server/functions/auth'

export const Route = createFileRoute('/hosted/perks')({
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
  component: HostedPerksPage,
})

function HostedPerksPage() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Perks</p>
      <div className="mt-3 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-foreground">Free storage</h2>
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Not available for this organization
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">We offer each hosted organization 5GB of free storage.</p>
      </div>
    </section>
  )
}
