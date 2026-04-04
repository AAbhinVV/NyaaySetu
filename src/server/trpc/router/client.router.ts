import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, clientProcedure, protectedProcedure, baseProcedure, adminProcedure } from '../init'



const CaseStatus = z.enum(['ACTIVE', 'IN_PROGRESS', 'HEARING_SET', 'COMPLETED', 'CANCELLED'])




export const clientRouter = createTRPCRouter({

    getDashboardSummary: clientProcedure
        .query(async ({ ctx }) => {
            const [
                { count: totalCases, error: e1 },
                { count: activeCases, error: e2 },
                { count: unreadNotifications, error: e3 },
                { count: activeConnections, error: e4 },
                { data: upcomingHearings, error: e5 },
            ] = await Promise.all([

                // total cases ever
                ctx.supabase
                    .from('cases')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId),

                // cases currently in progress
                ctx.supabase
                    .from('cases')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .in('status', ['IN_PROGRESS', 'HEARING_SET']),

                // unread notifications
                ctx.supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('read', false),

                // active lawyer connections
                ctx.supabase
                    .from('connections')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .eq('status', 'ACTIVE'),

                // next 3 upcoming hearings with minimal fields
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

            if (e1 || e2 || e3 || e4 || e5) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch dashboard summary',
                })
            }

            return {
                totalCases: totalCases ?? 0,
                activeCases: activeCases ?? 0,
                unreadNotifications: unreadNotifications ?? 0,
                activeConnections: activeConnections ?? 0,
                upcomingHearings: upcomingHearings ?? [],
            }
        }),


    getSavedLawyers: clientProcedure
        .query(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('saved_lawyers')
                .select(`
                        id,
                        lawyer_id,
                        saved_at,
                        lawyers(
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

    getMyConnections: clientProcedure
        .input(z.object({ status: z.enum(['PENDING', 'ACTIVE', 'DECLINED']).optional() }))
        .query(async ({ ctx, input }) => {
            let dbQuery = ctx.supabase
                .from('connections')
                .select(`
                        id,
                        lawyer_id,
                        status,
                        connected_at,
                        lawyers(
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
                .order('connected_at', { ascending: false })

            if (input.status) {
                dbQuery = dbQuery.eq('status', input.status)
            }

            const { data, error } = await dbQuery

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connections',
                })
            }

            return data ?? []
        }),

    getConnectionStatus: clientProcedure
        .input(z.object({ lawyerId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('connections')
                .select('status')
                .eq('client_id', ctx.userId)
                .eq('lawyer_id', input.lawyerId)
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connection status',
                })
            }

            return data?.status ?? null
        }),

    // initiatePayment: clientProcedure
    //     .input(z.object({ lawyerId: z.uuid() }))
    //     .query(async ({ ctx, input }) => {
    //         const { data, error } = await ctx.supabase
    //             .from('payments')
    //             .insert({
    //                 client_id: ctx.userId,
    //                 lawyer_id: input.lawyerId,
    //                 amount: 100,
    //                 status: 'PENDING',
    //             })
    //             .select()
    //             .single()

    //         if (error) {
    //             throw new TRPCError({
    //                 code: 'INTERNAL_SERVER_ERROR',
    //                 message: 'Failed to initiate payment',
    //             })
    //         }

    //         return data
    //     }),                                      need to configure still

    getMyCases: clientProcedure
        .input(z.object({ status: CaseStatus.optional(), page: z.number().default(1), limit: z.number().default(10) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit
            let dbQuery = ctx.supabase
                .from('cases')
                .select(`
                        id,
                        title,
                        category,
                        status,
                        next_hearing_at,
                        e_token,
                        created_at,
                        lawyers( full_name )
                    `, { count: 'exact' })
                .eq('client_id', ctx.userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (input.status) {
                dbQuery = dbQuery.eq('status', input.status)
            }

            const { data, count, error } = await dbQuery

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

    getCaseById: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('cases')
                .select(`
                    *,
                    lawyers(
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
                    e_tokens(*)
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

    getCaseTimeline: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // 1. Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            // 2. Fetch timeline events
            const { data, error } = await ctx.supabase
                .from('case_timeline')
                .select(`
                    id,
                    event_type,
                    description,
                    created_by,
                    created_at
                `)
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

    getCaseMessages: clientProcedure
        .input(z.object({ caseId: z.uuid(), page: z.number().default(1), limit: z.number().default(30) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            // 1. Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            // 2. Fetch messages with sender name, ordered DESC (newest first for pagination)
            const { data, count, error } = await ctx.supabase
                .from('case_messages')
                .select(`
                    id,
                    content,
                    created_at,
                    sender_id,
                    users( full_name )
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

    sendMessage: clientProcedure
        .input(z.object({ caseId: z.uuid(), body: z.string().min(1).max(2000) }))
        .mutation(async ({ ctx, input }) => {
            // 1. Verify ownership and case is not CLOSED
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

            // 2. Sanitize body — strip HTML tags to prevent XSS
            const sanitizedBody = input.body.replace(/<[^>]*>/g, '')

            // 3. Insert message
            const { data: message, error: msgError } = await ctx.supabase
                .from('messages')
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

            // 4. Create notification for the lawyer
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: caseData.lawyer_id,
                    type: 'NEW_MESSAGE',
                    message: 'You have a new message from your client',
                    case_id: input.caseId,
                })

            return message
        }),


    getCaseDocuments: clientProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // 1. Ownership check
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('id', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .eq('client_id', ctx.userId)
                .single()

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this case',
                })
            }

            // 2. Fetch documents (exclude soft-deleted)
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

    getDocumentAccessLog: clientProcedure
        .input(z.object({ documentId: z.uuid() }))
        .query(async ({ ctx, input }) => {

            // STEP 1: Ownership check via join
            // ---------------------------------
            // documents doesn't have client_id — ownership lives on the cases table.
            // Chain: documents.case_id → cases.id → cases.client_id
            // We use cases!inner() so the query returns NOTHING if the case
            // doesn't belong to this client (INNER JOIN = must match).
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

            // STEP 2: Fetch the access log
            // ---------------------------------
            // Now that we've confirmed ownership, query the access log.
            // Join to users via accessed_by FK to get the person's name.
            const { data, error } = await ctx.supabase
                .from('document_access_log')
                .select(`
                    accessed_by_name,
                    accessed_at,
                    ip_address
                `)
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

    getNotifications: clientProcedure
        .input(z.object({ page: z.number().default(1), limit: z.number().default(20) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            // Fetch notifications (paginated) + unread count in parallel
            const [notifResult, unreadResult] = await Promise.all([
                ctx.supabase
                    .from('notifications')
                    .select(`
                        id,
                        type,
                        message,
                        created_at,
                        is_read
                    `, { count: 'exact' })
                    .eq('user_id', ctx.userId)
                    .order('is_read', { ascending: true })
                    .order('created_at', { ascending: false })
                    .range(offset, offset + input.limit - 1),

                ctx.supabase
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('is_read', false),
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

    getUnreadCount: clientProcedure
        .query(async ({ ctx }) => {
            // head: true = don't return rows, just count them
            const { count, error } = await ctx.supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', ctx.userId)
                .eq('is_read', false)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch unread count',
                })
            }

            return { unreadCount: count ?? 0 }
        }),

    markNotificationRead: clientProcedure
        .input(z.object({ notificationId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { error: updateError } = await ctx.supabase
                .from('notifications')
                .select(`id, user_id`)
                .eq('id', input.notificationId)
                .eq('user_id', ctx.userId)
                .single()
        })
})
