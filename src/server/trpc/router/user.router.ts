import { z } from "zod";
import { protectedProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";

const userRouter = createTRPCRouter({
    getMyProfile: protectedProcedure
        .query(async ({ ctx }) => {
            const { data: user, error } = await ctx.supabase
                .from("users")
                .select(`
                        id,
                        full_name,
                        email,
                        phone,
                        city,
                        state,
                        created_at
                    `)
                .eq("id", ctx.userId)
                .single()

            if (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch user profile"
                })
            }

            if (ctx.role === "LAWYER") {
                const { data: lawyer, error: lawyerError } = await ctx.supabase
                    .from("lawyers")
                    .select(`
                        id,
                        bar_council_id,
                        verified,
                        verification_status,
                        specializations,
                        court_levels,
                        fee_per_consultation,
                        years_of_experience,
                        win_rate,
                        total_cases,
                        avg_rating,
                        review_count,
                        languages_spoken,
                        bio
                    `)
                    .eq("user_id", ctx.userId)
                    .single()

                if (lawyerError) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to fetch lawyer profile"
                    })
                }

                return {
                    ...user,
                    role: ctx.role,
                    lawyer,
                }
            }

            return {
                ...user,
                role: ctx.role,
                lawyer: null
            }
        }),

    updateMyProfile: protectedProcedure
        .input(z.object({ fullName: z.string().min(2).optional(), phone: z.string().regex(/^[6-9]\d{9}$/).optional(), city: z.string().optional(), state: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const updatePayload: Record<string, unknown> = {}

            if (input.fullName !== undefined) updatePayload.full_name = input.fullName
            if (input.phone !== undefined) updatePayload.phone = input.phone
            if (input.city !== undefined) updatePayload.city = input.city
            if (input.state !== undefined) updatePayload.state = input.state

            if (updatePayload === null) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No fields to update"
                })
            }

            const { error } = await ctx.supabase
                .from("users")
                .update(updatePayload)
                .eq("id", ctx.userId)

            if (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to update user profile"
                })
            }

            return {
                message: "Profile updated successfully"
            }
        }),

    getDashboardSummary: protectedProcedure
        .query(async ({ ctx }) => {
            const role = ctx.role;

            if (role === "CLIENT") {
                const {
                    data: caseData,
                    count: caseCount,
                    error: caseError,
                    data: notificationData,
                    count: notificationCount,
                    error: notificationError

                } = await Promise.all([
                    ctx.supabase
                        .from("cases")
                        .select("id, status, created_at", { count: "exact" })
                        .eq("client_id", ctx.userId),
                    ctx.supabase
                        .from("notifications")
                        .select("id, message, created_at", { count: "exact" })
                        .eq("user_id", ctx.userId)
                ])

                if (caseError || notificationError) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to fetch dashboard summary"
                    })
                }

                const totalCases = caseCount ?? 0;
                const totalNotifications = notificationCount ?? 0;

                const activeCases = caseData?.filter(c => c.status === "ACTIVE").length ?? 0;
                const unreadNotifications = notificationData?.filter(n => n.status === "UNREAD").length ?? 0;

                return {
                    totalCases: totalCases,
                    activeCases: activeCases,
                    totalNotifications: totalNotifications,
                    unreadNotifications: unreadNotifications,
                }
            }

            if (role === "LAWYER") {
                const {
                    data: caseData,
                    count: caseCount,
                    error: caseError,
                    data: notificationData,
                    count: notificationCount,
                    error: notificationError,
                    data: connectionData,
                    count: connectionCount,
                    error: connectionError
                } = await Promise.all([
                    ctx.supabase
                        .from("cases")
                        .select("id, status, created_at", { count: "exact" })
                        .eq("lawyer_id", ctx.userId),
                    ctx.supabase
                        .from("notifications")
                        .select("id, message, created_at", { count: "exact" })
                        .eq("user_id", ctx.userId),
                    ctx.supabase
                        .from("connections")
                        .select("id, status, created_at", { count: "exact" })
                        .eq("lawyer_id", ctx.userId)
                ])

                if (caseError || notificationError || connectionError) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to fetch dashboard summary"
                    })
                }

                const totalCases = caseCount ?? 0;
                const totalNotifications = notificationCount ?? 0;
                const totalConnections = connectionCount ?? 0;

                const activeCases = caseData?.filter(c => c.status === "ACTIVE").length ?? 0;
                const unreadNotifications = notificationData?.filter(n => n.status === "UNREAD").length ?? 0;
                const pendingConnectionRequests = connectionData?.filter(c => c.status === "PENDING").length ?? 0;

                return {
                    totalCases: totalCases,
                    activeCases: activeCases,
                    totalNotifications: totalNotifications,
                    unreadNotifications: unreadNotifications,
                    totalConnections: totalConnections,
                    pendingConnections: pendingConnectionRequests,
                }
            }
        })
})