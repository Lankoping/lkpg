import { createFileRoute, useRouter } from '@tanstack/react-router'
import { issueTicketFn, getEventsForTicketsFn, getTicketTypesFn } from '../../../server/functions/tickets'
import { useState } from 'react'
import { Ticket, User, Mail, Calendar, ArrowLeft, Save } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/tickets/new')({
  loader: async () => {
    const [events, types] = await Promise.all([
      getEventsForTicketsFn(),
      getTicketTypesFn()
    ])
    return { events, types }
  },
  component: NewTicket,
})

function NewTicket() {
  const { events, types } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    eventId: events[0]?.id || 0,
    participantName: '',
    participantEmail: '',
    ticketType: types[0]?.name || 'Ingen',
    pricePaid: types[0]?.price || 0,
  })

  const handleTypeChange = (value: string) => {
    const type = types.find(t => t.name === value)
    setFormData(prev => ({ 
      ...prev, 
      ticketType: value, 
      pricePaid: type ? type.price : 0 
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.eventId || !formData.participantName || !formData.participantEmail) {
      alert('Vänligen fyll i alla fält.')
      return
    }

    setIsSubmitting(true)
    try {
      await issueTicketFn({ data: formData })
      await router.invalidate()
      await navigate({ to: '/admin/tickets' })
    } catch (err) {
      console.error(err)
      alert('Kunde inte utfärda biljett.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Biljetter</p>
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground flex items-center gap-3">
              <Ticket className="w-8 h-8 text-primary" />
              Utfärda Biljett
            </h1>
            <p className="text-muted-foreground mt-2">Skapa en ny biljett för en deltagare.</p>
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

      <form onSubmit={handleSubmit} className="bg-card border border-border p-8 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-primary" />
          <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Biljettinformation</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Välj Event *
          </label>
          <select 
            value={formData.eventId}
            onChange={(e) => setFormData(prev => ({ ...prev, eventId: parseInt(e.target.value) }))}
            className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all cursor-pointer"
            required
          >
            <option value="" disabled>Välj ett event...</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Deltagarens Namn *
          </label>
          <input 
            type="text" 
            placeholder="För- och efternamn"
            value={formData.participantName}
            onChange={(e) => setFormData(prev => ({ ...prev, participantName: e.target.value }))}
            className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Deltagarens E-post *
          </label>
          <input 
            type="email" 
            placeholder="exempel@e-post.se"
            value={formData.participantEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, participantEmail: e.target.value }))}
            className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" />
              Biljett-typ
            </label>
            <select 
              value={formData.ticketType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all cursor-pointer"
            >
              {types.map(t => (
                <option key={t.id} value={t.name}>{t.name} ({t.price} kr)</option>
              ))}
              {types.length === 0 && <option value="standard">Standard</option>}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-2">
              <span className="text-primary font-bold">SEK</span>
              Pris Betalat
            </label>
            <input 
              type="number" 
              value={formData.pricePaid}
              onChange={(e) => setFormData(prev => ({ ...prev, pricePaid: parseInt(e.target.value) || 0 }))}
              className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all"
              required
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full px-4 py-4 bg-primary text-primary-foreground text-sm uppercase tracking-widest font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-3 justify-center"
          >
            {isSubmitting ? 'Utfärdar...' : (
              <>
                <Save className="w-5 h-5" />
                Utfärda Biljett
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
