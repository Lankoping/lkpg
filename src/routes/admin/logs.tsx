import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { getSessionFn } from '../../server/functions/auth'
import { getActivityLogsFn } from '../../server/functions/logs'

export const Route = createFileRoute('/admin/logs')({
  beforeLoad: async () => {
    const user = await getSessionFn()
    if (!user || user.role !== 'organizer') {
      throw redirect({ to: '/admin' })
    }
  },
  loader: async () => {
    try {
      const logs = await getActivityLogsFn({ data: { limit: 400 } })
      return { logs }
    } catch (error) {
      console.error('Failed to load activity logs', error)
      return { logs: [] }
    }
  },
  component: AdminLogs,
})

function AdminLogs() {
  const { logs } = Route.useLoaderData()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizer' | 'volunteer'>('all')

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return logs.filter((log) => {
      if (roleFilter !== 'all' && log.actorRole !== roleFilter) {
        return false
      }

      if (!normalized) {
        return true
      }

      const parsedDetails = parseDetails(log.details)
      const pieces = [
        log.action,
        log.entityType,
        String(log.entityId ?? ''),
        String(log.actorUserId),
        log.actorRole,
        log.actorName || '',
        log.actorEmail || '',
        JSON.stringify(parsedDetails ?? {}),
      ]

      return pieces.some((piece) => piece.toLowerCase().includes(normalized))
    })
  }, [logs, query, roleFilter])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground">Aktivitetslogg</h2>
        <p className="text-muted-foreground text-sm mt-1">Viktiga åtgärder utförda av organisatörer och volontärer.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Sök på användare, handling eller objekt..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 p-2.5 bg-background border border-border rounded text-foreground text-sm transition-colors placeholder:text-muted-foreground outline-none focus:border-primary/60"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | 'organizer' | 'volunteer')}
          className="md:w-52 p-2.5 bg-background border border-border rounded text-foreground text-sm outline-none focus:border-primary/60 transition-colors"
        >
          <option value="all">Alla roller</option>
          <option value="organizer">Endast organisatörer</option>
          <option value="volunteer">Endast volontärer</option>
        </select>
      </div>

      <div className="space-y-2">
        {filteredLogs.map((log) => {
          const details = parseDetails(log.details)
          const requestMeta = (details as { _request?: { ip?: string | null } } | null)?._request

          return (
            <div key={log.id} className="p-4 bg-card border border-border rounded">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">{log.action}</p>
                  <p className="text-sm text-foreground">
                    {log.actorName || 'Okänd användare'} ({log.actorRole === 'organizer' ? 'Organisatör' : 'Volontär'}) · {log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ID {log.actorUserId}{log.actorEmail ? ` · ${log.actorEmail}` : ''}
                    {requestMeta?.ip ? ` · IP ${requestMeta.ip}` : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString('sv-SE') : ''}
                </p>
              </div>
              {details && (
                <pre className="mt-3 p-3 bg-background border border-border rounded text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
        {filteredLogs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded">
            Inga loggrader matchade din sökning.
          </div>
        )}
      </div>
    </div>
  )
}

function parseDetails(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}
