import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { ArrowLeft, Scan, CheckCircle, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/tickets/scan')({
  component: TicketScanner,
})

function TicketScanner() {
  const navigate = useNavigate()
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [scanResult, setScanResult] = useState<string | null>(null)

  useEffect(() => {
    // Initialisera skannern
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner

    scanner.render((result) => {
      // Lyckad skanning!
      setScanResult(result)
      scanner.pause()
      
      // Vi navigerar till verifieringssidan (eller hanterar här men navigering är enklare)
      // Om koden är en URL (vilket våra QR-koder är), extrahera koden
      let code = result
      if (result.includes('/verify/')) {
        code = result.split('/verify/')[1]
      }
      
      // Vänta lite så användaren ser resultatet (om vi vill visa status här)
      // Men bäst är att bara navigera till den publika verifieringssidan som vi precis byggde
      window.location.href = `/verify/${code}`
      
    }, (error) => {
      // Tysta felmeddelanden under skanning
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [])

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden flex flex-col items-center">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="w-full flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3">
            <Scan className="w-8 h-8 text-[#C04A2A]" />
            Skanna Biljetter
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Verifiera biljetter genom att skanna QR-koden.</p>
        </div>
        <button 
          onClick={() => navigate({ to: '/admin/tickets' })}
          className="px-6 py-3 border border-[#C04A2A]/20 text-[#F0E8D8]/80 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:border-[#C04A2A]/50 hover:bg-[#C04A2A]/5 transition-all inline-flex items-center gap-2 justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
          Avbryt
        </button>
      </div>

      <div className="w-full max-w-lg bg-white/5 p-6 rounded-sm border border-[#C04A2A]/10">
        <div id="reader" className="overflow-hidden rounded-sm border border-[#C04A2A]/20"></div>
        {scanResult && (
           <p className="mt-4 text-center font-mono text-xs text-[#C04A2A]">
             Skannat: {scanResult}
           </p>
        )}
      </div>

      <div className="mt-8 text-center text-[#F0E8D8]/40 text-xs max-w-sm">
        <p className="mb-2">Tillåt kameran att skanna QR-koder. Håll koden stadig i ramen för att registrera den.</p>
        <p className="italic">När koden skannas skickas du till verifieringssidan.</p>
      </div>
    </div>
  )
}
