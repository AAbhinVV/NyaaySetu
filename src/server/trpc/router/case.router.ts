import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, lawyerProcedure } from '../init'
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

    // Step 2: Generate e-token number using crypto-safe random
    const eToken = `NYS-${crypto.randomUUID().slice(0, 8).toUpperCase()}-${Date.now()}`

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

    // Step 4: Insert initial timeline event (check for errors)
    const { error: timelineError } = await ctx.supabase
        .from('case_timeline')
        .insert({
            case_id: newCase.id,
            event_type: 'CASE_CREATED',
            description: 'Case created after lawyer accepted connection request',
            created_by: input.lawyerId,
        })

    if (timelineError) {
        console.error('Failed to insert case timeline entry:', timelineError)
    }

    // Step 5: Create e_token record (check for errors)
    const { error: tokenError } = await ctx.supabase
        .from('e_tokens')
        .insert({
            case_id: newCase.id,
            token_number: eToken,
            status: 'ACTIVE',
        })

    if (tokenError) {
        console.error('Failed to insert e_token record:', tokenError)
    }

    return newCase
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const caseRouter = createTRPCRouter({

    /** Internal: create case — called from connection.accept */
    createCase: lawyerProcedure
        .input(z.object({
            connectionId: z.string().uuid(),
            clientId: z.string().uuid(),
            lawyerId: z.string().uuid(),
        }))
        .mutation(async ({ ctx, input }) => {
            return createCaseInternal(ctx, input)
        }),

    /** Shared: get all cases — lawyer sees theirs, client sees theirs */
    getAllCases: protectedProcedure
        .input(z.object({
            status: z.enum(['IN_PROGRESS', 'HEARING_SET', 'VERDICT', 'CLOSED']).optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(20).default(10),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit
            const isLawyer = ctx.role === 'LAWYER'

            let query = ctx.supabase
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
                .eq(isLawyer ? 'lawyer_id' : 'client_id', ctx.userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (input.status) {
                query = query.eq('status', input.status)
            }

            const { data, count, error } = await query

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

    /** Shared: get single case by ID */
    getCaseById: protectedProcedure
        .input(z.object({ caseId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const isLawyer = ctx.role === 'LAWYER'

            const { data, error } = await ctx.supabase
                .from('cases')
                .select(`
                    *,
                    lawyers ( id, full_name, city, specializations, avg_rating, phone ),
                    users!client_id ( id, full_name, email, phone ),
                    e_tokens ( token_number, court_name, hearing_date, status )
                `)
                .eq('id', input.caseId)
                .eq(isLawyer ? 'lawyer_id' : 'client_id', ctx.userId)
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            return data
        }),

    /** Lawyer: update case status */
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

            // Add timeline event (with error check)
            const { error: timelineError } = await ctx.supabase
                .from('case_timeline')
                .insert({
                    case_id: input.caseId,
                    event_type: 'STATUS_CHANGED',
                    description: `Case status updated to ${input.status}`,
                    created_by: ctx.userId,
                })

            if (timelineError) {
                console.error('Failed to insert timeline event:', timelineError)
            }

            return data
        }),

    /** Lawyer: add hearing date */
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

            // Update case
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

            // Timeline + notification in parallel
            await Promise.all([
                ctx.supabase
                    .from('case_timeline')
                    .insert({
                        case_id: input.caseId,
                        event_type: 'HEARING_SCHEDULED',
                        description: `Hearing scheduled at ${input.courtName} on ${input.hearingDate}${input.notes ? `. Notes: ${input.notes}` : ''}`,
                        created_by: ctx.userId,
                    }),

                ctx.supabase
                    .from('notifications')
                    .insert({
                        user_id: existing.client_id,
                        type: 'HEARING_SCHEDULED',
                        title: 'Hearing date set',
                        body: `Your hearing has been scheduled at ${input.courtName} on ${new Date(input.hearingDate).toLocaleDateString('en-IN')}`,
                        case_id: input.caseId,
                    }),
            ])

            return data
        }),

    /** Lawyer: record verdict and close case */
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

            // Timeline + notification in parallel
            await Promise.all([
                ctx.supabase
                    .from('case_timeline')
                    .insert({
                        case_id: input.caseId,
                        event_type: 'VERDICT_RECORDED',
                        description: `Verdict recorded: ${input.outcome}${input.summary ? `. ${input.summary}` : ''}`,
                        created_by: ctx.userId,
                    }),

                ctx.supabase
                    .from('notifications')
                    .insert({
                        user_id: existing.client_id,
                        type: 'VERDICT',
                        title: 'Your case verdict is in',
                        body: `Your case outcome: ${input.outcome}. You can now leave a review for your lawyer.`,
                        case_id: input.caseId,
                    }),
            ])

            // Recalculate lawyer win rate
            try {
                const { createCallerFactory } = await import('../init')
                const { lawyerRouter } = await import('./lawyer.router')
                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                await serverCaller.updateWinRate({ lawyerId: existing.lawyer_id })
            } catch (err) {
                console.error('Failed to update win rate after verdict:', err)
            }

            return data
        }),

    /** Shared: get case timeline */
    getTimeline: protectedProcedure
        .input(z.object({ caseId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const isLawyer = ctx.role === 'LAWYER'

            // Ownership check scoped to role
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id')
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

    /** Shared: send message — used by both client and lawyer */
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
                    body: 'You have a new message on your case.',
                    case_id: input.caseId,
                })

            return message
        }),
})