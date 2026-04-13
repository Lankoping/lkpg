'use server'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { setCookie } from '@tanstack/react-start/server'
import { createHash, randomUUID } from 'node:crypto'
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { hostedHelpContext } from '../../lib/hosted-help'
import { getDb } from '../db/runtime'
import {
  foundaryApplicationMessages,
  foundaryApplications,
  hostedSupportTicketMessages,
  hostedSupportTickets,
  organizationInvitations,
  organizationMembers,
  storageFiles,
  storagePerkRequests,
  storageUploadReservations,
  users,
} from '../db/schema'
import { requireOrganizerUser, requireStaffUser } from '../lib/access'
import { hashPassword, verifyPassword } from '../lib/password'
import {
  getStorageClient,
  getStorageConfig,
  getStorageUpstreamErrorMessage,
  isStorageMissingObjectError,
  logStorageError,
} from '../lib/s3-compatible'
import { writeActivityLog } from './logs'

const FUNDING_PER_EVENT = 25
const INVITE_TTL_MS = 2 * 60 * 60 * 1000

type HostedAccessControl = {
  organizationName: string | null
  organizationState: {
    status: 'none' | 'pending' | 'approved' | 'rejected'
  }
  permissions: {
    canManageMembers: boolean
    canRequestFunds: boolean
    canManageTickets: boolean
    canAccessStorage: boolean
  }
}

const defaultHostedAccessControl: HostedAccessControl = {
  organizationName: null,
  organizationState: { status: 'none' },
  permissions: {
    canManageMembers: false,
    canRequestFunds: false,
    canManageTickets: false,
    canAccessStorage: false,
  },
}

const isMissingConfidentialityColumnsError = (error: unknown) => {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('is_confidential') ||
    msg.includes('created_by_user_id') ||
    msg.includes('ticket_closed') ||
    msg.includes('ticket_closed_at') ||
    msg.includes('ticket_closed_by_user_id') ||
    msg.includes('ticket_priority') ||
    msg.includes('ticket_labels') ||
    msg.includes('assigned_to_user_id') ||
    msg.includes('is_application_ticket')
  )
}

const isMissingAccessControlColumnsError = (error: unknown) => {
  if (!(error instanceof Error)) return false

  const msg = error.message.toLowerCase()
  return (
    msg.includes('can_manage_members') ||
    msg.includes('can_request_funds') ||
    msg.includes('can_manage_tickets') ||
    msg.includes('can_access_storage')
  )
}

const normalizeOrg = (value: string) => value.trim()
const slugifyOrgName = (value: string) =>
  normalizeOrg(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const getApplicationThreadId = (applicationId: number) => `<foundary-application-${applicationId}@lankoping.se>`
const getHostedSupportThreadId = (ticketId: number) => `<hosted-support-${ticketId}@lankoping.se>`
const ticketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const NAMESPACE_TRANSFER_STALE_MS = 2 * 60 * 1000

type NamespaceTransferStatus = {
  id: number
  organizationName: string
  newOrganizationName: string
  status: 'in_progress' | 'completed' | 'failed'
  progressPercent: number
  currentStep: string
  totalSteps: number
  completedSteps: number
  startedAt: Date
  completedAt: Date | null
  errorMessage: string | null
}

async function rollbackNamespaceTransferChanges(params: {
  db: Awaited<ReturnType<typeof getDb>>
  sourceOrganizationName: string
  targetOrganizationName: string
}) {
  const { db, sourceOrganizationName, targetOrganizationName } = params
  const sourceOrg = normalizeOrg(sourceOrganizationName)
  const targetOrg = normalizeOrg(targetOrganizationName)

  const sourcePrefix = slugifyOrgName(sourceOrg) || 'organization'
  const targetPrefix = slugifyOrgName(targetOrg) || 'organization'

  const config = getStorageConfig()
  const client = getStorageClient(config)

  const files = await db
    .select({
      id: storageFiles.id,
      objectKey: storageFiles.objectKey,
      organizationName: storageFiles.organizationName,
    })
    .from(storageFiles)
    .where(or(eq(storageFiles.organizationName, sourceOrg), eq(storageFiles.organizationName, targetOrg)))

  for (const file of files) {
    if (!file.objectKey.startsWith(`${targetPrefix}/`)) {
      continue
    }

    const restoredKey = `${sourcePrefix}/${file.objectKey.slice(targetPrefix.length + 1)}`
    const encodedSourceKey = file.objectKey.split('/').map(encodeURIComponent).join('/')

    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          CopySource: `${config.bucket}/${encodedSourceKey}`,
          Key: restoredKey,
        }),
      )
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: file.objectKey,
        }),
      )
    } catch (error) {
      if (!isStorageMissingObjectError(error)) {
        logStorageError('rollbackNamespaceTransferChanges storage copy/delete', error, {
          sourceOrganizationName: sourceOrg,
          targetOrganizationName: targetOrg,
          objectKey: file.objectKey,
          restoredKey,
        })
        throw new Error(getStorageUpstreamErrorMessage(error))
      }
    }

    await db.update(storageFiles).set({ objectKey: restoredKey }).where(eq(storageFiles.id, file.id))
  }

  const reservations = await db
    .select({
      id: storageUploadReservations.id,
      objectKey: storageUploadReservations.objectKey,
      organizationName: storageUploadReservations.organizationName,
    })
    .from(storageUploadReservations)
    .where(or(eq(storageUploadReservations.organizationName, sourceOrg), eq(storageUploadReservations.organizationName, targetOrg)))

  for (const reservation of reservations) {
    if (!reservation.objectKey.startsWith(`${targetPrefix}/`)) {
      continue
    }

    const restoredKey = `${sourcePrefix}/${reservation.objectKey.slice(targetPrefix.length + 1)}`
    await db.update(storageUploadReservations).set({ objectKey: restoredKey }).where(eq(storageUploadReservations.id, reservation.id))
  }

  await db.update(organizationMembers).set({ organizationName: sourceOrg }).where(eq(organizationMembers.organizationName, targetOrg))
  await db.update(organizationInvitations).set({ organizationName: sourceOrg }).where(eq(organizationInvitations.organizationName, targetOrg))
  await db.update(foundaryApplications).set({ organizationName: sourceOrg }).where(eq(foundaryApplications.organizationName, targetOrg))
  await db.update(storagePerkRequests).set({ organizationName: sourceOrg }).where(eq(storagePerkRequests.organizationName, targetOrg))
  await db.update(storageUploadReservations).set({ organizationName: sourceOrg }).where(eq(storageUploadReservations.organizationName, targetOrg))
  await db.update(storageFiles).set({ organizationName: sourceOrg }).where(eq(storageFiles.organizationName, targetOrg))
}

const isStaleNamespaceTransfer = (transfer: NamespaceTransferStatus, now = Date.now()) => {
  if (transfer.status !== 'in_progress') {
    return false
  }

  const startedAtMs = new Date(transfer.startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) {
    return false
  }

  const isInitialStep = transfer.completedSteps <= 0 || transfer.progressPercent <= 0
  return isInitialStep && now - startedAtMs >= NAMESPACE_TRANSFER_STALE_MS
}

function getExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows
    if (Array.isArray(rows)) {
      return rows as T[]
    }
  }

  return []
}

async function ensureNamespaceTransferTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_namespace_transfers (
      id serial PRIMARY KEY,
      organization_name text NOT NULL,
      new_organization_name text NOT NULL,
      status text NOT NULL DEFAULT 'in_progress',
      progress_percent integer NOT NULL DEFAULT 0,
      current_step text NOT NULL DEFAULT '',
      total_steps integer NOT NULL DEFAULT 0,
      completed_steps integer NOT NULL DEFAULT 0,
      started_at timestamp NOT NULL DEFAULT now(),
      completed_at timestamp,
      error_message text
    );
  `)
}

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

function buildHostedSupportConversationContext(messages: Array<{ senderRole: string; message: string }>) {
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

function hasRestrictedFlags(message: string): boolean {
  return /\bflag\s*=\s*(application|funding)\b/i.test(message)
}

async function hasStaffReplied(db: Awaited<ReturnType<typeof getDb>>, ticketId: number): Promise<boolean> {
  const staffReply = await db
    .select({ id: hostedSupportTicketMessages.id })
    .from(hostedSupportTicketMessages)
    .where(and(
      eq(hostedSupportTicketMessages.ticketId, ticketId),
      eq(hostedSupportTicketMessages.senderRole, 'organizer')
    ))
    .limit(1)
  return staffReply.length > 0
}

function buildHostedSupportHeuristic(message: string): HostedSupportAssistantResult {
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

async function getHostedSupportAssistantReply(message: string, conversationContext?: string): Promise<HostedSupportAssistantResult> {
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

    const payload = await response.json() as {
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

function normalizeTicketLabels(value: string) {
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

async function assertOrganizerAssignee(db: Awaited<ReturnType<typeof getDb>>, assignedToUserId: number | null | undefined) {
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

async function getAutomationOrganizerUserId(db: Awaited<ReturnType<typeof getDb>>) {
  const organizer = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'organizer'))
    .orderBy(desc(users.id))
    .limit(1)

  return organizer[0]?.id ?? null
}

function combineTicketLabels(...parts: Array<string | string[] | undefined>) {
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

function deriveApplicationTicketLabels(input: {
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

function buildAiIntroductionMessage() {
  return 'Nano: Hi, my name is Nano and I will be assisting you today.'
}

function buildAiFollowUpMessage(result: HostedSupportAssistantResult, shownPriority: HostedSupportAssistantResult['priority'] = result.priority) {
  if (result.followUpQuestions.length === 0) {
    return [
      `Nano: Thanks, I think we\'ve got all information needed. I have categorised this ticket as ${result.category} and set the priority to ${shownPriority}.`,
    ].join('\n')
  }

  const lines = [
    'Nano: Need a bit more detail:',
  ]

  for (const question of result.followUpQuestions) {
    lines.push(`- ${question}`)
  }

  return lines.join('\n')
}

const getHostedBaseUrl = () => {
  const raw =
    process.env.baseurl ||
    process.env.BASEURL ||
    process.env.BASE_URL ||
    process.env.hostedurl ||
    process.env.HOSTEDURL ||
    process.env.HOSTED_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'

  const trimmed = raw.trim()
  if (!trimmed) {
    return 'http://localhost:3000'
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/\/$/, '') : `https://${trimmed.replace(/\/$/, '')}`
}

async function sendOrganizationInviteEmail({
  to,
  invitedBy,
  link,
}: {
  to: string
  invitedBy: string
  link: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const text = [
    `Hi! you have been invited by ${invitedBy} to join their organisation on lanfoundary.`,
    '',
    'Click the link below to activate your account',
    '',
    link,
    '',
    "Your's truely The Lanfoundary team",
  ].join('\n')

  const html = `
    <p>Hi! you have been invited by <strong>${invitedBy}</strong> to join their organisation on lanfoundary.</p>
    <p>Click the link below to activate your account</p>
    <p><a href="${link}">${link}</a></p>
    <p>Your's truely The Lanfoundary team</p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: 'Lanfoundary organisation invite',
    text,
    html,
  })
}

async function sendApplicationThreadEmail({
  to,
  subject,
  text,
  html,
  applicationId,
}: {
  to: string
  subject: string
  text: string
  html: string
  applicationId: number
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const threadId = getApplicationThreadId(applicationId)

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject,
    text,
    html,
    headers: {
      'In-Reply-To': threadId,
      References: threadId,
    },
  })
}

async function sendOrganizationAccountRemovedEmail({
  to,
  organizationName,
  transferredFileCount,
}: {
  to: string
  organizationName: string
  transferredFileCount?: number
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const hasTransferredFiles = (transferredFileCount ?? 0) > 0
  const text = [
    `Hi, a organisation you are apart of have deleted your account.`,
    `Organization: ${organizationName}`,
    hasTransferredFiles
      ? 'If the admin deleting your account have transfered important documents hosted by you ownership of the files transfered has changed.'
      : 'No files were transfered to another user before account removal.',
    'Other files are pending for deletion, and you will recive a nonification as soon as they are removed from our systems.',
  ].join('\n')

  const html = `
    <p>Hi, a organisation you are apart of have deleted your account.</p>
    <p><strong>Organization:</strong> ${organizationName}</p>
    <p>${hasTransferredFiles
      ? 'If the admin deleting your account have transfered important documents hosted by you ownership of the files transfered has changed.'
      : 'No files were transfered to another user before account removal.'}</p>
    <p>Other files are pending for deletion, and you will recive a nonification as soon as they are removed from our systems.</p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: `Account removed from ${organizationName}`,
    text,
    html,
  })
}

async function sendOrganizationNamespaceTransferCompletedEmail({
  to,
  organizationName,
}: {
  to: string
  organizationName: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const text = `Hi the transfer of your orginisation to a new namespace is done!\nOrganization: ${organizationName}`
  const html = `<p>Hi the transfer of your orginisation to a new namespace is done!</p><p>Organization: <strong>${organizationName}</strong></p>`

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: `Namespace transfer completed for ${organizationName}`,
    text,
    html,
  })
}

function formatDeletionDurationHours(startedAtMs: number) {
  const elapsedMs = Math.max(0, Date.now() - startedAtMs)
  return (elapsedMs / (1000 * 60 * 60)).toFixed(2)
}

async function sendDataDeletionCompletedEmail({
  to,
  elapsedHours,
}: {
  to: string
  elapsedHours: string
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const text = [
    'Your reciving this email to notify you that your data has been sucsessfully deleted.',
    `This took us a total of : ${elapsedHours} hrs`,
  ].join('\n')

  const html = `
    <p>Your reciving this email to notify you that your data has been sucsessfully deleted.</p>
    <p>This took us a total of : <strong>${elapsedHours} hrs</strong></p>
  `

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject: 'Data deletion completed',
    text,
    html,
  })
}

async function deleteStorageFilesForOrganization({
  db,
  organizationName,
  uploadedByUserId,
}: {
  db: Awaited<ReturnType<typeof getDb>>
  organizationName: string
  uploadedByUserId?: number
}) {
  const whereClause = uploadedByUserId
    ? and(eq(storageFiles.organizationName, organizationName), eq(storageFiles.uploadedByUserId, uploadedByUserId))
    : eq(storageFiles.organizationName, organizationName)

  const files = await db
    .select({
      id: storageFiles.id,
      objectKey: storageFiles.objectKey,
    })
    .from(storageFiles)
    .where(whereClause)

  if (files.length === 0) {
    return { deletedFileCount: 0 }
  }

  const config = getStorageConfig()
  const client = getStorageClient(config)

  for (const file of files) {
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: file.objectKey,
        }),
      )
    } catch (error) {
      if (!isStorageMissingObjectError(error)) {
        logStorageError('deleteStorageFilesForOrganization DeleteObject', error, {
          organizationName,
          uploadedByUserId,
          objectKey: file.objectKey,
        })
        throw new Error(getStorageUpstreamErrorMessage(error))
      }
    }
  }

  await db.delete(storageFiles).where(inArray(storageFiles.id, files.map((file) => file.id)))

  return { deletedFileCount: files.length }
}

async function assertOrganizationOwner({
  db,
  organizationName,
  currentUserId,
}: {
  db: Awaited<ReturnType<typeof getDb>>
  organizationName: string
  currentUserId: number
}) {
  const ownerMembership = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationName, organizationName))
    .orderBy(organizationMembers.createdAt)
    .limit(1)

  if (!ownerMembership[0] || ownerMembership[0].userId !== currentUserId) {
    throw new Error('Only the organization owner can perform this action')
  }

  return ownerMembership[0]
}

async function deactivateUserIfNoMemberships(db: Awaited<ReturnType<typeof getDb>>, userId: number) {
  const memberships = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1)

  if (!memberships[0]) {
    await db.update(users).set({ active: false }).where(eq(users.id, userId))
    return true
  }

  return false
}

async function sendApplicationStatusNotificationEmail({
  to,
  applicationId,
  organizationName,
  eventName,
  status,
  reviewNotes,
}: {
  to: string
  applicationId: number
  organizationName: string
  eventName: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNotes?: string | null
}) {
  const readableStatus = status === 'pending' ? 'under review' : status
  const subjectPrefix =
    status === 'approved'
      ? 'Approved'
      : status === 'rejected'
        ? 'Rejected'
        : 'Under Review'
  const notes = reviewNotes?.trim()

  const textLines = [
    `Hi! Thanks for your application for the organisation: ${organizationName}.`,
    '',
    `Current status: ${readableStatus}.`,
    'You will receive notifications over email if anything changes.',
    '',
    `Event: ${eventName}`,
  ]

  if (notes) {
    textLines.push('', `Review notes: ${notes}`)
  }

  const text = textLines.join('\n')
  const html = `
    <p>Hi! Thanks for your application for the organisation: <strong>${organizationName}</strong>.</p>
    <p>Current status: <strong>${readableStatus}</strong>.</p>
    <p>You will receive notifications over email if anything changes.</p>
    <p><strong>Event:</strong> ${eventName}</p>
    ${notes ? `<p><strong>Review notes:</strong> ${notes.replace(/\n/g, '<br />')}</p>` : ''}
  `

  await sendApplicationThreadEmail({
    to,
    subject: `${subjectPrefix}: Lanfoundary application #${applicationId}`,
    text,
    html,
    applicationId,
  })
}

function buildAdminReplyNotificationMessage(replyMessage: string) {
  const forgotPasswordLink = `${getHostedBaseUrl()}?forgotpassword`

  const text = [
    'Hi! An admin has replied to your application.',
    'Please log on to the dashboard with the details you created to reply and see what they wrote.',
    '',
    'Forgot your password?',
    `Go to ${forgotPasswordLink}`,
    '',
    'Admin reply:',
    replyMessage,
  ].join('\n')

  const html = `
    <p>Hi! An admin has replied to your application.</p>
    <p>Please log on to the dashboard with the details you created to reply and see what they wrote.</p>
    <p><strong>Forgot your password?</strong><br /><a href="${forgotPasswordLink}">${forgotPasswordLink}</a></p>
    <p><strong>Admin reply:</strong></p>
    <p>${replyMessage.replace(/\n/g, '<br />')}</p>
  `

  return { text, html }
}

async function sendHostedSupportThreadEmail({
  to,
  subject,
  text,
  html,
  ticketId,
}: {
  to: string
  subject: string
  text: string
  html: string
  ticketId: number
}) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS')
  }

  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  const threadId = getHostedSupportThreadId(ticketId)

  await transporter.sendMail({
    from: 'foundary@lankoping.se',
    to,
    subject,
    text,
    html,
    headers: {
      'In-Reply-To': threadId,
      References: threadId,
    },
  })
}

export const getOrganizerUsersFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.role, 'organizer'))
    .orderBy(desc(users.createdAt))
})

const applicationSchema = z.object({
  applicantName: z.string().min(1),
  email: z.string().email(),
  age: z.coerce.number().int().min(13),
  cityCountry: z.string().min(1),
  organizationName: z.string().min(1),
  organizationStatus: z.enum(['registered_nonprofit_at_hackclub_bank', 'individual_group_for_reimbursements_only']),
  hasHcbAccount: z.boolean(),
  hcbUsername: z.string().optional(),
  preferredPaymentMethod: z.enum(['direct_hcb_transfer', 'receipt_reimbursement']),
  eventName: z.string().min(1),
  plannedMonths: z.string().min(1),
  expectedAttendees: z.coerce.number().int().min(1),
  requestedFunds: z.coerce.number().int().min(1).max(100000),
  briefEventDescription: z.string().min(1),
  budgetJustification: z.string().min(1),
  accountPassword: z.string().min(8).max(72),
  termsAccepted: z.literal(true),
})

export const submitFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => applicationSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const normalizedEmail = data.email.trim().toLowerCase()
    const normalizedOrganizationName = normalizeOrg(data.organizationName)

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    let accountUser = existingUser[0]

    if (accountUser) {
      if (accountUser.active === false) {
        throw new Error('Account is locked')
      }

      if (accountUser.role === 'organizer') {
        throw new Error('Organizer accounts cannot submit hosted applications here')
      }

      if (!verifyPassword(data.accountPassword, accountUser.passwordHash)) {
        throw new Error('Invalid email or password for hosted account')
      }
    } else {
      const createdUser = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: hashPassword(data.accountPassword),
          name: data.applicantName,
          role: 'volunteer',
          active: true,
        })
        .returning()

      accountUser = createdUser[0]
    }

    setCookie('session', accountUser.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    const duplicate = await db
      .select()
      .from(foundaryApplications)
      .where(and(eq(foundaryApplications.email, normalizedEmail), eq(foundaryApplications.status, 'pending')))
      .limit(1)

    if (duplicate[0]) {
      throw new Error('You already have a pending application')
    }

    const applicationValues = {
      applicantName: data.applicantName,
      email: normalizedEmail,
      age: data.age,
      cityCountry: data.cityCountry,
      organizationName: normalizedOrganizationName,
      organizationStatus: data.organizationStatus,
      hasHcbAccount: data.hasHcbAccount,
      hcbUsername: data.hasHcbAccount ? (data.hcbUsername?.trim() || null) : null,
      preferredPaymentMethod: data.preferredPaymentMethod,
      eventName: data.eventName,
      plannedMonths: data.plannedMonths,
      expectedAttendees: data.expectedAttendees,
      requestedEvents: 1,
      fundingRequestAmount: data.requestedFunds,
      briefEventDescription: data.briefEventDescription,
      budgetJustification: data.budgetJustification,
      termsAccepted: data.termsAccepted,
      isApplicationTicket: true,
      ticketLabels: deriveApplicationTicketLabels({
        organizationStatus: data.organizationStatus,
        hasHcbAccount: data.hasHcbAccount,
        preferredPaymentMethod: data.preferredPaymentMethod,
        requestedFunds: data.requestedFunds,
        eventName: data.eventName,
      }).join(', '),
      createdByUserId: accountUser.id,
      isConfidential: true,
      status: 'pending' as const,
    }

    let created
    try {
      created = await db.insert(foundaryApplications).values(applicationValues).returning()
    } catch (error) {
      if (!isMissingConfidentialityColumnsError(error)) throw error
      const {
        createdByUserId: _createdByUserId,
        isConfidential: _isConfidential,
        isApplicationTicket: _isApplicationTicket,
        ticketLabels: _ticketLabels,
        ...legacyValues
      } = applicationValues
      created = await db.insert(foundaryApplications).values(legacyValues).returning()
    }

    await db.insert(foundaryApplicationMessages).values({
      applicationId: created[0].id,
      senderUserId: accountUser.id,
      senderRole: accountUser.role,
      message: [
        `New hosted application submitted by ${data.applicantName}.`,
        `Organization: ${normalizedOrganizationName}`,
        `Event: ${data.eventName}`,
        `Requested funds: $${data.requestedFunds}`,
        `Planned months: ${data.plannedMonths}`,
      ].join('\n'),
    })

    const existingMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, accountUser.id),
          eq(organizationMembers.organizationName, normalizedOrganizationName),
        ),
      )
      .limit(1)

    if (!existingMembership[0]) {
      await db.insert(organizationMembers).values({
        userId: accountUser.id,
        organizationName: normalizedOrganizationName,
        addedBy: accountUser.id,
      })
    }

    await sendApplicationStatusNotificationEmail({
      to: normalizedEmail,
      applicationId: created[0].id,
      organizationName: normalizedOrganizationName,
      eventName: data.eventName,
      status: 'pending',
      reviewNotes: null,
    })

    return created[0]
  })

export const getMyFoundaryApplicationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  let organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  if (organizations.length === 0) {
    const legacyOrganizations = await db
      .select({ organizationName: foundaryApplications.organizationName })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.email, (currentUser.email ?? '').trim().toLowerCase()))

    if (legacyOrganizations.length > 0) {
      for (const org of legacyOrganizations) {
        const normalized = normalizeOrg(org.organizationName)
        const hasMembership = await db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(and(eq(organizationMembers.userId, currentUser.id), eq(organizationMembers.organizationName, normalized)))
          .limit(1)

        if (!hasMembership[0]) {
          await db.insert(organizationMembers).values({
            userId: currentUser.id,
            organizationName: normalized,
            addedBy: currentUser.id,
          })
        }
      }

      organizations = await db
        .select({ organizationName: organizationMembers.organizationName })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, currentUser.id))
    }
  }

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

  if (organizationNames.length === 0) {
    return []
  }

  try {
    return await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        status: foundaryApplications.status,
        isApplicationTicket: foundaryApplications.isApplicationTicket,
        isConfidential: foundaryApplications.isConfidential,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .where(
        and(
          inArray(foundaryApplications.organizationName, organizationNames),
          or(
            eq(foundaryApplications.isConfidential, false),
            eq(foundaryApplications.createdByUserId, currentUser.id),
            eq(foundaryApplications.email, currentUser.email),
          ),
        ),
      )
      .orderBy(desc(foundaryApplications.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    const legacyRows = await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        status: foundaryApplications.status,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .where(inArray(foundaryApplications.organizationName, organizationNames))
      .orderBy(desc(foundaryApplications.createdAt))

    return legacyRows.map((row) => ({
      ...row,
      isApplicationTicket: false,
    }))
  }
})

export const getMyOrganizationMembersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  const organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

  if (organizationNames.length === 0) {
    return []
  }

  const rows = await db
    .select({
      organizationName: organizationMembers.organizationName,
      userId: users.id,
      email: users.email,
      name: users.name,
      canManageMembers: organizationMembers.canManageMembers,
      canRequestFunds: organizationMembers.canRequestFunds,
      canManageTickets: organizationMembers.canManageTickets,
      canAccessStorage: organizationMembers.canAccessStorage,
      addedBy: organizationMembers.addedBy,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(inArray(organizationMembers.organizationName, organizationNames))

  return rows
})

export const getOrganizationMemberStorageFilesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        userId: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    const member = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.userId)))
      .limit(1)

    if (!member[0]) {
      throw new Error('Member not found in this organization')
    }

    return await db
      .select({
        id: storageFiles.id,
        fileName: storageFiles.fileName,
        sizeBytes: storageFiles.sizeBytes,
        createdAt: storageFiles.createdAt,
        objectKey: storageFiles.objectKey,
      })
      .from(storageFiles)
      .where(and(eq(storageFiles.organizationName, organizationName), eq(storageFiles.uploadedByUserId, data.userId)))
      .orderBy(desc(storageFiles.createdAt))
  })

export const transferSelectedOrganizationFilesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        fromUserId: z.number().int().positive(),
        toUserId: z.number().int().positive(),
        fileIds: z.array(z.number().int().positive()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    if (data.fromUserId === data.toUserId) {
      throw new Error('Source and destination users must be different')
    }

    const sourceMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.fromUserId)))
      .limit(1)

    const destinationMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.toUserId)))
      .limit(1)

    if (!sourceMembership[0]) {
      throw new Error('Source member not found in this organization')
    }

    if (!destinationMembership[0]) {
      throw new Error('Destination member not found in this organization')
    }

    const candidateFiles = await db
      .select({ id: storageFiles.id })
      .from(storageFiles)
      .where(
        and(
          eq(storageFiles.organizationName, organizationName),
          eq(storageFiles.uploadedByUserId, data.fromUserId),
          inArray(storageFiles.id, data.fileIds),
        ),
      )

    if (candidateFiles.length === 0) {
      throw new Error('No matching files found for transfer')
    }

    const transferred = await db
      .update(storageFiles)
      .set({ uploadedByUserId: data.toUserId })
      .where(inArray(storageFiles.id, candidateFiles.map((file) => file.id)))
      .returning({ id: storageFiles.id })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.files.transfer_selected',
      entityType: 'organization_member',
      entityId: sourceMembership[0].id,
      details: {
        organizationName,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        transferredFileCount: transferred.length,
        fileIds: candidateFiles.map((file) => file.id),
      },
    })

    return {
      success: true,
      transferredFileCount: transferred.length,
    }
  })

export const getMyOrganizationNamespaceTransferStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()
  await ensureNamespaceTransferTable(db)

  const organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  const names = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))
  if (names.length === 0) {
    return null
  }

  const orgMatch = sql.join(names.map((name) => sql`organization_name = ${name}`), sql` OR `)
  const newOrgMatch = sql.join(names.map((name) => sql`new_organization_name = ${name}`), sql` OR `)
  const rowsResult = await db.execute(sql`
    SELECT
      id,
      organization_name AS "organizationName",
      new_organization_name AS "newOrganizationName",
      status,
      progress_percent AS "progressPercent",
      current_step AS "currentStep",
      total_steps AS "totalSteps",
      completed_steps AS "completedSteps",
      started_at AS "startedAt",
      completed_at AS "completedAt",
      error_message AS "errorMessage"
    FROM organization_namespace_transfers
    WHERE (${orgMatch}) OR (${newOrgMatch})
    ORDER BY started_at DESC
    LIMIT 1
  `)

  const transfer = getExecuteRows<NamespaceTransferStatus>(rowsResult)[0]
  if (!transfer) {
    return null
  }

  if (isStaleNamespaceTransfer(transfer)) {
    await db.execute(sql`
      UPDATE organization_namespace_transfers
      SET
        status = 'failed',
        error_message = 'Namespace transfer did not start in time. Please retry.',
        current_step = 'Failed to start',
        completed_at = now()
      WHERE id = ${transfer.id}
        AND status = 'in_progress'
    `)

    return {
      ...transfer,
      status: 'failed',
      currentStep: 'Failed to start',
      errorMessage: 'Namespace transfer did not start in time. Please retry.',
      completedAt: new Date(),
    }
  }

  return transfer
})

export const getNamespaceTransfersForAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()
  await ensureNamespaceTransferTable(db)

  const rowsResult = await db.execute(sql`
    SELECT
      id,
      organization_name AS "organizationName",
      new_organization_name AS "newOrganizationName",
      status,
      progress_percent AS "progressPercent",
      current_step AS "currentStep",
      total_steps AS "totalSteps",
      completed_steps AS "completedSteps",
      started_at AS "startedAt",
      completed_at AS "completedAt",
      error_message AS "errorMessage"
    FROM organization_namespace_transfers
    ORDER BY started_at DESC
    LIMIT 100
  `)

  return getExecuteRows<NamespaceTransferStatus>(rowsResult)
})

export const renameOrganizationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        newOrganizationName: z.string().min(2),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    await ensureNamespaceTransferTable(db)
    const organizationName = normalizeOrg(data.organizationName)
    const newOrganizationName = normalizeOrg(data.newOrganizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    if (organizationName.toLowerCase() === newOrganizationName.toLowerCase()) {
      throw new Error('New organization name must be different')
    }

    const existingTarget = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationName, newOrganizationName))
      .limit(1)

    if (existingTarget[0]) {
      throw new Error('That organization name is already in use')
    }

    await db.execute(sql`
      UPDATE organization_namespace_transfers
      SET
        status = 'failed',
        error_message = 'Namespace transfer did not start in time. Please retry.',
        current_step = 'Failed to start',
        completed_at = now()
      WHERE (organization_name = ${organizationName} OR new_organization_name = ${organizationName})
        AND status = 'in_progress'
        AND completed_steps = 0
        AND progress_percent = 0
        AND started_at <= now() - interval '2 minutes'
    `)

    const activeTransferRowsResult = await db.execute(sql`
      SELECT id FROM organization_namespace_transfers
      WHERE (organization_name = ${organizationName} OR new_organization_name = ${organizationName})
        AND status = 'in_progress'
      LIMIT 1
    `)
    const activeTransferRows = getExecuteRows<{ id: number }>(activeTransferRowsResult)
    if (activeTransferRows.length > 0) {
      throw new Error('A namespace transfer is already in progress for this organization')
    }

    const transferCreateRowsResult = await db.execute(sql`
      INSERT INTO organization_namespace_transfers (
        organization_name,
        new_organization_name,
        status,
        progress_percent,
        current_step,
        total_steps,
        completed_steps,
        started_at
      ) VALUES (
        ${organizationName},
        ${newOrganizationName},
        'in_progress',
        0,
        'Starting namespace transfer',
        7,
        0,
        now()
      )
      RETURNING id
    `)

    const transferId = getExecuteRows<{ id: number }>(transferCreateRowsResult)[0]?.id
    if (!transferId) {
      throw new Error('Could not initialize namespace transfer')
    }

    let latestTransferStep = 'Starting namespace transfer'

    const updateTransferProgress = async (completedSteps: number, currentStep: string) => {
      latestTransferStep = currentStep
      const progressPercent = Math.min(100, Math.round((completedSteps / 7) * 100))
      await db.execute(sql`
        UPDATE organization_namespace_transfers
        SET
          completed_steps = ${completedSteps},
          current_step = ${currentStep},
          progress_percent = ${progressPercent}
        WHERE id = ${transferId}
      `)
    }

    const markTransferFailed = async (errorMessage: string) => {
      const details = [`Error on step: ${latestTransferStep}`, `Details: ${errorMessage}`].join('\n')
      await db.execute(sql`
        UPDATE organization_namespace_transfers
        SET
          status = 'failed',
          error_message = ${details},
          current_step = ${latestTransferStep},
          completed_at = now()
        WHERE id = ${transferId}
      `)
    }

    const memberRows = await db
      .select({ email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationName, organizationName))

    try {
      await updateTransferProgress(1, 'Preparing storage namespace transfer')

      const config = getStorageConfig()
      const client = getStorageClient(config)
      const oldPrefix = slugifyOrgName(organizationName) || 'organization'
      const newPrefix = slugifyOrgName(newOrganizationName) || 'organization'

      const storageRows = await db
        .select({ id: storageFiles.id, objectKey: storageFiles.objectKey })
        .from(storageFiles)
        .where(eq(storageFiles.organizationName, organizationName))

      const reservationRows = await db
        .select({ id: storageUploadReservations.id, objectKey: storageUploadReservations.objectKey })
        .from(storageUploadReservations)
        .where(eq(storageUploadReservations.organizationName, organizationName))

      await updateTransferProgress(2, 'Transferring stored file objects')
      for (const row of storageRows) {
        const nextKey = row.objectKey.startsWith(`${oldPrefix}/`)
          ? `${newPrefix}/${row.objectKey.slice(oldPrefix.length + 1)}`
          : `${newPrefix}/${row.objectKey}`

        const encodedSourceKey = row.objectKey.split('/').map(encodeURIComponent).join('/')
        await client.send(
          new CopyObjectCommand({
            Bucket: config.bucket,
            CopySource: `${config.bucket}/${encodedSourceKey}`,
            Key: nextKey,
          }),
        )
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: row.objectKey,
          }),
        )
        await db.update(storageFiles).set({ objectKey: nextKey }).where(eq(storageFiles.id, row.id))
      }

      await updateTransferProgress(3, 'Updating reservation object keys')
      for (const row of reservationRows) {
        const nextKey = row.objectKey.startsWith(`${oldPrefix}/`)
          ? `${newPrefix}/${row.objectKey.slice(oldPrefix.length + 1)}`
          : `${newPrefix}/${row.objectKey}`
        await db.update(storageUploadReservations).set({ objectKey: nextKey }).where(eq(storageUploadReservations.id, row.id))
      }

      await updateTransferProgress(4, 'Renaming organization membership namespace')
      await db.update(organizationMembers).set({ organizationName: newOrganizationName }).where(eq(organizationMembers.organizationName, organizationName))

      await updateTransferProgress(5, 'Renaming application and invitation namespace')
      await db.update(organizationInvitations).set({ organizationName: newOrganizationName }).where(eq(organizationInvitations.organizationName, organizationName))
      await db.update(foundaryApplications).set({ organizationName: newOrganizationName }).where(eq(foundaryApplications.organizationName, organizationName))

      await updateTransferProgress(6, 'Renaming storage namespace records')
      await db.update(storagePerkRequests).set({ organizationName: newOrganizationName }).where(eq(storagePerkRequests.organizationName, organizationName))
      await db.update(storageUploadReservations).set({ organizationName: newOrganizationName }).where(eq(storageUploadReservations.organizationName, organizationName))
      await db.update(storageFiles).set({ organizationName: newOrganizationName }).where(eq(storageFiles.organizationName, organizationName))

      await updateTransferProgress(7, 'Finalizing and notifying members')

      for (const member of memberRows) {
        await sendOrganizationNamespaceTransferCompletedEmail({
          to: member.email,
          organizationName: newOrganizationName,
        })
      }

      await db.execute(sql`
        UPDATE organization_namespace_transfers
        SET
          status = 'completed',
          progress_percent = 100,
          current_step = 'Transfer completed',
          completed_steps = 7,
          completed_at = now(),
          error_message = null
        WHERE id = ${transferId}
      `)
    } catch (error) {
      await markTransferFailed(error instanceof Error ? error.message : 'Unknown transfer error')
      throw error
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.rename',
      entityType: 'organization',
      details: {
        from: organizationName,
        to: newOrganizationName,
      },
    })

    return {
      success: true,
      previousOrganizationName: organizationName,
      organizationName: newOrganizationName,
      notice:
        'Hi, your unable to acsess this orginisation right now since you have changed the name, the orginisation will be back in less then 24-48h depending on how much data you are storing.',
    }
  })

export const cancelOrganizationNamespaceTransferFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    await ensureNamespaceTransferTable(db)

    const organizationName = normalizeOrg(data.organizationName)
    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    const transferRowsResult = await db.execute(sql`
      SELECT
        id,
        organization_name AS "organizationName",
        new_organization_name AS "newOrganizationName",
        status,
        progress_percent AS "progressPercent",
        current_step AS "currentStep",
        total_steps AS "totalSteps",
        completed_steps AS "completedSteps",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        error_message AS "errorMessage"
      FROM organization_namespace_transfers
      WHERE organization_name = ${organizationName} OR new_organization_name = ${organizationName}
      ORDER BY started_at DESC
      LIMIT 1
    `)

    const transfer = getExecuteRows<NamespaceTransferStatus>(transferRowsResult)[0]
    if (!transfer) {
      throw new Error('No namespace transfer found to cancel')
    }

    if (transfer.status === 'completed') {
      throw new Error('Completed transfers cannot be cancelled')
    }

    if (transfer.status === 'in_progress' && transfer.completedSteps > 1) {
      throw new Error('Cannot cancel while transfer is actively moving files. Please wait for completion or failure.')
    }

    await rollbackNamespaceTransferChanges({
      db,
      sourceOrganizationName: transfer.organizationName,
      targetOrganizationName: transfer.newOrganizationName,
    })

    await db.execute(sql`
      UPDATE organization_namespace_transfers
      SET
        status = 'failed',
        current_step = 'Cancelled and rolled back',
        error_message = 'Error on step: Cancel requested by owner\nDetails: Namespace transfer was cancelled and changes were reverted.',
        completed_at = now()
      WHERE id = ${transfer.id}
    `)

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.rename.cancel',
      entityType: 'organization',
      details: {
        organizationName: transfer.organizationName,
        attemptedNewOrganizationName: transfer.newOrganizationName,
        cancelledTransferId: transfer.id,
      },
    })

    return {
      success: true,
      notice: 'Namespace transfer cancelled. Changes have been rolled back.',
    }
  })

export const transferOrganizationMemberFilesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        fromUserId: z.number().int().positive(),
        toUserId: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    if (data.fromUserId === data.toUserId) {
      throw new Error('Source and destination users must be different')
    }

    const sourceMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.fromUserId)))
      .limit(1)

    const destinationMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.toUserId)))
      .limit(1)

    if (!sourceMembership[0]) {
      throw new Error('Source member not found in this organization')
    }

    if (!destinationMembership[0]) {
      throw new Error('Destination member not found in this organization')
    }

    const transferred = await db
      .update(storageFiles)
      .set({ uploadedByUserId: data.toUserId })
      .where(
        and(
          eq(storageFiles.organizationName, organizationName),
          eq(storageFiles.uploadedByUserId, data.fromUserId),
        ),
      )
      .returning({ id: storageFiles.id })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.files.transfer_owner',
      entityType: 'organization_member',
      entityId: sourceMembership[0].id,
      details: {
        organizationName,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        transferredFileCount: transferred.length,
      },
    })

    return {
      success: true,
      transferredFileCount: transferred.length,
    }
  })

export const removeOrganizationMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        userId: z.number().int().positive(),
        transferredFileCount: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const startedAtMs = Date.now()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    const targetMembership = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        email: users.email,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, data.userId)))
      .limit(1)

    if (!targetMembership[0]) {
      throw new Error('Member not found in this organization')
    }

    if (targetMembership[0].userId === currentUser.id) {
      throw new Error('Use delete account to remove yourself')
    }

    const storageCleanup = await deleteStorageFilesForOrganization({
      db,
      organizationName,
      uploadedByUserId: targetMembership[0].userId,
    })

    await db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, targetMembership[0].userId)))

    await deactivateUserIfNoMemberships(db, targetMembership[0].userId)

    await sendOrganizationAccountRemovedEmail({
      to: targetMembership[0].email,
      organizationName,
      transferredFileCount: data.transferredFileCount ?? 0,
    })

    await sendDataDeletionCompletedEmail({
      to: targetMembership[0].email,
      elapsedHours: formatDeletionDurationHours(startedAtMs),
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.remove',
      entityType: 'organization_member',
      entityId: targetMembership[0].id,
      details: {
        organizationName,
        removedUserId: targetMembership[0].userId,
        removedUserEmail: targetMembership[0].email,
        deletedFileCount: storageCleanup.deletedFileCount,
      },
    })

    return {
      success: true,
      removedUserId: targetMembership[0].userId,
      deletedFileCount: storageCleanup.deletedFileCount,
    }
  })

export const deleteMyOrganizationAccountFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const startedAtMs = Date.now()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    const ownerMembership = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationName, organizationName))
      .orderBy(organizationMembers.createdAt)
      .limit(1)

    if (ownerMembership[0] && ownerMembership[0].userId === currentUser.id) {
      throw new Error('Owner cannot self-delete from organization. Delete the organization instead.')
    }

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, currentUser.id)))
      .limit(1)

    if (!membership[0]) {
      throw new Error('You are not a member of this organization')
    }

    const storageCleanup = await deleteStorageFilesForOrganization({
      db,
      organizationName,
      uploadedByUserId: currentUser.id,
    })

    await db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.organizationName, organizationName), eq(organizationMembers.userId, currentUser.id)))

    const deactivated = await deactivateUserIfNoMemberships(db, currentUser.id)
    if (deactivated) {
      setCookie('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/',
      })
    }

    await sendDataDeletionCompletedEmail({
      to: currentUser.email,
      elapsedHours: formatDeletionDurationHours(startedAtMs),
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.self_delete',
      entityType: 'organization_member',
      entityId: membership[0].id,
      details: {
        organizationName,
        deletedFileCount: storageCleanup.deletedFileCount,
        deactivated,
      },
    })

    return {
      success: true,
      deletedFileCount: storageCleanup.deletedFileCount,
      deactivated,
    }
  })

export const deleteOrganizationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const startedAtMs = Date.now()
    const currentUser = await requireStaffUser()
    const db = await getDb()
    const organizationName = normalizeOrg(data.organizationName)

    await assertOrganizationOwner({
      db,
      organizationName,
      currentUserId: currentUser.id,
    })

    const members = await db
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        email: users.email,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationName, organizationName))

    const storageCleanup = await deleteStorageFilesForOrganization({
      db,
      organizationName,
    })

    await db.delete(storageUploadReservations).where(eq(storageUploadReservations.organizationName, organizationName))
    await db.delete(storagePerkRequests).where(eq(storagePerkRequests.organizationName, organizationName))

    const applications = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.organizationName, organizationName))

    if (applications.length > 0) {
      await db.delete(foundaryApplicationMessages).where(inArray(foundaryApplicationMessages.applicationId, applications.map((row) => row.id)))
    }

    await db.delete(foundaryApplications).where(eq(foundaryApplications.organizationName, organizationName))
    await db.delete(organizationInvitations).where(eq(organizationInvitations.organizationName, organizationName))
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationName, organizationName))

    let notifiedMemberCount = 0
    for (const member of members) {
      if (member.userId === currentUser.id) continue
      await sendOrganizationAccountRemovedEmail({
        to: member.email,
        organizationName,
      })
      await sendDataDeletionCompletedEmail({
        to: member.email,
        elapsedHours: formatDeletionDurationHours(startedAtMs),
      })
      notifiedMemberCount += 1
      await deactivateUserIfNoMemberships(db, member.userId)
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.delete',
      entityType: 'organization',
      details: {
        organizationName,
        deletedMemberCount: members.length,
        deletedFileCount: storageCleanup.deletedFileCount,
        deletedApplicationCount: applications.length,
        notifiedMemberCount,
      },
    })

    return {
      success: true,
      deletedMemberCount: members.length,
      deletedFileCount: storageCleanup.deletedFileCount,
      deletedApplicationCount: applications.length,
    }
  })

export { getHostedAccessControlFn } from './hosted-access-control'
export { updateOrganizationMemberAccessFn } from './hosted-access-control'

export const createHostedFundingRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        eventName: z.string().min(1),
        plannedMonths: z.string().min(1),
        expectedAttendees: z.coerce.number().int().min(1),
        requestedFunds: z.coerce.number().int().min(1).max(100000),
        briefEventDescription: z.string().min(1),
        budgetJustification: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const organizationName = normalizeOrg(data.organizationName)

    const membership = await db
      .select({ id: organizationMembers.id, canRequestFunds: organizationMembers.canRequestFunds })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, currentUser.id), eq(organizationMembers.organizationName, organizationName)))
      .limit(1)

    if (!membership[0]) {
      throw new Error('You can only request funds for organizations you belong to')
    }

    if (!membership[0].canRequestFunds) {
      throw new Error('You do not have permission to request funds for this organization')
    }

    const profileSource = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.organizationName, organizationName))
      .orderBy(desc(foundaryApplications.createdAt))
      .limit(1)

    if (!profileSource[0]) {
      throw new Error('No existing organization profile found. Submit an initial application first.')
    }

    const pendingExisting = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(and(eq(foundaryApplications.organizationName, organizationName), eq(foundaryApplications.status, 'pending')))
      .limit(1)

    if (pendingExisting[0]) {
      throw new Error('There is already a pending request for this organization')
    }

    const fundingValues = {
      applicantName: currentUser.name?.trim() || currentUser.email,
      email: currentUser.email,
      age: profileSource[0].age,
      cityCountry: profileSource[0].cityCountry,
      organizationName,
      organizationStatus: profileSource[0].organizationStatus,
      hasHcbAccount: profileSource[0].hasHcbAccount,
      hcbUsername: profileSource[0].hcbUsername,
      preferredPaymentMethod: profileSource[0].preferredPaymentMethod,
      eventName: data.eventName,
      plannedMonths: data.plannedMonths,
      expectedAttendees: data.expectedAttendees,
      requestedEvents: 1,
      fundingRequestAmount: data.requestedFunds,
      briefEventDescription: data.briefEventDescription,
      budgetJustification: data.budgetJustification,
      termsAccepted: true,
      createdByUserId: currentUser.id,
      isConfidential: true,
      status: 'pending' as const,
    }

    let created
    try {
      created = await db.insert(foundaryApplications).values(fundingValues).returning()
    } catch (error) {
      if (!isMissingConfidentialityColumnsError(error)) throw error
      const { createdByUserId: _createdByUserId, isConfidential: _isConfidential, ...legacyValues } = fundingValues
      created = await db.insert(foundaryApplications).values(legacyValues).returning()
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.request_from_hosted',
      entityType: 'foundary_application',
      entityId: created[0].id,
      details: {
        organizationName,
        eventName: data.eventName,
        requestedFunds: data.requestedFunds,
      },
    })

    return created[0]
  })

export const inviteOrganizationMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationName: z.string().min(1),
        email: z.string().email(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const organizationName = normalizeOrg(data.organizationName)
    const targetEmail = data.email.trim().toLowerCase()

    const inviterMembership = await db
      .select({ id: organizationMembers.id, canManageMembers: organizationMembers.canManageMembers })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, organizationName),
        ),
      )
      .limit(1)

    if (!inviterMembership[0]) {
      throw new Error('You can only invite members to organizations you belong to')
    }

    if (!inviterMembership[0].canManageMembers) {
      throw new Error('You do not have permission to invite members for this organization')
    }

    const token = createHash('sha256').update(`${organizationName}:${targetEmail}:${randomUUID()}`).digest('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    await db.insert(organizationInvitations).values({
      token,
      email: targetEmail,
      organizationName,
      invitedBy: currentUser.id,
      expiresAt,
    })

    const inviteLink = `${getHostedBaseUrl()}/invite-register?invite=${token}`
    const inviterName = currentUser.name?.trim() || currentUser.email
    await sendOrganizationInviteEmail({
      to: targetEmail,
      invitedBy: inviterName,
      link: inviteLink,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.invite',
      entityType: 'organization_member',
      details: {
        organizationName,
        invitedEmail: targetEmail,
        inviteToken: token,
      },
    })

    return {
      success: true,
      organizationName,
      invitedEmail: targetEmail,
      inviteLink,
    }
  })

export const getOrganizationInviteInfoFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const invite = await db
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        organizationName: organizationInvitations.organizationName,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
      })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, data.token.trim()))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    return {
      email: invite[0].email,
      organizationName: invite[0].organizationName,
      expiresAt: invite[0].expiresAt,
      isExpired: invite[0].expiresAt.getTime() < Date.now(),
      isAccepted: Boolean(invite[0].acceptedAt),
    }
  })

export const registerInvitedMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        name: z.string().min(1),
        password: z.string().min(8).max(72),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const token = data.token.trim()

    const invite = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    if (invite[0].acceptedAt) {
      throw new Error('Invitation already accepted')
    }

    if (invite[0].expiresAt.getTime() < Date.now()) {
      throw new Error('Invitation has expired')
    }

    const existing = await db
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.email, invite[0].email))
      .limit(1)

    if (existing[0]) {
      throw new Error('Account already exists for this invite. Please sign in instead.')
    }

    const createdUser = await db
      .insert(users)
      .values({
        email: invite[0].email,
        passwordHash: hashPassword(data.password),
        name: data.name.trim(),
        role: 'volunteer',
        active: true,
      })
      .returning()

    const user = createdUser[0]

    await db.insert(organizationMembers).values({
      userId: user.id,
      organizationName: invite[0].organizationName,
      addedBy: invite[0].invitedBy ?? user.id,
    })

    await db
      .update(organizationInvitations)
      .set({
        acceptedBy: user.id,
        acceptedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invite[0].id))

    setCookie('session', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    await writeActivityLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'foundary.organization.member.register_from_invite',
      entityType: 'organization_member',
      details: {
        organizationName: invite[0].organizationName,
      },
    })

    return {
      success: true,
      organizationName: invite[0].organizationName,
      email: user.email,
    }
  })

export const getFoundaryApplicationMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: foundaryApplicationMessages.id,
      applicationId: foundaryApplicationMessages.applicationId,
      senderUserId: foundaryApplicationMessages.senderUserId,
      senderRole: foundaryApplicationMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: foundaryApplicationMessages.message,
      createdAt: foundaryApplicationMessages.createdAt,
    })
    .from(foundaryApplicationMessages)
    .innerJoin(users, eq(foundaryApplicationMessages.senderUserId, users.id))
    .orderBy(desc(foundaryApplicationMessages.createdAt))
})

export const getMyFoundaryApplicationMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  const db = await getDb()

  const organizations = await db
    .select({ organizationName: organizationMembers.organizationName })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, currentUser.id))

  const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))
  if (organizationNames.length === 0) {
    return []
  }

  let scopedApplications
  try {
    scopedApplications = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(
        and(
          inArray(foundaryApplications.organizationName, organizationNames),
          or(
            eq(foundaryApplications.isConfidential, false),
            eq(foundaryApplications.createdByUserId, currentUser.id),
            eq(foundaryApplications.email, currentUser.email),
          ),
        ),
      )
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    scopedApplications = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(inArray(foundaryApplications.organizationName, organizationNames))
  }

  const applicationIds = scopedApplications.map((item) => item.id)
  if (applicationIds.length === 0) {
    return []
  }

  return await db
    .select({
      id: foundaryApplicationMessages.id,
      applicationId: foundaryApplicationMessages.applicationId,
      senderUserId: foundaryApplicationMessages.senderUserId,
      senderRole: foundaryApplicationMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: foundaryApplicationMessages.message,
      createdAt: foundaryApplicationMessages.createdAt,
    })
    .from(foundaryApplicationMessages)
    .innerJoin(users, eq(foundaryApplicationMessages.senderUserId, users.id))
    .where(inArray(foundaryApplicationMessages.applicationId, applicationIds))
    .orderBy(desc(foundaryApplicationMessages.createdAt))
})

export const postFoundaryApplicationMessageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (currentUser.role !== 'organizer') {
      const membership = await db
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, currentUser.id),
            eq(organizationMembers.organizationName, application[0].organizationName),
          ),
        )
        .limit(1)

      if (!membership[0]) {
        throw new Error('Forbidden')
      }

      const existingStaffMessage = await db
        .select({ id: foundaryApplicationMessages.id })
        .from(foundaryApplicationMessages)
        .where(
          and(
            eq(foundaryApplicationMessages.applicationId, application[0].id),
            eq(foundaryApplicationMessages.senderRole, 'organizer'),
          ),
        )
        .limit(1)

      if (!existingStaffMessage[0]) {
        throw new Error('Staff has not requested additional information for this request yet')
      }

      const latestThreadMessage = await db
        .select({
          senderUserId: foundaryApplicationMessages.senderUserId,
          senderRole: foundaryApplicationMessages.senderRole,
          createdAt: foundaryApplicationMessages.createdAt,
        })
        .from(foundaryApplicationMessages)
        .where(eq(foundaryApplicationMessages.applicationId, application[0].id))
        .orderBy(desc(foundaryApplicationMessages.createdAt))
        .limit(1)

      const latest = latestThreadMessage[0]
      if (latest && latest.senderRole !== 'organizer' && latest.senderUserId === currentUser.id) {
        throw new Error('Please wait for staff to reply before sending another message')
      }
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: application[0].id,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    if (currentUser.role === 'organizer') {
      const { text, html } = buildAdminReplyNotificationMessage(cleanMessage)
      await sendApplicationThreadEmail({
        to: application[0].email,
        subject: `Re: Lanfoundary funding request #${application[0].id}`,
        text,
        html,
        applicationId: application[0].id,
      })
    } else {
      const fromName = currentUser.name?.trim() || currentUser.email
      const text = `${fromName} replied on request #${application[0].id}\n\n${cleanMessage}`
      const html = `<p><strong>${fromName}</strong> replied on request #${application[0].id}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`
      await sendApplicationThreadEmail({
        to: 'foundary@lankoping.se',
        subject: `Re: Lanfoundary funding request #${application[0].id}`,
        text,
        html,
        applicationId: application[0].id,
      })
    }

    return created[0]
  })

export const acceptOrganizationInviteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    const db = await getDb()

    const token = data.token.trim()
    const invite = await db
      .select()
      .from(organizationInvitations)
      .where(eq(organizationInvitations.token, token))
      .limit(1)

    if (!invite[0]) {
      throw new Error('Invitation not found')
    }

    if (invite[0].acceptedAt) {
      return { success: true, alreadyAccepted: true, organizationName: invite[0].organizationName }
    }

    if (invite[0].expiresAt.getTime() < Date.now()) {
      throw new Error('Invitation has expired')
    }

    const currentEmail = (currentUser.email ?? '').trim().toLowerCase()
    if (invite[0].email !== currentEmail) {
      throw new Error('This invitation is for a different email account')
    }

    const existingMembership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, invite[0].organizationName),
        ),
      )
      .limit(1)

    if (!existingMembership[0]) {
      await db.insert(organizationMembers).values({
        userId: currentUser.id,
        organizationName: invite[0].organizationName,
        addedBy: invite[0].invitedBy ?? currentUser.id,
      })
    }

    await db
      .update(organizationInvitations)
      .set({
        acceptedBy: currentUser.id,
        acceptedAt: new Date(),
      })
      .where(eq(organizationInvitations.id, invite[0].id))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.organization.member.accept',
      entityType: 'organization_member',
      details: {
        organizationName: invite[0].organizationName,
      },
    })

    return {
      success: true,
      alreadyAccepted: false,
      organizationName: invite[0].organizationName,
    }
  })

export const getFoundaryApplicationsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  try {
    return await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        age: foundaryApplications.age,
        cityCountry: foundaryApplications.cityCountry,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        hasHcbAccount: foundaryApplications.hasHcbAccount,
        hcbUsername: foundaryApplications.hcbUsername,
        preferredPaymentMethod: foundaryApplications.preferredPaymentMethod,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        briefEventDescription: foundaryApplications.briefEventDescription,
        budgetJustification: foundaryApplications.budgetJustification,
        ticketPriority: foundaryApplications.ticketPriority,
        ticketLabels: foundaryApplications.ticketLabels,
        assignedToUserId: foundaryApplications.assignedToUserId,
        status: foundaryApplications.status,
        isApplicationTicket: foundaryApplications.isApplicationTicket,
        createdByUserId: foundaryApplications.createdByUserId,
        isConfidential: foundaryApplications.isConfidential,
        ticketClosed: foundaryApplications.ticketClosed,
        ticketClosedAt: foundaryApplications.ticketClosedAt,
        ticketClosedByUserId: foundaryApplications.ticketClosedByUserId,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        reviewerName: users.name,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .leftJoin(users, eq(foundaryApplications.reviewedBy, users.id))
      .orderBy(desc(foundaryApplications.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error
    const legacyRows = await db
      .select({
        id: foundaryApplications.id,
        applicantName: foundaryApplications.applicantName,
        email: foundaryApplications.email,
        age: foundaryApplications.age,
        cityCountry: foundaryApplications.cityCountry,
        organizationName: foundaryApplications.organizationName,
        organizationStatus: foundaryApplications.organizationStatus,
        hasHcbAccount: foundaryApplications.hasHcbAccount,
        hcbUsername: foundaryApplications.hcbUsername,
        preferredPaymentMethod: foundaryApplications.preferredPaymentMethod,
        eventName: foundaryApplications.eventName,
        plannedMonths: foundaryApplications.plannedMonths,
        expectedAttendees: foundaryApplications.expectedAttendees,
        requestedEvents: foundaryApplications.requestedEvents,
        fundingRequestAmount: foundaryApplications.fundingRequestAmount,
        briefEventDescription: foundaryApplications.briefEventDescription,
        budgetJustification: foundaryApplications.budgetJustification,
        status: foundaryApplications.status,
        reviewNotes: foundaryApplications.reviewNotes,
        reviewedAt: foundaryApplications.reviewedAt,
        reviewerName: users.name,
        createdAt: foundaryApplications.createdAt,
        updatedAt: foundaryApplications.updatedAt,
      })
      .from(foundaryApplications)
      .leftJoin(users, eq(foundaryApplications.reviewedBy, users.id))
      .orderBy(desc(foundaryApplications.createdAt))

    return legacyRows.map((row) => ({
      ...row,
      createdByUserId: null as number | null,
      isConfidential: true,
      ticketPriority: 'normal' as const,
      ticketLabels: '',
      assignedToUserId: null as number | null,
      ticketClosed: false,
      ticketClosedAt: null,
      ticketClosedByUserId: null,
      isApplicationTicket: false,
    }))
  }
})

export const updateFoundaryApplicationTicketMetadataFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        priority: ticketPrioritySchema.optional(),
        labels: z.string().optional(),
        assignedToUserId: z.number().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    const updates: Partial<typeof foundaryApplications.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.priority) {
      updates.ticketPriority = data.priority
    }

    if (data.labels !== undefined) {
      updates.ticketLabels = normalizeTicketLabels(data.labels)
    }

    if (data.assignedToUserId !== undefined) {
      updates.assignedToUserId = await assertOrganizerAssignee(db, data.assignedToUserId)
    }

    await db.update(foundaryApplications).set(updates).where(eq(foundaryApplications.id, data.applicationId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.update_metadata',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        priority: data.priority ?? null,
        labels: data.labels !== undefined ? normalizeTicketLabels(data.labels).split(', ').filter(Boolean) : undefined,
        assignedToUserId: data.assignedToUserId ?? null,
      },
    })

    return { success: true }
  })

export const updateFoundaryApplicationStatusFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      applicationId: z.number(),
      status: z.enum(['pending', 'approved', 'rejected']),
      adjustedFundingAmount: z.number().int().positive().max(100000).optional(),
      requestMoreInfoMessage: z.string().optional(),
      reviewNotes: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()
    const now = new Date()

    const existing = await db
      .select({
        id: foundaryApplications.id,
        status: foundaryApplications.status,
        email: foundaryApplications.email,
        organizationName: foundaryApplications.organizationName,
        eventName: foundaryApplications.eventName,
      })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Application not found')
    }

    const updated = await db
      .update(foundaryApplications)
      .set({
        status: data.status,
        fundingRequestAmount: data.adjustedFundingAmount,
        reviewNotes: data.reviewNotes?.trim() || null,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    const requestMessage = data.requestMoreInfoMessage?.trim()
    if (requestMessage) {
      await db.insert(foundaryApplicationMessages).values({
        applicationId: data.applicationId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: requestMessage,
      })

      const { text, html } = buildAdminReplyNotificationMessage(requestMessage)

      await sendApplicationThreadEmail({
        to: updated[0].email,
        subject: `Re: Lanfoundary funding request #${data.applicationId}`,
        text,
        html,
        applicationId: data.applicationId,
      })
    }

    if (existing[0].status !== data.status) {
      await sendApplicationStatusNotificationEmail({
        to: updated[0].email,
        applicationId: data.applicationId,
        organizationName: existing[0].organizationName,
        eventName: existing[0].eventName,
        status: data.status,
        reviewNotes: data.reviewNotes ?? null,
      })
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: `foundary.application.${data.status}`,
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        reviewNotes: data.reviewNotes ?? null,
        adjustedFundingAmount: data.adjustedFundingAmount ?? null,
        requestMoreInfoMessage: requestMessage ?? null,
      },
    })

    return updated[0]
  })

export const updateFoundaryApplicationConfidentialityFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        isConfidential: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const updated = await db
      .update(foundaryApplications)
      .set({
        isConfidential: data.isConfidential,
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    if (!updated[0]) {
      throw new Error('Application not found')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: data.isConfidential
        ? 'foundary.application.confidentiality.enabled'
        : 'foundary.application.confidentiality.disabled',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        isConfidential: data.isConfidential,
      },
    })

    return updated[0]
  })

export const closeFoundaryApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      return application[0]
    }

    const closed = await db
      .update(foundaryApplications)
      .set({
        ticketClosed: true,
        ticketClosedAt: new Date(),
        ticketClosedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close ticket')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const closeFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const existing = await db
      .select({ id: foundaryApplications.id })
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Application not found')
    }

    const now = new Date()
    const closed = await db
      .update(foundaryApplications)
      .set({
        status: 'rejected',
        reviewedBy: currentUser.id,
        reviewedAt: now,
        ticketClosed: true,
        ticketClosedAt: now,
        ticketClosedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        status: foundaryApplications.status,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close application')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const decideFoundaryApplicationFundingFromTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        decision: z.enum(['approved', 'rejected']),
        reason: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (data.decision === 'rejected' && !data.reason?.trim()) {
      throw new Error('Please provide a rejection reason')
    }

    const now = new Date()
    const cleanReason = data.reason?.trim() || null

    const updated = await db
      .update(foundaryApplications)
      .set({
        status: data.decision,
        reviewNotes: cleanReason,
        reviewedBy: currentUser.id,
        reviewedAt: now,
        ticketClosed: true,
        ticketClosedAt: now,
        ticketClosedByUserId: currentUser.id,
        updatedAt: now,
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning()

    const decisionLabel = data.decision === 'approved' ? 'approved' : 'rejected'
    const cleanMessage = [
      data.decision === 'approved'
        ? 'Funding request approved.'
        : 'Funding request rejected and ticket closed.',
      cleanReason ? `Reason: ${cleanReason}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    await db.insert(foundaryApplicationMessages).values({
      applicationId: data.applicationId,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    const staffName = currentUser.name?.trim() || currentUser.email
    const emailText = [
      `Your funding request #${data.applicationId} has been ${decisionLabel}.`,
      '',
      `${staffName} wrote:`,
      cleanMessage,
    ].join('\n')
    const emailHtml = `<p>Your funding request #${data.applicationId} has been <strong>${decisionLabel}</strong>.</p><p><strong>${staffName}</strong> wrote:</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendApplicationThreadEmail({
      to: application[0].email,
      subject: `Lanfoundary funding request #${data.applicationId} ${decisionLabel}`,
      text: emailText,
      html: emailHtml,
      applicationId: data.applicationId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action:
        data.decision === 'approved'
          ? 'foundary.application.ticket.approve'
          : 'foundary.application.ticket.reject_and_close',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        reason: cleanReason,
      },
    })

    return updated[0]
  })

export const createFoundaryApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: application[0].id,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    const staffName = currentUser.name?.trim() || currentUser.email
    const text = [
      'You have received a new ticket update on your funding request.',
      '',
      `${staffName} wrote:`,
      cleanMessage,
    ].join('\n')
    const html = `<p>You have received a new ticket update on your funding request.</p><p><strong>${staffName}</strong> wrote:</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendApplicationThreadEmail({
      to: application[0].email,
      subject: `Re: Lanfoundary funding request #${application[0].id}`,
      text,
      html,
      applicationId: application[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.create',
      entityType: 'foundary_application',
      entityId: application[0].id,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return created[0]
  })

export const createHostedApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Organizers should use admin ticket actions')
    }

    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    if (application[0].ticketClosed) {
      throw new Error('This ticket is closed')
    }

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, application[0].organizationName),
        ),
      )
      .limit(1)

    if (!membership[0]) {
      throw new Error('Forbidden')
    }

    if (application[0].isConfidential && application[0].createdByUserId && application[0].createdByUserId !== currentUser.id) {
      throw new Error('This request is confidential to the original creator')
    }

    const existingOrganizerMessage = await db
      .select({ id: foundaryApplicationMessages.id })
      .from(foundaryApplicationMessages)
      .where(
        and(
          eq(foundaryApplicationMessages.applicationId, data.applicationId),
          eq(foundaryApplicationMessages.senderRole, 'organizer'),
        ),
      )
      .limit(1)

    if (existingOrganizerMessage[0]) {
      throw new Error('A ticket thread already exists. Use reply instead.')
    }

    const latestThreadMessage = await db
      .select({
        senderUserId: foundaryApplicationMessages.senderUserId,
        senderRole: foundaryApplicationMessages.senderRole,
      })
      .from(foundaryApplicationMessages)
      .where(eq(foundaryApplicationMessages.applicationId, data.applicationId))
      .orderBy(desc(foundaryApplicationMessages.createdAt))
      .limit(1)

    const latest = latestThreadMessage[0]
    if (latest && latest.senderRole !== 'organizer' && latest.senderUserId === currentUser.id) {
      throw new Error('Please wait for staff to reply before sending another message')
    }

    const cleanMessage = data.message.trim()
    const created = await db
      .insert(foundaryApplicationMessages)
      .values({
        applicationId: data.applicationId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning()

    const fromName = currentUser.name?.trim() || currentUser.email
    const text = `${fromName} opened a ticket on request #${application[0].id}\n\n${cleanMessage}`
    const html = `<p><strong>${fromName}</strong> opened a ticket on request #${application[0].id}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`
    await sendApplicationThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Re: Lanfoundary funding request #${application[0].id}`,
      text,
      html,
      applicationId: application[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.create_from_hosted',
      entityType: 'foundary_application',
      entityId: application[0].id,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return created[0]
  })

export const createHostedSupportTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Organizers should use admin ticket actions')
    }

    const db = await getDb()
    const cleanMessage = data.message.trim()
    
    // Check for restricted flags - AI should not process these
    const hasRestrictedFlagsInMessage = hasRestrictedFlags(cleanMessage)
    const aiResult = !hasRestrictedFlagsInMessage 
      ? await getHostedSupportAssistantReply(cleanMessage)
      : buildHostedSupportHeuristic('restricted topic')
    
    const combinedLabels = hasRestrictedFlagsInMessage 
      ? 'staff-only, restricted-topic'
      : combineTicketLabels(aiResult.category, aiResult.labels)

    const openTickets = await db
      .select({ id: hostedSupportTickets.id })
      .from(hostedSupportTickets)
      .where(and(eq(hostedSupportTickets.userId, currentUser.id), eq(hostedSupportTickets.status, 'open')))

    if (openTickets.length >= 3) {
      throw new Error('You can have at most 3 open tickets at a time')
    }

    const created = await db
      .insert(hostedSupportTickets)
      .values({
        userId: currentUser.id,
        message: aiResult.summary,
        ticketPriority: 'low',
        ticketLabels: combinedLabels,
        status: 'open',
      })
      .returning({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
      })

    await db.insert(hostedSupportTicketMessages).values({
      ticketId: created[0].id,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    const aiResponderId = (await getAutomationOrganizerUserId(db)) ?? currentUser.id
    if (aiResponderId) {
      await db.insert(hostedSupportTicketMessages).values({
        ticketId: created[0].id,
        senderUserId: aiResponderId,
        senderRole: 'organizer',
        message: buildAiIntroductionMessage(),
      })

      await db.insert(hostedSupportTicketMessages).values({
        ticketId: created[0].id,
        senderUserId: aiResponderId,
        senderRole: 'organizer',
        message: buildAiFollowUpMessage(aiResult, 'low'),
      })
    }

    const organizations = await db
      .select({ organizationName: organizationMembers.organizationName })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, currentUser.id))

    const organizationNames = Array.from(new Set(organizations.map((org) => normalizeOrg(org.organizationName)).filter(Boolean)))

    const fromName = currentUser.name?.trim() || currentUser.email
    const organizationLine =
      organizationNames.length > 0 ? `Organization(s): ${organizationNames.join(', ')}` : 'Organization(s): None linked yet'

    const text = [
      `${fromName} opened a hosted support ticket.`,
      organizationLine,
      '',
      cleanMessage,
    ].join('\n')

    const html = [
      `<p><strong>${fromName}</strong> opened a hosted support ticket.</p>`,
      `<p>${organizationLine}</p>`,
      `<p>${cleanMessage.replace(/\n/g, '<br />')}</p>`,
    ].join('')

    await sendHostedSupportThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Hosted support ticket #${created[0].id} from ${fromName}`,
      text,
      html,
      ticketId: created[0].id,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.create',
      entityType: 'hosted_support_ticket',
      entityId: created[0].id,
      details: {
        messageLength: cleanMessage.length,
        organizationCount: organizationNames.length,
        priority: 'low',
        labels: combinedLabels ? combinedLabels.split(', ') : [],
        aiCategory: aiResult.category,
        aiFollowUpQuestions: aiResult.followUpQuestions,
      },
    })

    return {
      success: true,
      ticketId: created[0].id,
    }
  })

export const getMyHostedSupportTicketMessagesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  if (currentUser.role === 'organizer') {
    throw new Error('Use admin ticket views')
  }

  const db = await getDb()

  return await db
    .select({
      id: hostedSupportTicketMessages.id,
      ticketId: hostedSupportTicketMessages.ticketId,
      senderUserId: hostedSupportTicketMessages.senderUserId,
      senderRole: hostedSupportTicketMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: hostedSupportTicketMessages.message,
      createdAt: hostedSupportTicketMessages.createdAt,
    })
    .from(hostedSupportTicketMessages)
    .innerJoin(hostedSupportTickets, eq(hostedSupportTicketMessages.ticketId, hostedSupportTickets.id))
    .innerJoin(users, eq(hostedSupportTicketMessages.senderUserId, users.id))
    .where(eq(hostedSupportTickets.userId, currentUser.id))
    .orderBy(desc(hostedSupportTicketMessages.createdAt))
})

export const postMyHostedSupportTicketMessageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin ticket actions')
    }

    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].userId !== currentUser.id) {
      throw new Error('Forbidden')
    }

    if (ticket[0].status === 'closed') {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()
    const recentThreadMessages = await db
      .select({ senderRole: hostedSupportTicketMessages.senderRole, message: hostedSupportTicketMessages.message })
      .from(hostedSupportTicketMessages)
      .where(eq(hostedSupportTicketMessages.ticketId, data.ticketId))
      .orderBy(desc(hostedSupportTicketMessages.createdAt))
      .limit(12)

    const conversationContext = buildHostedSupportConversationContext(recentThreadMessages.reverse())
    const aiResult = await getHostedSupportAssistantReply(cleanMessage, conversationContext)

    const created = await db
      .insert(hostedSupportTicketMessages)
      .values({
        ticketId: data.ticketId,
        senderUserId: currentUser.id,
        senderRole: currentUser.role,
        message: cleanMessage,
      })
      .returning({
        id: hostedSupportTicketMessages.id,
      })

    const currentTicket = await db
      .select({
        ticketLabels: hostedSupportTickets.ticketLabels,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    const combinedLabels = combineTicketLabels(currentTicket[0]?.ticketLabels ?? '', aiResult.category, aiResult.labels)

    await db
      .update(hostedSupportTickets)
      .set({
        message: aiResult.summary,
        ticketPriority: aiResult.priority,
        ticketLabels: combinedLabels,
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    const aiResponderId = (await getAutomationOrganizerUserId(db)) ?? currentUser.id
    if (aiResponderId) {
      await db.insert(hostedSupportTicketMessages).values({
        ticketId: data.ticketId,
        senderUserId: aiResponderId,
        senderRole: 'organizer',
        message: buildAiFollowUpMessage(aiResult),
      })
    }

    const fromName = currentUser.name?.trim() || currentUser.email
    const text = `${fromName} replied on hosted support ticket #${data.ticketId}\n\n${cleanMessage}`
    const html = `<p><strong>${fromName}</strong> replied on hosted support ticket #${data.ticketId}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendHostedSupportThreadEmail({
      to: 'foundary@lankoping.se',
      subject: `Re: Hosted support ticket #${data.ticketId}`,
      text,
      html,
      ticketId: data.ticketId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.reply',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
      details: {
        messageLength: cleanMessage.length,
        messageId: created[0].id,
        aiCategory: aiResult.category,
        aiPriority: aiResult.priority,
        aiFollowUpQuestions: aiResult.followUpQuestions,
      },
    })

    return { success: true }
  })

export const getMyHostedSupportTicketsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const currentUser = await requireStaffUser()
  if (currentUser.role === 'organizer') {
    throw new Error('Use admin ticket views')
  }

  const db = await getDb()

  try {
    return await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        message: hostedSupportTickets.message,
        ticketPriority: hostedSupportTickets.ticketPriority,
        ticketLabels: hostedSupportTickets.ticketLabels,
        assignedToUserId: hostedSupportTickets.assignedToUserId,
        status: hostedSupportTickets.status,
        closedAt: hostedSupportTickets.closedAt,
        closedByUserId: hostedSupportTickets.closedByUserId,
        createdAt: hostedSupportTickets.createdAt,
        updatedAt: hostedSupportTickets.updatedAt,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.userId, currentUser.id))
      .orderBy(desc(hostedSupportTickets.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error

    const legacyRows = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        message: hostedSupportTickets.message,
        status: hostedSupportTickets.status,
        closedAt: hostedSupportTickets.closedAt,
        closedByUserId: hostedSupportTickets.closedByUserId,
        createdAt: hostedSupportTickets.createdAt,
        updatedAt: hostedSupportTickets.updatedAt,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.userId, currentUser.id))
      .orderBy(desc(hostedSupportTickets.createdAt))

    return legacyRows.map((row) => ({
      ...row,
      ticketPriority: 'normal' as const,
      ticketLabels: '',
      assignedToUserId: null as number | null,
    }))
  }
})

export const getHostedSupportTicketsForAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  try {
    return await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        reporterName: users.name,
        reporterEmail: users.email,
        message: hostedSupportTickets.message,
        ticketPriority: hostedSupportTickets.ticketPriority,
        ticketLabels: hostedSupportTickets.ticketLabels,
        assignedToUserId: hostedSupportTickets.assignedToUserId,
        status: hostedSupportTickets.status,
        closedAt: hostedSupportTickets.closedAt,
        closedByUserId: hostedSupportTickets.closedByUserId,
        createdAt: hostedSupportTickets.createdAt,
        updatedAt: hostedSupportTickets.updatedAt,
      })
      .from(hostedSupportTickets)
      .innerJoin(users, eq(hostedSupportTickets.userId, users.id))
      .orderBy(desc(hostedSupportTickets.createdAt))
  } catch (error) {
    if (!isMissingConfidentialityColumnsError(error)) throw error

    const legacyRows = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        reporterName: users.name,
        reporterEmail: users.email,
        message: hostedSupportTickets.message,
        status: hostedSupportTickets.status,
        closedAt: hostedSupportTickets.closedAt,
        closedByUserId: hostedSupportTickets.closedByUserId,
        createdAt: hostedSupportTickets.createdAt,
        updatedAt: hostedSupportTickets.updatedAt,
      })
      .from(hostedSupportTickets)
      .innerJoin(users, eq(hostedSupportTickets.userId, users.id))
      .orderBy(desc(hostedSupportTickets.createdAt))

    return legacyRows.map((row) => ({
      ...row,
      ticketPriority: 'normal' as const,
      ticketLabels: '',
      assignedToUserId: null as number | null,
    }))
  }
})

export const getHostedSupportTicketMessagesForAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireOrganizerUser()
  const db = await getDb()

  return await db
    .select({
      id: hostedSupportTicketMessages.id,
      ticketId: hostedSupportTicketMessages.ticketId,
      senderUserId: hostedSupportTicketMessages.senderUserId,
      senderRole: hostedSupportTicketMessages.senderRole,
      senderName: users.name,
      senderEmail: users.email,
      message: hostedSupportTicketMessages.message,
      createdAt: hostedSupportTicketMessages.createdAt,
    })
    .from(hostedSupportTicketMessages)
    .innerJoin(users, eq(hostedSupportTicketMessages.senderUserId, users.id))
    .orderBy(desc(hostedSupportTicketMessages.createdAt))
})

export const updateHostedSupportTicketMetadataFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
        priority: ticketPrioritySchema.optional(),
        labels: z.string().optional(),
        assignedToUserId: z.number().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({ id: hostedSupportTickets.id })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    const updates: Partial<typeof hostedSupportTickets.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.priority) {
      updates.ticketPriority = data.priority
    }

    if (data.labels !== undefined) {
      updates.ticketLabels = normalizeTicketLabels(data.labels)
    }

    if (data.assignedToUserId !== undefined) {
      updates.assignedToUserId = await assertOrganizerAssignee(db, data.assignedToUserId)
    }

    await db.update(hostedSupportTickets).set(updates).where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.update_metadata',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
      details: {
        priority: data.priority ?? null,
        labels: data.labels !== undefined ? normalizeTicketLabels(data.labels).split(', ') : undefined,
        assignedToUserId: data.assignedToUserId ?? null,
      },
    })

    return { success: true }
  })

export const closeMyHostedSupportTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin ticket actions')
    }

    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        userId: hostedSupportTickets.userId,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].userId !== currentUser.id) {
      throw new Error('Forbidden')
    }

    if (ticket[0].status === 'closed') {
      return { success: true }
    }

    await db
      .update(hostedSupportTickets)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.close',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const postHostedSupportTicketMessageFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
        message: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
        reporterEmail: users.email,
      })
      .from(hostedSupportTickets)
      .innerJoin(users, eq(hostedSupportTickets.userId, users.id))
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].status === 'closed') {
      throw new Error('This ticket is closed')
    }

    const cleanMessage = data.message.trim()

    await db.insert(hostedSupportTicketMessages).values({
      ticketId: data.ticketId,
      senderUserId: currentUser.id,
      senderRole: currentUser.role,
      message: cleanMessage,
    })

    await db
      .update(hostedSupportTickets)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    const senderName = currentUser.name?.trim() || currentUser.email
    const text = `${senderName} replied on hosted support ticket #${data.ticketId}\n\n${cleanMessage}`
    const html = `<p><strong>${senderName}</strong> replied on hosted support ticket #${data.ticketId}</p><p>${cleanMessage.replace(/\n/g, '<br />')}</p>`

    await sendHostedSupportThreadEmail({
      to: ticket[0].reporterEmail,
      subject: `Re: Hosted support ticket #${data.ticketId}`,
      text,
      html,
      ticketId: data.ticketId,
    })

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.reply_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
      details: {
        messageLength: cleanMessage.length,
      },
    })

    return { success: true }
  })

export const closeHostedSupportTicketFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({
        id: hostedSupportTickets.id,
        status: hostedSupportTickets.status,
      })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    if (ticket[0].status === 'closed') {
      return { success: true }
    }

    await db
      .update(hostedSupportTickets)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.close_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const deleteHostedSupportTicketFromAdminFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const ticket = await db
      .select({ id: hostedSupportTickets.id })
      .from(hostedSupportTickets)
      .where(eq(hostedSupportTickets.id, data.ticketId))
      .limit(1)

    if (!ticket[0]) {
      throw new Error('Ticket not found')
    }

    await db.delete(hostedSupportTicketMessages).where(eq(hostedSupportTicketMessages.ticketId, data.ticketId))
    await db.delete(hostedSupportTickets).where(eq(hostedSupportTickets.id, data.ticketId))

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.hosted.support_ticket.delete_from_admin',
      entityType: 'hosted_support_ticket',
      entityId: data.ticketId,
    })

    return { success: true }
  })

export const closeHostedApplicationTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireStaffUser()
    if (currentUser.role === 'organizer') {
      throw new Error('Use admin actions to manage this ticket')
    }

    const db = await getDb()

    const application = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!application[0]) {
      throw new Error('Application not found')
    }

    const membership = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, currentUser.id),
          eq(organizationMembers.organizationName, application[0].organizationName),
        ),
      )
      .limit(1)

    if (!membership[0]) {
      throw new Error('Forbidden')
    }

    if (application[0].isConfidential && application[0].createdByUserId && application[0].createdByUserId !== currentUser.id) {
      throw new Error('This request is confidential to the original creator')
    }

    const closed = await db
      .update(foundaryApplications)
      .set({
        ticketClosed: true,
        ticketClosedAt: new Date(),
        ticketClosedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({
        id: foundaryApplications.id,
        ticketClosed: foundaryApplications.ticketClosed,
      })

    if (!closed[0]) {
      throw new Error('Could not close ticket')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.ticket.close_from_hosted',
      entityType: 'foundary_application',
      entityId: data.applicationId,
    })

    return closed[0]
  })

export const deleteFoundaryApplicationFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.number(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const currentUser = await requireOrganizerUser()
    const db = await getDb()

    const existing = await db
      .select()
      .from(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .limit(1)

    if (!existing[0]) {
      throw new Error('Application not found')
    }

    const removedMessages = await db
      .delete(foundaryApplicationMessages)
      .where(eq(foundaryApplicationMessages.applicationId, data.applicationId))
      .returning({ id: foundaryApplicationMessages.id })

    const removedApplication = await db
      .delete(foundaryApplications)
      .where(eq(foundaryApplications.id, data.applicationId))
      .returning({ id: foundaryApplications.id })

    if (!removedApplication[0]) {
      throw new Error('Could not delete application')
    }

    await writeActivityLog({
      actorUserId: currentUser.id,
      actorRole: currentUser.role,
      action: 'foundary.application.delete',
      entityType: 'foundary_application',
      entityId: data.applicationId,
      details: {
        organizationName: existing[0].organizationName,
        eventName: existing[0].eventName,
        deletedMessageCount: removedMessages.length,
      },
    })

    return {
      success: true,
      applicationId: data.applicationId,
      deletedMessageCount: removedMessages.length,
    }
  })