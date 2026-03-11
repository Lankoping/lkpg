'use server'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/index'
import { users, posts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { getCookie } from '@tanstack/react-start/server'
import { GoogleGenAI } from '@google/genai'

export const typeValidator = z.union([z.literal('blog'), z.literal('news')])

export const getPostsFn = createServerFn({ method: "GET" })
  .inputValidator((type: string) => z.enum(['blog', 'news']).parse(type))
  .handler(async ({ data: type }) => {
    return await db.select()
      .from(posts)
      .where(eq(posts.type, type))
      .orderBy(desc(posts.createdAt))
      .limit(10)
  })

export const getPostBySlugFn = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const post = await db.select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1)
    
    return post[0] || null
  })

export const getPostByIdFn = createServerFn({ method: "GET" })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    const post = await db.select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1)
    
    return post[0] || null
  })

export const updatePostFn = createServerFn({ method: "POST" })
  .inputValidator((post: unknown) => {
    return z.object({
      id: z.number(),
      title: z.string(),
      content: z.string(),
      excerpt: z.string().optional(),
      type: z.enum(['blog', 'news']),
      slug: z.string(),
    }).parse(post)
  })
  .handler(async ({ data }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

    const updatedPost = await db.update(posts).set({
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      type: data.type,
      slug: data.slug,
    }).where(eq(posts.id, data.id)).returning()

    return updatedPost[0]
  })

export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((post: unknown) => {
    return z.object({
      title: z.string(),
      content: z.string(),
      excerpt: z.string().optional(),
      type: z.enum(['blog', 'news']),
      slug: z.string(),
      authorId: z.number().optional()
    }).parse(post)
  })
  .handler(async ({ data }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

    const newPost = await db.insert(posts).values({
      ...data,
      authorId: currentUser[0].id,
      published: true, // Auto publish for now
    }).returning()
    return newPost[0]
  })

export const deletePostFn = createServerFn({ method: "POST" })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

    const deletedPost = await db.delete(posts)
      .where(eq(posts.id, id))
      .returning()
      
    return deletedPost[0]
  })

export const fixPostSpellingFn = createServerFn({ method: 'POST' })
  .inputValidator((payload: unknown) => {
    return z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
      })
      .parse(payload)
  })
  .handler(async ({ data }) => {
    const currentUserId = getCookie('session')
    if (!currentUserId) {
      throw new Error('Unauthorized')
    }

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(currentUserId)))
      .limit(1)

    if (!currentUser[0] || currentUser[0].role !== 'admin') {
      throw new Error('Forbidden')
    }

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

    const prompt = `You are a careful Swedish+English copy editor and markdown formatter.

TASK:
1. Fix ONLY spelling and obvious grammar mistakes
2. Preserve all existing markdown formatting if present
3. If content is plain text with NO markdown, add basic markdown formatting:
   - Use # for main sections
   - Use ## for subsections
   - Use - for bullet lists where appropriate
   - Use **bold** for important terms
   - Keep natural paragraph breaks
4. NEVER change proper nouns or brand names (esp. "Lankoping", "Linköping" - use input exactly)

CRITICAL RULES:
- Preserve EXACT existing markdown: **bold**, *italic*, # headers, - lists, [links](url), \`code\`, etc.
- Do NOT change proper nouns, company names, or brand names from the input
- Do NOT remove any markdown formatting
- Do NOT add new sections, just format plain text as markdown
- Preserve original meaning, tone, and structure
- Return valid JSON only: {"title":"...","content":"..."}

TITLE:
${data.title}

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

    const parsed = z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
      })
      .parse(JSON.parse(normalized))

    return parsed
  })
