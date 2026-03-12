'use server'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/index'
import { users, posts } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { getCookie } from '@tanstack/react-start/server'
import { GoogleGenAI } from '@google/genai'
import { requireOrganizerUser } from '../lib/access'
import { writeActivityLog } from './logs'

export const typeValidator = z.union([z.literal('blog'), z.literal('news')])

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

const translationCache = new Map<string, string>()

async function translateWithGoogle(text: string, from = 'sv', to = 'en'): Promise<string> {
  if (!text.trim()) return text

  const cacheKey = `${from}:${to}:${text}`
  const cached = translationCache.get(cacheKey)
  if (cached) return cached

  const chunks = splitIntoChunks(text)
  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Google Translate request failed: ${response.status}`)
    }

    const data = (await response.json()) as unknown
    const translated = Array.isArray(data) && Array.isArray(data[0])
      ? (data[0] as Array<Array<string>>)
          .map((segment) => segment?.[0] ?? '')
          .join('')
      : chunk

    translatedChunks.push(translated)
  }

  const translatedText = translatedChunks.join('')
  translationCache.set(cacheKey, translatedText)
  return translatedText
}

async function translatePostToEnglish(post: typeof posts.$inferSelect) {
  const [title, excerpt, content] = await Promise.all([
    translateWithGoogle(post.title),
    post.excerpt ? translateWithGoogle(post.excerpt) : Promise.resolve(post.excerpt),
    translateWithGoogle(post.content),
  ])

  return {
    ...post,
    title,
    excerpt,
    content,
  }
}

export const getPostsFn = createServerFn({ method: "GET" })
  .inputValidator((type: string) => z.enum(['blog', 'news']).parse(type))
  .handler(async ({ data: type }) => {
    return await db.select()
      .from(posts)
      .where(eq(posts.type, type))
      .orderBy(desc(posts.createdAt))
      .limit(10)
  })

export const getPostsTranslatedToEnglishFn = createServerFn({ method: 'GET' })
  .inputValidator((type: string) => z.enum(['blog', 'news']).parse(type))
  .handler(async ({ data: type }) => {
    const postsResult = await db.select()
      .from(posts)
      .where(eq(posts.type, type))
      .orderBy(desc(posts.createdAt))
      .limit(10)

    return await Promise.all(postsResult.map((post) => translatePostToEnglish(post)))
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

export const getPostBySlugTranslatedToEnglishFn = createServerFn({ method: 'GET' })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const post = await db.select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1)

    if (!post[0]) {
      return null
    }

    return await translatePostToEnglish(post[0])
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
    const currentUser = await requireOrganizerUser()

    const updatedPost = await db.update(posts).set({
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      type: data.type,
      slug: data.slug,
    }).where(eq(posts.id, data.id)).returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'post.update',
      entityType: 'post',
      entityId: data.id,
      details: {
        slug: data.slug,
        type: data.type,
      },
    })

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
    const currentUser = await requireOrganizerUser()

    const newPost = await db.insert(posts).values({
      ...data,
      authorId: currentUser.id,
      published: true, // Auto publish for now
    }).returning()

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'post.create',
      entityType: 'post',
      entityId: newPost[0].id,
      details: {
        slug: newPost[0].slug,
        type: newPost[0].type,
      },
    })

    return newPost[0]
  })

export const deletePostFn = createServerFn({ method: "POST" })
  .inputValidator((id: number) => z.number().parse(id))
  .handler(async ({ data: id }) => {
    const currentUser = await requireOrganizerUser()

    const deletedPost = await db.delete(posts)
      .where(eq(posts.id, id))
      .returning()

    if (deletedPost[0]) {
      await writeActivityLog({
        actorUserId: currentUser.id,
        actorRole: currentUser.role,
        action: 'post.delete',
        entityType: 'post',
        entityId: deletedPost[0].id,
        details: {
          slug: deletedPost[0].slug,
          type: deletedPost[0].type,
        },
      })
    }
      
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

    // Check if content has any markdown syntax
    const hasMarkdown = /[#*\[\]`~>-]/.test(data.content)

    const prompt = `You are a Swedish+English copy editor and markdown formatter.

INSTRUCTIONS:
1. Fix ONLY spelling and grammar mistakes
2. Preserve ALL existing markdown exactly: **bold**, *italic*, # headers, lists, links, code blocks, etc.
3. DO NOT change proper nouns: "Lanköping", "Linköping" must stay EXACTLY as typed in input
4. Brand names and company names stay UNCHANGED
${!hasMarkdown ? `5. THIS CONTENT HAS NO MARKDOWN. Convert it to markdown:
   - Use appropriate # headers for main topics
   - Use ## or ### for subsections
   - Use **bold** for important concepts
   - Use - for lists
   - Keep natural paragraph breaks` : `5. Content already has markdown - preserve it exactly while fixing typos`}

Output must be valid JSON: {"title":"...","content":"..."}

TITLE: ${data.title}

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
