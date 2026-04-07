import { createFileRoute, redirect } from '@tanstack/react-router'
import { ArrowRight, HardDrive, Sparkles } from 'lucide-react'
import { getSessionFn } from '../../server/functions/auth'
import { getMyStoragePerkFn } from '../../server/functions/storage'
import { storageTabRoutes } from '../../components/storage-page-shell'

export const Route = createFileRoute('/hosted/perks')({
  loader: async () => {
    const user = await getSessionFn()
    if (!user) {
      throw redirect({ to: '/hosted', search: { invite: undefined } })
    }
    if (user.role === 'organizer') {
      throw redirect({ to: '/admin' })
    }
    const storage = await getMyStoragePerkFn().catch(() => null)
    return { storage }
  },
  component: HostedPerksHubPage,
})

function HostedPerksHubPage() {
  const { storage } = Route.useLoaderData() as {
    storage: {
      organizationName: string | null
      request: {
        status: 'pending' | 'approved' | 'rejected'
        termsAcceptedAt: Date | string | null
      } | null
    } | null
  }

  const hasOrganization = Boolean(storage?.organizationName)
  const isApproved = storage?.request?.status === 'approved'
  const isActivated = Boolean(storage?.request?.termsAcceptedAt)
  const isPending = storage?.request?.status === 'pending'
  const isRejected = storage?.request?.status === 'rejected'

  const storageStatusLabel = !hasOrganization
    ? 'Needs org'
    : isActivated
      ? 'Activated'
      : isApproved
        ? 'Approved'
        : isPending
          ? 'Pending'
          : isRejected
            ? 'Rejected'
            : 'Available'

  const storageActionHref = storageTabRoutes.overview

  const storageActionLabel = !hasOrganization
    ? 'Open storage'
    : isActivated
      ? 'Open storage'
      : isApproved
        ? 'Activate storage'
        : 'Apply for storage'

  return (
    <section className="space-y-6 rounded-3xl border border-border bg-card p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-background/90 p-6 md:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Perks</p>
        <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">Choose a perk</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          More perks are coming soon. Storage now lives in its own section so this page can grow into a proper hub.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="group rounded-2xl border border-border bg-background p-6 transition-colors hover:border-primary/30 hover:bg-card">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <HardDrive className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-2xl text-foreground">Storage</h3>
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {storageStatusLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upload files, browse the explorer, manage CDN links, and review limits.
              </p>
              <a
                href={storageActionHref}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {storageActionLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-background p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-2xl text-foreground">More perks coming soon</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This slot is ready for future perks without touching the storage area again.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Coming soon
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}