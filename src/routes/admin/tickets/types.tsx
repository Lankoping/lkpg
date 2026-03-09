import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getTicketTypesFn, createTicketTypeFn, deleteTicketTypeFn } from '../../../server/functions/tickets'
import { useState } from 'react'
import { Plus, Trash2, Tag, Save, ArrowLeft, Settings } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/tickets/types')({
  loader: async () => {
    return await getTicketTypesFn()
  },
  component: TicketTypesAdmin,
})

function TicketTypesAdmin() {
  const types = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    description: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) return

    setIsSubmitting(true)
    try {
      await createTicketTypeFn({ data: formData })
      setFormData({ name: '', price: 0, description: '' })
      await router.invalidate()
    } catch (err) {
      console.error(err)
      alert('Kunde inte skapa biljettyp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Är du säker på att du vill radera denna biljettyp?')) {
      try {
        await deleteTicketTypeFn({ data: id })
        await router.invalidate()
      } catch (err) {
        console.error(err)
        alert('Kunde inte radera biljettyp.')
      }
    }
  }

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3">
            <Settings className="w-8 h-8 text-[#C04A2A]" />
            Hantera Biljettyper
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Skapa och konfigurera de biljettyper som kan utfärdas.</p>
        </div>
        <button 
          onClick={() => navigate({ to: '/admin/tickets' })}
          className="px-6 py-3 border border-[#C04A2A]/20 text-[#F0E8D8]/80 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:border-[#C04A2A]/50 hover:bg-[#C04A2A]/5 transition-all inline-flex items-center gap-2 justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till Biljetter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="space-y-6 bg-[#1A1816]/40 p-6 border border-[#C04A2A]/10 rounded-sm sticky top-0">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#C04A2A]/80 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Skapa Ny Typ
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Namn</label>
              <input 
                type="text" 
                placeholder="t.ex. VIP, Early Bird"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Standardpris (SEK)</label>
              <input 
                type="number" 
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Beskrivning</label>
              <textarea 
                placeholder="Valfri beskrivning..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all min-h-[100px]"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.25em] font-bold rounded-sm hover:bg-[#A03A1A] disabled:opacity-50 transition-all flex items-center gap-2 justify-center"
            >
              <Save className="w-4 h-4" />
              Spara Biljettyp
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="grid gap-4">
            {types.map((type) => (
              <div key={type.id} className="p-5 bg-[#1A1816]/60 border border-[#C04A2A]/10 rounded-sm flex justify-between items-center group hover:border-[#C04A2A]/30 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#C04A2A]/10 rounded-sm border border-[#C04A2A]/20 group-hover:bg-[#C04A2A]/20">
                    <Tag className="w-5 h-5 text-[#C04A2A]" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg tracking-wide">{type.name}</h4>
                    <p className="text-[#C04A2A]/80 font-mono text-sm">{type.price} SEK</p>
                    {type.description && <p className="text-[#F0E8D8]/40 text-xs mt-1 italic">{type.description}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(type.id)}
                  className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {types.length === 0 && (
              <div className="p-12 text-center text-[#F0E8D8]/20 font-serif italic text-lg border-2 border-dashed border-[#C04A2A]/10">
                Inga biljettyper skapade än.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
