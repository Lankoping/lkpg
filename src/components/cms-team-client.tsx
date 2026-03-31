import { useState } from 'react'
import { createTeamMemberFn, updateTeamMemberFn, deleteTeamMemberFn } from '../server/functions/cms'
import { Loader2, Trash2, Edit2, Plus } from 'lucide-react'

interface TeamMember {
  id: number
  name: string
  role: string
  roleEn?: string
  description: string
  descriptionEn?: string
  icon: string
  sortOrder: number
  isActive: boolean
  createdAt?: Date
  updatedAt?: Date
}

const ICON_NAMES = ['Crown', 'Code', 'Users', 'Zap', 'Trophy', 'Heart', 'Star', 'Rocket', 'Wifi', 'Shield']

export function TeamPageClient({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    description: '',
    icon: 'Crown',
    sortOrder: 0,
  })

  const resetForm = () => {
    setFormData({ name: '', role: '', description: '', icon: 'Crown', sortOrder: 0 })
    setEditingId(null)
    setShowForm(false)
  }

  const handleEdit = (member: TeamMember) => {
    setFormData({
      name: member.name,
      role: member.role,
      description: member.description,
      icon: member.icon,
      sortOrder: member.sortOrder,
    })
    setEditingId(member.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (editingId) {
        const updated = await updateTeamMemberFn({
          data: {
            id: editingId,
            name: formData.name,
            role: formData.role,
            description: formData.description,
            icon: formData.icon,
            sortOrder: formData.sortOrder,
            isActive: true,
          },
        })
        setMembers(members.map(m => (m.id === editingId ? updated : m)))
        setMessage('Team member updated successfully!')
      } else {
        const created = await createTeamMemberFn({
          data: {
            name: formData.name,
            role: formData.role,
            description: formData.description,
            icon: formData.icon,
            sortOrder: formData.sortOrder,
          },
        })
        setMembers([...members, created])
        setMessage('Team member created successfully!')
      }
      setTimeout(() => {
        resetForm()
        setMessage('')
      }, 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this team member?')) return

    setLoading(true)
    try {
      await deleteTeamMemberFn({ data: id })
      setMembers(members.filter(m => m.id !== id))
      setMessage('Team member deleted successfully!')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-foreground mb-2">Team Members</h2>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Member
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded border ${message.includes('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded p-6 space-y-4">
          <h3 className="font-display text-xl text-foreground">{editingId ? 'Edit' : 'Add'} Team Member</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="Role (Swedish)"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Team member bio"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm resize-vertical"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                >
                  {ICON_NAMES.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-border rounded hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {members.map(member => (
          <div key={member.id} className="bg-card border border-border rounded p-4 flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1">{member.name}</h3>
              <p className="text-sm text-primary mb-2 font-medium">{member.role}</p>
              <p className="text-sm text-muted-foreground mb-2">{member.description}</p>
              <div className="text-xs text-muted-foreground">
                Icon: {member.icon} · Sort: {member.sortOrder}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(member)}
                className="p-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(member.id)}
                disabled={loading}
                className="p-2 text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {members.length === 0 && !showForm && (
          <div className="bg-card border border-dashed border-border rounded p-8 text-center text-muted-foreground">
            No team members yet. Add your first one!
          </div>
        )}
      </div>
    </div>
  )
}
