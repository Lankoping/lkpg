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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">Biljetter</p>
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
          <div>
            <h1 className="font-display text-4xl text-foreground flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              Hantera Biljettyper
            </h1>
            <p className="text-muted-foreground mt-2">Skapa och konfigurera de biljettyper som kan utfärdas.</p>
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
              <span className="text-[10px] font-medium tracking-widest text-primary uppercase">Skapa ny typ</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Namn *</label>
              <input 
                type="text" 
                placeholder="t.ex. VIP, Early Bird"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Standardpris (SEK) *</label>
              <input 
                type="number" 
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Beskrivning</label>
              <textarea 
                placeholder="Valfri beskrivning..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-3 bg-background border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none text-foreground text-sm transition-all min-h-[100px] resize-y placeholder:text-muted-foreground"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2 justify-center"
            >
              <Save className="w-4 h-4" />
              Spara Biljettyp
            </button>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 space-y-3">
          {types.map((type) => (
            <div key={type.id} className="bg-card border border-border p-5 flex justify-between items-center group hover:border-primary/30 transition-all">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 flex-shrink-0">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-display text-xl text-foreground">{type.name}</h4>
                  <p className="text-primary font-mono text-sm">{type.price} SEK</p>
                  {type.description && <p className="text-muted-foreground text-sm mt-1">{type.description}</p>}
                </div>
              </div>
              <button 
                onClick={() => handleDelete(type.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {types.length === 0 && (
            <div className="bg-card border border-dashed border-border p-12 text-center">
              <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Inga biljettyper skapade än.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
