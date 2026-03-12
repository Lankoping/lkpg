import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAvgangRequestsFn,
  getMyPendingSignaturesFn,
  createAvgangRequestFn,
  addDigitalSignatureFn,
  fixAvgangSpellingFn,
  updateAvgangStatusFn,
  markPhysicallySignedFn,
  recordPdfGenerationFn,
} from '../../server/functions/avgang'
import { getUsersFn, getSessionFn } from '../../server/functions/auth'
import { openAvgangPdf } from '../../lib/pdf-export'
import { useState } from 'react'

export const Route = createFileRoute('/admin/avgang')({
  loader: async () => {
    const [requests, myPending, session] = await Promise.all([
      getAvgangRequestsFn(),
      getMyPendingSignaturesFn(),
      getSessionFn(),
    ])
    const allUsers = session?.role === 'organizer' ? await getUsersFn() : []
    return { requests, myPending, allUsers, session }
  },
  component: AvgangAdmin,
})

type EnrichedRequest = Awaited<ReturnType<typeof getAvgangRequestsFn>>[number]

const statusLabel = (s: string) =>
  ({ pending: 'Väntande', approved: 'Godkänd', rejected: 'Avslagen', archived: 'Arkiverad' }[s] ?? s)

const statusColor = (s: string) =>
  ({
    approved: 'bg-green-500/10 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
    archived: 'bg-[#F0E8D8]/5 text-[#F0E8D8]/40 border-[#F0E8D8]/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }[s] ?? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30')

function AvgangAdmin() {
  const { requests: init, myPending: initPending, allUsers, session } = Route.useLoaderData()
  const router = useRouter()
  const isOrganizer = session?.role === 'organizer'

  const [requests, setRequests] = useState<EnrichedRequest[]>(init)
  const [myPending, setMyPending] = useState<EnrichedRequest[]>(initPending)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Form state
  const [namn, setNamn] = useState('')
  const [pnr, setPnr] = useState('')
  const [roll, setRoll] = useState('')
  const [orsak, setOrsak] = useState('')
  const [datum, setDatum] = useState('')
  const [targetUserId, setTargetUserId] = useState<number | null>(null)
  const [requiredSignerIds, setRequiredSignerIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFixingSpelling, setIsFixingSpelling] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)

  const myId = session?.id

  const toggleSigner = (userId: number) => {
    setRequiredSignerIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!namn || !pnr || !roll || !orsak || !datum) {
      setFormError('Alla fält utom kontoknytning är obligatoriska')
      return
    }
    setIsSubmitting(true)
    try {
      const created = await createAvgangRequestFn({
        data: { namn, pnr, roll, orsak, datum, targetUserId: targetUserId ?? null, requiredSignerIds },
      })
      setRequests(prev => [created, ...prev])
      setNamn(''); setPnr(''); setRoll(''); setOrsak(''); setDatum('')
      setTargetUserId(null); setRequiredSignerIds([])
      setFormSuccess(true)
      setTimeout(() => setFormSuccess(false), 4000)
      setFormOpen(false)
      await router.invalidate()
    } catch (err: any) {
      setFormError(err?.message || 'Kunde inte registrera avgång')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDigitalSign = async (id: number) => {
    try {
      const updated = await addDigitalSignatureFn({ data: { requestId: id } })
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      setMyPending(prev => prev.filter(r => r.id !== id))
      await router.invalidate()
    } catch (err: any) {
      alert('Kunde inte signera: ' + (err?.message || 'Okänt fel'))
    }
  }

  const handleStatusChange = async (id: number, status: 'approved' | 'rejected' | 'archived') => {
    try {
      const updated = await updateAvgangStatusFn({ data: { id, status } })
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      await router.invalidate()
    } catch (err: any) {
      alert('Kunde inte uppdatera status: ' + (err?.message || 'Okänt fel'))
    }
  }

  const handleMarkPhysical = async (id: number) => {
    if (!window.confirm('Bekräfta att dokumentet har signerats fysiskt av samtliga parter. Kontot för avgående person spärras.')) return
    try {
      const updated = await markPhysicallySignedFn({ data: { id } })
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      await router.invalidate()
    } catch (err: any) {
      alert('Fel: ' + (err?.message || 'Okänt fel'))
    }
  }

  const handleGeneratePdf = async (req: EnrichedRequest) => {
    try {
      const updated = await recordPdfGenerationFn({ data: { id: req.id } })
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r))
      openAvgangPdf(
        {
          id: req.id,
          namn: req.namn,
          pnr: req.pnr,
          roll: req.roll,
          orsak: req.orsak,
          datum: req.datum,
          createdAt: req.createdAt,
          generatedByName: session?.name ?? null,
          requiredSigners: req.requiredSigners,
          status: req.status,
          physicalSigned: req.physicalSigned,
          allSigned: req.allSigned,
        },
        session?.name ?? 'Admin'
      )
    } catch (err: any) {
      alert('Fel vid PDF-generering: ' + (err?.message || 'Okänt fel'))
    }
  }

  const handleFixSpelling = async () => {
    if (!namn.trim() || !roll.trim() || !orsak.trim()) {
      setFormError('Namn, roll och anledning krävs för stavningskontroll')
      return
    }

    setFormError('')
    setIsFixingSpelling(true)
    try {
      const fixed = await fixAvgangSpellingFn({
        data: {
          namn,
          roll,
          orsak,
        },
      })

      setNamn(fixed.namn)
      setRoll(fixed.roll)
      setOrsak(fixed.orsak)
    } catch (err: any) {
      setFormError(err?.message || 'Kunde inte fixa stavning just nu')
    } finally {
      setIsFixingSpelling(false)
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="font-display text-3xl tracking-wide text-[#F0E8D8] mb-2">Avgångar</h2>
        <p className="text-[#F0E8D8]/60 text-sm">Hantera avgångsbegäran, digitala signaturer och fysisk utskrift</p>
      </div>

      {/* Pending signatures for current user */}
      {myPending.length > 0 && (
        <div className="mb-8 bg-[#C04A2A]/10 border border-[#C04A2A]/40 rounded-sm p-6">
          <h3 className="font-display text-lg tracking-wide text-[#C04A2A] mb-1">
            Din signatur krävs — {myPending.length} {myPending.length === 1 ? 'ärende' : 'ärenden'}
          </h3>
          <p className="text-[#F0E8D8]/60 text-sm mb-5">
            Granska och bekräfta din digitala signatur för nedanstående avgångsbegäran.
          </p>
          <div className="space-y-3">
            {myPending.map(req => {
              const mySig = req.requiredSigners.find(s => s.userId === myId)
              return (
                <div key={req.id} className="flex items-center justify-between gap-4 p-4 bg-[#1A1816]/60 border border-[#C04A2A]/30 rounded-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#F0E8D8] truncate">{req.namn}</p>
                    <p className="text-sm text-[#F0E8D8]/60">{req.roll} — avgång {req.datum ? new Date(req.datum).toLocaleDateString('sv-SE') : '?'}</p>
                  </div>
                  {mySig && !mySig.signed ? (
                    <button
                      onClick={() => handleDigitalSign(req.id)}
                      className="shrink-0 px-4 py-2 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] transition-all"
                    >
                      [ ] Bekräfta digitalt
                    </button>
                  ) : (
                    <span className="text-green-400 text-sm font-mono shrink-0">[X] Signerad</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Success banner */}
      {formSuccess && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-sm text-green-400 text-sm">
          Avgångsbegäran registrerad
        </div>
      )}

      {isOrganizer && (
        <div className="mb-6">
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="text-[11px] uppercase tracking-[0.15em] text-[#C04A2A] hover:text-[#F0E8D8] border border-[#C04A2A]/40 hover:border-[#C04A2A] px-4 py-2 rounded-sm transition-colors"
          >
            {formOpen ? 'Stäng formulär' : 'Ny avgångsbegäran'}
          </button>
        </div>
      )}

      {/* New request form */}
      {isOrganizer && formOpen && (
        <div className="mb-8 bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
          <h3 className="font-display text-lg tracking-wide text-[#F0E8D8] mb-6">Ny avgångsbegäran</h3>

          {formError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-red-400 text-sm">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Namn</label>
                <input
                  type="text"
                  value={namn}
                  onChange={e => setNamn(e.target.value)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Personnummer</label>
                <input
                  type="text"
                  placeholder="YYYYMMDD-XXXX"
                  value={pnr}
                  onChange={e => setPnr(e.target.value)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Roll</label>
                <input
                  type="text"
                  placeholder="t.ex. Ordförande"
                  value={roll}
                  onChange={e => setRoll(e.target.value)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Avgångsdatum</label>
                <input
                  type="date"
                  value={datum}
                  onChange={e => setDatum(e.target.value)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Anledning till avgång</label>
              <textarea
                value={orsak}
                onChange={e => setOrsak(e.target.value)}
                rows={3}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm resize-none"
              />
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  disabled={isFixingSpelling || isSubmitting}
                  onClick={handleFixSpelling}
                  className="px-4 py-2 bg-[#1A1816] border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.15em] font-medium rounded-sm hover:border-[#C04A2A]/80 hover:text-white transition-all disabled:opacity-50"
                >
                  {isFixingSpelling ? 'Fixar text...' : 'Fixa stavning (Gemini Flash)'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">
                Konto att spärra vid slutförande (valfritt)
              </label>
              <select
                value={targetUserId ?? ''}
                onChange={e => setTargetUserId(e.target.value ? Number(e.target.value) : null)}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
              >
                <option value="">Inget konto kopplat</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[#F0E8D8]/40 text-xs">
                Kontot spärras automatiskt när dokumentet markerats som fysiskt signerat.
              </p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-2">
                Krävda digitala signatärer
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allUsers.map(u => (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                      requiredSignerIds.includes(u.id)
                        ? 'border-[#C04A2A]/60 bg-[#C04A2A]/10'
                        : 'border-[#C04A2A]/20 bg-[#100E0C] hover:border-[#C04A2A]/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={requiredSignerIds.includes(u.id)}
                      onChange={() => toggleSigner(u.id)}
                      className="accent-[#C04A2A]"
                    />
                    <span className="text-sm text-[#F0E8D8] truncate">{u.name || u.email}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(192,74,42,0.3)]"
              >
                {isSubmitting ? 'Registrerar...' : 'Registrera avgångsbegäran'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* All requests list */}
      <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
        <h3 className="font-display text-lg tracking-wide text-[#F0E8D8] mb-6">
          Alla avgångsbegäran ({requests.length})
        </h3>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-[#F0E8D8]/50">
            <p className="font-serif italic">Inga avgångsbegäran registrerade ännu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const isExpanded = expandedId === req.id
              const canGeneratePdf = req.status === 'approved' && req.allSigned
              const canMarkPhysical = canGeneratePdf && !req.physicalSigned
              const done = req.physicalSigned

              return (
                <div key={req.id} className="border border-[#C04A2A]/20 rounded-sm overflow-hidden">
                  {/* Row header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-[#1C1A18] transition-colors flex items-center gap-3"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <span className="text-[#F0E8D8]/30 text-xs w-4 shrink-0">{isExpanded ? '▼' : '▶'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-[#F0E8D8]">{req.namn}</span>
                        <span className={`text-[9px] font-medium uppercase tracking-[0.2em] px-2 py-0.5 border rounded-sm ${statusColor(req.status)}`}>
                          {statusLabel(req.status)}
                        </span>
                        {req.allSigned && !done && (
                          <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 border border-green-500/30 bg-green-500/10 text-green-400 rounded-sm">
                            Digitalt bekräftat
                          </span>
                        )}
                        {done && (
                          <span className="text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 border border-blue-500/30 bg-blue-500/10 text-blue-400 rounded-sm">
                            Fysiskt signerat
                          </span>
                        )}
                      </div>
                      <p className="text-[#F0E8D8]/60 text-xs">
                        {req.roll} — {req.pnr}
                        {req.createdByName ? ` — Registrerad av ${req.createdByName}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="bg-[#141210]/50 border-t border-[#C04A2A]/20 p-5 space-y-5">

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-1">Avgångsdatum</p>
                          <p className="text-sm text-[#F0E8D8]">{req.datum ? new Date(req.datum).toLocaleDateString('sv-SE') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-1">Registrerad</p>
                          <p className="text-sm text-[#F0E8D8]">{req.createdAt ? new Date(req.createdAt).toLocaleDateString('sv-SE') : '—'}</p>
                        </div>
                        {req.targetName && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-1">Konto att spärras</p>
                            <p className="text-sm text-[#C04A2A]">{req.targetName}</p>
                          </div>
                        )}
                        {req.generatedAt && req.generatedByName && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-1">PDF genererad</p>
                            <p className="text-sm text-[#F0E8D8]/80">
                              {new Date(req.generatedAt).toLocaleDateString('sv-SE')} av {req.generatedByName}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-2">Anledning</p>
                        <p className="text-sm text-[#F0E8D8] leading-relaxed">{req.orsak}</p>
                      </div>

                      {/* Digital signatures */}
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 mb-3">
                          Digitala signaturer ({req.requiredSigners.filter(s => s.signed).length}/{req.requiredSigners.length})
                        </p>
                        {req.requiredSigners.length === 0 ? (
                          <p className="text-sm text-[#F0E8D8]/40 italic">Inga signatärer valda</p>
                        ) : (
                          <div className="space-y-2">
                            {req.requiredSigners.map(signer => {
                              const isMe = signer.userId === myId
                              const canISign = isMe && !signer.signed && req.status !== 'archived'
                              return (
                                <div key={signer.userId} className="flex items-center justify-between gap-3 p-3 bg-[#1A1816]/60 rounded-sm">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`font-mono text-sm shrink-0 ${signer.signed ? 'text-green-400' : 'text-[#F0E8D8]/40'}`}>
                                      {signer.signed ? '[X]' : '[ ]'}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-sm text-[#F0E8D8] truncate">{signer.name}</p>
                                      <p className="text-xs text-[#F0E8D8]/50 truncate">{signer.email}</p>
                                    </div>
                                  </div>
                                  {canISign && (
                                    <button
                                      onClick={() => handleDigitalSign(req.id)}
                                      className="shrink-0 px-3 py-1.5 bg-[#C04A2A]/15 text-[#C04A2A] border border-[#C04A2A]/40 text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/25 transition-colors"
                                    >
                                      Signera
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#C04A2A]/20">
                        {isOrganizer && req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(req.id, 'approved')}
                              className="px-4 py-2 bg-green-500/15 text-green-400 border border-green-500/30 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm hover:bg-green-500/25 transition-colors"
                            >
                              Godkänn
                            </button>
                            <button
                              onClick={() => handleStatusChange(req.id, 'rejected')}
                              className="px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm hover:bg-red-500/25 transition-colors"
                            >
                              Avslå
                            </button>
                          </>
                        )}

                        {canGeneratePdf && (
                          <button
                            onClick={() => handleGeneratePdf(req)}
                            className="px-4 py-2 bg-[#C04A2A]/15 text-[#C04A2A] border border-[#C04A2A]/40 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm hover:bg-[#C04A2A]/25 transition-colors"
                          >
                            Generera PDF
                          </button>
                        )}

                        {isOrganizer && canMarkPhysical && (
                          <button
                            onClick={() => handleMarkPhysical(req.id)}
                            className="px-4 py-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm hover:bg-blue-500/25 transition-colors"
                          >
                            Markera fysiskt signerat
                          </button>
                        )}

                        {isOrganizer && req.status !== 'archived' && (
                          <button
                            onClick={() => handleStatusChange(req.id, 'archived')}
                            className="px-4 py-2 bg-[#F0E8D8]/5 text-[#F0E8D8]/40 border border-[#F0E8D8]/15 text-[10px] uppercase tracking-[0.1em] font-medium rounded-sm hover:bg-[#F0E8D8]/10 transition-colors"
                          >
                            Arkivera
                          </button>
                        )}
                      </div>

                      {done && req.targetName && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-sm">
                          <p className="text-blue-400 text-sm">
                            Kontot för {req.targetName} har spärrats.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
