import { createFileRoute } from '@tanstack/react-router'
import { verifyTicketByCodeFn } from '../../../server/functions/tickets'
import { useState, useEffect } from 'react'
import { Ticket, Calendar, User, MapPin, QrCode, Loader2, Clock, Mail } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export const Route = createFileRoute('/_public/biljett/$code')({
  component: PublicTicketView,
})

function PublicTicketView() {
  const { code } = Route.useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Use markAsUsed: false so viewing the ticket doesn't check the user in
        const res = await verifyTicketByCodeFn({ data: { code, markAsUsed: false } })
        setData(res)
      } catch (err) {
        console.error(err)
        setData({ success: false, message: 'Kunde inte ladda biljetten' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#100E0C] text-[#F0E8D8] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-[#C04A2A] animate-spin mb-4" />
        <p className="font-display text-xl tracking-wider uppercase opacity-50">Laddar Digital Biljett...</p>
      </div>
    )
  }

  if (!data?.success || !data?.ticket) {
    return (
      <div className="min-h-screen bg-[#100E0C] text-[#F0E8D8] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
          <Ticket className="w-10 h-10 text-red-500/50" />
        </div>
        <h1 className="font-display text-3xl mb-2">Biljetten hittades inte</h1>
        <p className="text-[#F0E8D8]/50 max-w-xs mb-8">Koden {code} verkar inte vara giltig eller så har biljetten tagits bort.</p>
        <a href="/" className="px-8 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-sm hover:bg-[#A03A1A] transition-all">
          Gå till startsidan
        </a>
      </div>
    )
  }

  const { ticket, event } = data
  const statusColors = {
    valid: 'text-green-400 border-green-500/30 bg-green-500/5',
    used: 'text-orange-400 border-orange-500/30 bg-orange-500/5',
    cancelled: 'text-red-400 border-red-500/30 bg-red-500/5'
  }
  const statusLabels = {
    valid: 'Giltig',
    used: 'Använd',
    cancelled: 'Ogiltig'
  }

  return (
    <div className="min-h-screen bg-[#100E0C] text-[#F0E8D8] py-12 px-4 flex flex-col items-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#C04A2A08_0%,transparent_70%)] pointer-events-none" />
      
      <div className="w-full max-w-md bg-[#1A1816] border border-[#C04A2A]/20 rounded-sm relative overflow-hidden shadow-2xl">
        {/* Decorative Top Bar */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#C04A2A] to-transparent w-full opacity-60" />
        
        {/* Header */}
        <div className="p-8 text-center border-b border-[#C04A2A]/10">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
             <Ticket className="w-5 h-5 text-[#C04A2A]" />
             <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#C04A2A]">Digital Biljett</span>
          </div>
          <h1 className="font-display text-2xl tracking-tight mb-1">{event?.title || 'Event'}</h1>
          <div className="flex items-center justify-center gap-2 text-[#F0E8D8]/40 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            {event?.date ? new Date(event.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Datum saknas'}
          </div>
        </div>

        {/* QR Code Section */}
        <div className="p-10 flex flex-col items-center bg-[#141210]/50">
          <div className="bg-white p-4 rounded-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] mb-6">
            <QRCodeSVG 
              value={`${window.location.origin}/verify/${ticket.ticketCode}`} 
              size={220} 
              level="H"
              includeMargin={false}
            />
          </div>
          
          <div className="text-center">
            <p className="font-mono text-lg tracking-widest text-[#F0E8D8] mb-1">{ticket.ticketCode}</p>
            <div className={`inline-flex items-center px-3 py-1 rounded-sm border text-[10px] uppercase font-bold tracking-widest ${statusColors[ticket.status as keyof typeof statusColors]}`}>
              {statusLabels[ticket.status as keyof typeof statusColors]}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-[#C04A2A]/5 border border-[#C04A2A]/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#C04A2A]/60" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#C04A2A]/80 font-bold mb-0.5">Deltagare</p>
                <p className="text-lg font-medium">{ticket.participantName}</p>
                <p className="text-xs text-[#F0E8D8]/40 truncate">{ticket.participantEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-[#C04A2A]/5 border border-[#C04A2A]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#C04A2A]/60" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#C04A2A]/80 font-bold mb-0.5">Plats</p>
                <p className="text-lg font-medium leading-tight">{event?.location || 'Plats meddelas senare'}</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#C04A2A]/10">
            <div className="bg-[#100E0C] p-4 border border-[#C04A2A]/10 rounded-sm">
                <p className="text-[10px] uppercase tracking-widest text-[#F0E8D8]/40 mb-3 block text-center italic">Instruktioner</p>
                <ul className="text-xs text-[#F0E8D8]/60 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-[#C04A2A] font-bold">•</span>
                    Ha denna sida öppen när du anländer till eventet.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C04A2A] font-bold">•</span>
                    Visa QR-koden för funktionären i entrén.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#C04A2A] font-bold">•</span>
                    Biljetten är personlig och kan endast skannas en gång.
                  </li>
                </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#C04A2A]/5 border-t border-[#C04A2A]/10 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-[#F0E8D8]/30">Utfärdad av Lanköping</p>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-[#F0E8D8]/20 text-center max-w-xs leading-relaxed">
        Vid frågor eller problem med din biljett, kontakta support på lankoping.se
      </p>
    </div>
  )
}