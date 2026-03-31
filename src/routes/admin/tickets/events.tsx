import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getEventsFn, createEventFn, deleteEventFn } from '../../../server/functions/tickets'
import { useState } from 'react'
import { Plus, Trash2, Calendar as CalendarIcon, Save, ArrowLeft, MapPin } from 'lucide-react'
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Biljetter</p>
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 text-primary" />
              Hantera Events
            </h1>
            <p className="text-muted-foreground mt-2">Skapa och konfigurera events att sälja biljetter till.</p>
          </div>
          <button 
            onClick={() => navigate({ to: '/admin/tickets' })}
            className="px-4 py-2.5 border border-border text-muted-foreground text-xs uppercase tracking-wider font-medium hover:text-foreground hover:border-primary/50 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-card border border-border p-6 space-y-5 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-primary" />
              <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Skapa nytt event</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Titel *</label>
              <input 
                type="text" 
                placeholder="Namn på eventet"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Datum & Tid *</label>
              <input 
                type="datetime-local" 
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-2">
                <MapPin className="w-3 h-3 text-primary" /> Plats
              </label>
              <input 
                type="text" 
                placeholder="Eventets adress/lokal"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Beskrivning</label>
              <textarea 
                placeholder="Vad handlar eventet om?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all min-h-[100px] resize-y placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="published"
                checked={formData.published}
                onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
                className="accent-primary w-4 h-4"
              />
              <label htmlFor="published" className="text-sm text-muted-foreground">Publicera direkt</label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2 justify-center"
            >
              <Save className="w-4 h-4" />
              Spara Event
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="bg-card border border-border p-5 flex justify-between items-center group hover:border-primary/30 transition-all">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-primary/10 flex-shrink-0">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-display text-xl text-foreground truncate">{event.title}</h4>
                    {event.published ? (
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 uppercase font-bold tracking-wider">Live</span>
                    ) : (
                      <span className="text-[9px] bg-secondary text-muted-foreground px-2 py-0.5 uppercase font-bold tracking-wider">Utkast</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> 
                      {new Date(event.date).toLocaleDateString('sv-SE')} {new Date(event.date).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-muted-foreground text-sm mt-2 line-clamp-2">{event.description}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => handleDelete(event.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-4 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {events.length === 0 && (
            <div className="bg-card border border-dashed border-border p-12 text-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Inga event skapade än.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
