import { pgTable, text, serial, timestamp, boolean, integer, jsonb, real } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role', { enum: ['admin'] }).default('admin').notNull(),
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

export const performanceTests = pgTable('performance_tests', {
  id: serial('id').primaryKey(),
  testDate: timestamp('test_date').notNull().defaultNow(),
  totalTests: integer('total_tests').notNull(),
  successfulTests: integer('successful_tests').notNull(),
  failedTests: integer('failed_tests').notNull(),
  successRate: real('success_rate').notNull(),
  avgLoadTime: real('avg_load_time').notNull(),
  minLoadTime: real('min_load_time'),
  maxLoadTime: real('max_load_time'),
  duration: real('duration').notNull(),
  status: text('status', { enum: ['running', 'completed', 'failed'] }).default('running').notNull(),
  results: jsonb('results'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const performanceTestResults = pgTable('performance_test_results', {
  id: serial('id').primaryKey(),
  testId: integer('test_id').notNull().references(() => performanceTests.id),
  deviceName: text('device_name').notNull(),
  browserName: text('browser_name').notNull(),
  platform: text('platform').notNull(),
  page: text('page').notNull(),
  loadTime: real('load_time').notNull(),
  domContentLoaded: real('dom_content_loaded'),
  firstPaint: real('first_paint'),
  success: boolean('success').notNull(),
  error: text('error'),
  pageTitle: text('page_title'),
  createdAt: timestamp('created_at').defaultNow(),
})
