import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, lawyerProcedure } from '../init'
import { updateLawyerWinRate } from './lawyer.router'

// ─── Shared Internal Function ─────────────────────────────────────────────────

// ─── Router ───────────────────────────────────────────────────────────────────

export const caseRouter = createTRPCRouter({

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
                    lawyers!cases_lawyer_profile_fkey ( id, full_name ),
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
                    lawyers!cases_lawyer_profile_fkey ( id, full_name, city, specializations, avg_rating, phone ),
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
            status: z.enum(['IN_PROGRESS', 'HEARING_SET']),
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

            if (existing.status === 'VERDICT' || existing.status === input.status) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Cannot change status from ${existing.status} to ${input.status}`,
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
                await ctx.supabase
                    .from('cases')
                    .update({ status: existing.status })
                    .eq('id', input.caseId)
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'The status change could not be recorded. Please retry.',
                })
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
            const { data, error } = await ctx.supabase.rpc('schedule_case_hearing', {
                p_case_id: input.caseId,
                p_lawyer_id: ctx.userId,
                p_hearing_date: input.hearingDate,
                p_court_name: input.courtName.trim(),
                p_notes: input.notes?.trim() || null,
            })

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to add hearing date',
                })
            }

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
            const { data, error } = await ctx.supabase.rpc('close_case_with_verdict', {
                p_case_id: input.caseId,
                p_lawyer_id: ctx.userId,
                p_outcome: input.outcome,
                p_summary: input.summary?.trim() || null,
            })

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to record verdict',
                })
            }

            // Recalculate lawyer win rate
            try {
                await updateLawyerWinRate(ctx, ctx.userId)
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

            if (!sanitizedBody.trim()) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Message cannot be empty.',
                })
            }

            const { data: message, error: msgError } = await ctx.supabase
                .from('case_messages')
                .insert({
                    case_id: input.caseId,
                    content: sanitizedBody.trim(),
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
