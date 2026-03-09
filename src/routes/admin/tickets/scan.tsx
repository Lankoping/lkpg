import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { ArrowLeft, Scan, CheckCircle, XCircle, AlertTriangle, ShieldCheck, User, Calendar, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { verifyTicketByCodeFn } from '../../../server/functions/tickets'

export const Route = createFileRoute('/admin/tickets/scan')({
  component: TicketScanner,
})

function TicketScanner() {
  const navigate = useNavigate()
  const router = useRouter()
  const [scanResult, setScanResult] = useState<any>(null)
  const [isScanning, setIsScanning] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isScanning) return

    // Initialisera skannern
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    async function onScanSuccess(result: string) {
      if (processing) return
      setProcessing(true)
      
      // Extract code if it's a full URL
      let code = result
      if (result.includes('/verify/')) {
        code = result.split('/verify/').pop() || result
      } else if (result.includes('/biljett/')) {
        code = result.split('/biljett/').pop() || result
      }
      
      try {
        await scanner.clear()
        setIsScanning(false)
        const res = await verifyTicketByCodeFn({ data: { code: code.trim().toUpperCase(), markAsUsed: true } })
        setScanResult(res)
        await router.invalidate()
      } catch (err) {
        console.error(err)
        setError('Kunde inte verifiera biljetten')
      } finally {
        setProcessing(false)
      }
    }

    function onScanFailure(error: any) {
      // Tysta felmeddelanden under skanning
    }

    scanner.render(onScanSuccess, onScanFailure)

    return () => {
      scanner.clear().catch(console.error)
    }
  }, [isScanning, processing])

  const resetScanner = () => {
    setScanResult(null)
    setError(null)
    setIsScanning(true)
  }

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden flex flex-col items-center">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="w-full flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3">
            <Scan className="w-8 h-8 text-[#C04A2A]" />
            Biljettskanner
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Verifiera biljetter genom att skanna QR-koden.</p>
        </div>
        <button 
          onClick={() => navigate({ to: '/admin/tickets' })}
          className="px-6 py-3 border border-[#C04A2A]/20 text-[#F0E8D8]/80 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:border-[#C04A2A]/50 hover:bg-[#C04A2A]/5 transition-all inline-flex items-center gap-2 justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka
        </button>
      </div>

      <div className="w-full max-w-lg">
        {isScanning && (
          <div className="bg-white/5 p-6 rounded-sm border border-[#C04A2A]/10">
            <div id="reader" className="overflow-hidden rounded-sm border border-[#C04A2A]/20"></div>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
             <Loader2 className="w-12 h-12 text-[#C04A2A] animate-spin" />
             <p className="font-display text-lg uppercase tracking-wider opacity-50">Verifierar...</p>
          </div>
        )}

        {scanResult && (
          <div className={`p-8 border ${
            !scanResult.success || (scanResult.ticket && scanResult.ticket.status !== 'used')
              ? 'border-red-500/30 bg-red-500/10 shadow-[0_0:50px_rgba(239,68,68,0.2)]'
              : 'border-green-500/30 bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.2)]'
          } rounded-sm text-center animate-in fade-in zoom-in duration-300`}>
            
            <div className="mb-6 flex justify-center">
              {scanResult.success ? (
                scanResult.ticket.status === 'used' ? (
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

            <h3 className="font-display text-2xl tracking-wide mb-1 uppercase">
              {scanResult.success 
                ? (scanResult.ticket.status === 'used' ? 'Godkänd Incheckning' : 'Biljett Redan Använd') 
                : 'Ogiltig Kod'}
            </h3>

            {scanResult.ticket && (
              <div className="mt-8 text-left space-y-5 border-t border-[#C04A2A]/20 pt-8">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[#C04A2A]/50 mt-1" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Deltagare</p>
                    <p className="text-xl font-medium">{scanResult.ticket.participantName}</p>
                    <p className="text-xs text-[#F0E8D8]/40">{scanResult.ticket.participantEmail}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#C04A2A]/50 mt-1" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C04A2A]/80">Event</p>
                    <p className="text-sm font-medium">{scanResult.event?.title || 'Okänt event'}</p>
                  </div>
                </div>
                <div className="bg-black/50 p-3 rounded-sm border border-[#C04A2A]/10 text-center font-mono text-xs text-[#F0E8D8]/60 mt-4">
                  {scanResult.ticket.ticketCode}
                </div>
              </div>
            )}

            {!scanResult.success && (
              <p className="text-sm text-red-400 mt-6 bg-red-500/10 p-4 border border-red-500/20 rounded-sm">
                {scanResult.message || 'Biljetten kunde inte hittas i systemet.'}
              </p>
            )}

            <button 
              onClick={resetScanner}
              className="w-full mt-10 py-4 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.3em] font-black rounded-sm hover:translate-y-[-2px] hover:shadow-[0_0_20px_rgba(192,74,42,0.4)] active:translate-y-0 transition-all font-display"
            >
              Nästa Skanning
            </button>
          </div>
        )}

        {error && (
          <div className="p-8 border border-red-500/30 bg-red-500/10 rounded-sm text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="font-display text-xl mb-2 italic">Ett fel uppstod</h3>
            <p className="text-sm text-red-300 opacity-60 mb-6">{error}</p>
            <button 
              onClick={resetScanner}
              className="px-8 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-sm hover:bg-[#A03A1A] transition-all"
            >
              Försök igen
            </button>
          </div>
        )}
      </div>

      {isScanning && (
        <div className="mt-8 text-center text-[#F0E8D8]/40 text-xs max-w-sm">
          <p className="mb-2 uppercase tracking-widest font-black text-white/20">Instruktioner</p>
          <p className="italic">Tillåt kameran att skanna QR-koder. Håll koden stadig i ramen för att registrera den.</p>
        </div>
      )}
    </div>
  )
}
