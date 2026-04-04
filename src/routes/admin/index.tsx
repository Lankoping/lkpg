import { createFileRoute } from '@tanstack/react-router'
import { Users, FileText, CircleAlert, CircleCheck } from 'lucide-react'
import { getUsersFn } from '../../server/functions/auth'
import { getFoundaryApplicationsFn } from '../../server/functions/foundary'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const [members, applications] = await Promise.all([getUsersFn(), getFoundaryApplicationsFn()])

    return {
      memberCount: members.length,
      applicationCount: applications.length,
      pendingCount: applications.filter((app) => app.status === 'pending').length,
      approvedCount: applications.filter((app) => app.status === 'approved').length,
      recentApplications: applications.slice(0, 5),
    }
  },
  component: AdminDashboard,
})

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-4xl text-foreground">{value}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { memberCount, applicationCount, pendingCount, approvedCount, recentApplications } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Staff dashboard</p>
        <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track hosted organization activity and review flow at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={memberCount} icon={Users} />
        <StatCard label="Applications" value={applicationCount} icon={FileText} />
        <StatCard label="Pending" value={pendingCount} icon={CircleAlert} />
        <StatCard label="Approved" value={approvedCount} icon={CircleCheck} />
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-2xl text-foreground">Recent applications</h2>
          <a href="/admin/applications" className="text-sm text-muted-foreground hover:text-foreground">
            View all
          </a>
        </div>

        {recentApplications.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No hosted applications have been submitted yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {recentApplications.map((application) => (
              <article key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-base font-medium text-foreground">{application.eventName}</p>
                  <p className="text-sm text-muted-foreground">{application.organizationName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-foreground">${application.fundingRequestAmount}</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{application.status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
