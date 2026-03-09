import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getTicketsFn, deleteTicketFn, updateTicketStatusFn, getEventsForTicketsFn } from '../../../server/functions/tickets'
import { useState } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, Search, Ticket, Mail, User, Calendar, QrCode, Scan, Settings } from 'lucide-react'
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

  const verificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify/` : ''

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3">
            <Ticket className="w-8 h-8 text-[#C04A2A]" />
            Biljetthantering
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Utfärda och hantera biljetter för dine event.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate({ to: '/admin/tickets/events' })}
            className="px-6 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Calendar className="w-4 h-4" />
            Hantera Events
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/types' })}
            className="px-6 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Settings className="w-4 h-4" />
            Konfigurera Typer
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/scan' })}
            className="px-6 py-3 border border-[#C04A2A]/40 text-[#F0E8D8] text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#C04A2A]/10 transition-all inline-flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <Scan className="w-4 h-4" />
            Skanna Biljett
          </button>
          <button 
            onClick={() => navigate({ to: '/admin/tickets/new' })}
            className="px-6 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2 justify-center shadow-[0_0_15px_rgba(192,74,42,0.3)] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Utfärda Ny Biljett
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
              <th className="p-4 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Kod</th>
              <th className="p-4 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Deltagare</th>
              <th className="p-4 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Typ & Pris</th>
              <th className="p-4 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Status</th>
              <th className="p-4 text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80 text-right">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C04A2A]/5">
            {filteredTickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-[#C04A2A]/5 transition-colors group">
                <td className="p-4">
                  <span className="font-mono text-xs bg-[#100E0C] px-2 py-1 border border-[#C04A2A]/20 rounded-sm group-hover:border-[#C04A2A]/40 text-[#F0E8D8]">
                    {ticket.ticketCode}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium flex items-center gap-2">
                       <User className="w-3 h-3 text-[#C04A2A]/40" />
                       {ticket.participantName}
                    </span>
                    <span className="text-xs text-[#F0E8D8]/40 flex items-center gap-2">
                       <Calendar className="w-3 h-3 text-[#C04A2A]/40" />
                       {getEventTitle(ticket.eventId)}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#C04A2A]/80">{ticket.ticketType}</span>
                    <span className="text-xs font-mono">{ticket.pricePaid} SEK</span>
                  </div>
                </td>
                <td className="p-4">
                  <select 
                    value={ticket.status}
                    onChange={(e) => handleUpdateStatus(ticket.id, e.target.value as any)}
                    className={`px-2 py-1 text-[9px] font-medium uppercase tracking-wider rounded-sm border bg-[#100E0C] outline-none cursor-pointer transition-all ${
                      ticket.status === 'valid' ? 'border-green-500/30 text-green-400' :
                      ticket.status === 'used' ? 'border-blue-500/30 text-blue-400' :
                      'border-red-500/30 text-red-400'
                    }`}
                  >
                    <option value="valid">Giltig</option>
                    <option value="used">Använd</option>
                    <option value="cancelled">Annullerad</option>
                  </select>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-1.5 text-[#C04A2A]/60 hover:text-[#C04A2A] hover:bg-[#C04A2A]/10 rounded-sm transition-all"
                      title="Visa QR-kod"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    {ticket.status === 'valid' && (
                      <button 
                        onClick={() => handleUpdateStatus(ticket.id, 'used')}
                        className="p-1.5 text-blue-400/60 hover:text-blue-400 hover:bg-blue-400/10 rounded-sm transition-all"
                        title="Markera som använd"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {ticket.status !== 'cancelled' && (
                      <button 
                        onClick={() => handleUpdateStatus(ticket.id, 'cancelled')}
                        className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-all"
                        title="Annullera"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(ticket.id)}
                      className="p-1.5 text-gray-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                      title="Radera"
                    >
                      <Trash2 className="w-4 h-4" />
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
