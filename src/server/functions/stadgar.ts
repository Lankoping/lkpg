'use server'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/index'
import { stadgar, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { requireOrganizerUser, requireStaffUser } from '../lib/access'
import { writeActivityLog } from './logs'

export const getStadgarFn = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireStaffUser()
    const data = await db.select().from(stadgar).limit(1)
    if (!data[0]) {
      return {
        id: 0,
        content: '',
        signatures: '{}',
        updatedAt: new Date(),
        createdAt: new Date(),
        signers: []
      }
    }

    // Get signer info
    let signatures: Record<string, boolean> = {}
    try {
      signatures = JSON.parse(data[0].signatures || '{}')
    } catch (e) {
      signatures = {}
    }

    const userIds = Object.keys(signatures).map(Number)
    const signerUsers = userIds.length > 0 
      ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
      : []

    return {
      ...data[0],
      signers: signerUsers
        .filter(u => userIds.includes(u.id))
        .map(u => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          signed: signatures[u.id] || false
        }))
    }
  })

export const updateStadgarFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        content: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()

    const existing = await db.select().from(stadgar).limit(1)
    
    if (existing.length > 0) {
      const result = await db
        .update(stadgar)
        .set({
          content: data.content,
          updatedBy: currentUser.id,
          updatedAt: new Date(),
        })
        .where(eq(stadgar.id, existing[0].id))
        .returning()

      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'stadgar.update',
        entityType: 'stadgar',
        entityId: result[0].id,
      })

      return result[0]
    } else {
      const result = await db
        .insert(stadgar)
        .values({
          content: data.content,
          updatedBy: currentUser.id,
          signatures: JSON.stringify({}),
        })
        .returning()

      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'stadgar.create',
        entityType: 'stadgar',
        entityId: result[0].id,
      })

      return result[0]
    }
  })

export const updateSignatureFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
        signed: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()

    const existing = await db.select().from(stadgar).limit(1)
    if (!existing[0]) {
      throw new Error('Stadgar not found')
    }

    const sigs = JSON.parse(existing[0].signatures || '{}')
    const isListedSigner = Object.prototype.hasOwnProperty.call(sigs, data.userId.toString())
    if (!isListedSigner) {
      throw new Error('Signer not found')
    }

    if (currentUser.id !== data.userId || data.signed !== true) {
      throw new Error('Forbidden')
    }

    sigs[data.userId.toString()] = data.signed

    const result = await db
      .update(stadgar)
      .set({
        signatures: JSON.stringify(sigs),
        updatedBy: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(stadgar.id, existing[0].id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'stadgar.sign',
      entityType: 'stadgar',
      entityId: result[0].id,
      details: { userId: data.userId },
    })

    return result[0]
  })

export const fixStadgarSpellingFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: unknown) =>
    z
      .object({
        content: z.string().min(1),
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

    const prompt = `Du är en svensk språkgranskare för stadgetexter.

INSTRUKTIONER:
1. Korrigera ENDAST stavning och grammatik.
  2. Behåll juridisk och organisatorisk innebörd exakt oförändrad.
  3. Behåll paragrafindelning, punktlistor och radbrytningar.
4. Returnera ENDAST valid JSON pa exakt format:
{"content":"..."}

CONTENT:
${data.content}`

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
        content: z.string().min(1),
      })
      .parse(JSON.parse(normalized))
  })

export const addSignerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()

    // Check user exists
    const user = await db.select().from(users).where(eq(users.id, data.userId)).limit(1)
    if (!user[0]) {
      throw new Error('User not found')
    }

    const existing = await db.select().from(stadgar).limit(1)
    let sigs: Record<string, boolean> = {}
    
    if (existing[0]) {
      sigs = JSON.parse(existing[0].signatures || '{}')
    }

    sigs[data.userId.toString()] = false

    if (existing[0]) {
      const result = await db
        .update(stadgar)
        .set({
          signatures: JSON.stringify(sigs),
          updatedBy: currentUser.id,
          updatedAt: new Date(),
        })
        .where(eq(stadgar.id, existing[0].id))
        .returning()

      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'stadgar.signer.add',
        entityType: 'stadgar',
        entityId: result[0].id,
        details: { userId: data.userId },
      })

      return result[0]
    } else {
      const result = await db
        .insert(stadgar)
        .values({
          content: '',
          updatedBy: currentUser.id,
          signatures: JSON.stringify(sigs),
        })
        .returning()

      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'stadgar.create',
        entityType: 'stadgar',
        entityId: result[0].id,
        details: { initialSignerUserId: data.userId },
      })

      return result[0]
    }
  })

export const removeSignerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()

    const existing = await db.select().from(stadgar).limit(1)
    if (!existing[0]) {
      throw new Error('Stadgar not found')
    }

    const sigs = JSON.parse(existing[0].signatures || '{}')
    delete sigs[data.userId.toString()]

    const result = await db
      .update(stadgar)
      .set({
        signatures: JSON.stringify(sigs),
        updatedBy: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(stadgar.id, existing[0].id))
      .returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'stadgar.signer.remove',
      entityType: 'stadgar',
      entityId: result[0].id,
      details: { userId: data.userId },
    })

    return result[0]
  })

export const exportStadgarPdfFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const currentUser = await requireStaffUser()

    const data = await db.select().from(stadgar).limit(1)
    if (!data[0]) {
      throw new Error('Stadgar not found')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'stadgar.export.pdf',
      entityType: 'stadgar',
      entityId: data[0].id,
    })

    return {
      success: true,
      message: 'Stadgar exporterade',
      content: data[0].content,
      signatures: data[0].signatures,
    }
  })
