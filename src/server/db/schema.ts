import { pgTable, text, serial, timestamp, boolean, integer } from 'drizzle-orm/pg-core'

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
