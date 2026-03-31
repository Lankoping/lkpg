import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getTicketsFn, deleteTicketFn, updateTicketStatusFn, getEventsForTicketsFn, verifyTicketByCodeFn } from '../../../server/functions/tickets'
import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle, XCircle, Search, Ticket, Mail, User, Calendar, QrCode, Settings, Copy, Check, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'

const stockholmTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Stockholm',
})

function formatStockholmTime(value: Date | string | null | undefined, fallback = '') {
  if (!value) return fallback
  return stockholmTimeFormatter.format(new Date(value))
}

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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Biljetter</p>
        <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground flex items-center gap-3">
              <Ticket className="w-8 h-8 text-primary" />
              Biljetthantering
            </h1>
            <p className="text-muted-foreground mt-2">Utfärda och hantera biljetter för dina event.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => navigate({ to: '/admin/tickets/events' })}
              className="px-4 py-2.5 border border-border text-muted-foreground text-xs uppercase tracking-wider font-medium hover:text-foreground hover:border-primary/50 transition-all inline-flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Events
            </button>
            <button 
              onClick={() => navigate({ to: '/admin/tickets/types' })}
              className="px-4 py-2.5 border border-border text-muted-foreground text-xs uppercase tracking-wider font-medium hover:text-foreground hover:border-primary/50 transition-all inline-flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Typer
            </button>
            <button 
              onClick={handleManualVerification}
              className="px-4 py-2.5 border border-border text-muted-foreground text-xs uppercase tracking-wider font-medium hover:text-foreground hover:border-primary/50 transition-all inline-flex items-center gap-2"
            >
              <Ticket className="w-4 h-4" />
              Ange Kod
            </button>
            <button 
              onClick={() => navigate({ to: '/admin/tickets/new' })}
              className="px-4 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-wider font-medium hover:bg-primary/90 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ny biljett
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Sök på namn, e-post, kod eller event..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 pl-10 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
            />
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="p-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Kod</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Deltagare</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Typ & Pris</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Status</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-secondary/30 transition-colors group">
                  <td className="p-4 whitespace-nowrap">
                    <span className="font-mono text-xs bg-secondary px-2 py-1 border border-border text-foreground">
                      {ticket.ticketCode}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col min-w-[120px]">
                      <span className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                       <User className="w-3 h-3 text-muted-foreground" />
                       <span className="truncate">{ticket.participantName}</span>
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                       <Calendar className="w-3 h-3" />
                       <span className="truncate">{getEventTitle(ticket.eventId)}</span>
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col whitespace-nowrap">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-primary">{ticket.ticketType}</span>
                    <span className="text-sm font-mono text-foreground">{ticket.pricePaid} SEK</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col min-w-[100px]">
                    <div className={`px-2 py-1 text-[10px] font-medium uppercase tracking-wider border mb-1.5 flex items-center justify-between transition-all ${
                      ticket.status === 'valid' ? 'border-green-500/30 text-green-600 bg-green-50' :
                      ticket.status === 'used' ? 'border-blue-500/30 text-blue-600 bg-blue-50' :
                      'border-red-500/30 text-red-600 bg-red-50'
                    }`}>
                      <select 
                        value={ticket.status}
                        onChange={(e) => handleUpdateStatus(ticket.id, e.target.value as any)}
                        className="bg-transparent outline-none cursor-pointer w-full"
                      >
                        <option value="valid">Giltig</option>
                        <option value="used">Använd</option>
                        <option value="cancelled">Annullerad</option>
                      </select>
                    </div>
                    {ticket.scannedAt && (
                      <div className="flex flex-col mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Skannad: {formatStockholmTime(ticket.scannedAt)}
                        </span>
                        {ticket.scannedByName && (
                          <span className="text-[10px] text-primary font-medium mt-0.5">
                            Av: {ticket.scannedByName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => handleCopyLink(ticket.ticketCode, ticket.id)}
                      className={`p-2 transition-all flex items-center gap-1 ${
                        copiedId === ticket.id ? 'text-green-600 bg-green-50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                      title="Kopiera länk"
                    >
                      {copiedId === ticket.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => setSelectedTicket(ticket)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                      title="Visa QR"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(ticket.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
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
                <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                  Inga biljetter hittades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {verificationResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/80 backdrop-blur-md" onClick={() => setVerificationResult(null)}>
          <div className={`w-full max-w-sm p-8 bg-card border ${
            !verificationResult.success || !verificationResult.checkingIn
              ? 'border-destructive/30'
              : 'border-green-500/30'
          } relative overflow-hidden text-center`} onClick={e => e.stopPropagation()}>
            
            <button 
              onClick={() => setVerificationResult(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="mb-6 flex justify-center">
              {verificationResult.success ? (
                verificationResult.checkingIn ? (
                  <div className="p-4 bg-green-100 border border-green-300">
                    <ShieldCheck className="w-12 h-12 text-green-600" />
                  </div>
                ) : (
                  <div className="p-4 bg-orange-100 border border-orange-300">
                    <AlertTriangle className="w-12 h-12 text-orange-600" />
                  </div>
                )
              ) : (
                <div className="p-4 bg-red-100 border border-red-300">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
              )}
            </div>

            <h3 className="font-display text-2xl text-foreground mb-1">
              {verificationResult.success 
                ? (verificationResult.checkingIn ? 'Godkänd Incheckning' : (verificationResult.ticket.status === 'used' ? 'Biljett Redan Använd' : 'Biljett Ogiltig')) 
                : 'Ogiltig Kod'}
            </h3>
            
            {verificationResult.ticket && (
              <div className="mt-6 text-left space-y-4 border-t border-border pt-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-medium text-primary">Deltagare</p>
                  <p className="text-lg font-medium text-foreground">{verificationResult.ticket.participantName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-medium text-primary">Event</p>
                  <p className="text-sm text-foreground">{verificationResult.event?.title || 'Okänt event'}</p>
                </div>
                <div className="bg-secondary p-2 border border-border text-center font-mono text-xs text-muted-foreground">
                  {verificationResult.ticket.ticketCode}
                </div>
              </div>
            )}

            {!verificationResult.success && (
              <p className="text-sm text-destructive mt-4">{verificationResult.message}</p>
            )}

            <button 
              onClick={() => setVerificationResult(null)}
              className="w-full mt-8 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-medium hover:bg-primary/90 transition-all"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/80 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="bg-card border border-border p-8 max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedTicket(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-6 h-6" />
            </button>
            
            <div className="text-center space-y-6">
              <div>
                <h3 className="font-display text-xl text-foreground mb-1">{selectedTicket.participantName}</h3>
                <p className="text-muted-foreground text-xs uppercase tracking-wider">{getEventTitle(selectedTicket.eventId)}</p>
              </div>

              <div className="bg-white p-4 inline-block border border-border">
                <QRCodeSVG value={`${verificationUrl}${selectedTicket.ticketCode}`} size={200} level="H" />
              </div>

              <div className="space-y-2">
                <p className="font-mono text-sm bg-secondary py-2 border border-border text-foreground">
                  {selectedTicket.ticketCode}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Skanna för att verifiera</p>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full py-3 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-medium hover:bg-primary/90 transition-all"
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
