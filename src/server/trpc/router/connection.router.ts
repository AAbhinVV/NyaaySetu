import { z } from "zod";
import { createTRPCRouter, lawyerProcedure, protectedProcedure, clientProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { createCaseInternal } from "./case.router";

const connectionStatus = z.enum(['PENDING', 'ACTIVE', 'DECLINED'])

export const connectionRouter = createTRPCRouter({

    /** Client initiates a connection with a lawyer after payment */
    createConnection: clientProcedure
        .input(z.object({
            lawyerId: z.uuid(),
            stripeSessionId: z.string(),
            stripePaymentIntentId: z.string(),
            amount: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Check for existing active/pending connection
            const { count, error: checkError } = await ctx.supabase
                .from('connections')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', ctx.userId)
                .eq('lawyer_id', input.lawyerId)
                .in('status', ['ACTIVE', 'PENDING'])

            if (checkError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to check existing connections',
                })
            }

            if ((count ?? 0) > 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'You already have an active or pending connection with this lawyer',
                })
            }

            // 2. Create connection
            const { data: connection, error: connectionError } = await ctx.supabase
                .from('connections')
                .insert({
                    client_id: ctx.userId,
                    lawyer_id: input.lawyerId,
                    status: 'PENDING',
                })
                .select()
                .single()

            if (connectionError || !connection) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create connection',
                })
            }

            // 3. Create payment record
            const { error: paymentError } = await ctx.supabase
                .from('payments')
                .insert({
                    connection_id: connection.id,
                    client_id: ctx.userId,
                    stripe_session_id: input.stripeSessionId,
                    stripe_payment_intent_id: input.stripePaymentIntentId,
                    amount: input.amount,
                    status: 'CAPTURED',
                })

            if (paymentError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to record payment',
                })
            }

            // 4. Notify the lawyer
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: input.lawyerId,
                    type: 'CONNECTION_REQUEST',
                    title: 'New connection request',
                    body: 'A client has requested to connect with you.',
                    case_id: null,
                })

            return connection
        }),

    /** Lawyer accepts a pending connection — creates a case */
    acceptConnection: lawyerProcedure
        .input(z.object({ connectionId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch connection and verify lawyer owns it
            const { data: connection, error: fetchError } = await ctx.supabase
                .from('connections')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.connectionId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !connection) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Connection not found',
                })
            }

            // 2. Must be PENDING to accept
            if (connection.status !== 'PENDING') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Cannot accept a connection with status ${connection.status}`,
                })
            }

            // 3. Update connection to ACTIVE
            const { data: updatedConnection, error: updateError } = await ctx.supabase
                .from('connections')
                .update({ status: 'ACTIVE', accepted_at: new Date().toISOString() })
                .eq('id', input.connectionId)
                .select()
                .single()

            if (updateError || !updatedConnection) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to update connection status',
                })
            }

            // 4. Create the case via the shared internal function
            let newCase
            try {
                newCase = await createCaseInternal(ctx, {
                    connectionId: connection.id,
                    clientId: connection.client_id,
                    lawyerId: connection.lawyer_id,
                })
            } catch {
                // Roll back connection to PENDING so the lawyer can retry
                await ctx.supabase
                    .from('connections')
                    .update({ status: 'PENDING', accepted_at: null })
                    .eq('id', input.connectionId)

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Connection accepted but case creation failed. Please try again.',
                })
            }

            // 5. Notify the client
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: connection.client_id,
                    type: 'CONNECTION_ACCEPTED',
                    title: 'Your lawyer has accepted your request',
                    body: 'Your connection has been accepted. Your case has been created and is now active.',
                    case_id: newCase.id,
                })

            return {
                connection: updatedConnection,
                case: newCase,
            }
        }),

    /** Lawyer declines a pending connection */
    declineConnection: lawyerProcedure
        .input(z.object({
            connectionId: z.string().uuid(),
            reason: z.string().max(500).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch connection
            const { data: connection, error: fetchError } = await ctx.supabase
                .from('connections')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.connectionId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !connection) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Connection not found',
                })
            }

            if (connection.status !== 'PENDING') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Cannot decline a connection with status ${connection.status}`,
                })
            }

            // 2. Update to DECLINED
            const { data: updatedConnection, error: updateError } = await ctx.supabase
                .from('connections')
                .update({
                    status: 'DECLINED',
                    decline_reason: input.reason ?? null,
                })
                .eq('id', input.connectionId)
                .select()
                .single()

            if (updateError || !updatedConnection) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to decline connection',
                })
            }

            // 3. Notify the client
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: connection.client_id,
                    type: 'CONNECTION_DECLINED',
                    title: 'Your connection request was declined',
                    body: input.reason
                        ? `Your lawyer declined your request. Reason: ${input.reason}. You can connect with another lawyer.`
                        : 'Your lawyer declined your request. You can connect with another lawyer.',
                    case_id: null,
                })

            return { success: true }
        }),

    /** Lawyer: get incoming connection requests (paid, pending) */
    getIncomingRequests: lawyerProcedure
        .input(z.object({
            status: connectionStatus.optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(10),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            let query = ctx.supabase
                .from('connections')
                .select(`
                    id,
                    status,
                    created_at,
                    updated_at,
                    users!client_id (
                        id,
                        full_name,
                        email
                    ),
                    payments (
                        id,
                        status,
                        amount,
                        stripe_payment_intent_id
                    )
                `, { count: 'exact' })
                .eq('lawyer_id', ctx.userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            // Apply optional status filter
            if (input.status) {
                query = query.eq('status', input.status)
            }

            const { data, count, error } = await query

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch incoming requests',
                })
            }

            const total = count ?? 0
            return {
                connections: data ?? [],
                total,
                page: input.page,
                totalPages: Math.ceil(total / input.limit),
            }
        }),

    /** Lawyer: get active connections */
    getMyConnections: lawyerProcedure
        .input(z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(10),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data, count, error } = await ctx.supabase
                .from('connections')
                .select(`
                    id,
                    status,
                    created_at,
                    updated_at,
                    users!client_id (
                        id,
                        full_name,
                        email
                    )
                `, { count: 'exact' })
                .eq('lawyer_id', ctx.userId)
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connections',
                })
            }

            const total = count ?? 0
            return {
                connections: data ?? [],
                total,
                page: input.page,
                totalPages: Math.ceil(total / input.limit),
            }
        }),

    /** Check if the current user has a connection with a specific partner */
    isConnected: protectedProcedure
        .input(z.object({
            clientId: z.uuid(),
            lawyerId: z.uuid(),
        }))
        .query(async ({ ctx, input }) => {
            // Scope to ctx.userId — check if current user is either the client or lawyer
            const { data, error } = await ctx.supabase
                .from('connections')
                .select('id, status')
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)
                .or(`client_id.eq.${input.clientId},lawyer_id.eq.${input.lawyerId}`)
                .in('status', ['ACTIVE', 'PENDING'])
                .maybeSingle()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to check connection status',
                })
            }

            return {
                connected: data?.status === 'ACTIVE',
                pending: data?.status === 'PENDING',
                status: data?.status ?? null,
            }
        }),
})