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
    const logs = await getActivityLogsFn({ data: { limit: 400 } })
    return { logs }
  },
  component: AdminLogs,
})

function AdminLogs() {
  const { logs } = Route.useLoaderData()
  const [query, setQuery] = useState('')

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return logs

    return logs.filter((log) => {
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
  }, [logs, query])

  return (
    <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />

      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#C04A2A] font-medium mb-2">Granskning</p>
        <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2">Aktivitetslogg</h2>
        <p className="text-xs text-[#F0E8D8]/50">Visar viktiga åtgärder utförda av administratörer och volontärer.</p>
      </div>

      <div className="mb-6 p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm">
        <input
          type="text"
          placeholder="Sök på användare, handling eller objekt..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all placeholder:text-[#F0E8D8]/30"
        />
      </div>

      <div className="space-y-3">
        {filteredLogs.map((log) => (
          <div key={log.id} className="p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#C04A2A] mb-1">{log.action}</p>
                <p className="text-sm text-[#F0E8D8]">
                  {log.actorName || 'Okänd användare'} ({log.actorRole}) · {log.entityType}
                  {log.entityId ? ` #${log.entityId}` : ''}
                </p>
                <p className="text-xs text-[#F0E8D8]/45 mt-1">ID {log.actorUserId}{log.actorEmail ? ` · ${log.actorEmail}` : ''}</p>
              </div>
              <p className="text-xs text-[#F0E8D8]/50 whitespace-nowrap">
                {log.createdAt ? new Date(log.createdAt).toLocaleString('sv-SE') : ''}
              </p>
            </div>
              {parseDetails(log.details) && (
              <pre className="mt-3 p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[11px] text-[#F0E8D8]/75 overflow-x-auto">
                  {JSON.stringify(parseDetails(log.details), null, 2)}
              </pre>
            )}
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="text-center py-10 text-[#F0E8D8]/50 border border-dashed border-[#C04A2A]/25 rounded-sm">
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
