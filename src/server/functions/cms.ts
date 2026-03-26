'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import {
  heroContent,
  infoSections,
  teamMembers,
  pages,
  navigationItems,
  siteSettings,
} from '../db/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { z } from 'zod'
import { requireOrganizerUser } from '../lib/access'

const translationCache = new Map<string, string>()

async function translateWithGoogle(text: string, from = 'sv', to = 'en'): Promise<string> {
  if (!text.trim()) return text

  const cacheKey = `${from}:${to}:${text}`
  const cached = translationCache.get(cacheKey)
  if (cached) return cached

  try {
    const chunks = splitIntoChunks(text)
    const translatedChunks: string[] = []

    for (const chunk of chunks) {
      const url =
        'https://translate.googleapis.com/translate_a/single' +
        `?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (!response.ok) {
          console.warn(`[v0] Google Translate API returned ${response.status}, using original text`)
          translatedChunks.push(chunk)
          continue
        }

        const data = (await response.json()) as unknown
        const translated = Array.isArray(data) && Array.isArray(data[0])
          ? (data[0] as Array<Array<string>>)
              .map((segment) => segment?.[0] ?? '')
              .join('')
          : chunk

        translatedChunks.push(translated)
      } catch (error) {
        console.warn(`[v0] Translation failed for chunk, using original text`, error)
        translatedChunks.push(chunk)
      }
    }

    const translatedText = translatedChunks.join('')
    translationCache.set(cacheKey, translatedText)
    return translatedText
  } catch (error) {
    console.warn(`[v0] Translation failed, returning original text`, error)
    return text
  }
}

function splitIntoChunks(text: string, maxChunkLength = 1000): string[] {
  if (text.length <= maxChunkLength) return [text]

  const chunks: string[] = []
  let current = ''

  for (const part of text.split(/(\n\n+)/)) {
    if ((current + part).length > maxChunkLength && current.length > 0) {
      chunks.push(current)
      current = part
      continue
    }
    current += part
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

// Hero Content Functions
export const getHeroContentFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const hero = await db.select().from(heroContent).limit(1)
  return hero[0] || null
})

export const updateHeroContentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        eyebrow: z.string(),
        headline: z.string(),
        tagline: z.string(),
        description: z.string(),
        primaryButtonText: z.string(),
        primaryButtonLink: z.string(),
        secondaryButtonText: z.string().optional(),
        secondaryButtonLink: z.string().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    // Translate to English with error handling
    let eyebrowEn = data.eyebrow
    let headlineEn = data.headline
    let taglineEn = data.tagline
    let descriptionEn = data.description
    let primaryButtonTextEn = data.primaryButtonText
    let secondaryButtonTextEn = data.secondaryButtonText

    try {
      [eyebrowEn, headlineEn, taglineEn, descriptionEn, primaryButtonTextEn, secondaryButtonTextEn] = 
        await Promise.all([
          translateWithGoogle(data.eyebrow),
          translateWithGoogle(data.headline),
          translateWithGoogle(data.tagline),
          translateWithGoogle(data.description),
          translateWithGoogle(data.primaryButtonText),
          data.secondaryButtonText ? translateWithGoogle(data.secondaryButtonText) : Promise.resolve(undefined),
        ])
    } catch (error) {
      console.warn('[v0] Translation failed, using Swedish text for English fields', error)
      // If translation fails, use Swedish text for English fields
    }

    const existing = await db.select().from(heroContent).limit(1)

    if (existing[0]) {
      const updated = await db
        .update(heroContent)
        .set({
          eyebrow: data.eyebrow,
          eyebrowEn,
          headline: data.headline,
          headlineEn,
          tagline: data.tagline,
          taglineEn,
          description: data.description,
          descriptionEn,
          primaryButtonText: data.primaryButtonText,
          primaryButtonTextEn,
          primaryButtonLink: data.primaryButtonLink,
          secondaryButtonText: data.secondaryButtonText,
          secondaryButtonTextEn,
          secondaryButtonLink: data.secondaryButtonLink,
          updatedAt: new Date(),
        })
        .where(eq(heroContent.id, existing[0].id))
        .returning()
      return updated[0]
    } else {
      const created = await db
        .insert(heroContent)
        .values({
          eyebrow: data.eyebrow,
          eyebrowEn,
          headline: data.headline,
          headlineEn,
          tagline: data.tagline,
          taglineEn,
          description: data.description,
          descriptionEn,
          primaryButtonText: data.primaryButtonText,
          primaryButtonTextEn,
          primaryButtonLink: data.primaryButtonLink,
          secondaryButtonText: data.secondaryButtonText,
          secondaryButtonTextEn,
          secondaryButtonLink: data.secondaryButtonLink,
        })
        .returning()
      return created[0]
    }
  })

// Info Sections Functions
export const getInfoSectionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  return await db
    .select()
    .from(infoSections)
    .where(eq(infoSections.isActive, true))
    .orderBy(asc(infoSections.sortOrder))
})

export const createInfoSectionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        slug: z.string(),
        icon: z.string(),
        title: z.string(),
        description: z.string(),
        sortOrder: z.number().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    let titleEn = data.title
    let descriptionEn = data.description

    try {
      [titleEn, descriptionEn] = await Promise.all([
        translateWithGoogle(data.title),
        translateWithGoogle(data.description),
      ])
    } catch (error) {
      console.warn('[v0] Translation failed for info section, using Swedish text', error)
    }

    const created = await db
      .insert(infoSections)
      .values({
        slug: data.slug,
        icon: data.icon,
        title: data.title,
        titleEn,
        description: data.description,
        descriptionEn,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
      })
      .returning()

    return created[0]
  })

export const updateInfoSectionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        id: z.number(),
        slug: z.string(),
        icon: z.string(),
        title: z.string(),
        description: z.string(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    let titleEn = data.title
    let descriptionEn = data.description

    try {
      [titleEn, descriptionEn] = await Promise.all([
        translateWithGoogle(data.title),
        translateWithGoogle(data.description),
      ])
    } catch (error) {
      console.warn('[v0] Translation failed for info section update, using Swedish text', error)
    }

    const updated = await db
      .update(infoSections)
      .set({
        slug: data.slug,
        icon: data.icon,
        title: data.title,
        titleEn,
        description: data.description,
        descriptionEn,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(infoSections.id, data.id))
      .returning()

    return updated[0]
  })

export const deleteInfoSectionFn = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    await requireOrganizerUser()

    const db = await getDb()
    return await db
      .update(infoSections)
      .set({ isActive: false })
      .where(eq(infoSections.id, id))
      .returning()
  })

// Team Members Functions
export const getTeamMembersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  return await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.isActive, true))
    .orderBy(asc(teamMembers.sortOrder))
})

export const createTeamMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        name: z.string(),
        role: z.string(),
        description: z.string(),
        icon: z.string(),
        sortOrder: z.number().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    let roleEn = data.role
    let descriptionEn = data.description

    try {
      [roleEn, descriptionEn] = await Promise.all([
        translateWithGoogle(data.role),
        translateWithGoogle(data.description),
      ])
    } catch (error) {
      console.warn('[v0] Translation failed for team member, using Swedish text', error)
    }

    const created = await db
      .insert(teamMembers)
      .values({
        name: data.name,
        role: data.role,
        roleEn,
        description: data.description,
        descriptionEn,
        icon: data.icon,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
      })
      .returning()

    return created[0]
  })

export const updateTeamMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        id: z.number(),
        name: z.string(),
        role: z.string(),
        description: z.string(),
        icon: z.string(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    let roleEn = data.role
    let descriptionEn = data.description

    try {
      [roleEn, descriptionEn] = await Promise.all([
        translateWithGoogle(data.role),
        translateWithGoogle(data.description),
      ])
    } catch (error) {
      console.warn('[v0] Translation failed for team member update, using Swedish text', error)
    }

    const updated = await db
      .update(teamMembers)
      .set({
        name: data.name,
        role: data.role,
        roleEn,
        description: data.description,
        descriptionEn,
        icon: data.icon,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, data.id))
      .returning()

    return updated[0]
  })

export const deleteTeamMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    await requireOrganizerUser()

    const db = await getDb()
    return await db
      .update(teamMembers)
      .set({ isActive: false })
      .where(eq(teamMembers.id, id))
      .returning()
  })

// Pages Functions
export const getPagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  return await db
    .select()
    .from(pages)
    .where(eq(pages.isPublished, true))
    .orderBy(desc(pages.updatedAt))
})

export const getPageBySlugFn = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const db = await getDb()
    const page = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1)
    return page[0] || null
  })

export const createPageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        slug: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        content: z.array(z.record(z.unknown())),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    const [titleEn, subtitleEn] = await Promise.all([
      translateWithGoogle(data.title),
      data.subtitle ? translateWithGoogle(data.subtitle) : Promise.resolve(undefined),
    ])

    const created = await db
      .insert(pages)
      .values({
        slug: data.slug,
        title: data.title,
        titleEn,
        subtitle: data.subtitle,
        subtitleEn,
        content: data.content,
        isPublished: true,
      })
      .returning()

    return created[0]
  })

export const updatePageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        id: z.number(),
        slug: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        content: z.array(z.record(z.unknown())),
        isPublished: z.boolean().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    const [titleEn, subtitleEn] = await Promise.all([
      translateWithGoogle(data.title),
      data.subtitle ? translateWithGoogle(data.subtitle) : Promise.resolve(undefined),
    ])

    const updated = await db
      .update(pages)
      .set({
        slug: data.slug,
        title: data.title,
        titleEn,
        subtitle: data.subtitle,
        subtitleEn,
        content: data.content,
        isPublished: data.isPublished ?? true,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, data.id))
      .returning()

    return updated[0]
  })

export const deletePageFn = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    await requireOrganizerUser()

    const db = await getDb()
    return await db
      .update(pages)
      .set({ isPublished: false })
      .where(eq(pages.id, id))
      .returning()
  })

// Navigation Items Functions
export const getNavigationItemsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  return await db
    .select()
    .from(navigationItems)
    .where(eq(navigationItems.isActive, true))
    .orderBy(asc(navigationItems.sortOrder))
})

export const createNavigationItemFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        label: z.string(),
        href: z.string(),
        sortOrder: z.number().optional(),
        parentId: z.number().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    const labelEn = await translateWithGoogle(data.label)

    const created = await db
      .insert(navigationItems)
      .values({
        label: data.label,
        labelEn,
        href: data.href,
        sortOrder: data.sortOrder ?? 0,
        parentId: data.parentId,
        isActive: true,
      })
      .returning()

    return created[0]
  })

export const updateNavigationItemFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z
      .object({
        id: z.number(),
        label: z.string(),
        href: z.string(),
        sortOrder: z.number().optional(),
        parentId: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    const labelEn = await translateWithGoogle(data.label)

    const updated = await db
      .update(navigationItems)
      .set({
        label: data.label,
        labelEn,
        href: data.href,
        sortOrder: data.sortOrder ?? 0,
        parentId: data.parentId,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(navigationItems.id, data.id))
      .returning()

    return updated[0]
  })

export const deleteNavigationItemFn = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    await requireOrganizerUser()

    const db = await getDb()
    return await db
      .update(navigationItems)
      .set({ isActive: false })
      .where(eq(navigationItems.id, id))
      .returning()
  })

// Site Settings Functions
export const getSiteSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const settings = await db.select().from(siteSettings)
  
  const result: Record<string, unknown> = {}
  for (const setting of settings) {
    result[setting.key] = setting.value
  }
  return result
})

export const updateSiteSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    return z.record(z.unknown()).parse(data)
  })
  .handler(async ({ data }) => {
    await requireOrganizerUser()

    const db = await getDb()

    for (const [key, value] of Object.entries(data)) {
      const existing = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1)

      if (existing[0]) {
        await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key))
      } else {
        await db.insert(siteSettings).values({ key, value })
      }
    }

    const settings = await db.select().from(siteSettings)
    const result: Record<string, unknown> = {}
    for (const setting of settings) {
      result[setting.key] = setting.value
    }
    return result
  })
