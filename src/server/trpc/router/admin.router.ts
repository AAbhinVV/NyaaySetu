import { z } from 'zod'
import { adminProcedure, createTRPCRouter, createCallerFactory } from "../init";
import { TRPCError } from '@trpc/server';
import { clerkClient } from '@clerk/nextjs/server';
import { recalculateLawyerRating } from './lawyer.router'
import { refundStripePayment } from '@/lib/stripe'
const VerificationStatus = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

export const adminRouter = createTRPCRouter({
    /** List all lawyers with optional verification status filter */
    getAllLawyers: adminProcedure
        .input(z.object({
            verificationStatus: VerificationStatus.optional(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(50).default(20),
        }))
        .query(async ({ ctx, input }) => {
            const { verificationStatus, page, limit } = input
            const offset = (page - 1) * limit

            let dbQuery = ctx.supabase
                .from('lawyers')
                .select(`
                    id,
                    user_id,
                    bar_council_id,
                    state_bar_council,
                    enrollment_year,
                    verification_document_url,
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
                    verification_status,
                    languages_spoken,
                    created_at,
                    users!user_id ( email, phone )
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

    /** Get platform-wide statistics */
    getPlatformStats: adminProcedure
        .query(async ({ ctx }) => {
            const [
                usersResult,
                lawyersResult,
                verifiedResult,
                pendingResult,
                casesResult,
                paymentsCountResult,
                paymentsAmountResult,
            ] = await Promise.all([
                ctx.supabase.from('users').select('id', { count: 'exact', head: true }),
                ctx.supabase.from('lawyers').select('id', { count: 'exact', head: true }),
                ctx.supabase.from('lawyers').select('id', { count: 'exact', head: true }).eq('verified', true),
                ctx.supabase.from('lawyers').select('id', { count: 'exact', head: true }).eq('verification_status', 'PENDING'),
                ctx.supabase.from('cases').select('id, status', { count: 'exact' }),
                ctx.supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'CAPTURED'),
                ctx.supabase.from('payments').select('amount').eq('status', 'CAPTURED'),
            ])

            if (usersResult.error || lawyersResult.error || casesResult.error ||
                paymentsCountResult.error || verifiedResult.error || pendingResult.error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch platform stats',
                })
            }

            const totalRevenue = paymentsAmountResult.data?.reduce(
                (acc: number, p: { amount: number | null }) => acc + (p.amount ?? 0), 0
            ) ?? 0

            const closedCases = casesResult.data?.filter(
                (c: { status: string }) => c.status === 'CLOSED'
            ).length ?? 0

            const totalCases = casesResult.count ?? 0

            return {
                totalUsers: usersResult.count ?? 0,
                totalLawyers: lawyersResult.count ?? 0,
                verifiedLawyers: verifiedResult.count ?? 0,
                pendingVerification: pendingResult.count ?? 0,
                totalCases,
                activeCases: totalCases - closedCases,
                closedCases,
                totalPayments: paymentsCountResult.count ?? 0,
                totalRevenue,
            }
        }),

    /** Verify or reject a lawyer's profile */
    verifyLawyer: adminProcedure
        .input(z.object({
            lawyerId: z.uuid(),
            status: VerificationStatus,
            rejectionReason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { lawyerId, status, rejectionReason } = input

            const { lawyerRouter } = await import('./lawyer.router')
            const createCaller = createCallerFactory(lawyerRouter)
            const serverCaller = createCaller(ctx)
            const result = await serverCaller.updateVerificationStatus({
                lawyerId,
                status,
                rejectionReason,
            })

            return result
        }),

    /** Suspend a user account (cannot suspend admins) */
    suspendUser: adminProcedure
        .input(z.object({
            userId: z.string().uuid(),
            reason: z.string().min(5).max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const { userId, reason } = input


            const { data: userData, error: userError } = await ctx.supabase
                .from("users")
                .select("id, clerk_user_id, full_name, role, suspended")
                .eq("id", userId)
                .single()

            if (userError || !userData) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found",
                })
            }

            if (userData.suspended) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "User is already suspended",
                })
            }

            if (userData.role === "ADMIN") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Cannot suspend an admin user",
                })
            }

            // Suspend in Supabase
            const { error: updateError } = await ctx.supabase
                .from("users")
                .update({
                    suspended: true,
                    suspension_reason: reason,
                    suspended_at: new Date().toISOString(),
                })
                .eq("id", userId)

            if (updateError) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to suspend user",
                })
            }

            // If lawyer, also revoke verification
            if (userData.role === "LAWYER") {
                const { error: lawyerUpdateError } = await ctx.supabase
                    .from('lawyers')
                    .update({
                        verified: false,
                        verification_status: 'REJECTED',
                        rejection_reason: `Account suspended: ${reason}`,
                    })
                    .eq('user_id', userId)

                if (lawyerUpdateError) {
                    console.error('Failed to revoke lawyer verification during suspension:', lawyerUpdateError)
                }
            }

            // Sync suspension to Clerk
            try {
                const clerk = await clerkClient()
                const clerkUser = await clerk.users.getUser(userData.clerk_user_id)
                await clerk.users.updateUserMetadata(userData.clerk_user_id, {
                    publicMetadata: {
                        ...clerkUser.publicMetadata,
                        suspended: true,
                        suspensionReason: reason,
                    },
                })
            } catch (err) {
                console.error(
                    `CRITICAL: Supabase suspended but Clerk update failed for user ${userData.clerk_user_id}`,
                    err
                )
            }

            return { success: true }
        }),

    /** Refund a captured Stripe connection payment. */
    refundPayment: adminProcedure
        .input(z.object({
            paymentId: z.uuid(),
            reason: z.string().trim().min(5).max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            const { data: payment, error: paymentError } = await ctx.supabase
                .from('payments')
                .select('id, status, stripe_payment_intent_id, connection_id, client_id')
                .eq('id', input.paymentId)
                .single()

            if (paymentError || !payment) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' })
            }
            if (payment.status === 'REFUNDED') return { success: true, alreadyRefunded: true }
            if (payment.status !== 'CAPTURED' || !payment.stripe_payment_intent_id) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Only captured Stripe payments can be refunded.',
                })
            }

            await refundStripePayment(payment.stripe_payment_intent_id)

            const { error: updateError } = await ctx.supabase
                .from('payments')
                .update({ status: 'REFUNDED' })
                .eq('id', payment.id)
                .eq('status', 'CAPTURED')

            if (updateError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Stripe refunded the payment, but local reconciliation is pending.',
                })
            }

            await ctx.supabase.from('notifications').insert({
                user_id: payment.client_id,
                type: 'CONNECTION_DECLINED',
                title: 'Your connection payment was refunded',
                body: `Your payment was refunded. Reason: ${input.reason}`,
                case_id: null,
            })

            return { success: true, alreadyRefunded: false }
        }),

    /** Hard-delete a review and recalculate the lawyer's rating */
    removeReview: adminProcedure
        .input(z.object({ reviewId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { data: review, error: reviewError } = await ctx.supabase
                .from('reviews')
                .select('id, lawyer_id, case_id, rating, flagged')
                .eq('id', input.reviewId)
                .single()

            if (reviewError || !review) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Review not found',
                })
            }

            // Hard delete
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

            // Recalculate lawyer rating
            try {
                await recalculateLawyerRating(ctx, review.lawyer_id)
            } catch (err) {
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
                    case_id: review.case_id,
                })

            return { success: true }
        }),
})
