import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getEventsFn, createEventFn, deleteEventFn } from '../../../server/functions/tickets'
import { useState } from 'react'
import { Plus, Trash2, Calendar as CalendarIcon, Save, ArrowLeft, MapPin, Image as ImageIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/tickets/events')({
  loader: async () => {
    return await getEventsFn()
  },
  component: EventsAdmin,
})

function EventsAdmin() {
  const events = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    image: '',
    published: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.date) return

    setIsSubmitting(true)
    try {
      await createEventFn({ data: formData })
      setFormData({ 
        title: '', 
        description: '', 
        date: '', 
        location: '', 
        image: '', 
        published: false 
      })
      await router.invalidate()
    } catch (err) {
      console.error(err)
      alert('Kunde inte skapa event.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Är du säker på att du vill radera detta event?')) {
      try {
        await deleteEventFn({ data: id })
        await router.invalidate()
      } catch (err) {
        console.error(err)
        alert('Kunde inte radera event.')
      }
    }
  }

  return (
    <div className="bg-[#141210]/95 border border-[#C04A2A]/20 p-5 sm:p-8 lg:p-10 rounded-sm text-[#F0E8D8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C04A2A]/50 to-transparent opacity-50" />
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide mb-2 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-[#C04A2A]" />
            Hantera Events
          </h2>
          <p className="text-[#F0E8D8]/60 text-sm">Skapa och konfigurera events att sälja biljetter till.</p>
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
              Skapa Nytt Event
            </h3>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Titel</label>
              <input 
                type="text" 
                placeholder="Namn på eventet"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Datum & Tid</label>
              <input 
                type="datetime-local" 
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-[#C04A2A]" /> Plats
              </label>
              <input 
                type="text" 
                placeholder="Eventets adress/lokal"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#C04A2A]/80">Beskrivning</label>
              <textarea 
                placeholder="Vad handlar eventet om?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono transition-all min-h-[100px]"
              />
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="published"
                checked={formData.published}
                onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
                className="accent-[#C04A2A]"
              />
              <label htmlFor="published" className="text-xs uppercase tracking-wider text-[#F0E8D8]/70">Publicera direkt</label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.25em] font-bold rounded-sm hover:bg-[#A03A1A] disabled:opacity-50 transition-all flex items-center gap-2 justify-center shadow-lg"
            >
              <Save className="w-4 h-4" />
              Spara Event
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="grid gap-4">
            {events.map((event) => (
              <div key={event.id} className="p-5 bg-[#1A1816]/60 border border-[#C04A2A]/10 rounded-sm flex justify-between items-center group hover:border-[#C04A2A]/30 transition-all overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
                   {event.published ? (
                     <span className="text-[8px] bg-green-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">Live</span>
                   ) : (
                     <span className="text-[8px] bg-gray-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">Draft</span>
                   )}
                 </div>
                 
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-[#C04A2A]/10 rounded-sm border border-[#C04A2A]/20 group-hover:bg-[#C04A2A]/20 shrink-0">
                    <CalendarIcon className="w-6 h-6 text-[#C04A2A]" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-display text-xl tracking-wide truncate pr-12">{event.title}</h4>
                    <div className="flex items-center gap-4 text-xs font-mono text-[#C04A2A]/80 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
                    </div>
                    {event.description && <p className="text-[#F0E8D8]/40 text-xs mt-3 line-clamp-2 italic leading-relaxed">{event.description}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(event.id)}
                  className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all ml-4 shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {events.length === 0 && (
              <div className="p-12 text-center text-[#F0E8D8]/20 font-serif italic text-lg border-2 border-dashed border-[#C04A2A]/10">
                Inga event skapade än.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
