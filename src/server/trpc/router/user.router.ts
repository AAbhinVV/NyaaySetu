import { z } from "zod";
import { protectedProcedure, onboardingProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
    /** Get the current user's profile (includes lawyer data if role is LAWYER) */
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
                    role,
                    created_at
                `)
                .eq("id", ctx.userId)
                .single()

            if (error || !user) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User profile not found",
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
                        message: "Failed to fetch lawyer profile",
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
                lawyer: null,
            }
        }),

    /** Update the current user's basic profile fields */
    updateMyProfile: protectedProcedure
        .input(z.object({
            fullName: z.string().min(2).optional(),
            phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
            city: z.string().optional(),
            state: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const updatePayload: Record<string, unknown> = {}

            if (input.fullName !== undefined) updatePayload.full_name = input.fullName
            if (input.phone !== undefined) updatePayload.phone = input.phone
            if (input.city !== undefined) updatePayload.city = input.city
            if (input.state !== undefined) updatePayload.state = input.state

            // Fixed: was `=== null` which is always false for an object literal
            if (Object.keys(updatePayload).length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No fields to update",
                })
            }

            const { error } = await ctx.supabase
                .from("users")
                .update(updatePayload)
                .eq("id", ctx.userId)

            if (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to update user profile",
                })
            }

            return { success: true }
        }),

    /** Onboarding: upsert user profile (works even if webhook hasn't created the row) */
    completeOnboarding: onboardingProcedure
        .input(z.object({
            fullName: z.string().min(2),
            email: z.email(),
            phone: z.string().regex(/^[6-9]\d{9}$/),
            city: z.string().min(1),
            state: z.string().min(1),
            role: z.enum(['CLIENT', 'LAWYER']),
        }))
        .mutation(async ({ ctx, input }) => {
            // Use service role client to bypass RLS (no INSERT policy on users table)
            const { createServiceRoleClient } = await import('@/lib/supabase/server')
            const serviceSupabase = createServiceRoleClient()

            const userData = {
                clerk_user_id: ctx.clerkUserId,
                full_name: input.fullName,
                email: input.email,
                phone: input.phone,
                city: input.city,
                state: input.state,
                role: input.role,
            }

            // Try insert first
            const { error: insertError } = await serviceSupabase
                .from('users')
                .insert(userData)

            if (insertError) {
                // Row already exists (from webhook) — do an explicit update
                if (insertError.code === '23505') {
                    const { error: updateError } = await serviceSupabase
                        .from('users')
                        .update({
                            full_name: input.fullName,
                            email: input.email,
                            phone: input.phone,
                            city: input.city,
                            state: input.state,
                            role: input.role,
                        })
                        .eq('clerk_user_id', ctx.clerkUserId)

                    if (updateError) {
                        throw new TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: `Failed to update profile: ${updateError.message}`,
                        })
                    }
                } else {
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: `Failed to save profile: ${insertError.message}`,
                    })
                }
            }

            // Set role in Clerk publicMetadata (server-side via Backend SDK).
            // This is included in the JWT so the middleware can read it.
            try {
                const { clerkClient } = await import('@clerk/nextjs/server')
                const clerk = await clerkClient()
                await clerk.users.updateUserMetadata(ctx.clerkUserId, {
                    publicMetadata: { role: input.role },
                })
            } catch (clerkErr) {
                console.error('Failed to set Clerk publicMetadata:', clerkErr)
                // Non-fatal — the user row is already created in Supabase
            }

            return { success: true }
        }),

    /** Get dashboard summary for the current user (CLIENT or LAWYER) */
    getDashboardSummary: protectedProcedure
        .query(async ({ ctx }) => {
            const role = ctx.role

            if (role === "CLIENT") {
                // Run all queries in parallel, destructure as an ARRAY
                const [casesResult, notificationsResult] = await Promise.all([
                    ctx.supabase
                        .from("cases")
                        .select("id, status", { count: "exact" })
                        .eq("client_id", ctx.userId),
                    ctx.supabase
                        .from("notifications")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", ctx.userId)
                        .eq("read", false),
                ])

                if (casesResult.error || notificationsResult.error) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to fetch dashboard summary",
                    })
                }

                const totalCases = casesResult.count ?? 0
                // Filter active cases from the data (cases that are not CLOSED)
                const activeCases = casesResult.data?.filter(
                    (c: { status: string }) => c.status !== 'CLOSED'
                ).length ?? 0

                return {
                    totalCases,
                    activeCases,
                    unreadNotifications: notificationsResult.count ?? 0,
                }
            }

            if (role === "LAWYER") {
                const [casesResult, notificationsResult, connectionsResult] = await Promise.all([
                    ctx.supabase
                        .from("cases")
                        .select("id, status", { count: "exact" })
                        .eq("lawyer_id", ctx.userId),
                    ctx.supabase
                        .from("notifications")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", ctx.userId)
                        .eq("read", false),
                    ctx.supabase
                        .from("connections")
                        .select("id, status", { count: "exact" })
                        .eq("lawyer_id", ctx.userId),
                ])

                if (casesResult.error || notificationsResult.error || connectionsResult.error) {
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Failed to fetch dashboard summary",
                    })
                }

                const totalCases = casesResult.count ?? 0
                const activeCases = casesResult.data?.filter(
                    (c: { status: string }) => c.status !== 'CLOSED'
                ).length ?? 0
                const pendingConnections = connectionsResult.data?.filter(
                    (c: { status: string }) => c.status === 'PENDING'
                ).length ?? 0

                return {
                    totalCases,
                    activeCases,
                    unreadNotifications: notificationsResult.count ?? 0,
                    totalConnections: connectionsResult.count ?? 0,
                    pendingConnections,
                }
            }

            // For ADMIN or unknown roles, return a minimal summary
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Dashboard summary not available for this role",
            })
        }),
})