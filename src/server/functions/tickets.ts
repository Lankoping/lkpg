'use server'
import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/index'
import { tickets, posts, ticketTypes, events, users } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { getCookie } from '@tanstack/react-start/server'
import { nanoid } from 'nanoid'

async function checkAdmin() {
  const userId = getCookie('session')
  if (!userId) throw new Error('Unauthorized')
  return parseInt(userId)
}

export const getEventsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await checkAdmin()
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
    await checkAdmin()
    const result = await db.insert(events).values({
      ...data,
      date: new Date(data.date),
    }).returning()
    return result[0]
  })

export const deleteEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: id }) => {
    await checkAdmin()
    await db.delete(events).where(eq(events.id, id))
    return { success: true }
  })

export const getTicketTypesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    await checkAdmin()
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
    await checkAdmin()
    const result = await db.insert(ticketTypes).values(data).returning()
    return result[0]
  })

export const deleteTicketTypeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: id }) => {
    await checkAdmin()
    await db.delete(ticketTypes).where(eq(ticketTypes.id, id))
    return { success: true }
  })

export const getTicketsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    await checkAdmin()
    return await db.select({
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
  })

export const getTicketFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.string().parse(data))
  .handler(async ({ data: ticketId }) => {
    await checkAdmin()
    const result = await db.select().from(tickets).where(eq(tickets.id, parseInt(ticketId))).limit(1)
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
    const adminId = await checkAdmin()
    
    const ticketCode = `TKT-${nanoid(8).toUpperCase()}`
    
    const newTicket = await db.insert(tickets).values({
      eventId: data.eventId,
      participantName: data.participantName,
      participantEmail: data.participantEmail,
      ticketType: data.ticketType,
      pricePaid: data.pricePaid,
      ticketCode,
      issuedBy: adminId,
    }).returning()

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
    const adminId = await checkAdmin()
    const scanDate = data.status === 'used' ? new Date() : null
    const updated = await db.update(tickets)
      .set({ 
        status: data.status, 
        scannedAt: scanDate,
        scannedBy: data.status === 'used' ? adminId : null,
        updatedAt: new Date() 
      })
      .where(eq(tickets.id, data.ticketId))
      .returning()
    return updated[0]
  })

export const deleteTicketFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.number().parse(data))
  .handler(async ({ data: ticketId }) => {
    await checkAdmin()
    await db.delete(tickets).where(eq(tickets.id, ticketId))
    return { success: true }
  })

export const verifyTicketByCodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.string().parse(data))
  .handler(async ({ data: code }) => {
    // Try to get adminId if they're logged in
    let adminId: number | null = null
    try {
      adminId = await checkAdmin()
    } catch (e) {
      // Not logged in or not admin, that's fine for public verification
    }

    const result = await db.select().from(tickets).where(eq(tickets.ticketCode, code)).limit(1)
    if (result.length === 0) return { success: false, message: 'Ogiltig biljettkod' }
    
    const ticket = result[0]
    
    // If ticket is valid, mark it as used and record scan time
    if (ticket.status === 'valid') {
      const scanDate = new Date()
      await db.update(tickets)
        .set({ 
          status: 'used', 
          scannedAt: scanDate, 
          scannedBy: adminId,
          updatedAt: scanDate 
        })
        .where(eq(tickets.id, ticket.id))
      
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
      event: event[0] || null 
    }
  })

export const getEventsForTicketsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    await checkAdmin()
    return await db.select().from(events)
  })
