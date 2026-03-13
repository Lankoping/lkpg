import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getStadgarFn, updateStadgarFn, updateSignatureFn, addSignerFn, removeSignerFn, fixStadgarSpellingFn } from '../../server/functions/stadgar'
import { getUsersFn, getSessionFn } from '../../server/functions/auth'
import { openStadgarPdf } from '../../lib/pdf-export'
import { useState } from 'react'

export const Route = createFileRoute('/admin/stadgar')({
  loader: async () => {
    const [stadgar, session] = await Promise.all([getStadgarFn(), getSessionFn()])
    const allUsers = session?.role === 'organizer' ? await getUsersFn() : []
    return { stadgar, allUsers, session }
  },
  component: StadgarAdmin,
})

type SignerState = {
  userId: number
  name: string
  email: string
  signed: boolean
}

function StadgarAdmin() {
  const { stadgar: initialData, allUsers, session } = Route.useLoaderData()
  const isOrganizer = session?.role === 'organizer'
  const router = useRouter()
  const [content, setContent] = useState(initialData?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [signers, setSigners] = useState<SignerState[]>(
    (initialData?.signers || []).map((signer) => ({
      ...signer,
      name: signer.name || signer.email || `User ${signer.userId}`,
    })),
  )
  const [showAddSigner, setShowAddSigner] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('')
  const [isAddingSigner, setIsAddingSigner] = useState(false)
  const [isFixingSpelling, setIsFixingSpelling] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateStadgarFn({ data: { content } })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await router.invalidate()
    } catch (err) {
      alert('Kunde inte spara stadgar: ' + (err as any)?.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignatureToggle = async (userId: number) => {
    const signer = signers.find(s => s.userId === userId)
    if (!signer || signer.signed || signer.userId !== session?.id) return

    try {
      await updateSignatureFn({ data: { userId, signed: true } })
      setSigners(signers.map(s => s.userId === userId ? { ...s, signed: true } : s))
    } catch (err) {
      alert('Kunde inte uppdatera signatur: ' + (err as any)?.message)
    }
  }

  const handleFixSpelling = async () => {
    if (!content.trim()) {
      alert('Fyll i innehåll först.')
      return
    }

    setIsFixingSpelling(true)
    try {
      const fixed = await fixStadgarSpellingFn({ data: { content } })
      setContent(fixed.content)
    } catch (err) {
      alert('Kunde inte fixa stavning just nu: ' + (err as any)?.message)
    } finally {
      setIsFixingSpelling(false)
    }
  }

  const handleAddSigner = async () => {
    if (selectedUserId === '' || !selectedUserId) {
      alert('Välj en användare')
      return
    }

    setIsAddingSigner(true)
    try {
      await addSignerFn({ data: { userId: Number(selectedUserId) } })
      const user = allUsers.find(u => u.id === Number(selectedUserId))
      if (user) {
        setSigners([...signers, { userId: user.id, name: user.name || user.email, email: user.email, signed: false }])
      }
      setSelectedUserId('')
      setShowAddSigner(false)
      await router.invalidate()
    } catch (err) {
      alert('Kunde inte lägga till signatur: ' + (err as any)?.message)
    } finally {
      setIsAddingSigner(false)
    }
  }

  const handleRemoveSigner = async (userId: number) => {
    if (!window.confirm('Ta bort signatur från denna användare?')) return

    try {
      await removeSignerFn({ data: { userId } })
      setSigners(signers.filter(s => s.userId !== userId))
      await router.invalidate()
    } catch (err) {
      alert('Kunde inte ta bort signatur: ' + (err as any)?.message)
    }
  }

  const handleExport = async () => {
    openStadgarPdf(
      {
        content,
        signers,
        updatedAt: initialData?.updatedAt ?? null,
        generatedByName: session?.name ?? 'Admin',
      },
      session?.name ?? 'Admin'
    )
  }

  // Get available users not already signers
  const availableUsers = allUsers.filter(u => !signers.find(s => s.userId === u.id))

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-display text-3xl tracking-wide text-[#F0E8D8] mb-2">Stadgar</h2>
        <p className="text-[#F0E8D8]/60 text-sm">Hantera och godkänn organisationens stadgar</p>
      </div>

      {/* Success message */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-sm text-green-400 text-sm">
          ✓ Stadgar sparade
        </div>
      )}

      {/* Signers section */}
      <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-lg tracking-wide text-[#F0E8D8]">Signatärer ({signers.length})</h3>
          {isOrganizer && (
            <button
              type="button"
              onClick={() => setShowAddSigner(!showAddSigner)}
              className="text-[11px] uppercase tracking-[0.15em] text-[#C04A2A] hover:text-white transition-colors"
            >
              {showAddSigner ? 'Stäng' : 'Lägg till'}
            </button>
          )}
        </div>

        {/* Add signer form */}
        {isOrganizer && showAddSigner && (
          <div className="mb-6 p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm flex gap-3 flex-wrap">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
              className="flex-1 min-w-48 p-3 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm"
            >
              <option value="">Välj användare...</option>
              {availableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddSigner}
              disabled={isAddingSigner || selectedUserId === ''}
              className="px-4 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] transition-all disabled:opacity-50"
            >
              {isAddingSigner ? 'Läggs till...' : 'Lägg till'}
            </button>
          </div>
        )}

        {/* Signers list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {signers.length === 0 ? (
            <div className="col-span-full text-center py-6 text-[#F0E8D8]/50">
              <p className="text-sm">Ingen har lagts till som signerare ännu</p>
            </div>
          ) : (
            signers.map((signer) => (
              <div
                key={signer.userId}
                className="p-4 bg-[#1A1816]/50 border border-[#C04A2A]/20 rounded-sm cursor-pointer hover:border-[#C04A2A]/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#F0E8D8] truncate">{signer.name || 'User ' + signer.userId}</p>
                    <p className="text-[#F0E8D8]/60 text-xs truncate">{signer.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSigner(signer.userId)}
                    className="ml-2 text-red-500/50 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    X
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleSignatureToggle(signer.userId)}
                  disabled={signer.signed || signer.userId !== session?.id}
                  className={`w-full py-2 text-[11px] uppercase tracking-[0.1em] font-medium rounded-sm transition-all border ${
                    signer.signed
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-transparent text-[#C04A2A]/60 border-[#C04A2A]/30 hover:border-[#C04A2A]/60'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {signer.signed ? '[X] Signerad' : signer.userId === session?.id ? '[ ] Signera' : '[ ] Väntar på signatur'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor section */}
      <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm mb-8">
        <h3 className="font-display text-lg tracking-wide text-[#F0E8D8] mb-4">Innehåll</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          readOnly={!isOrganizer}
          className="w-full h-96 p-4 bg-[#100E0C] border border-[#C04A2A]/20 focus:border-[#C04A2A]/60 outline-none rounded-sm text-[#F0E8D8] text-sm font-mono resize-none disabled:opacity-60"
          placeholder="Stadgar-innehållet..."
        />
        {isOrganizer && (
          <div className="flex justify-end mt-3">
            <button
              type="button"
              disabled={isFixingSpelling || isSaving}
              onClick={handleFixSpelling}
              className="px-4 py-2 bg-[#1A1816] border border-[#C04A2A]/40 text-[#F0E8D8] text-[10px] uppercase tracking-[0.15em] font-medium rounded-sm hover:border-[#C04A2A]/80 hover:text-white transition-all disabled:opacity-50"
            >
              {isFixingSpelling ? 'Fixar text...' : 'Fixa stavning (Gemini Flash)'}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        {isOrganizer && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#A03A1A] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(192,74,42,0.3)]"
          >
            {isSaving ? 'Sparar...' : 'Spara ändringar'}
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          className="px-6 py-3 bg-[#C04A2A]/20 text-[#C04A2A] border border-[#C04A2A]/50 text-[11px] uppercase tracking-[0.15em] font-medium rounded-sm hover:bg-[#C04A2A]/30 transition-all"
        >
          Skriv ut / Spara PDF
        </button>
      </div>
    </div>
  )
}
