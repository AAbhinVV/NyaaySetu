import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";

export const notificationRouter = createTRPCRouter({
    /** Get paginated notifications + unread count */
    getAllNotifications: protectedProcedure
        .input(z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(20),
        }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            // Run both queries in parallel, destructure as ARRAY
            const [notifResult, unreadResult] = await Promise.all([
                ctx.supabase
                    .from('notifications')
                    .select(`
                        id,
                        type,
                        title,
                        body,
                        read,
                        case_id,
                        created_at
                    `, { count: 'exact' })
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
                page: input.page,
                totalPages: Math.ceil(total / input.limit),
                unreadCount: unreadResult.count ?? 0,
            }
        }),

    /** Get unread notification count only */
    getUnreadCount: protectedProcedure
        .query(async ({ ctx }) => {
            // Single select with head: true — returns count only, no rows
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
    markRead: protectedProcedure
        .input(z.object({ notificationId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', input.notificationId)
                .eq('user_id', ctx.userId)
                .select('id')

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to mark notification as read',
                })
            }

            if (!data || data.length === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Notification not found',
                })
            }

            return { success: true }
        }),

    /** Mark all notifications as read */
    markAllRead: protectedProcedure
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
})
