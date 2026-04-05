import { z } from "zod";
import { createTRPCRouter, lawyerProcedure, protectedProcedure, createCallerFactory } from "../init";
import { TRPCError } from "@trpc/server";
import { caseRouter } from "./case.router";


const connectionStatus = z.enum(['PENDING', 'ACTIVE', 'DECLINED'])


export const connectionRouter = createTRPCRouter({

    createConnection: protectedProcedure
        .input(z.object({ clientId: z.uuid(), lawyerId: z.uuid(), razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpayPaymentAmount: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const { clientId, lawyerId, razorpayOrderId, razorpayPaymentId, razorpayPaymentAmount } = input

            const { activeConnection: activeConnectionError } = await ctx.supabase
                .from('connections')
                .select('*', { count: 'exact', head: true })
                .eq('client_id', clientId)
                .eq('lawyer_id', lawyerId)
                .in('status', ['ACTIVE', 'PENDING'])

            if (activeConnectionError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'You already have an active connection with this lawyer',
                })
            }

            const {
                data: connectionsData, error: connectionsError,
                data: paymentsData, error: paymentsError

            } = await Promise.all([
                ctx.supabase
                    .from('connections')
                    .insert({
                        client_id: clientId,
                        lawyer_id: lawyerId,
                        razorpay_order_id: razorpayOrderId,
                        razorpay_payment_id: razorpayPaymentId,
                    })
                    .eq('status', 'PENDING'),

                ctx.supabase
                    .from('payments')
                    .insert({
                        client_id: clientId,
                        lawyer_id: lawyerId,
                        razorpay_order_id: razorpayOrderId,
                        razorpay_payment_id: razorpayPaymentId,
                        razorpay_payment_amount: razorpayPaymentAmount
                    })
                    .eq('status', 'PENDING')
            ])

            if (connectionsError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create connection',
                })
            }

            if (paymentsError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: `Failed to create payment`
                })
            }

            return data
        }),

    acceptConnection: lawyerProcedure
        .input(z.object({ connectionId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {

            // Step 1: Fetch connection and verify lawyer owns it
            const { data: connection, error: fetchError } = await ctx.supabase
                .from('connections')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.connectionId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !connection) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Connection not found or you do not have access',
                })
            }

            // Step 2: Guard — must be PENDING to accept
            if (connection.status !== 'PENDING') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Cannot accept a connection with status ${connection.status}`,
                })
            }

            // Step 3: Update connection to ACTIVE
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

            // Step 4: Create the case via server-side caller
            const createCaller = createCallerFactory(caseRouter)
            const caseCaller = createCaller(ctx)

            const newCase = await caseCaller.create({
                connectionId: connection.id,
                clientId: connection.client_id,
                lawyerId: connection.lawyer_id,
            }).catch(() => {
                // Step 4a: Case creation failed — roll back the connection to PENDING
                // so the lawyer can try again and the client is not left in a broken state
                ctx.supabase
                    .from('connections')
                    .update({ status: 'PENDING', accepted_at: null })
                    .eq('id', input.connectionId)

                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Connection accepted but case creation failed. Please try again.',
                })
            })

            // Step 5: Notify the client
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

    declineConnection: lawyerProcedure
        .input(z.object({ connectionId: z.uuid(), reason: z.string().max(500).optional() }))
        .mutation(async ({ ctx, input }) => {
            const { data: connection, error: fetchError } = await ctx.supabase
                .from('connection')
                .select('id, client_id, lawyer_id, status')
                .eq('id', input.connectionId)
                .eq('lawyer_id', ctx.userId)
                .single()

            if (fetchError || !connection) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You are not authorized to decline this connection',
                })
            }

            if (connection.status !== 'PENDING') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: `Cannot accept a connection with status ${connection.status}`,
                })
            }

            const { data: updatedConnection, error: updateError } = await ctx.supabase
                .from('connections')
                .update({ status: 'DECLINED', declined_at: new Date().toISOString() })
                .eq('id', input.connectionId)
                .select()
                .single()

            if (updateError || !updatedConnection) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to update connection status',
                })
            }

            const { data: notification, error: notificationError } = await ctx.supabase
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

            if (notificationError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to create notification'
                })
            }

            return {
                success: true,
                message: 'Connection declined successfully'
            }
        }),

    getIncomingRequests: lawyerProcedure
        .input(z.object({ status: connectionStatus.optional(), page: z.number().default(1), limit: z.number().default(10) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data: connections, error: connectionsError } = await ctx.supabase
                .from('connections')
                .select(`
                    id,
                    status,
                    created_At,
                    updated_at,
                    users!client_id(
                        id,
                        full_name,
                        email
                    ),
                    payments (
                        id,
                        status,
                        razorpay_payment_amount,
                        razorpay_payment_id
                    )
                    `, { count: 'exact' })
                .eq('lawyer_id', ctx.userId)
                .eq('payment_status', 'CAPTURED')
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (connectionsError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connections'
                })
            }

            const total = connections.length
            const totalPages = Math.ceil(total / input.limit)
            const page = input.page


            return {
                connections,
                total,
                page,
                totalPages
            }
        }),

    getMyConnections: lawyerProcedure
        .input(z.object({ page: z.number().default(1), limit: z.number().default(10) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data: connections, error: connectionsError } = await ctx.supabase
                .from('connections')
                .select(`
                    id,
                    status,
                    created_At,
                    updated_at,
                    users!client_id(
                        id,
                        full_name,
                        email
                    ),
                    `, { count: 'exact' })
                .eq('lawyer_id', ctx.userId)
                .eq('connection_status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (connectionsError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connections'
                })
            }

            const total = connections.length
            const totalPages = Math.ceil(total / input.limit)
            const page = input.page


            return {
                connections,
                total,
                page,
                totalPages
            }
        }),

    isConnected: protectedProcedure
        .input(z.object({ clientId: z.uuid(), lawyerId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { data: conenctionData, error: connectionError } = ctx.supabase
                .from('connections')
                .select(`
                    id,
                    client_id,
                    lawyer_id,
                    status,
                    created_at,
                    updated_at
                    `, { count: 'exact', head: true })
                .eq('client_id', input.clientId)
                .eq('lawyer_id', input.lawyerId)
                .single()

            if (connectionError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch connection'
                })
            }

            if (conenctionData.status !== 'ACTIVE') {
                return {
                    connected: false
                }
            }

            return {
                connected: true
            }
        })

})