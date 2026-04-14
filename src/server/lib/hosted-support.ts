import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { hostedHelpContext } from '../../lib/hosted-help'
import { getDb } from '../db/runtime'
import { hostedSupportTicketMessages, users } from '../db/schema'

export const ticketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

type HostedSupportAssistantResult = {
  summary: string
  answer: string
  category: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  labels: string[]
  followUpQuestions: string[]
  shouldOpenTicket: boolean
  suggestedTicketMessage: string
}

function buildTeamMemberFollowUpQuestions() {
  return [
    'What is the affected team member email?',
    'Are they in the same organization as you?',
    'What exact error message do they see on login?',
  ]
}

function normalizeAssistantFollowUpQuestions(prompt: string, questions: string[]) {
  const loweredPrompt = prompt.toLowerCase()
  const isTeamMemberContext = /(team\s*member|teammate|my\s+team|our\s+team|team\s+members)/.test(loweredPrompt)
  if (isTeamMemberContext) {
    return buildTeamMemberFollowUpQuestions()
  }

  const isUserDeletionContext = /(delete\s+(a\s+)?user|remove\s+(a\s+)?user|delete\s+account|remove\s+account)/.test(loweredPrompt)
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(prompt)
  const hasOrganizationReference = /(org|organisation|organization)\b/i.test(prompt)
  if (isUserDeletionContext && hasEmail && hasOrganizationReference) {
    return []
  }

  return Array.from(
    new Set(
      questions
        .map((question) => question.trim())
        .filter(Boolean),
    ),
  ).slice(0, 3)
}

function extractFirstJsonObject(raw: string) {
  const trimmed = raw.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed
  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Assistant did not return JSON')
  }

  return candidate.slice(firstBrace, lastBrace + 1)
}

export function buildHostedSupportConversationContext(messages: Array<{ senderRole: string; message: string }>) {
  return messages
    .filter((entry) => {
      const body = entry.message || ''
      if (entry.senderRole === 'organizer' && (body.startsWith('Nano:') || body.includes('[AI First Responder]'))) {
        return false
      }
      return Boolean(body.trim())
    })
    .slice(-8)
    .map((entry) => `${entry.senderRole === 'organizer' ? 'Staff' : 'Hosted'}: ${entry.message.trim()}`)
    .join('\n')
}

export function hasRestrictedFlags(message: string): boolean {
  return /\bflag\s*=\s*(application|funding)\b/i.test(message)
}

export function buildHostedSupportHeuristic(message: string): HostedSupportAssistantResult {
  const lowered = message.toLowerCase()

  let category = 'general'
  if (/login|password|account|2fa|two factor|sign in/.test(lowered)) category = 'account-access'
  else if (/bill|invoice|refund|payment|cost|price/.test(lowered)) category = 'billing'
  else if (/upload|file|cdn|link|storage|bucket/.test(lowered)) category = 'storage'
  else if (/apply|application|funding|request/.test(lowered)) category = 'application'
  else if (/error|crash|bug|broken|failed|500|403|404/.test(lowered)) category = 'technical-issue'

  let priority: HostedSupportAssistantResult['priority'] = 'low'
  if (/urgent|asap|blocked|production down|cannot access|can't access|outage/.test(lowered)) {
    priority = 'high'
  }
  if (/security|data leak|breach/.test(lowered)) {
    priority = 'urgent'
  }

  const labels = [category]
  const shortMessage = message.trim().length < 40
  const followUpQuestions = shortMessage
    ? [
        'What did you expect to happen?',
        'What actually happened (exact error text if any)?',
        'Which page or feature were you using?',
      ]
    : ['Can you share exact steps to reproduce this?', 'Did this start after a recent change?']

  const normalizedFollowUpQuestions = normalizeAssistantFollowUpQuestions(message, followUpQuestions)

  return {
    summary:
      category === 'storage'
        ? 'Storage issue: check limits, file path, and CDN or upload configuration.'
        : category === 'account-access'
          ? 'Account access issue: verify login, password, and 2FA details.'
          : category === 'billing'
            ? 'Billing issue: verify payment method, receipts, and requested amount.'
            : category === 'technical-issue'
              ? 'Technical issue: gather exact error text and reproduction steps.'
              : 'General support request: more details needed to triage.',
    answer:
      category === 'storage'
        ? 'This looks like a storage-related question. Check the Storage section for limits, upload flow, and CDN links. If the issue remains, open a ticket with error text and file details.'
        : 'Thanks for the details. I can help triage this. If this blocks your work, open a ticket and include exact steps, expected behavior, and any error message.',
    category,
    priority,
    labels,
    followUpQuestions: normalizedFollowUpQuestions,
    shouldOpenTicket: true,
    suggestedTicketMessage: message.trim() || 'Please describe your issue and expected outcome.',
  }
}

export async function getHostedSupportAssistantReply(message: string, conversationContext?: string): Promise<HostedSupportAssistantResult> {
  const prompt = message.trim()
  if (!prompt) {
    return buildHostedSupportHeuristic('')
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return buildHostedSupportHeuristic(prompt)
  }

  const systemPrompt = [
    'You are a hosted support triage assistant for Lan Foundary.',
    'Use the provided FAQ and product info as ground truth when possible.',
    'Classify category and priority. Ask for missing details when needed.',
    'Keep followUpQuestions short and limited to the 1-3 most important questions.',
    'Do not repeat the same request in both answer and followUpQuestions.',
    'Use the conversation context and do not ask for information already provided earlier in the same ticket.',
    'If reporter mentions a team member or teammate in the same organization, do not ask them to open a separate ticket.',
    'In that case ask for the affected member email, whether it is the same organization, and the exact error text.',
    'If the question can be solved by FAQ without staff action, set shouldOpenTicket to false.',
    'Return only JSON with this shape:',
    '{"summary": string, "answer": string, "category": string, "priority": "low"|"normal"|"high"|"urgent", "labels": string[], "followUpQuestions": string[], "shouldOpenTicket": boolean, "suggestedTicketMessage": string}',
    'Keep answer concise and actionable.',
  ].join('\n')

  const userPrompt = [
    'FAQ and app context:',
    hostedHelpContext,
    '',
    'Current ticket conversation:',
    conversationContext?.trim() || '(none)',
    '',
    'User request:',
    prompt,
  ].join('\n')

  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-nemo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      return buildHostedSupportHeuristic(prompt)
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = payload.choices?.[0]?.message?.content ?? ''
    const json = extractFirstJsonObject(content)
    const parsed = z
      .object({
        summary: z.string().min(1),
        answer: z.string().min(1),
        category: z.string().min(1),
        priority: ticketPrioritySchema,
        labels: z.array(z.string()).default([]),
        followUpQuestions: z.array(z.string()).default([]),
        shouldOpenTicket: z.boolean().default(true),
        suggestedTicketMessage: z.string().min(1),
      })
      .parse(JSON.parse(json))

    const normalizedFollowUpQuestions = normalizeAssistantFollowUpQuestions(prompt, parsed.followUpQuestions)

    return {
      ...parsed,
      summary: parsed.summary.trim(),
      labels: parsed.labels.map((label) => label.trim()).filter(Boolean),
      followUpQuestions: normalizedFollowUpQuestions,
    }
  } catch {
    return buildHostedSupportHeuristic(prompt)
  }
}

export function normalizeTicketLabels(value: string) {
  const seen = new Set<string>()
  const labels: string[] = []

  for (const raw of value.split(/[\n,;]/)) {
    const cleaned = raw.trim()
    if (!cleaned) continue
    const normalized = cleaned.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    labels.push(normalized)
  }

  return labels.join(', ')
}

export async function assertOrganizerAssignee(db: Awaited<ReturnType<typeof getDb>>, assignedToUserId: number | null | undefined) {
  if (assignedToUserId == null) {
    return null
  }

  const assignee = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, assignedToUserId), eq(users.role, 'organizer')))
    .limit(1)

  if (!assignee[0]) {
    throw new Error('Assigned user must be an organizer')
  }

  return assignee[0].id
}

export async function getAutomationOrganizerUserId(db: Awaited<ReturnType<typeof getDb>>) {
  const organizer = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'organizer'))
    .orderBy(desc(users.id))
    .limit(1)

  return organizer[0]?.id ?? null
}

export function combineTicketLabels(...parts: Array<string | string[] | undefined>) {
  const merged = parts
    .flatMap((part) => {
      if (!part) return [] as string[]
      if (Array.isArray(part)) return part
      return part.split(',')
    })
    .map((item) => item.trim())
    .filter(Boolean)

  return normalizeTicketLabels(merged.join(', '))
}

export function deriveApplicationTicketLabels(input: {
  organizationStatus: string
  hasHcbAccount: boolean
  preferredPaymentMethod: string
  requestedFunds: number
  eventName: string
}) {
  const labels = new Set<string>()

  labels.add('application')
  labels.add('funding-request')

  if (input.organizationStatus === 'registered_nonprofit_at_hackclub_bank') {
    labels.add('nonprofit')
  }
  if (input.organizationStatus === 'individual_group_for_reimbursements_only') {
    labels.add('reimbursement-only')
  }

  if (input.hasHcbAccount) {
    labels.add('hcb')
  } else {
    labels.add('no-hcb')
  }

  if (input.preferredPaymentMethod === 'direct_hcb_transfer') {
    labels.add('direct-transfer')
  } else {
    labels.add('reimbursement')
  }

  if (input.requestedFunds >= 15000) {
    labels.add('large-request')
  } else if (input.requestedFunds >= 5000) {
    labels.add('medium-request')
  } else {
    labels.add('small-request')
  }

  const loweredEvent = input.eventName.toLowerCase()
  if (/workshop|talk|lecture|seminar/.test(loweredEvent)) labels.add('workshop')
  if (/music|concert|gig|dj/.test(loweredEvent)) labels.add('music')
  if (/gaming|game|tournament/.test(loweredEvent)) labels.add('gaming')
  if (/kids|youth|family/.test(loweredEvent)) labels.add('family')

  return Array.from(labels)
}

export function buildAiIntroductionMessage() {
  return 'Nano: Hi, my name is Nano and I will be assisting you today.'
}

export function buildAiFollowUpMessage(
  result: HostedSupportAssistantResult,
  shownPriority: HostedSupportAssistantResult['priority'] = result.priority,
) {
  if (result.followUpQuestions.length === 0) {
    return [`Nano: Thanks, I think we\'ve got all information needed. I have categorised this ticket as ${result.category} and set the priority to ${shownPriority}.`].join('\n')
  }

  const lines = ['Nano: Need a bit more detail:']

  for (const question of result.followUpQuestions) {
    lines.push(`- ${question}`)
  }

  return lines.join('\n')
}
