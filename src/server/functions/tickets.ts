'use server'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../db/runtime'
import { tickets, posts, ticketTypes, events, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getCookie } from '@tanstack/react-start/server'
import { nanoid } from 'nanoid'
import { isDemoTesterUser, requireStaffUser } from '../lib/access'
import { writeActivityLog } from './logs'

async function checkAdmin() {
  const user = await requireStaffUser()
  return user
}

export const getEventsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await checkAdmin()
    const db = await getDb()
    return await db.select().from(events)
  })

export const createEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.string(), // We'll parse this as a Date on the server
      location: z.string().optional(),
      image: z.string().optional(),
      published: z.boolean().default(false),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    const result = await db.insert(events).values({
      ...data,
      date: new Date(data.date),
    }).returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'event.create',
      entityType: 'event',
      entityId: result[0].id,
      details: { title: result[0].title },
    })

    return result[0]
  })

export const deleteEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: id }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    await db.delete(events).where(eq(events.id, id))

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'event.delete',
      entityType: 'event',
      entityId: id,
    })

    return { success: true }
  })

export const getTicketTypesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    await checkAdmin()
    const db = await getDb()
    return await db.select().from(ticketTypes)
  })

export const createTicketTypeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string(),
      price: z.number(),
      description: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    const result = await db.insert(ticketTypes).values(data).returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'ticket_type.create',
      entityType: 'ticket_type',
      entityId: result[0].id,
      details: { name: result[0].name },
    })

    return result[0]
  })

export const deleteTicketTypeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: id }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    await db.delete(ticketTypes).where(eq(ticketTypes.id, id))

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'ticket_type.delete',
      entityType: 'ticket_type',
      entityId: id,
    })

    return { success: true }
  })

export const getTicketsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = await checkAdmin()
    const db = await getDb()
    const baseQuery = db.select({
      id: tickets.id,
      eventId: tickets.eventId,
      participantName: tickets.participantName,
      participantEmail: tickets.participantEmail,
      ticketType: tickets.ticketType,
      pricePaid: tickets.pricePaid,
      ticketCode: tickets.ticketCode,
      status: tickets.status,
      scannedAt: tickets.scannedAt,
      scannedBy: tickets.scannedBy,
      scannedByName: users.name,
      issuedBy: tickets.issuedBy,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.scannedBy, users.id))

    if (isDemoTesterUser(admin)) {
      return await baseQuery.where(eq(tickets.issuedBy, admin.id))
    }

    return await baseQuery
  })

export const getTicketFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.string().parse(data))
  .handler(async ({ data: ticketId }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    const result = await db.select().from(tickets).where(eq(tickets.id, parseInt(ticketId))).limit(1)
    if (isDemoTesterUser(admin) && result[0] && result[0].issuedBy !== admin.id) {
      throw new Error('Forbidden in demo mode')
    }
    return result[0]
  })

export const issueTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({
      eventId: z.number(),
      participantName: z.string(),
      participantEmail: z.string().email(),
      ticketType: z.string(),
      pricePaid: z.number(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await checkAdmin()
    const db = await getDb()
    
    const ticketCode = `TKT-${nanoid(8).toUpperCase()}`
    
    const newTicket = await db.insert(tickets).values({
      eventId: data.eventId,
      participantName: data.participantName,
      participantEmail: data.participantEmail,
      ticketType: data.ticketType,
      pricePaid: data.pricePaid,
      ticketCode,
      issuedBy: admin.id,
    }).returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'ticket.issue',
      entityType: 'ticket',
      entityId: newTicket[0].id,
      details: {
        code: newTicket[0].ticketCode,
        eventId: newTicket[0].eventId,
      },
    })

    return newTicket[0]
  })

export const updateTicketStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      ticketId: z.number(),
      status: z.enum(['valid', 'used', 'cancelled']),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const admin = await checkAdmin()
    const db = await getDb()

    if (isDemoTesterUser(admin)) {
      const existing = await db.select().from(tickets).where(eq(tickets.id, data.ticketId)).limit(1)
      if (!existing[0] || existing[0].issuedBy !== admin.id) {
        throw new Error('Forbidden in demo mode')
      }
    }

    const scanDate = data.status === 'used' ? new Date() : null
    const updated = await db.update(tickets)
      .set({ 
        status: data.status, 
        scannedAt: scanDate,
        scannedBy: data.status === 'used' ? admin.id : null,
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, data.ticketId))
      .returning()

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'ticket.status.update',
      entityType: 'ticket',
      entityId: data.ticketId,
      details: { status: data.status },
    })

    return updated[0]
  })

export const deleteTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: ticketId }) => {
    const admin = await checkAdmin()
    const db = await getDb()

    if (isDemoTesterUser(admin)) {
      const existing = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1)
      if (!existing[0] || existing[0].issuedBy !== admin.id) {
        throw new Error('Forbidden in demo mode')
      }
    }

    await db.delete(tickets).where(eq(tickets.id, ticketId))

    await writeActivityLog({
      actorUserId: admin.id,
      actorRole: admin.role,
      action: 'ticket.delete',
      entityType: 'ticket',
      entityId: ticketId,
    })

    return { success: true }
  })

export const verifyTicketByCodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      code: z.string(),
      markAsUsed: z.boolean().default(true),
    }).parse(data)
  )
  .handler(async ({ data: { code, markAsUsed } }) => {
    const db = await getDb()
    // Try to get adminId if they're logged in
    let adminId: number | null = null
    let adminRole: 'organizer' | 'volunteer' | null = null
    let demoRestricted = false
    try {
      const admin = await checkAdmin()
      adminId = admin.id
      adminRole = admin.role
      demoRestricted = isDemoTesterUser(admin)
    } catch (e) {
      // Not logged in or not admin, that's fine for public verification
    }

    const result = await db.select().from(tickets).where(eq(tickets.ticketCode, code)).limit(1)
    if (result.length === 0) return { success: false, message: 'Ogiltig biljettkod' }
    
    const ticket = result[0]

    if (demoRestricted && adminId && ticket.issuedBy !== adminId) {
      throw new Error('Forbidden in demo mode')
    }

    let checkingIn = false
    
    // If ticket is valid, mark it as used and record scan time ONLY if markAsUsed is true
    if (ticket.status === 'valid' && markAsUsed) {
      checkingIn = true
      const scanDate = new Date()
      await db.update(tickets)
        .set({ 
          status: 'used', 
          scannedAt: scanDate, 
          scannedBy: adminId,
          updatedAt: scanDate 
        })
        .where(eq(tickets.id, ticket.id))

      if (adminId && adminRole) {
        await writeActivityLog({
          actorUserId: adminId,
          actorRole: adminRole,
          action: 'ticket.verify.checkin',
          entityType: 'ticket',
          entityId: ticket.id,
          details: { code },
        })
      }
      
      // Update local object for response
      ticket.status = 'used'
      ticket.scannedAt = scanDate
      ticket.scannedBy = adminId
    }

    // Also get event details from the events table
    const event = await db.select().from(events).where(eq(events.id, ticket.eventId)).limit(1)
    
    return { 
      success: true, 
      ticket, 
      event: event[0] || null,
      checkingIn
    }
  })

export const getEventsForTicketsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await checkAdmin()
    const db = await getDb()
    return await db.select().from(events)
  })
