import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, lawyerProcedure, clientProcedure } from '../init'
import type { TRPCContext } from '../init'

// ─── Shared Internal Function ─────────────────────────────────────────────────

export async function createCaseInternal(
    ctx: TRPCContext,
    input: {
        connectionId: string
        clientId: string
        lawyerId: string
    }
) {
    // Step 1: Fetch lawyer city for geo-matched jurisdiction
    const { data: lawyer, error: lawyerError } = await ctx.supabase
        .from('lawyers')
        .select('city, state')
        .eq('user_id', input.lawyerId)
        .single()

    if (lawyerError || !lawyer) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not fetch lawyer details for case creation',
        })
    }

    // Step 2: Generate e-token number (simple unique token for MVP)
    const eToken = `NYS-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    // Step 3: Create the case
    const { data: newCase, error: caseError } = await ctx.supabase
        .from('cases')
        .insert({
            connection_id: input.connectionId,
            client_id: input.clientId,
            lawyer_id: input.lawyerId,
            status: 'IN_PROGRESS',
            jurisdiction_city: lawyer.city,
            jurisdiction_state: lawyer.state,
            e_token: eToken,
        })
        .select()
        .single()

    if (caseError || !newCase) {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create case',
        })
    }

    // Step 4: Insert initial timeline event
    await ctx.supabase
        .from('case_timeline')
        .insert({
            case_id: newCase.id,
            event_type: 'CASE_CREATED',
            description: 'Case created after lawyer accepted connection request',
            created_by: input.lawyerId,
        })

    // Step 5: Create e_token record
    await ctx.supabase
        .from('e_tokens')
        .insert({
            case_id: newCase.id,
            token_number: eToken,
            status: 'ACTIVE',
        })

    return newCase
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const caseRouter = createTRPCRouter({

    // ── Internal: create case — called from connection.accept ─────────────────
    createCase: lawyerProcedure
        .input(z.object({
            connectionId: z.string().uuid(),
            clientId: z.string().uuid(),
            lawyerId: z.string().uuid(),
        }))
        .mutation(async ({ ctx, input }) => {
            return createCaseInternal(ctx, input)
        }),

    // ── Shared: get all cases — lawyer sees theirs, client sees theirs ─────────
    getAllCases: protectedProcedure
        .input(z.object({
            status: z.enum(['IN_PROGRESS', 'HEARING_SET', 'VERDICT', 'CLOSED']).optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(20).default(10),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            // Build base query — filter by role
            // If lawyer: show cases where lawyer_id = ctx.userId
            // If client: show cases where client_id = ctx.userId
            const isLawyer = ctx.role === 'LAWYER'

            let dbQuery = ctx.supabase
                .from('cases')
                .select(`
          id,
          title,
          category,
          status,
          e_token,
          jurisdiction_city,
          next_hearing_at,
          created_at,
          lawyers ( id, full_name ),
          users!client_id ( id, full_name )
        `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            dbQuery = isLawyer
                ? dbQuery.eq('lawyer_id', ctx.userId)
                : dbQuery.eq('client_id', ctx.userId)

            if (input.status) {
                dbQuery = dbQuery.eq('status', input.status)
            }

            const { data, count, error } = await dbQuery

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            const total = count ?? 0
            return {
                cases: data ?? [],
                total,
                page: input.page,
                totalPages: Math.ceil(total / input.limit),
            }
        }),

    // ── Shared: get single case by ID ─────────────────────────────────────────
    getCasesById: protectedProcedure
        .input(z.object({ caseId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const isLawyer = ctx.role === 'LAWYER'

            let dbQuery = ctx.supabase
                .from('cases')
                .select(`
          *,
          lawyers ( id, full_name, city, specializations, avg_rating, phone ),
          users!client_id ( id, full_name, email, phone ),
          e_tokens ( token_number, court_name, hearing_date, status )
        `)
                .eq('id', input.caseId)

            // scope to the requesting user based on role
            dbQuery = isLawyer
                ? dbQuery.eq('lawyer_id', ctx.userId)
                : dbQuery.eq('client_id', ctx.userId)

            const { data, error } = await dbQuery.single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            return data
        }),

    // ── Lawyer: update case status ─────────────────────────────────────────────
    updateStatus: lawyerProcedure
        .input(z.object({
            caseId: z.string().uuid(),
            status: z.enum(['IN_PROGRESS', 'HEARING_SET', 'VERDICT', 'CLOSED']),
        }))
        .mutation(async ({ ctx, input }) => {
            // Ownership check
            const { data: existing, error: fetchError } = await ctx.supabase
                .from('cases')
                .select('id, status')
                .eq('id', input.caseId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !existing) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Case not found or you do not have access',
                })
            }

            // Cannot reopen a closed case
            if (existing.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Cannot update status of a closed case',
                })
            }

            const { data, error } = await ctx.supabase
                .from('cases')
                .update({ status: input.status })
                .eq('id', input.caseId)
                .select()
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to update case status',
                })
            }

            // Add timeline event
            await ctx.supabase
                .from('case_timeline')
                .insert({
                    case_id: input.caseId,
                    event_type: 'STATUS_CHANGED',
                    description: `Case status updated to ${input.status}`,
                    created_by: ctx.userId,
                })

            return data
        }),

    // ── Lawyer: add hearing date ───────────────────────────────────────────────
    addHearingDate: lawyerProcedure
        .input(z.object({
            caseId: z.string().uuid(),
            hearingDate: z.string().datetime(),
            courtName: z.string().min(2),
            notes: z.string().max(500).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Ownership check
            const { data: existing, error: fetchError } = await ctx.supabase
                .from('cases')
                .select('id, client_id, status')
                .eq('id', input.caseId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !existing) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Case not found or you do not have access',
                })
            }

            if (existing.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Cannot add hearing date to a closed case',
                })
            }

            // Update next_hearing_at on case
            const { data, error } = await ctx.supabase
                .from('cases')
                .update({
                    next_hearing_at: input.hearingDate,
                    status: 'HEARING_SET',
                })
                .eq('id', input.caseId)
                .select()
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to add hearing date',
                })
            }

            // Add timeline event
            await ctx.supabase
                .from('case_timeline')
                .insert({
                    case_id: input.caseId,
                    event_type: 'HEARING_SCHEDULED',
                    description: `Hearing scheduled at ${input.courtName} on ${input.hearingDate}${input.notes ? `. Notes: ${input.notes}` : ''}`,
                    created_by: ctx.userId,
                })

            // Notify client
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: existing.client_id,
                    type: 'HEARING_SCHEDULED',
                    title: 'Hearing date set',
                    body: `Your hearing has been scheduled at ${input.courtName} on ${new Date(input.hearingDate).toLocaleDateString('en-IN')}`,
                    case_id: input.caseId,
                })

            return data
        }),

    // ── Lawyer: record verdict ─────────────────────────────────────────────────
    recordVerdict: lawyerProcedure
        .input(z.object({
            caseId: z.string().uuid(),
            outcome: z.enum(['WON', 'LOST', 'SETTLED']),
            summary: z.string().max(1000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Ownership check
            const { data: existing, error: fetchError } = await ctx.supabase
                .from('cases')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.caseId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !existing) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Case not found or you do not have access',
                })
            }

            if (existing.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Verdict already recorded for this case',
                })
            }

            // Update case with verdict and close it
            const { data, error } = await ctx.supabase
                .from('cases')
                .update({
                    status: 'CLOSED',
                    verdict_outcome: input.outcome,
                    verdict_summary: input.summary ?? null,
                    closed_at: new Date().toISOString(),
                })
                .eq('id', input.caseId)
                .select()
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to record verdict',
                })
            }

            // Add timeline event
            await ctx.supabase
                .from('case_timeline')
                .insert({
                    case_id: input.caseId,
                    event_type: 'VERDICT_RECORDED',
                    description: `Verdict recorded: ${input.outcome}${input.summary ? `. ${input.summary}` : ''}`,
                    created_by: ctx.userId,
                })

            // Notify client of verdict
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: existing.client_id,
                    type: 'VERDICT',
                    title: 'Your case verdict is in',
                    body: `Your case outcome: ${input.outcome}. You can now leave a review for your lawyer.`,
                    case_id: input.caseId,
                })

            // Recalculate lawyer win rate
            const { createCallerFactory } = await import('../init')
            const { lawyerRouter } = await import('./lawyer.router')
            const createCaller = createCallerFactory(lawyerRouter)
            const serverCaller = createCaller(ctx)
            await serverCaller.updateWinRate({ lawyerId: existing.lawyer_id })

            return data
        }),

    // ── Shared: get case timeline ──────────────────────────────────────────────
    getTimeline: protectedProcedure
        .input(z.object({ caseId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const isLawyer = ctx.role === 'LAWYER'

            // Ownership check scoped to role
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .eq(isLawyer ? 'lawyer_id' : 'client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            const { data, error } = await ctx.supabase
                .from('case_timeline')
                .select('id, event_type, description, created_by, created_at')
                .eq('case_id', input.caseId)
                .order('created_at', { ascending: true })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case timeline',
                })
            }

            return data ?? []
        }),

    // ── Shared: send message — used by both client and lawyer ─────────────────
    sendMessage: protectedProcedure
        .input(z.object({
            caseId: z.string().uuid(),
            body: z.string().min(1).max(2000),
        }))
        .mutation(async ({ ctx, input }) => {
            const isLawyer = ctx.role === 'LAWYER'

            // Ownership check + fetch other party's ID for notification
            const { data: caseData, error: caseError } = await ctx.supabase
                .from('cases')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.caseId)
                .eq(isLawyer ? 'lawyer_id' : 'client_id', ctx.userId)
                .single()

            if (caseError || !caseData) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            if (caseData.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Cannot send messages on a closed case',
                })
            }

            // Strip HTML to prevent XSS
            const sanitizedBody = input.body.replace(/<[^>]*>/g, '')

            const { data: message, error: msgError } = await ctx.supabase
                .from('case_messages')
                .insert({
                    case_id: input.caseId,
                    content: sanitizedBody,
                    sender_id: ctx.userId,
                })
                .select()
                .single()

            if (msgError || !message) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to send message',
                })
            }

            // Notify the other party
            const recipientId = isLawyer ? caseData.client_id : caseData.lawyer_id

            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: recipientId,
                    type: 'NEW_MESSAGE',
                    title: 'New message',
                    body: 'You have a new message on your case',
                    case_id: input.caseId,
                })

            return message
        }),
})