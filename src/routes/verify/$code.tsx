import { createFileRoute } from '@tanstack/react-router'
import { verifyTicketByCodeFn } from '../../server/functions/tickets'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Ticket, Calendar, User, Mail, ShieldCheck, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/verify/$code')({
  component: VerifyTicket,
})

function VerifyTicket() {
  const { code } = Route.useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await verifyTicketByCodeFn({ data: code })
        setData(res)
      } catch (err) {
        console.error(err)
        setData({ success: false, message: 'Nätverksfel vid verifiering' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#100E0C] text-[#F0E8D8] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-[#C04A2A] animate-spin mb-4" />
        <p className="font-display text-xl tracking-wider">Verifierar biljett...</p>
      </div>
    )
  }

  const { success, ticket, event, message } = data

  return (
    <div className="min-h-screen bg-[#100E0C] text-[#F0E8D8] flex flex-col items-center justify-center p-6">
       <div className="absolute inset-0 bg-[linear-gradient(to_right,#C04A2A08_1px,transparent_1px),linear-gradient(to_bottom,#C04A2A08_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
       
       <div className={`w-full max-w-md p-8 border ${
          !success || ticket?.status !== 'valid' 
            ? 'border-red-500/30 bg-red-500/5 shadow-[0_0_40px_rgba(239,68,68,0.1)]' 
            : 'border-green-500/30 bg-green-500/5 shadow-[0_0_40px_rgba(34,197,94,0.1)]'
        } rounded-sm relative overflow-hidden text-center`}>
          
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C04A2A]/20 to-transparent" />
          
          <div className="mb-6 flex justify-center">
            {success ? (
              ticket.status === 'valid' ? (
                <div className="p-4 bg-green-500/20 rounded-full border border-green-500/40">
                   <ShieldCheck className="w-10 h-10 text-green-400" />
                </div>
              ) : ticket.status === 'used' ? (
                <div className="p-4 bg-orange-500/20 rounded-full border border-orange-500/40">
                   <AlertTriangle className="w-10 h-10 text-orange-400" />
                </div>
              ) : (
                <div className="p-4 bg-red-500/20 rounded-full border border-red-500/40">
                   <XCircle className="w-10 h-10 text-red-400" />
                </div>
              )
            ) : (
               <div className="p-4 bg-red-500/20 rounded-full border border-red-500/40">
                  <XCircle className="w-10 h-10 text-red-400" />
               </div>
            )}
          </div>

          <h1 className="font-display text-3xl tracking-wide mb-2">
            {success 
              ? (ticket.status === 'valid' ? 'Giltig Biljett' : ticket.status === 'used' ? 'Biljett Redan Använd' : 'Biljett Ogiltig') 
              : 'Ogiltig Kod'}
          </h1>
          <p className="text-[#F0E8D8]/50 text-xs font-mono uppercase tracking-[3px] mb-8">
            {code}
          </p>

          {success && ticket && (
            <div className="space-y-6 text-left border-t border-[#C04A2A]/10 pt-6">
              <div className="flex items-start gap-4">
                <Calendar className="w-5 h-5 text-[#C04A2A]/60 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#C04A2A]/80 font-bold mb-1">Event</p>
                  <p className="text-lg font-medium">{event?.title || 'Okänt event'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <User className="w-5 h-5 text-[#C04A2A]/60 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#C04A2A]/80 font-bold mb-1">Deltagare</p>
                  <p className="text-lg font-medium">{ticket.participantName}</p>
                  <p className="text-xs text-[#F0E8D8]/40">{ticket.participantEmail}</p>
                </div>
              </div>
            </div>
          )}

          {!success && (
            <p className="text-sm text-red-400 mt-4">{message}</p>
          )}

          <div className="mt-10">
             <a href="/" className="px-8 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-sm hover:translate-y-[-2px] active:translate-y-0 transition-all inline-block">
               Hem till webbplatsen
             </a>
          </div>
       </div>
    </div>
  )
}
