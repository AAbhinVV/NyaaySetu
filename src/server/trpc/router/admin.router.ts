import { z } from 'zod'
import { adminProcedure, createTRPCRouter } from "../init";
import { TRPCError } from '@trpc/server';
import { clerkClient } from '@clerk/nextjs/server';
import { useDeprecatedAnimatedState } from 'motion/react';



const VerificationStatus = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

type LawyerStatus = {
    verification_status: 'VERIFIED' | 'PENDING' | 'REJECTED'
}

type CaseStatus = {
    status: 'ACTIVE' | 'CLOSED'
}

export const adminRouter = createTRPCRouter({
    getAllLawyers: adminProcedure
        .input(z.object({ verificationStatus: VerificationStatus.optional(), page: z.number().min(1).default(1), limit: z.number().min(1).max(50).default(20) }))
        .query(async ({ ctx, input }) => {
            const { verificationStatus, page, limit } = input
            const offset = (page - 1) * limit

            let dbQuery = ctx.supabase
                .from('lawyers')
                .select(`
                    id,
                    user_id,
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
                    users!user_id ( email, phone_number )
                `, { count: 'exact' })

            if (verificationStatus) {
                dbQuery = dbQuery.eq('verification_status', verificationStatus)
            }

            dbQuery = dbQuery
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            const { data, error, count } = await dbQuery

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return {
                lawyers: data ?? [],
                total: count ?? 0,
                page,
                totalPages: Math.ceil((count ?? 0) / limit),
            }
        }),

    getPlatformStats: adminProcedure
        .query(async ({ ctx }) => {
            const [{ data: userData, count: totalUsers, error: userError },
                { data: lawyerData, count: totalLawyers, error: lawyerError },
                { data: verifiedLawyers, count: verifiedLawyersCount, error: verifiedLawyersError },
                { data: pendingVerification, count: pendingVerificationCount, error: pendingVerificationError },
                { data: caseData, count: totalCases, error: caseError },
                { data: paymentData, count: totalPayments, error: paymentError },
            ] = await Promise.all([
                ctx.supabase.from('users').select('*', { count: 'exact' }),
                ctx.supabase.from('lawyers').select<LawyerStatus>('*', { count: 'exact' }),
                ctx.supabase.from('lawyers').select<LawyerStatus>('*', { count: 'exact' }).eq('verified', true),
                ctx.supabase.from('lawyers').select<LawyerStatus>('*', { count: 'exact' }).eq('verification_status', 'PENDING'),
                ctx.supabase.from('cases').select('*', { count: 'exact' }),
                ctx.supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'CAPTURED'),
                ctx.supabase.from('payments').select('amount').eq('status', 'CAPTURED')
            ])

            if (userError || lawyerError || caseError || paymentError || verifiedLawyersError || pendingVerificationError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch platform stats',
                })
            }

            const totalRevenue = paymentData?.reduce((acc: number, p: { amount: number | null }) => acc + (p.amount ?? 0), 0) ?? 0

            const closedCases = caseData?.filter((c: CaseStatus) => c.status === 'CLOSED')?.length ?? 0
            const activeCases = (totalCases ?? 0) - (closedCases ?? 0)
            // const closedCases = caseData?.filter((case: CaseStatus) => case.status === 'CLOSED')?.length ?? 0


            return {
                totalUsers: totalUsers ?? 0,
                totalLawyers: totalLawyers ?? 0,
                verifiedLawyers: verifiedLawyers ?? 0,
                pendingVerification: pendingVerification ?? 0,
                totalCases: totalCases ?? 0,
                activeCases: activeCases,
                closedCases: closedCases ?? 0,
                totalPayments: totalPayments ?? 0,
                totalRevenue: totalRevenue,
            }
        }),

    verifyLawyer: adminProcedure
        .input(z.object({ lawyerId: z.uuid(), status: VerificationStatus, rejectionReason: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const { lawyerId, status, rejectionReason } = input

            try {
                const { createCallerFactory } = await import('../init')
                const { lawyerRouter } = await import('./lawyer.router')

                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                const updateVerificationStatus = await serverCaller.updateVerificationStatus({ lawyerId, status, rejectionReason })

            } catch (error) {
                console.error('Error verifying lawyer:', error)
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to verify lawyer',
                })
            }
        }), // can also just remove from admin router and simply call lawyer.updateverificationstatus on admin frontend

    suspendUser: adminProcedure
        .input(z.object({ userId: z.uuid(), reason: z.string().min(5).max(500) }))
        .mutation(async ({ ctx, input }) => {
            const { userId, reason } = input

            const { data: userData, error: userError } = ctx.supabase
                .from("users")
                .select("id, clerk_user_id, full_name, role, suspended")
                .eq("id", userId)
                .single()

            if (userError || !userData) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Failed to fetch user"
                })
            }

            if (userData.suspended) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "User is already suspended"
                })
            }

            if (userData.role === "ADMIN") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot suspend an admin"
                })
            }

            const { data: updatedUser, error: updateError } = await ctx.supabase
                .from("users")
                .update({ suspended: true, suspension_reason: reason, suspended_at: new Date().toISOString() })
                .eq("id", userId)
                .select()
                .single()

            if (updateError) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to suspend user"
                })
            }

            if (userData.role === "LAWYER") {
                await ctx.supabase
                    .from('lawyers')
                    .update({
                        verified: false,
                        verification_status: 'REJECTED',
                        rejection_reason: `Account suspended: ${reason}`,
                    })
                    .eq('user_id', input.userId)
                    .select()
                    .single()
            }

            try {
                const clerk = await clerkClient()
                await clerk.users.updateUser(userData.clerk_user_id, {
                    publicMetadata: { suspended: true, suspensionReason: reason }
                })
            } catch (error) {
                console.error(
                    `CRITICAL: Supabase suspended but Clerk update failed for user ${userData.clerk_user_id}`,
                    error
                )
            }

            return {
                success: true
            }


        }),

    removeReview: adminProcedure
        .input(z.object({ reviewId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { data: review, error: reviewError } = await ctx.supabase
                .from('reviews')
                .select('id, lawyer_id, rating, flagged')
                .eq('id', input.reviewId)
                .single()

            if (reviewError || !review) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Review not found',
                })
            }

            // Hard delete — reviews leave no trace once removed
            const { error: deleteError } = await ctx.supabase
                .from('reviews')
                .delete()
                .eq('id', input.reviewId)

            if (deleteError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to remove review',
                })
            }

            // Recalculate lawyer rating immediately
            // The cached avg_rating is now wrong — fix it before returning
            try {
                const { createCallerFactory } = await import('../init')
                const { lawyerRouter } = await import('./lawyer.router')
                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                await serverCaller.recalculateRating({ lawyerId: review.lawyer_id })
            } catch (err) {
                // Log but don't fail — review is already deleted
                // Rating will self-correct on next review submission
                console.error('Failed to recalculate rating after review removal:', err)
            }

            // Notify the lawyer
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: review.lawyer_id,
                    type: 'REVIEW_REMOVED',
                    title: 'A review on your profile was removed',
                    body: 'A review on your profile has been removed by our moderation team for violating community guidelines.',
                    case_id: null,
                })

            return { success: true }
        })
})