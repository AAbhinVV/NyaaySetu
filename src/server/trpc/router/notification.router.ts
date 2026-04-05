import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";

export const notificationRouter = createTRPCRouter({
    getAllNotifications: protectedProcedure
        .input(z.object({ page: z.number().min(1).default(1), limit: z.number().min(1).max(50).default(20) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data, error } = await Promise.all([
                ctx.supabase
                    .from('notifications')
                    .select(`
                    id,
                    type,
                    title,
                    message,
                    read,
                    created_at,
                    updated_at,
                `)
                    .eq('user_id', ctx.userId)
                    .order('is_read', { ascending: true })
                    .order('created_at', { ascending: false })
                    .range(offset, offset + input.limit - 1)
                    .select('*', { count: 'exact' }),

                ctx.supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('is_read', false)

            ])

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch notifications',
                })
            }

            const total = data?.[0]?.length
            const totalPages = Math.ceil(total / input.limit)
            const page = input.page

            return {
                notifications: data?.[0],
                total,
                page,
                totalPages,
                unreadCount: data?.[1]?.count,
            }
        }),

    getUnreadCount: protectedProcedure
        .query(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('notifications')
                .select(`
                    id,
                    type,
                    title,
                    message,
                    read,
                    created_at,
                    updated_at,
                `)
                .eq('user_id', ctx.userId)
                .eq('is_read', false)
                .select('*', { count: 'exact', head: true })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch unread count',
                })
            }

            return {
                unreadCount: data?.length,
            }
        }),

    markRead: protectedProcedure
        .input(z.object({ notificationId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', input.notificationId)
                .eq('user_id', ctx.userId)
                .select()

            if (!data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Notification not found'
                })
            }

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to mark notification as read',
                })
            }


            return {
                success: true
            }
        }),

    markAllRead: protectedProcedure
        .mutation(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', ctx.userId)
                .eq('is_read', false)
                .select()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to mark all notifications as read',
                })
            }

            return {
                updated: data?.length
            }
        })
})
