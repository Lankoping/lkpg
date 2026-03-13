import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionFn, getUsersFn } from '../../server/functions/auth'
import {
  addAgreementSignatureFn,
  archiveAgreementFn,
  createAgreementFn,
  fixAgreementSpellingFn,
  getAgreementsFn,
  getMyPendingAgreementSignaturesFn,
  markAgreementPhysicalFn,
  requestAgreementDeleteFn,
  recordAgreementPdfGenerationFn,
  updateAgreementFn,
} from '../../server/functions/agreements'
import { openAgreementPdf } from '../../lib/pdf-export'

export const Route = createFileRoute('/admin/avtal')({
  loader: async () => {
    const [agreements, myPending, session, allUsers] = await Promise.all([
      getAgreementsFn(),
      getMyPendingAgreementSignaturesFn(),
      getSessionFn(),
      getUsersFn().catch(() => []),
    ])

    return { agreements, myPending, session, allUsers }
  },
  component: AgreementsAdmin,
})

type AgreementRow = Awaited<ReturnType<typeof getAgreementsFn>>[number]

function AgreementsAdmin() {
  const { agreements: initialAgreements, myPending: initialPending, session, allUsers } = Route.useLoaderData()
  const router = useRouter()

  const [agreements, setAgreements] = useState<AgreementRow[]>(initialAgreements)
  const [myPending, setMyPending] = useState<AgreementRow[]>(initialPending)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [agreementTemplate, setAgreementTemplate] = useState<'none' | 'purchase' | 'confidentiality'>('none')
  const [purchaseCost, setPurchaseCost] = useState('')
  const [purchaseItem, setPurchaseItem] = useState('')
  const [purchaseMotivation, setPurchaseMotivation] = useState('')
  const [adminSignerId, setAdminSignerId] = useState<number | null>(null)
  const [recipientSignerId, setRecipientSignerId] = useState<number | null>(null)
  const [status, setStatus] = useState<'draft' | 'active'>('draft')
  const [isSaving, setIsSaving] = useState(false)
  const [isFixingSpelling, setIsFixingSpelling] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  const isOrganizer = session?.role === 'organizer'
  const myId = session?.id
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const matchesAgreement = (agreement: AgreementRow) => {
    if (!normalizedQuery) return true

    const searchableValues = [
      agreement.title,
      agreement.description || '',
      agreement.body,
      agreement.status,
      agreement.createdByName || '',
      agreement.generatedByName || '',
      agreement.deleteRequestedByName || '',
      String(agreement.id),
      ...(agreement.requiredSigners || []).flatMap((signer) => [
        signer.name || '',
        signer.email || '',
        signer.role || '',
        signer.nameClarification || '',
      ]),
    ]

    return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery))
  }

  const filteredAgreements = agreements.filter(matchesAgreement)
  const filteredMyPending = myPending.filter(matchesAgreement)

  const parsePhysicalSignatureMetadata = (agreement: AgreementRow) => {
    const raw = (agreement as any).digitalSignatures
    if (!raw || typeof raw !== 'string') {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return {
        adminPhysicalNameClarification:
          typeof parsed.__physicalSignedByAdminNameClarification === 'string'
            ? parsed.__physicalSignedByAdminNameClarification
            : null,
        printedCopyConfirmed: parsed.__printedCopyConfirmed === true,
        recipientIsUnder18: parsed.__recipientIsUnder18 === true,
        guardianNameClarification:
          typeof parsed.__guardianNameClarification === 'string' ? parsed.__guardianNameClarification : null,
        guardianSignatureConfirmed: parsed.__guardianSignatureConfirmed === true,
      }
    } catch {
      return null
    }
  }

  const buildPurchaseTemplateBody = () => `Anpassat avtal för köp

Kostnad:
${purchaseCost}

Sak:
${purchaseItem}

Motivering:
${purchaseMotivation}

Parterna bekräftar att uppgifterna ovan är korrekta och att köpet godkänns enligt organisationens rutiner.`

  const buildConfidentialityTemplateBody = () => `Sekretessavtal (NDA) - Åtkomst till system med personuppgifter

Bakgrund
Om du har blivit ombedd att signera det här pappret är det för att du kommer att få åtkomst till ett system som innehåller personinformation som inte får delas.

1. Vad som omfattas av sekretess
- Personuppgifter (namn, e-post, telefon, interna ID-nummer, adressuppgifter och liknande)
- Kontoinformation, inloggningsinformation, roller och behörighetsnivåer
- Intern dokumentation, arbetsflöden, loggar, avtal och administrativ information
- Säkerhetsrelaterad information och teknisk systeminformation

2. Dina skyldigheter
- Du får endast använda informationen för uppgifter kopplade till din roll i Lanköping
- Du får inte kopiera, exportera, dela, publicera eller sprida information till obehöriga
- Du får inte använda informationen för privata syften eller externa projekt
- Du måste skydda ditt konto, lösenord och eventuell tvåfaktorsautentisering
- Du ska omedelbart rapportera misstänkt läcka, obehörig åtkomst eller säkerhetsincident

3. Åtkomstbegränsning
- Åtkomst ges enligt principen "minsta möjliga behörighet"
- Lanköping kan begränsa eller återkalla åtkomst när som helst vid säkerhetsbehov

4. Loggning och spårbarhet
- Åtgärder i systemet kan loggas för säkerhet, revision och incidenthantering
- Loggning kan omfatta tidpunkt, konto, roll, åtgärd och teknisk metadata

5. Brott mot avtalet
- Brott mot detta avtal kan leda till omedelbart borttagen åtkomst
- Brott kan medföra interna disciplinära åtgärder och rättsliga konsekvenser

6. Giltighet
- Detta sekretessåtagande gäller under hela tiden du har åtkomst till systemet
- Sekretessåtagandet gäller även efter att uppdrag, roll eller konto avslutas

Genom signering bekräftar du att du har läst, förstått och accepterat villkoren i detta sekretessavtal.`

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setBody('')
    setAgreementTemplate('none')
    setPurchaseCost('')
    setPurchaseItem('')
    setPurchaseMotivation('')
    setAdminSignerId(null)
    setRecipientSignerId(null)
    setStatus('draft')
    setError('')
  }

  const startEdit = (agreement: AgreementRow) => {
    setEditingId(agreement.id)
    setTitle(agreement.title)
    setDescription(agreement.description || '')
    setBody(agreement.body)
    setAgreementTemplate('none')
    setPurchaseCost('')
    setPurchaseItem('')
    setPurchaseMotivation('')
    const adminSigner = agreement.requiredSigners.find((signer) => signer.role === 'organizer')
    const recipientSigner = agreement.requiredSigners.find((signer) => signer.userId !== adminSigner?.userId)

    setAdminSignerId(adminSigner?.userId ?? null)
    setRecipientSignerId(recipientSigner?.userId ?? null)
    setStatus(agreement.status === 'active' ? 'active' : 'draft')
    setExpandedId(agreement.id)
  }

  const handleApplyPurchaseTemplate = () => {
    if (!purchaseCost.trim() || !purchaseItem.trim() || !purchaseMotivation.trim()) {
      setError('Fyll i Kostnad, Sak och Motivering innan du infogar köp-template')
      return
    }

    setError('')
    setBody(buildPurchaseTemplateBody())
  }

  const handleApplyConfidentialityTemplate = () => {
    setError('')
    if (!title.trim()) {
      setTitle('Sekretessavtal - Åtkomst till personuppgiftssystem')
    }
    if (!description.trim()) {
      setDescription('Måste signeras innan åtkomst till system med personuppgifter ges.')
    }
    setBody(buildConfidentialityTemplateBody())
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!adminSignerId || !recipientSignerId) {
      setError('Välj både signerande administratör och signerande mottagare')
      return
    }

    if (adminSignerId === recipientSignerId) {
      setError('Signerande administratör och mottagare måste vara två olika personer')
      return
    }

    const selectedAdmin = allUsers.find((user) => user.id === adminSignerId)
    if (!selectedAdmin || selectedAdmin.role !== 'organizer') {
      setError('Signerande administratör måste vara en användare med rollen organizer')
      return
    }

    const requiredSignerIds = [adminSignerId, recipientSignerId]

    const finalBody = body.trim()
      ? body
      : agreementTemplate === 'purchase' && purchaseCost.trim() && purchaseItem.trim() && purchaseMotivation.trim()
        ? buildPurchaseTemplateBody()
        : agreementTemplate === 'confidentiality'
          ? buildConfidentialityTemplateBody()
          : ''

    if (!title.trim() || !finalBody.trim()) {
      setError('Titel och avtalstext krävs')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const result = editingId
        ? await updateAgreementFn({
            data: {
              id: editingId,
              title,
              description,
              body: finalBody,
              requiredSignerIds,
              status,
            },
          })
        : await createAgreementFn({
            data: {
              title,
              description,
              body: finalBody,
              requiredSignerIds,
              status,
            },
          })

      setAgreements((current) => {
        if (editingId) {
          return current.map((agreement) => (agreement.id === result.id ? result : agreement))
        }
        return [result, ...current]
      })

      resetForm()
      await router.invalidate()
    } catch (err: any) {
      setError(err?.message || 'Kunde inte spara avtalet')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSign = async (agreementId: number) => {
    const defaultName = session?.name?.trim() || ''
    const nameClarification = window.prompt('Ange namnförtydligande för digital signering:', defaultName)
    if (!nameClarification || !nameClarification.trim()) {
      return
    }

    try {
      const updated = await addAgreementSignatureFn({ data: { agreementId, nameClarification: nameClarification.trim() } })
      setAgreements((current) => current.map((agreement) => (agreement.id === agreementId ? updated : agreement)))
      setMyPending((current) => current.filter((agreement) => agreement.id !== agreementId))
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Kunde inte signera avtalet')
    }
  }

  const handleGeneratePdf = async (agreement: AgreementRow) => {
    try {
      const updated = await recordAgreementPdfGenerationFn({ data: { id: agreement.id } })
      setAgreements((current) => current.map((row) => (row.id === agreement.id ? updated : row)))
      openAgreementPdf(
        {
          id: updated.id,
          title: updated.title,
          description: updated.description || null,
          body: updated.body,
          createdAt: updated.createdAt,
          generatedAt: updated.generatedAt,
          generatedByName: updated.generatedByName,
          requiredSigners: updated.requiredSigners,
          status: updated.status,
        },
        session?.name || 'System'
      )
    } catch (err: any) {
      alert(err?.message || 'Kunde inte generera PDF')
    }
  }

  const handleFixSpelling = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Titel och avtalstext krävs för stavningskontroll')
      return
    }

    setIsFixingSpelling(true)
    setError('')
    try {
      const fixed = await fixAgreementSpellingFn({
        data: {
          title,
          description,
          body,
        },
      })

      setTitle(fixed.title)
      setDescription(fixed.description)
      setBody(fixed.body)
    } catch (err: any) {
      setError(err?.message || 'Kunde inte fixa stavning just nu')
    } finally {
      setIsFixingSpelling(false)
    }
  }

  const handleMarkPhysical = async (agreementId: number) => {
    if (!window.confirm('Bekräfta att en fysisk kopia skrivs ut nu och signeras med penna av parterna.')) {
      return
    }

    const adminDefaultName = session?.name?.trim() || ''
    const adminPhysicalNameClarification = window.prompt(
      'Ange namnförtydligande för den fysiskt signerande administratören:',
      adminDefaultName,
    )

    if (!adminPhysicalNameClarification || adminPhysicalNameClarification.trim().length < 2) {
      alert('Admin namnförtydligande krävs för fysisk signering')
      return
    }

    const recipientIsUnder18 = window.confirm(
      'Är mottagaren under 18 år? Klicka OK för Ja, Avbryt för Nej.',
    )

    let guardianNameClarification = ''
    let guardianSignatureConfirmed = false

    if (recipientIsUnder18) {
      const guardianName = window.prompt('Mottagaren är under 18. Ange målsmans namnförtydligande:')
      if (!guardianName || guardianName.trim().length < 2) {
        alert('Målsmans namnförtydligande krävs när mottagaren är under 18 år')
        return
      }

      const guardianSigned = window.confirm('Bekräfta att målsman har signerat den fysiska kopian.')
      if (!guardianSigned) {
        alert('Målsmans signatur måste vara bekräftad för mottagare under 18 år')
        return
      }

      guardianNameClarification = guardianName.trim()
      guardianSignatureConfirmed = true
    }

    if (!window.confirm('Slutlig bekräftelse: fysisk kopia är utskriven och signerad enligt kraven.')) {
      return
    }

    try {
      const updated = await markAgreementPhysicalFn({
        data: {
          id: agreementId,
          printedCopyConfirmed: true,
          adminPhysicalNameClarification: adminPhysicalNameClarification.trim(),
          recipientIsUnder18,
          guardianNameClarification: recipientIsUnder18 ? guardianNameClarification : undefined,
          guardianSignatureConfirmed: recipientIsUnder18 ? guardianSignatureConfirmed : undefined,
        },
      })
      setAgreements((current) => current.map((row) => (row.id === agreementId ? updated : row)))
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Kunde inte markera avtalet som fysiskt signerat')
    }
  }

  const handleArchive = async (agreementId: number) => {
    if (!window.confirm('Arkivera avtalet?')) {
      return
    }

    try {
      const updated = await archiveAgreementFn({ data: { id: agreementId } })
      setAgreements((current) => current.map((row) => (row.id === agreementId ? updated : row)))
      setMyPending((current) => current.filter((agreement) => agreement.id !== agreementId))
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Kunde inte arkivera avtalet')
    }
  }

  const handleDeleteWithApproval = async (agreement: AgreementRow) => {
    if (!isOrganizer) return

    const isSecondApproval = agreement.deletePending && agreement.deleteRequestedByUserId && agreement.deleteRequestedByUserId !== myId
    const confirmText = isSecondApproval
      ? 'En annan admin har begärt radering. Bekräftar du radering tas avtalet bort permanent.'
      : 'Begär radering av avtalet. En annan admin måste bekräfta innan permanent borttagning.'

    if (!window.confirm(confirmText)) {
      return
    }

    try {
      const result = await requestAgreementDeleteFn({ data: { id: agreement.id } })
      if (result.deleted) {
        setAgreements((current) => current.filter((row) => row.id !== agreement.id))
        setMyPending((current) => current.filter((row) => row.id !== agreement.id))
      } else {
        setAgreements((current) => current.map((row) => (row.id === agreement.id ? result.agreement : row)))
      }
      await router.invalidate()
    } catch (err: any) {
      alert(err?.message || 'Kunde inte hantera radering')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-3xl tracking-wide text-[#F0E8D8] mb-2">Avtal</h2>
        <p className="text-[#F0E8D8]/60 text-sm">Bygg anpassade signerbara avtal och skicka dem till valda konton.</p>
      </div>

      {filteredMyPending.length > 0 && (
        <div className="bg-[#C04A2A]/10 border border-[#C04A2A]/35 rounded-sm p-6">
          <h3 className="font-display text-lg tracking-wide text-[#C04A2A] mb-1">Avtal som väntar på din signatur</h3>
          <p className="text-sm text-[#F0E8D8]/60 mb-4">Du kan digitalt signera de avtal där ditt konto har valts som signatär.</p>
          <div className="space-y-3">
            {filteredMyPending.map((agreement) => (
              <div key={agreement.id} className="flex items-center justify-between gap-4 p-4 rounded-sm border border-[#C04A2A]/25 bg-[#1A1816]/60">
                <div className="min-w-0">
                  <p className="text-[#F0E8D8] font-medium truncate">{agreement.title}</p>
                  <p className="text-sm text-[#F0E8D8]/50 truncate">{agreement.description || 'Anpassat avtal'}</p>
                </div>
                <button
                  onClick={() => handleSign(agreement.id)}
                  className="px-4 py-2 bg-[#C04A2A] text-white text-[10px] uppercase tracking-[0.15em] rounded-sm hover:bg-[#A03A1A] transition-colors"
                >
                  [ ] Signera
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOrganizer && (
        <form onSubmit={handleSave} className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-lg tracking-wide text-[#F0E8D8]">{editingId ? 'Redigera avtal' : 'Avtalsbyggaren'}</h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/50 hover:text-[#F0E8D8]"
              >
                Avbryt redigering
              </button>
            )}
          </div>

          {error && <div className="p-3 rounded-sm border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Titel</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'active')} className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60">
                <option value="draft">Utkast</option>
                <option value="active">Aktiv</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Kort beskrivning</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60" />
          </div>

          <div className="space-y-3 border border-[#C04A2A]/20 rounded-sm p-4 bg-[#100E0C]/40">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Template</label>
              <select
                value={agreementTemplate}
                onChange={(e) => setAgreementTemplate(e.target.value as 'none' | 'purchase' | 'confidentiality')}
                className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
              >
                <option value="none">Ingen template</option>
                <option value="purchase">Anpassat avtal: Köp</option>
                <option value="confidentiality">Sekretessavtal (NDA): Systemåtkomst</option>
              </select>
            </div>

            {agreementTemplate === 'purchase' && (
              <div className="space-y-3">
                <p className="text-xs text-[#F0E8D8]/55">Fyll i fälten och infoga texten i avtalstexten.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Kostnad</label>
                    <input
                      value={purchaseCost}
                      onChange={(e) => setPurchaseCost(e.target.value)}
                      placeholder="t.ex. 12 500 kr"
                      className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Sak</label>
                    <input
                      value={purchaseItem}
                      onChange={(e) => setPurchaseItem(e.target.value)}
                      placeholder="t.ex. Ljudutrustning"
                      className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Motivering</label>
                  <textarea
                    value={purchaseMotivation}
                    onChange={(e) => setPurchaseMotivation(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60 resize-y"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyPurchaseTemplate}
                    className="px-4 py-2 border border-[#C04A2A]/40 text-[#C04A2A] text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/10"
                  >
                    Infoga köp-template
                  </button>
                </div>
              </div>
            )}

            {agreementTemplate === 'confidentiality' && (
              <div className="space-y-3">
                <p className="text-xs text-[#F0E8D8]/55">
                  Infogar en detaljerad sekretessavtal-template för system med personinformation.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyConfidentialityTemplate}
                    className="px-4 py-2 border border-[#C04A2A]/40 text-[#C04A2A] text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/10"
                  >
                    Infoga sekretessavtal-template
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Avtalstext</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60 resize-y" />
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
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-2">Signerande parter</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Signerande administratör</label>
                <select
                  value={adminSignerId ?? ''}
                  onChange={(e) => setAdminSignerId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
                >
                  <option value="">Välj administratör</option>
                  {allUsers
                    .filter((user) => user.role === 'organizer')
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/60 mb-1.5">Signerande mottagare</label>
                <select
                  value={recipientSignerId ?? ''}
                  onChange={(e) => setRecipientSignerId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
                >
                  <option value="">Välj mottagare</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.name || user.email) + ' (' + user.role + ')'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#F0E8D8]/50">
              Båda parter måste väljas och signera digitalt innan avtalet kan markeras som fysiskt signerat.
            </p>
          </div>

          <button type="submit" disabled={isSaving} className="px-6 py-3 bg-[#C04A2A] text-white text-[11px] uppercase tracking-[0.15em] rounded-sm hover:bg-[#A03A1A] disabled:opacity-50 shadow-[0_0_15px_rgba(192,74,42,0.3)]">
            {isSaving ? 'Sparar...' : editingId ? 'Spara avtal' : 'Skapa avtal'}
          </button>
        </form>
      )}

      <div className="bg-[#141210]/80 border border-[#C04A2A]/20 p-6 rounded-sm">
        <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-end md:justify-between">
          <h3 className="font-display text-lg tracking-wide text-[#F0E8D8]">
            Avtalslista ({filteredAgreements.length}/{agreements.length})
          </h3>
          <div className="w-full md:w-[26rem]">
            <label className="block text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/55 mb-1.5">Sök i avtal</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Namn, titel, sak, motivering, signatär, status..."
              className="w-full p-3 bg-[#100E0C] border border-[#C04A2A]/20 rounded-sm text-[#F0E8D8] text-sm outline-none focus:border-[#C04A2A]/60"
            />
          </div>
        </div>
        <div className="space-y-3">
          {filteredAgreements.length === 0 && (
            <div className="p-4 rounded-sm border border-[#C04A2A]/20 bg-[#100E0C] text-sm text-[#F0E8D8]/60">
              Inga avtal matchade din sökning.
            </div>
          )}

          {filteredAgreements.map((agreement) => {
            const isExpanded = expandedId === agreement.id
            const mySignature = agreement.requiredSigners.find((signer) => signer.userId === myId)
            const canGeneratePdf = agreement.allSigned && agreement.status !== 'archived'
            const physicalMeta = parsePhysicalSignatureMetadata(agreement)
            return (
              <div key={agreement.id} className="border border-[#C04A2A]/20 rounded-sm overflow-hidden">
                <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-[#1A1816]/60" onClick={() => setExpandedId(isExpanded ? null : agreement.id)}>
                  <span className="text-[#F0E8D8]/30 text-xs">{isExpanded ? '▼' : '▶'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[#F0E8D8] font-medium truncate">{agreement.title}</span>
                      <span className="px-2 py-0.5 border rounded-sm text-[9px] uppercase tracking-[0.15em] text-[#C04A2A] border-[#C04A2A]/30 bg-[#C04A2A]/10">{agreement.status}</span>
                      {agreement.allSigned && <span className="px-2 py-0.5 border rounded-sm text-[9px] uppercase tracking-[0.15em] text-green-400 border-green-500/30 bg-green-500/10">Alla digitala klara</span>}
                    </div>
                    <p className="text-xs text-[#F0E8D8]/50 truncate">{agreement.description || 'Anpassat avtal'}{agreement.createdByName ? ` - skapat av ${agreement.createdByName}` : ''}</p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 border-t border-[#C04A2A]/20 bg-[#141210]/40 space-y-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/55 mb-2">Avtalstext</p>
                      <p className="text-sm text-[#F0E8D8] whitespace-pre-wrap leading-relaxed">{agreement.body}</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#F0E8D8]/55 mb-2">Digitala signaturer</p>
                      <div className="space-y-2">
                        {agreement.requiredSigners.map((signer) => {
                          const agreementAdminSigner = agreement.requiredSigners.find((candidate) => candidate.role === 'organizer')
                          const agreementRecipientSigner = agreement.requiredSigners.find(
                            (candidate) => candidate.userId !== agreementAdminSigner?.userId,
                          )
                          const signerRoleLabel = signer.userId === agreementAdminSigner?.userId
                            ? 'Signerande administratör'
                            : signer.userId === agreementRecipientSigner?.userId
                              ? 'Signerande mottagare'
                              : 'Signerande part'
                          const canISign = signer.userId === myId && !signer.signed
                          return (
                            <div key={signer.userId} className="flex items-center justify-between gap-3 p-3 rounded-sm bg-[#1A1816]/60">
                              <div>
                                <p className="text-sm text-[#F0E8D8]">{signer.signed ? '[X]' : '[ ]'} {signer.name}</p>
                                <p className="text-xs text-[#F0E8D8]/45">{signer.email}</p>
                                <p className="text-xs text-[#F0E8D8]/55">{signerRoleLabel}</p>
                                {signer.signed && signer.nameClarification && (
                                  <p className="text-xs text-[#F0E8D8]/55">Namnförtydligande: {signer.nameClarification}</p>
                                )}
                              </div>
                              {canISign && (
                                <button onClick={() => handleSign(agreement.id)} className="px-3 py-1.5 border border-[#C04A2A]/40 text-[#C04A2A] text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/10">
                                  Signera
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 border-t border-[#C04A2A]/20">
                      {isOrganizer && (
                        <button onClick={() => startEdit(agreement)} className="px-4 py-2 border border-[#F0E8D8]/20 text-[#F0E8D8]/70 text-[10px] uppercase tracking-[0.1em] rounded-sm hover:border-[#F0E8D8]/40 hover:text-[#F0E8D8]">
                          Redigera
                        </button>
                      )}
                      {mySignature && !mySignature.signed && (
                        <button onClick={() => handleSign(agreement.id)} className="px-4 py-2 border border-[#C04A2A]/40 text-[#C04A2A] text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/10">
                          Signera digitalt
                        </button>
                      )}
                      {canGeneratePdf && (
                        <button onClick={() => handleGeneratePdf(agreement)} className="px-4 py-2 border border-[#C04A2A]/40 text-[#C04A2A] text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-[#C04A2A]/10">
                          Generera PDF
                        </button>
                      )}
                      {isOrganizer && agreement.allSigned && !agreement.physicalSigned && (
                        <button onClick={() => handleMarkPhysical(agreement.id)} className="px-4 py-2 border border-green-500/30 text-green-400 text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-green-500/10">
                          Markera fysiskt signerat
                        </button>
                      )}
                      {isOrganizer && agreement.status !== 'archived' && (
                        <button onClick={() => handleArchive(agreement.id)} className="px-4 py-2 border border-[#F0E8D8]/20 text-[#F0E8D8]/70 text-[10px] uppercase tracking-[0.1em] rounded-sm hover:border-[#F0E8D8]/40 hover:text-[#F0E8D8]">
                          Arkivera
                        </button>
                      )}
                      {isOrganizer && (
                        <button
                          onClick={() => handleDeleteWithApproval(agreement)}
                          disabled={agreement.deletePending && agreement.deleteRequestedByUserId === myId}
                          className="px-4 py-2 border border-red-500/35 text-red-400 text-[10px] uppercase tracking-[0.1em] rounded-sm hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {agreement.deletePending
                            ? agreement.deleteRequestedByUserId === myId
                              ? 'Väntar på andra admin'
                              : 'Bekräfta och radera'
                            : 'Begär radering (2 admins)'}
                        </button>
                      )}
                    </div>

                    {agreement.physicalSigned && physicalMeta && (
                      <div className="p-3 rounded-sm border border-green-500/25 bg-green-500/10 space-y-1">
                        <p className="text-xs text-green-300/90 uppercase tracking-[0.12em]">Fysisk signeringsinformation</p>
                        <p className="text-xs text-[#F0E8D8]/70">
                          Utskriven kopia: {physicalMeta.printedCopyConfirmed ? 'Ja' : 'Nej'}
                        </p>
                        <p className="text-xs text-[#F0E8D8]/70">
                          Signerande admin (namnförtydligande): {physicalMeta.adminPhysicalNameClarification || 'Ej angivet'}
                        </p>
                        <p className="text-xs text-[#F0E8D8]/70">
                          Mottagare under 18: {physicalMeta.recipientIsUnder18 ? 'Ja' : 'Nej'}
                        </p>
                        {physicalMeta.recipientIsUnder18 && (
                          <>
                            <p className="text-xs text-[#F0E8D8]/70">
                              Målsmans namnförtydligande: {physicalMeta.guardianNameClarification || 'Ej angivet'}
                            </p>
                            <p className="text-xs text-[#F0E8D8]/70">
                              Målsmans signatur bekräftad: {physicalMeta.guardianSignatureConfirmed ? 'Ja' : 'Nej'}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {agreement.deletePending && agreement.deleteRequestedByName && (
                      <p className="text-xs text-yellow-300/80 border border-yellow-500/25 bg-yellow-500/10 rounded-sm p-2">
                        Radering begärd av {agreement.deleteRequestedByName}. En annan admin måste bekräfta för permanent borttagning.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}