'use server'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { getDb } from '../db/runtime'
import { agreements, users } from '../db/schema'
import {
  hasPendingConfidentialityAgreement,
  isDemoTesterUser,
  requireOrganizerUser,
  requireStaffUser,
  scopeSignerIdsForUser,
} from '../lib/access'
import { writeActivityLog } from './logs'

type AgreementSignatureValue =
  | boolean
  | {
      signed?: boolean
      nameClarification?: string
      signedAt?: string
    }

type AgreementSignaturesState = Record<string, AgreementSignatureValue | string | number>

const GUARDIAN_NOTICE_HEADING = 'Särskilda villkor för mottagare under 18 år'
const GUARDIAN_NOTICE_BLOCK = `${GUARDIAN_NOTICE_HEADING}
Mottagaren är under 18 år. Målsman ska därför närvara vid fysisk signering och fylla i namnförtydligande, underskrift och datum på den utskrivna kopian.`

function ensureGuardianNoticeInBody(body: string, recipientIsUnder18: boolean) {
  if (!recipientIsUnder18) {
    return body
  }

  const normalizedBody = body.toLowerCase()
  if (normalizedBody.includes(GUARDIAN_NOTICE_HEADING.toLowerCase())) {
    return body
  }

  return `${body.trim()}\n\n${GUARDIAN_NOTICE_BLOCK}`
}

function isConfidentialityAgreement(record: { title: string | null; body: string | null }) {
  const haystack = `${record.title ?? ''}\n${record.body ?? ''}`.toLowerCase()
  return haystack.includes('sekretessavtal') || haystack.includes('confidentiality')
}

function getSignatureEntry(state: AgreementSignaturesState, userId: number) {
  const raw = state[String(userId)]
  if (raw === true) {
    return { signed: true, nameClarification: null as string | null }
  }
  if (typeof raw === 'object' && raw !== null) {
    const signed = raw.signed === true
    const nameClarification = typeof raw.nameClarification === 'string' && raw.nameClarification.trim()
      ? raw.nameClarification.trim()
      : null
    return { signed, nameClarification }
  }
  return { signed: false, nameClarification: null as string | null }
}

async function enrichAgreement(record: typeof agreements.$inferSelect, allUsers: (typeof users.$inferSelect)[]) {
  const signerIds: number[] = JSON.parse(record.requiredSigners || '[]')
  const digitalSignatures: AgreementSignaturesState = JSON.parse(record.digitalSignatures || '{}')

  const requiredSigners = signerIds.map((id) => {
    const user = allUsers.find((candidate) => candidate.id === id)
    const signature = getSignatureEntry(digitalSignatures, id)
    return {
      userId: id,
      name: user?.name || 'Okänd användare',
      email: user?.email || '',
      signed: signature.signed,
      nameClarification: signature.nameClarification,
      role: user?.role || 'volunteer',
    }
  })

  const createdByUser = record.createdByUserId ? allUsers.find((candidate) => candidate.id === record.createdByUserId) : null
  const generatedByUser = record.generatedBy ? allUsers.find((candidate) => candidate.id === record.generatedBy) : null
  const deleteRequestedByUserId = Number(digitalSignatures.__deleteRequestedBy || 0) || null
  const deleteRequestedByUser = deleteRequestedByUserId
    ? allUsers.find((candidate) => candidate.id === deleteRequestedByUserId)
    : null
  const deleteRequestedAt = typeof digitalSignatures.__deleteRequestedAt === 'string'
    ? digitalSignatures.__deleteRequestedAt
    : null
  const recipientIsUnder18 = digitalSignatures.__recipientIsUnder18 === true

  return {
    ...record,
    requiredSigners,
    createdByName: createdByUser?.name || null,
    generatedByName: generatedByUser?.name || null,
    allSigned: signerIds.length > 0 && signerIds.every((id) => getSignatureEntry(digitalSignatures, id).signed),
    deleteRequestedByUserId,
    deleteRequestedByName: deleteRequestedByUser?.name || null,
    deleteRequestedAt,
    deletePending: Boolean(deleteRequestedByUserId),
    recipientIsUnder18,
  }
}

export const getAgreementsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const currentUser = await requireStaffUser({ allowPendingConfidentiality: true })
    const mustSignConfidentiality = await hasPendingConfidentialityAgreement(currentUser.id)
    const isDemo = isDemoTesterUser(currentUser)
    const db = await getDb()
    const rows = await db.select().from(agreements).orderBy(desc(agreements.createdAt))
    const scopedRowsBase = isDemo ? rows.filter((row) => row.createdByUserId === currentUser.id) : rows
    const scopedRows = mustSignConfidentiality
      ? scopedRowsBase.filter((row) => {
          if (!isConfidentialityAgreement(row) || row.status === 'archived') {
            return false
          }
          const signerIds: number[] = JSON.parse(row.requiredSigners || '[]')
          return signerIds.includes(currentUser.id)
        })
      : scopedRowsBase
    const allUsers = isDemo ? [currentUser] : await db.select().from(users)
    const enriched = await Promise.all(scopedRows.map((row) => enrichAgreement(row, allUsers)))

    if (!isDemo) {
      return enriched
    }

    return enriched.map((row) => ({
      ...row,
      requiredSigners: row.requiredSigners.filter((signer) => signer.userId === currentUser.id),
      createdByName: row.createdByUserId === currentUser.id ? row.createdByName : null,
      generatedByName: row.generatedBy === currentUser.id ? row.generatedByName : null,
      deleteRequestedByName: row.deleteRequestedByUserId === currentUser.id ? row.deleteRequestedByName : null,
      deleteRequestedByUserId: row.deleteRequestedByUserId === currentUser.id ? row.deleteRequestedByUserId : null,
      deletePending: row.deleteRequestedByUserId === currentUser.id ? row.deletePending : false,
    }))
  })

export const getMyPendingAgreementSignaturesFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const currentUser = await requireStaffUser({ allowPendingConfidentiality: true })
    const mustSignConfidentiality = await hasPendingConfidentialityAgreement(currentUser.id)
    const isDemo = isDemoTesterUser(currentUser)
    const db = await getDb()
    const rows = await db.select().from(agreements).orderBy(desc(agreements.createdAt))
    const scopedRowsBase = isDemo ? rows.filter((row) => row.createdByUserId === currentUser.id) : rows
    const scopedRows = mustSignConfidentiality
      ? scopedRowsBase.filter((row) => isConfidentialityAgreement(row))
      : scopedRowsBase
    const allUsers = isDemo ? [currentUser] : await db.select().from(users)
    const enriched = await Promise.all(scopedRows.map((row) => enrichAgreement(row, allUsers)))
    return enriched.filter((agreement) =>
      agreement.status !== 'archived' &&
      agreement.requiredSigners.some((signer) => signer.userId === currentUser.id && !signer.signed),
    )
  })

export const createAgreementFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      body: z.string().min(1),
      requiredSignerIds: z.array(z.number()).default([]),
      recipientIsUnder18: z.boolean().default(false),
      status: z.enum(['draft', 'active']).default('draft'),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const requiredSignerIds = scopeSignerIdsForUser(currentUser, data.requiredSignerIds)

    const bodyWithGuardianNotice = ensureGuardianNoticeInBody(data.body, data.recipientIsUnder18)

    const inserted = await db.insert(agreements).values({
      title: data.title,
      description: data.description,
      body: bodyWithGuardianNotice,
      status: data.status,
      createdByUserId: currentUser.id,
      requiredSigners: JSON.stringify(requiredSignerIds),
      digitalSignatures: JSON.stringify({
        __recipientIsUnder18: data.recipientIsUnder18,
      }),
    }).returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.create',
      entityType: 'agreement',
      entityId: inserted[0].id,
      details: {
        title: inserted[0].title,
        status: inserted[0].status,
        recipientIsUnder18: data.recipientIsUnder18,
      },
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(inserted[0], allUsers)
  })

export const updateAgreementFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      body: z.string().min(1),
      requiredSignerIds: z.array(z.number()).default([]),
      recipientIsUnder18: z.boolean().default(false),
      status: z.enum(['draft', 'active', 'completed', 'archived']),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.id)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    const scopedSignerIds = scopeSignerIdsForUser(currentUser, data.requiredSignerIds)

    const existingSignatures: AgreementSignaturesState = JSON.parse(current[0].digitalSignatures || '{}')
    const allowedSignatureEntries = Object.entries(existingSignatures).filter(([key]) =>
      key.startsWith('__') || scopedSignerIds.includes(Number(key)),
    )
    const metadataPreserved = Object.fromEntries(allowedSignatureEntries)
    metadataPreserved.__recipientIsUnder18 = data.recipientIsUnder18

    const bodyWithGuardianNotice = ensureGuardianNoticeInBody(data.body, data.recipientIsUnder18)

    const updated = await db.update(agreements)
      .set({
        title: data.title,
        description: data.description,
        body: bodyWithGuardianNotice,
        status: data.status,
        requiredSigners: JSON.stringify(scopedSignerIds),
        digitalSignatures: JSON.stringify(metadataPreserved),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, data.id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.update',
      entityType: 'agreement',
      entityId: data.id,
      details: {
        status: data.status,
        signerCount: scopedSignerIds.length,
        recipientIsUnder18: data.recipientIsUnder18,
      },
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(updated[0], allUsers)
  })

export const addAgreementSignatureFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        agreementId: z.number(),
        nameClarification: z.string().min(2),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser({ allowPendingConfidentiality: true })
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.agreementId)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    const signerIds: number[] = JSON.parse(current[0].requiredSigners || '[]')
    if (!signerIds.includes(currentUser.id)) {
      throw new Error('You are not a required signer')
    }

    const digitalSignatures: AgreementSignaturesState = JSON.parse(current[0].digitalSignatures || '{}')
    digitalSignatures[currentUser.id] = {
      signed: true,
      nameClarification: data.nameClarification.trim(),
      signedAt: new Date().toISOString(),
    }

    const updated = await db.update(agreements)
      .set({
        digitalSignatures: JSON.stringify(digitalSignatures),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, data.agreementId))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.sign.digital',
      entityType: 'agreement',
      entityId: data.agreementId,
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(updated[0], allUsers)
  })

export const archiveAgreementFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.id)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    const updated = await db.update(agreements)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, data.id))
      .returning()

    if (!updated[0]) {
      throw new Error('Agreement not found')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.archive',
      entityType: 'agreement',
      entityId: data.id,
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(updated[0], allUsers)
  })

export const requestAgreementDeleteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.id)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    const signatures: AgreementSignaturesState = JSON.parse(current[0].digitalSignatures || '{}')
    const requestedBy = Number(signatures.__deleteRequestedBy || 0) || null

    if (!requestedBy) {
      signatures.__deleteRequestedBy = currentUser.id
      signatures.__deleteRequestedAt = new Date().toISOString()

      const updated = await db.update(agreements)
        .set({
          digitalSignatures: JSON.stringify(signatures),
          updatedAt: new Date(),
        })
        .where(eq(agreements.id, data.id))
        .returning()

      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'agreement.delete.requested',
        entityType: 'agreement',
        entityId: data.id,
      })

      const allUsers = await db.select().from(users)
      return {
        deleted: false,
        agreement: await enrichAgreement(updated[0], allUsers),
      }
    }

    if (requestedBy === currentUser.id) {
      throw new Error('Radering är redan begärd av dig. Väntar på bekräftelse från en annan admin.')
    }

    const deletedRows = await db.delete(agreements).where(eq(agreements.id, data.id)).returning()

    if (!deletedRows[0]) {
      throw new Error('Agreement not found')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.delete.confirmed',
      entityType: 'agreement',
      entityId: data.id,
      details: {
        deletedBySecondApprover: true,
      },
    })

    return {
      deleted: true,
      deletedId: data.id,
    }
  })

export const markAgreementPhysicalFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.number(),
      printedCopyConfirmed: z.boolean(),
      adminPhysicalNameClarification: z.string().min(2),
      recipientIsUnder18: z.boolean(),
      guardianNameClarification: z.string().optional(),
      guardianSignatureConfirmed: z.boolean().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser({ allowPendingConfidentiality: true })
    if (currentUser.role !== 'organizer') {
      throw new Error('Forbidden')
    }
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.id)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    if (!data.printedCopyConfirmed) {
      throw new Error('Fysisk kopia måste skrivas ut innan avtalet kan markeras som fysiskt signerat')
    }

    const signerIds: number[] = JSON.parse(current[0].requiredSigners || '[]')
    const digitalSignatures: AgreementSignaturesState = JSON.parse(current[0].digitalSignatures || '{}')
    const allSigned = signerIds.length > 0 && signerIds.every((id) => getSignatureEntry(digitalSignatures, id).signed)

    if (!allSigned) {
      throw new Error('Alla digitala signaturer måste vara klara innan fysisk signering markeras')
    }

    if (data.recipientIsUnder18) {
      if (!data.guardianNameClarification || data.guardianNameClarification.trim().length < 2) {
        throw new Error('Målsmans namnförtydligande krävs när mottagaren är under 18 år')
      }
      if (!data.guardianSignatureConfirmed) {
        throw new Error('Bekräfta målsmans fysiska signatur när mottagaren är under 18 år')
      }
    }

    digitalSignatures.__physicalSignedByAdminId = currentUser.id
    digitalSignatures.__physicalSignedByAdminNameClarification = data.adminPhysicalNameClarification.trim()
    digitalSignatures.__physicalSignedAt = new Date().toISOString()
    digitalSignatures.__printedCopyConfirmed = true
    digitalSignatures.__recipientIsUnder18 = data.recipientIsUnder18
    digitalSignatures.__guardianNameClarification = data.recipientIsUnder18
      ? data.guardianNameClarification?.trim() || null
      : null
    digitalSignatures.__guardianSignatureConfirmed = data.recipientIsUnder18
      ? Boolean(data.guardianSignatureConfirmed)
      : false

    const updated = await db.update(agreements)
      .set({
        physicalSigned: true,
        status: 'completed',
        digitalSignatures: JSON.stringify(digitalSignatures),
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, data.id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.mark.physical_signed',
      entityType: 'agreement',
      entityId: data.id,
      details: {
        printedCopyConfirmed: true,
        adminPhysicalNameClarification: data.adminPhysicalNameClarification.trim(),
        recipientIsUnder18: data.recipientIsUnder18,
        guardianNameClarification: data.recipientIsUnder18 ? data.guardianNameClarification?.trim() || null : null,
        guardianSignatureConfirmed: data.recipientIsUnder18 ? Boolean(data.guardianSignatureConfirmed) : false,
      },
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(updated[0], allUsers)
  })

export const recordAgreementPdfGenerationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.number() }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser({ allowPendingConfidentiality: true })
    const db = await getDb()
    const current = await db.select().from(agreements).where(eq(agreements.id, data.id)).limit(1)
    if (!current[0]) {
      throw new Error('Agreement not found')
    }

    if (isDemoTesterUser(currentUser) && current[0].createdByUserId !== currentUser.id) {
      throw new Error('Forbidden in demo mode')
    }

    if (current[0].createdByUserId !== currentUser.id) {
      throw new Error('Endast den som begärt signering kan generera PDF för avtalet')
    }

    const updated = await db.update(agreements)
      .set({
        generatedAt: new Date(),
        generatedBy: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, data.id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'agreement.pdf.generated',
      entityType: 'agreement',
      entityId: data.id,
    })

    const allUsers = await db.select().from(users)
    return enrichAgreement(updated[0], allUsers)
  })

export const fixAgreementSpellingFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: unknown) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        body: z.string().min(1),
      })
      .parse(payload),
  )
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const apiKey =
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (!apiKey) {
      throw new Error(
        'Missing Gemini API key in environment (set GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY)',
      )
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Du är en svensk språkgranskare specialiserad på avtalstexter.

INSTRUKTIONER:
1. Korrigera ENDAST stavning och grammatik.
  2. Behåll juridisk innebörd exakt oförändrad.
  3. Behåll namn, titlar, datum, nummer, punktlistor och radbrytningar.
  4. Skriv inte om struktur, rubriknivåer eller ton.
5. Returnera ENDAST valid JSON pa exakt format:
{"title":"...","description":"...","body":"..."}

TITLE:
${data.title}

DESCRIPTION:
${data.description ?? ''}

BODY:
${data.body}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const text = response.text?.trim()
    if (!text) {
      throw new Error('Gemini returned an empty response')
    }

    const normalized = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim()

    return z
      .object({
        title: z.string().min(1),
        description: z.string(),
        body: z.string().min(1),
      })
      .parse(JSON.parse(normalized))
  })