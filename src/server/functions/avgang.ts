'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { avgangsRequests, users } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { lockUserFn } from './auth'
import {
  enforceDemoOwnUserScope,
  isDemoTesterUser,
  requireOrganizerUser,
  requireStaffUser,
  scopeSignerIdsForUser,
} from '../lib/access'
import { writeActivityLog } from './logs'

async function enrichRequest(req: typeof avgangsRequests.$inferSelect, allUsers: (typeof users.$inferSelect)[]) {
  const signerIds: number[] = JSON.parse(req.requiredSigners || '[]')
  const digSigs: Record<string, boolean> = JSON.parse(req.digitalSignatures || '{}')

  const requiredSigners = signerIds.map(id => {
    const u = allUsers.find(u => u.id === id)
    return { userId: id, name: u?.name || 'Okänd', email: u?.email || '', signed: digSigs[id] === true }
  })

  const createdByUser = req.createdByUserId ? allUsers.find(u => u.id === req.createdByUserId) : null
  const targetUser = req.targetUserId ? allUsers.find(u => u.id === req.targetUserId) : null
  const generatedByUser = req.generatedBy ? allUsers.find(u => u.id === req.generatedBy) : null

  return {
    ...req,
    requiredSigners,
    createdByName: createdByUser?.name || null,
    targetName: targetUser?.name || null,
    generatedByName: generatedByUser?.name || null,
    allSigned: signerIds.length > 0 && signerIds.every(id => digSigs[id] === true),
  }
}

export const getAvgangRequestsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const admin = await requireStaffUser()
    const isDemo = isDemoTesterUser(admin)
    const db = await getDb()
    const requests = await db.select().from(avgangsRequests).orderBy(desc(avgangsRequests.createdAt))
    const scopedRequests = isDemo
      ? requests.filter((request) => request.createdByUserId === admin.id || request.targetUserId === admin.id)
      : requests
    const allUsers = isDemo ? [admin] : await db.select().from(users)
    const enriched = await Promise.all(scopedRequests.map((request) => enrichRequest(request, allUsers)))

    if (!isDemo) {
      return enriched
    }

    return enriched.map((request) => ({
      ...request,
      requiredSigners: request.requiredSigners.filter((signer) => signer.userId === admin.id),
      createdByName: request.createdByUserId === admin.id ? request.createdByName : null,
      targetName: request.targetUserId === admin.id ? request.targetName : null,
      generatedByName: request.generatedBy === admin.id ? request.generatedByName : null,
    }))
  })

export const getMyPendingSignaturesFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const admin = await requireStaffUser()
    const isDemo = isDemoTesterUser(admin)
    const db = await getDb()
    const requests = await db.select().from(avgangsRequests).orderBy(desc(avgangsRequests.createdAt))
    const scopedRequests = isDemo
      ? requests.filter((request) => request.createdByUserId === admin.id || request.targetUserId === admin.id)
      : requests
    const allUsers = isDemo ? [admin] : await db.select().from(users)
    const enriched = await Promise.all(scopedRequests.map((request) => enrichRequest(request, allUsers)))
    return enriched.filter(r =>
      r.status !== 'archived' &&
      r.requiredSigners.some(s => s.userId === admin.id && !s.signed)
    )
  })

export const createAvgangRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      namn: z.string(),
      pnr: z.string(),
      roll: z.string(),
      orsak: z.string(),
      datum: z.string(),
      targetUserId: z.number().nullable().optional(),
      requiredSignerIds: z.array(z.number()).default([]),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await requireOrganizerUser()
    const db = await getDb()
    const targetUserId = isDemoTesterUser(admin) ? admin.id : (data.targetUserId ?? null)
    const requiredSignerIds = scopeSignerIdsForUser(admin, data.requiredSignerIds)

    enforceDemoOwnUserScope(admin, targetUserId)

    const req = await db.insert(avgangsRequests).values({
      namn: data.namn,
      pnr: data.pnr,
      roll: data.roll,
      orsak: data.orsak,
      datum: new Date(data.datum),
      status: 'pending',
      createdByUserId: admin.id,
      targetUserId,
      requiredSigners: JSON.stringify(requiredSignerIds),
      digitalSignatures: '{}',
    }).returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'avgang.create',
      entityType: 'avgang_request',
      entityId: req[0].id,
      details: {
        namn: req[0].namn,
        targetUserId: req[0].targetUserId,
      },
    })

    const allUsers = await db.select().from(users)
    return enrichRequest(req[0], allUsers)
  })

export const addDigitalSignatureFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ requestId: z.number() }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await requireStaffUser()
    const db = await getDb()
    const req = await db.select().from(avgangsRequests).where(eq(avgangsRequests.id, data.requestId)).limit(1)
    if (!req[0]) throw new Error('Not found')

    if (isDemoTesterUser(admin) && req[0].createdByUserId !== admin.id && req[0].targetUserId !== admin.id) {
      throw new Error('Forbidden in demo mode')
    }

    const signerIds: number[] = JSON.parse(req[0].requiredSigners || '[]')
    if (!signerIds.includes(admin.id)) throw new Error('You are not a required signer')

    const digSigs: Record<string, boolean> = JSON.parse(req[0].digitalSignatures || '{}')
    digSigs[admin.id] = true

    const updated = await db.update(avgangsRequests)
      .set({ digitalSignatures: JSON.stringify(digSigs), updatedAt: new Date() })
      .where(eq(avgangsRequests.id, data.requestId))
      .returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'avgang.sign.digital',
      entityType: 'avgang_request',
      entityId: data.requestId,
    })

    const allUsers = await db.select().from(users)
    return enrichRequest(updated[0], allUsers)
  })

export const updateAvgangStatusFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      id: z.number(),
      status: z.enum(['pending', 'approved', 'rejected', 'archived']),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await requireOrganizerUser()
    const db = await getDb()
    const request = await db.select().from(avgangsRequests).where(eq(avgangsRequests.id, data.id)).limit(1)
    if (!request[0]) {
      throw new Error('Not found')
    }

    if (isDemoTesterUser(admin) && request[0].createdByUserId !== admin.id && request[0].targetUserId !== admin.id) {
      throw new Error('Forbidden in demo mode')
    }

    const updated = await db.update(avgangsRequests)
      .set({ status: data.status, reviewedBy: admin.id, updatedAt: new Date() })
      .where(eq(avgangsRequests.id, data.id))
      .returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'avgang.status.update',
      entityType: 'avgang_request',
      entityId: data.id,
      details: { status: data.status },
    })

    const allUsers = await db.select().from(users)
    return enrichRequest(updated[0], allUsers)
  })

export const markPhysicallySignedFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ id: z.number() }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await requireOrganizerUser()
    const db = await getDb()
    const req = await db.select().from(avgangsRequests).where(eq(avgangsRequests.id, data.id)).limit(1)
    if (!req[0]) throw new Error('Not found')

    if (isDemoTesterUser(admin) && req[0].createdByUserId !== admin.id && req[0].targetUserId !== admin.id) {
      throw new Error('Forbidden in demo mode')
    }

    if (req[0].status !== 'approved') throw new Error('Must be approved first')

    enforceDemoOwnUserScope(admin, req[0].targetUserId)

    const updated = await db.update(avgangsRequests)
      .set({ physicalSigned: true, updatedAt: new Date() })
      .where(eq(avgangsRequests.id, data.id))
      .returning()

    // Lock target account if linked
    if (req[0].targetUserId) {
      await lockUserFn({ data: { userId: req[0].targetUserId } })
    }

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'avgang.mark.physical_signed',
      entityType: 'avgang_request',
      entityId: data.id,
      details: {
        targetUserId: req[0].targetUserId,
      },
    })

    const allUsers = await db.select().from(users)
    return enrichRequest(updated[0], allUsers)
  })

export const recordPdfGenerationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ id: z.number() }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await requireStaffUser()
    const db = await getDb()
    const existing = await db.select().from(avgangsRequests).where(eq(avgangsRequests.id, data.id)).limit(1)
    if (!existing[0]) {
      throw new Error('Not found')
    }

    if (isDemoTesterUser(admin) && existing[0].createdByUserId !== admin.id && existing[0].targetUserId !== admin.id) {
      throw new Error('Forbidden in demo mode')
    }

    const updated = await db.update(avgangsRequests)
      .set({ generatedAt: new Date(), generatedBy: admin.id, updatedAt: new Date() })
      .where(eq(avgangsRequests.id, data.id))
      .returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'avgang.pdf.generated',
      entityType: 'avgang_request',
      entityId: data.id,
    })

    const allUsers = await db.select().from(users)
    return enrichRequest(updated[0], allUsers)
  })

export const fixAvgangSpellingFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: unknown) =>
    z
      .object({
        namn: z.string().min(1),
        roll: z.string().min(1),
        orsak: z.string().min(1),
      })
      .parse(payload)
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

    const prompt = `Du är en svensk språkgranskare för administrativa avgångsunderlag.

INSTRUKTIONER:
1. Korrigera ENDAST stavning och grammatik.
  2. Förändra inte sakuppgifter eller innebörden.
  3. Behåll namn och roller så nära originalet som möjligt.
4. Returnera ENDAST valid JSON pa exakt format:
{"namn":"...","roll":"...","orsak":"..."}

NAMN:
${data.namn}

ROLL:
${data.roll}

ORSAK:
${data.orsak}`

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
        namn: z.string().min(1),
        roll: z.string().min(1),
        orsak: z.string().min(1),
      })
      .parse(JSON.parse(normalized))
  })
