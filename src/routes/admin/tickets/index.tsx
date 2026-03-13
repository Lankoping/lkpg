import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getTicketsFn, deleteTicketFn, updateTicketStatusFn, getEventsForTicketsFn, verifyTicketByCodeFn } from '../../../server/functions/tickets'
import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, Search, Ticket, Mail, User, Calendar, QrCode, Scan, Settings, Copy, Check, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'

export const Route = createFileRoute('/admin/tickets/')({
  loader: async () => {
    const [tickets, events] = await Promise.all([
      getTicketsFn(),
      getEventsForTicketsFn()
    ])
    return { tickets, events }
  },
  component: TicketsAdmin,
})

function TicketsAdmin() {
  const { tickets, events } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<typeof tickets[0] | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [verificationUrl, setVerificationUrl] = useState('')

  useEffect(() => {
    setVerificationUrl(`${window.location.origin}/verify/`)
  }, [])

  const handleManualVerification = async () => {
    const code = window.prompt('Ange biljettkod (t.ex. TKT-ABC123XY):')
    if (!code) return

    try {
      const res = await verifyTicketByCodeFn({ data: { code: code.trim().toUpperCase(), markAsUsed: true } })
      setVerificationResult(res)
      await router.invalidate()
    } catch (err) {
      console.error(err)
      alert('Verifiering misslyckades')
    }
  }

  const handleCopyLink = (code: string, ticketId: number) => {
    const url = `${window.location.origin}/biljett/${code}`
    navigator.clipboard.writeText(url)
    setCopiedId(ticketId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Är du säker på att du vill radera denna biljett?')) {
      try {
        await deleteTicketFn({ data: id })
        await router.invalidate()
      } catch (err) {
        console.error(err)
        alert('Kunde inte radera biljetten')
      }
    }
  }

  const handleUpdateStatus = async (id: number, status: 'valid' | 'used' | 'cancelled') => {
    try {
      await updateTicketStatusFn({ data: { ticketId: id, status } })
      await router.invalidate()
    } catch (err) {
      console.error(err)
      alert('Kunde inte uppdatera status')
    }
  }

  const getEventTitle = (eventId: number) => {
    return events.find(e => e.id === eventId)?.title || 'Okänt event'
  }

  const filteredTickets = tickets.filter(ticket => {
    const searchLower = searchQuery.toLowerCase()
    const eventTitle = getEventTitle(ticket.eventId).toLowerCase()
    return (
      ticket.participantName.toLowerCase().includes(searchLower) ||
      ticket.participantEmail.toLowerCase().includes(searchLower) ||
      ticket.ticketCode.toLowerCase().includes(searchLower) ||
      eventTitle.includes(searchLower)
    )
  })

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-visible">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3 text-[#C04A2A]">
            <Ticket className="w-8 h-8" />
            Biljetthantering
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Utfärda och hantera biljetter för dina event.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          <button 
            onClick={() => navigate({ to: '/admin/tickets/events' })}
            className="px-4 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.12em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5" />
            Events
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/types' })}
            className="px-4 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.12em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            Typer
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/scan' })}
            className="px-4 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.12em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Scan className="w-3.5 h-3.5" />
            Skanna
          </button>
          <button 
            onClick={handleManualVerification}
            className="px-4 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.12em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Ticket className="w-3.5 h-3.5" />
            Ange Kod
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/new' })}
            className="px-4 py-3 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.12em] font-medium rounded-sm hover:bg-[#A03A1A] hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2 justify-center shadow-[0_0_15px_rgba(192,74,42,0.3)] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Ny biljett
          </button>
        </div>
      </div>

      <div className="mb-8 p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Sök på namn, e-post, kod eller event..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 pl-10 bg-[#100E0C] border border-[#C04A2A]/15 focus:border-[#C04A2A]/50 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all placeholder:text-[#F0E8D8]/20"
          />
          <Search className="absolute left-3 top-3 w-4 h-4 text-[#C04A2A]/40" />
        </div>
      </div>

      <div className="overflow-x-auto border border-[#C04A2A]/10 rounded-sm bg-[#1A1816]/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#C04A2A]/20 bg-[#C04A2A]/5">
              <th className="p-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Kod</th>
              <th className="p-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Deltagare</th>
              <th className="p-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Typ & Pris</th>
              <th className="p-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Status</th>
              <th className="p-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80 text-right">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C04A2A]/5">
            {filteredTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-[#C04A2A]/5 transition-colors group">
                <td className="p-3 whitespace-nowrap">
                  <span className="font-mono text-[11px] bg-[#100E0C] px-1.5 py-1 border border-[#C04A2A]/20 rounded-sm group-hover:border-[#C04A2A]/40 text-[#F0E8D8]">
                    {ticket.ticketCode}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-col min-w-[120px]">
                    <span className="text-xs font-medium flex items-center gap-1.5 text-[#F0E8D8]">
                       <User className="w-3 h-3 text-[#C04A2A]/40" />
                       <span className="truncate">{ticket.participantName}</span>
                    </span>
                    <span className="text-[10px] text-[#F0E8D8]/40 flex items-center gap-1.5 mt-0.5">
                       <Calendar className="w-3 h-3 text-[#C04A2A]/40" />
                       <span className="truncate">{getEventTitle(ticket.eventId)}</span>
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-col whitespace-nowrap">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#C04A2A]/80">{ticket.ticketType}</span>
                    <span className="text-[11px] font-mono">{ticket.pricePaid} SEK</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex flex-col min-w-[100px]">
                    <div className={`px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-sm border bg-[#100E0C] mb-1.5 flex items-center justify-between transition-all ${
                      ticket.status === 'valid' ? 'border-green-500/30 text-green-400' :
                      ticket.status === 'used' ? 'border-blue-500/30 text-blue-400' :
                      'border-red-500/30 text-red-400'
                    }`}>
                      <select 
                        value={ticket.status}
                        onChange={(e) => handleUpdateStatus(ticket.id, e.target.value as any)}
                        className="bg-transparent outline-none cursor-pointer w-full py-0.5"
                      >
                        <option value="valid">Giltig</option>
                        <option value="used">Använd</option>
                        <option value="cancelled">Annullerad</option>
                      </select>
                    </div>
                    {ticket.scannedAt && (
                      <div className="flex flex-col mt-0.5">
                        <span className="text-[8px] text-[#F0E8D8]/30 uppercase tracking-tighter">
                          Skannad: {new Date(ticket.scannedAt).toLocaleString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {ticket.scannedByName && (
                          <span className="text-[8px] text-[#C04A2A]/40 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap">
                            Av: {ticket.scannedByName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button 
                      onClick={() => handleCopyLink(ticket.ticketCode, ticket.id)}
                      className={`p-1.5 transition-all rounded-sm flex items-center gap-1 border border-transparent ${
                        copiedId === ticket.id ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-[#F0E8D8]/40 hover:text-[#F0E8D8] hover:bg-[#F0E8D8]/5'
                      }`}
                      title="Kopiera länk"
                    >
                      {copiedId === ticket.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-1.5 text-[#C04A2A]/60 hover:text-[#C04A2A] hover:bg-[#C04A2A]/10 rounded-sm transition-all border border-transparent"
                      title="Visa QR"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(ticket.id)}
                      className="p-1.5 text-gray-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all border border-transparent"
                      title="Radera"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-[#F0E8D8]/30 font-serif italic text-lg">
                  Inga biljetter hittades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {verificationResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setVerificationResult(null)}>
          <div className={`w-full max-w-sm p-8 border ${
            !verificationResult.success || !verificationResult.checkingIn
              ? 'border-red-500/30 bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]'
              : 'border-green-500/30 bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.2)]'
          } rounded-sm relative overflow-hidden text-center`} onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C04A2A] to-transparent" />
            
            <button 
              onClick={() => setVerificationResult(null)}
              className="absolute top-4 right-4 text-[#F0E8D8]/40 hover:text-[#F0E8D8] transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-6 flex justify-center">
              {verificationResult.success ? (
                verificationResult.checkingIn ? (
                  <div className="p-4 bg-green-500/20 rounded-full border border-green-500/40">
                    <ShieldCheck className="w-12 h-12 text-green-400" />
                  </div>
                ) : (
                  <div className="p-4 bg-orange-500/20 rounded-full border border-orange-500/40">
                    <AlertTriangle className="w-12 h-12 text-orange-400" />
                  </div>
                )
              ) : (
                <div className="p-4 bg-red-500/20 rounded-full border border-red-500/40">
                  <XCircle className="w-12 h-12 text-red-400" />
                </div>
              )}
            </div>

            <h3 className="font-display text-2xl tracking-wide mb-1">
              {verificationResult.success 
                ? (verificationResult.checkingIn ? 'Godkänd Incheckning' : (verificationResult.ticket.status === 'used' ? 'Biljett Redan Använd' : 'Biljett Ogiltig')) 
                : 'Ogiltig Kod'}
            </h3>
            
            {verificationResult.ticket && (
              <div className="mt-6 text-left space-y-4 border-t border-[#C04A2A]/20 pt-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Deltagare</p>
                  <p className="text-lg font-medium">{verificationResult.ticket.participantName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Event</p>
                  <p className="text-sm">{verificationResult.event?.title || 'Okänt event'}</p>
                </div>
                <div className="bg-[#100E0C] p-2 rounded-sm border border-[#C04A2A]/10 text-center font-mono text-xs text-[#F0E8D8]/60">
                  {verificationResult.ticket.ticketCode}
                </div>
              </div>
            )}

            {!verificationResult.success && (
              <p className="text-sm text-red-400 mt-4">{verificationResult.message}</p>
            )}

            <button 
              onClick={() => setVerificationResult(null)}
              className="w-full mt-8 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-sm hover:bg-[#A03A1A] transition-all"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="bg-[#1A1816] border border-[#C04A2A]/40 p-8 rounded-sm max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 text-[#F0E8D8]/40 hover:text-[#F0E8D8]"
            >
              <XCircle className="w-6 h-6" />
            </button>
            
            <div className="text-center space-y-6">
              <div>
                <h3 className="font-display text-xl mb-1">{selectedTicket.participantName}</h3>
                <p className="text-[#F0E8D8]/50 text-xs uppercase tracking-wider">{getEventTitle(selectedTicket.eventId)}</p>
              </div>

              <div className="bg-white p-4 inline-block rounded-sm">
                <QRCodeSVG value={`${verificationUrl}${selectedTicket.ticketCode}`} size={200} level="H" />
              </div>

              <div className="space-y-2">
                <p className="font-mono text-sm bg-[#100E0C] py-2 border border-[#C04A2A]/20 rounded-sm">
                  {selectedTicket.ticketCode}
                </p>
                <p className="text-[10px] text-[#F0E8D8]/30 uppercase tracking-[0.2em]">Skanna för att verifiera</p>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-sm hover:bg-[#A03A1A] transition-all"
              >
                Skriv ut biljett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
