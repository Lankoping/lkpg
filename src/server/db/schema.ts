import { bigint, pgTable, text, serial, timestamp, boolean, integer, json } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role', { enum: ['organizer', 'volunteer'] }).default('volunteer').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  type: text('type', { enum: ['blog', 'news'] }).default('blog').notNull(),
  published: boolean('published').default(false),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  location: text('location'),
  image: text('image'),
  published: boolean('published').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const ticketTypes = pgTable('ticket_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').default(0).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id),
  participantName: text('participant_name').notNull(),
  participantEmail: text('participant_email').notNull(),
  ticketType: text('ticket_type').default('standard').notNull(),
  pricePaid: integer('price_paid').default(0).notNull(),
  ticketCode: text('ticket_code').notNull().unique(),
  status: text('status', { enum: ['valid', 'used', 'cancelled'] }).default('valid').notNull(),
  scannedAt: timestamp('scanned_at'),
  scannedBy: integer('scanned_by').references(() => users.id),
  issuedBy: integer('issued_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id).notNull(),
  actorRole: text('actor_role', { enum: ['organizer', 'volunteer'] }).notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const loginTwoFactorCodes = pgTable('login_two_factor_codes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  challengeId: text('challenge_id').notNull().unique(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// CMS Tables

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: json('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const heroContent = pgTable('hero_content', {
  id: serial('id').primaryKey(),
  eyebrow: text('eyebrow').notNull(),
  eyebrowEn: text('eyebrow_en'),
  headline: text('headline').notNull(),
  headlineEn: text('headline_en'),
  tagline: text('tagline').notNull(),
  taglineEn: text('tagline_en'),
  description: text('description').notNull(),
  descriptionEn: text('description_en'),
  primaryButtonText: text('primary_button_text').notNull(),
  primaryButtonTextEn: text('primary_button_text_en'),
  primaryButtonLink: text('primary_button_link').notNull(),
  secondaryButtonText: text('secondary_button_text'),
  secondaryButtonTextEn: text('secondary_button_text_en'),
  secondaryButtonLink: text('secondary_button_link'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const infoSections = pgTable('info_sections', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  icon: text('icon').notNull(),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  description: text('description').notNull(),
  descriptionEn: text('description_en'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  roleEn: text('role_en'),
  description: text('description').notNull(),
  descriptionEn: text('description_en'),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const pages = pgTable('pages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  subtitle: text('subtitle'),
  subtitleEn: text('subtitle_en'),
  content: json('content').$type<PageSection[]>().notNull(),
  contentEn: json('content_en').$type<PageSection[]>(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const foundaryApplications = pgTable('foundary_applications', {
  id: serial('id').primaryKey(),
  applicantName: text('applicant_name').notNull(),
  email: text('email').notNull(),
  age: integer('age').notNull(),
  cityCountry: text('city_country').notNull(),
  organizationName: text('organization_name').notNull(),
  organizationStatus: text('organization_status', {
    enum: ['registered_nonprofit', 'equivalent_in_my_country', 'individual_group_for_reimbursements_only'],
  }).notNull(),
  hasHcbAccount: boolean('has_hcb_account').default(false).notNull(),
  hcbUsername: text('hcb_username'),
  preferredPaymentMethod: text('preferred_payment_method', {
    enum: ['direct_hcb_transfer', 'receipt_reimbursement'],
  }).notNull(),
  eventName: text('event_name').notNull(),
  plannedMonths: text('planned_months').notNull(),
  expectedAttendees: integer('expected_attendees').notNull(),
  requestedEvents: integer('requested_events').default(1).notNull(),
  fundingRequestAmount: integer('funding_request_amount').notNull(),
  briefEventDescription: text('brief_event_description').notNull(),
  budgetJustification: text('budget_justification').notNull(),
  termsAccepted: boolean('terms_accepted').default(true).notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  isConfidential: boolean('is_confidential').default(true).notNull(),
  ticketClosed: boolean('ticket_closed').default(false).notNull(),
  ticketClosedAt: timestamp('ticket_closed_at'),
  ticketClosedByUserId: integer('ticket_closed_by_user_id').references(() => users.id),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  reviewNotes: text('review_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  organizationName: text('organization_name').notNull(),
  addedBy: integer('added_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const organizationInvitations = pgTable('organization_invitations', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  email: text('email').notNull(),
  organizationName: text('organization_name').notNull(),
  invitedBy: integer('invited_by').references(() => users.id),
  acceptedBy: integer('accepted_by').references(() => users.id),
  acceptedAt: timestamp('accepted_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const foundaryApplicationMessages = pgTable('foundary_application_messages', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => foundaryApplications.id),
  senderUserId: integer('sender_user_id').notNull().references(() => users.id),
  senderRole: text('sender_role', { enum: ['organizer', 'volunteer'] }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const storagePerkRequests = pgTable('storage_perk_requests', {
  id: serial('id').primaryKey(),
  organizationName: text('organization_name').notNull().unique(),
  requestedByUserId: integer('requested_by_user_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  reviewNotes: text('review_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  approvedAt: timestamp('approved_at'),
  termsAcceptedAt: timestamp('terms_accepted_at'),
  termsAcceptedByUserId: integer('terms_accepted_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const storageUploadReservations = pgTable('storage_upload_reservations', {
  id: serial('id').primaryKey(),
  organizationName: text('organization_name').notNull(),
  requestedByUserId: integer('requested_by_user_id').notNull().references(() => users.id),
  fileName: text('file_name').notNull(),
  contentType: text('content_type'),
  objectKey: text('object_key').notNull().unique(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const storageFiles = pgTable('storage_files', {
  id: serial('id').primaryKey(),
  organizationName: text('organization_name').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').notNull().references(() => users.id),
  fileName: text('file_name').notNull(),
  contentType: text('content_type'),
  objectKey: text('object_key').notNull().unique(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const navigationItems = pgTable('navigation_items', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  labelEn: text('label_en'),
  href: text('href').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  parentId: integer('parent_id').references(() => navigationItems.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Type for page content sections
export type PageSection = {
  type: 'heading' | 'paragraph' | 'list' | 'callout'
  icon?: string
  title?: string
  content?: string
  items?: string[]
  variant?: 'default' | 'warning' | 'info'
}
