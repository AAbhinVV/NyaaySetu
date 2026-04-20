import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, clientProcedure, createCallerFactory } from '../init'

const CaseStatus = z.enum(['IN_PROGRESS', 'HEARING_SET', 'VERDICT', 'CLOSED'])

export const clientRouter = createTRPCRouter({

    /** Client dashboard — all summary stats in one call */
    getDashboardSummary: clientProcedure
        .query(async ({ ctx }) => {
            const [
                casesResult,
                activeCasesResult,
                unreadResult,
                connectionsResult,
                hearingsResult,
            ] = await Promise.all([
                // total cases ever
                ctx.supabase
                    .from('cases')
                    .select('id', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId),

                // cases currently in progress
                ctx.supabase
                    .from('cases')
                    .select('id', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .in('status', ['IN_PROGRESS', 'HEARING_SET']),

                // unread notifications
                ctx.supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('read', false),

                // active lawyer connections
                ctx.supabase
                    .from('connections')
                    .select('id', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .eq('status', 'ACTIVE'),

                // next 3 upcoming hearings
                ctx.supabase
                    .from('cases')
                    .select('id, title, next_hearing_at, status, lawyers(full_name)')
                    .eq('client_id', ctx.userId)
                    .in('status', ['IN_PROGRESS', 'HEARING_SET'])
                    .not('next_hearing_at', 'is', null)
                    .gt('next_hearing_at', new Date().toISOString())
                    .order('next_hearing_at', { ascending: true })
                    .limit(3),
            ])

            if (casesResult.error || activeCasesResult.error || unreadResult.error ||
                connectionsResult.error || hearingsResult.error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch dashboard summary',
                })
            }

            return {
                totalCases: casesResult.count ?? 0,
                activeCases: activeCasesResult.count ?? 0,
                unreadNotifications: unreadResult.count ?? 0,
                activeConnections: connectionsResult.count ?? 0,
                upcomingHearings: hearingsResult.data ?? [],
            }
        }),

    /** Get saved/bookmarked lawyers */
    getSavedLawyers: clientProcedure
        .query(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('saved_lawyers')
                .select(`
                    id,
                    lawyer_id,
                    saved_at,
                    lawyers (
                        id,
                        full_name,
                        bio,
                        city,
                        state,
                        specializations,
                        court_levels,
                        fee_per_consultation,
                        years_of_experience,
                        win_rate,
                        total_cases,
                        avg_rating,
                        review_count,
                        verified,
                        languages_spoken,
                        created_at,
                        users!inner ( email )
                    )
                `)
                .eq('client_id', ctx.userId)
                .order('saved_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch saved lawyers',
                })
            }

            return data ?? []
        }),

    /** Get client's connections with optional status filter */
    getMyConnections: clientProcedure
        .input(z.object({
            status: z.enum(['PENDING', 'ACTIVE', 'DECLINED']).optional(),
        }))
        .query(async ({ ctx, input }) => {
            // Build query first, THEN await — fixed the missing await + broken .eq() on data
            let query = ctx.supabase
                .from('connections')
                .select(`
                    id,
                    lawyer_id,
                    status,
                    created_at,
                    lawyers (
                        id,
                        full_name,
                        bio,
                        city,
                        state,
                        specializations,
                        court_levels,
                        fee_per_consultation,
                        years_of_experience,
                        win_rate,
                        total_cases,
                        avg_rating,
                        review_count,
                        verified,
                        languages_spoken,
                        created_at,
                        users!inner ( email )
                    )
                `)
                .eq('client_id', ctx.userId)
                .order('created_at', { ascending: false })

            if (input.status) {
                query = query.eq('status', input.status)
            }

            const { data, error } = await query

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connections',
                })
            }

            return data ?? []
        }),

    /** Check connection status with a specific lawyer */
    getConnectionStatus: clientProcedure
        .input(z.object({ lawyerId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('connections')
                .select('status')
                .eq('client_id', ctx.userId)
                .eq('lawyer_id', input.lawyerId)
                .maybeSingle()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connection status',
                })
            }

            return data?.status ?? null
        }),

    /** Get client's cases with optional status filter and pagination */
    getMyCases: clientProcedure
        .input(z.object({
            status: CaseStatus.optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(20).default(10),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            let query = ctx.supabase
                .from('cases')
                .select(`
                    id,
                    title,
                    category,
                    status,
                    next_hearing_at,
                    e_token,
                    created_at,
                    lawyers ( full_name )
                `, { count: 'exact' })
                .eq('client_id', ctx.userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (input.status) {
                query = query.eq('status', input.status)
            }

            const { data, count, error } = await query

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch cases',
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

    /** Get full case details by ID */
    getCaseById: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('cases')
                .select(`
                    *,
                    lawyers (
                        id,
                        full_name,
                        bio,
                        city,
                        state,
                        specializations,
                        court_levels,
                        fee_per_consultation,
                        years_of_experience,
                        win_rate,
                        total_cases,
                        avg_rating,
                        review_count,
                        verified,
                        languages_spoken,
                        created_at,
                        users!inner ( email )
                    ),
                    e_tokens (*)
                `)
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            return data
        }),

    /** Get timeline events for a case */
    getCaseTimeline: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id')
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
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

    /** Get paginated messages for a case */
    getCaseMessages: clientProcedure
        .input(z.object({
            caseId: z.uuid(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(30),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            // Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id')
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            const { data, count, error } = await ctx.supabase
                .from('case_messages')
                .select(`
                    id,
                    content,
                    created_at,
                    sender_id,
                    users ( full_name )
                `, { count: 'exact' })
                .eq('case_id', input.caseId)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case messages',
                })
            }

            const total = count ?? 0
            const totalPages = Math.ceil(total / input.limit)
            return {
                messages: data ?? [],
                total,
                page: input.page,
                totalPages,
                hasMore: input.page < totalPages,
            }
        }),

    /** Send a message on a case */
    sendMessage: clientProcedure
        .input(z.object({
            caseId: z.uuid(),
            body: z.string().min(1).max(2000),
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify ownership and case is open
            const { data: caseData, error: caseError } = await ctx.supabase
                .from('cases')
                .select('id, status, lawyer_id')
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
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

            // Notify the lawyer (fixed: was using 'message' field, DB has 'title'+'body')
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: caseData.lawyer_id,
                    type: 'NEW_MESSAGE',
                    title: 'New message',
                    body: 'You have a new message from your client.',
                    case_id: input.caseId,
                })

            return message
        }),

    /** Get documents for a case (excludes soft-deleted) */
    getCaseDocuments: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id')
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            const { data, error } = await ctx.supabase
                .from('documents')
                .select(`
                    id,
                    file_name,
                    file_url,
                    sha256_hash,
                    chain_tx_id,
                    uploaded_by,
                    created_at
                `)
                .eq('case_id', input.caseId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch documents',
                })
            }

            return data ?? []
        }),

    /** Get access log for a specific document */
    getDocumentAccessLog: clientProcedure
        .input(z.object({ documentId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // Ownership check via document → case → client_id
            const { error: ownershipError } = await ctx.supabase
                .from('documents')
                .select('id, cases!inner( client_id )')
                .eq('id', input.documentId)
                .eq('cases.client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this document',
                })
            }

            const { data, error } = await ctx.supabase
                .from('document_access_log')
                .select('accessed_by, accessed_at, ip_address')
                .eq('document_id', input.documentId)
                .order('accessed_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch document access log',
                })
            }

            return data ?? []
        }),

    /** Get notifications with pagination and unread count */
    getNotifications: clientProcedure
        .input(z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(20),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const [notifResult, unreadResult] = await Promise.all([
                ctx.supabase
                    .from('notifications')
                    .select('id, type, title, body, read, created_at', { count: 'exact' })
                    .eq('user_id', ctx.userId)
                    .order('read', { ascending: true })
                    .order('created_at', { ascending: false })
                    .range(offset, offset + input.limit - 1),

                ctx.supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('read', false),
            ])

            if (notifResult.error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch notifications',
                })
            }

            const total = notifResult.count ?? 0
            return {
                notifications: notifResult.data ?? [],
                total,
                unreadCount: unreadResult.count ?? 0,
            }
        }),

    /** Get unread notification count */
    getUnreadCount: clientProcedure
        .query(async ({ ctx }) => {
            const { count, error } = await ctx.supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', ctx.userId)
                .eq('read', false)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch unread count',
                })
            }

            return { unreadCount: count ?? 0 }
        }),

    /** Mark a single notification as read */
    markNotificationRead: clientProcedure
        .input(z.object({ notificationId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { error } = await ctx.supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', input.notificationId)
                .eq('user_id', ctx.userId)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to mark notification as read',
                })
            }

            return { success: true }
        }),

    /** Mark all notifications as read */
    markAllNotificationsRead: clientProcedure
        .mutation(async ({ ctx }) => {
            const { count, error } = await ctx.supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', ctx.userId)
                .eq('read', false)
                .select('id', { count: 'exact', head: true })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to mark all notifications as read',
                })
            }

            return { updated: count ?? 0 }
        }),

    /** Submit a review for a closed case */
    submitReview: clientProcedure
        .input(z.object({
            caseId: z.uuid(),
            rating: z.number().min(1).max(5).int(),
            outcome: z.enum(['WON', 'LOST', 'SETTLED']),
            body: z.string().min(10).max(1000),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Ownership + fetch case data
            const { data: caseData, error: caseError } = await ctx.supabase
                .from('cases')
                .select('id, status, lawyer_id')
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (caseError || !caseData) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            if (caseData.status !== 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Reviews can only be submitted for closed cases',
                })
            }

            // 2. Duplicate check
            const { data: existingReview } = await ctx.supabase
                .from('reviews')
                .select('id')
                .eq('case_id', input.caseId)
                .eq('reviewer_id', ctx.userId)
                .maybeSingle()

            if (existingReview) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'You have already submitted a review for this case',
                })
            }

            // 3. Insert
            const { data: review, error: reviewError } = await ctx.supabase
                .from('reviews')
                .insert({
                    case_id: input.caseId,
                    lawyer_id: caseData.lawyer_id,
                    reviewer_id: ctx.userId,
                    rating: input.rating,
                    outcome: input.outcome,
                    body: input.body,
                })
                .select()
                .single()

            if (reviewError || !review) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to submit review',
                })
            }

            // 4. Recalculate lawyer rating
            try {
                const { lawyerRouter } = await import('./lawyer.router')
                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                await serverCaller.recalculateRating({ lawyerId: caseData.lawyer_id })
            } catch (err) {
                console.error('Failed to recalculate rating:', err)
            }

            return review
        }),

    /** Get reviews the client has submitted */
    getMyReviews: clientProcedure
        .input(z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(20).default(10),
        }).optional())
        .query(async ({ ctx, input }) => {
            const page = input?.page ?? 1
            const limit = input?.limit ?? 10
            const offset = (page - 1) * limit

            const { data, error } = await ctx.supabase
                .from('reviews')
                .select(`
                    id,
                    rating,
                    outcome,
                    body,
                    created_at,
                    cases (
                        id,
                        title,
                        category,
                        created_at
                    ),
                    lawyers (
                        id,
                        full_name,
                        specializations,
                        court_levels,
                        years_of_experience,
                        avg_rating,
                        review_count
                    )
                `)
                .eq('reviewer_id', ctx.userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch reviews',
                })
            }

            return data ?? []
        }),

    /** Get client's own profile */
    getMyProfile: clientProcedure
        .query(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    city,
                    state,
                    created_at,
                    updated_at
                `)
                .eq('id', ctx.userId)
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Profile not found',
                })
            }

            return data
        }),

    /** Update client's profile */
    updateMyProfile: clientProcedure
        .input(z.object({
            full_name: z.string().min(2).optional(),
            phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
            city: z.string().optional(),
            state: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // Build payload with correct DB column names
            const updatePayload: Record<string, unknown> = {}

            if (input.full_name !== undefined) updatePayload.full_name = input.full_name
            if (input.phone !== undefined) updatePayload.phone = input.phone
            if (input.city !== undefined) updatePayload.city = input.city
            if (input.state !== undefined) updatePayload.state = input.state

            if (Object.keys(updatePayload).length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'No fields to update',
                })
            }

            const { data, error } = await ctx.supabase
                .from('users')
                .update(updatePayload)
                .eq('id', ctx.userId)
                .select()
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to update profile',
                })
            }

            return data
        }),
})
