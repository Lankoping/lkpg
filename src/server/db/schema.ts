import { pgTable, text, serial, timestamp, boolean, integer, json } from 'drizzle-orm/pg-core'

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

export const stadgar = pgTable('stadgar', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  signatures: text('signatures').default('{}').notNull(), // JSON: { "1": true, "2": false } (userId: signed)
  updatedBy: integer('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const avgangsRequests = pgTable('avgangs_requests', {
  id: serial('id').primaryKey(),
  namn: text('namn').notNull(),
  pnr: text('pnr').notNull(),
  roll: text('roll').notNull(),
  orsak: text('orsak').notNull(),
  datum: timestamp('datum').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'archived'] }).default('pending').notNull(),
  pdfUrl: text('pdf_url'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  targetUserId: integer('target_user_id').references(() => users.id),
  requiredSigners: text('required_signers').default('[]').notNull(), // JSON: number[]
  digitalSignatures: text('digital_signatures').default('{}').notNull(), // JSON: { userId: bool }
  physicalSigned: boolean('physical_signed').default(false).notNull(),
  generatedAt: timestamp('generated_at'),
  generatedBy: integer('generated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const agreements = pgTable('agreements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  body: text('body').notNull(),
  status: text('status', { enum: ['draft', 'active', 'completed', 'archived'] }).default('draft').notNull(),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  requiredSigners: text('required_signers').default('[]').notNull(),
  digitalSignatures: text('digital_signatures').default('{}').notNull(),
  generatedAt: timestamp('generated_at'),
  generatedBy: integer('generated_by').references(() => users.id),
  physicalSigned: boolean('physical_signed').default(false).notNull(),
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

export const navigationItems = pgTable('navigation_items', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  labelEn: text('label_en'),
  href: text('href').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  parentId: integer('parent_id').references((): ReturnType<typeof pgTable> => navigationItems.id),
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
