import { z } from 'zod'
import { adminProcedure, createTRPCRouter } from "../init";
import { TRPCError } from '@trpc/server';
import { clerkClient } from '@clerk/nextjs/server';



const VerificationStatus = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

type LawyerStatus = {
    verification_status: 'VERIFIED' | 'PENDING' | 'REJECTED'
}

type CaseStatus = {
    status: 'ACTIVE' | 'CLOSED'
}

const adminRouter = createTRPCRouter({
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
            const [{
                data: userData,
                count: userCount,
                error: userError,
                data: lawyerData,
                count: lawyerCount,
                error: lawyerError,
                data: caseData,
                count: caseCount,
                error: caseError,
                data: paymentData,
                count: paymentCount,
                error: paymentError,

            }] = await Promise.all([
                ctx.supabase.from('users').select('*', { count: 'exact' }),
                ctx.supabase.from('lawyers').select<LawyerStatus>('*', { count: 'exact' }),
                ctx.supabase.from('cases').select('*', { count: 'exact' }),
                ctx.supabase.from('payments').select('*', { count: 'exact' }),
            ])

            if (userError || lawyerError || caseError || paymentError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch platform stats',
                })
            }

            const verifiedLawyers = lawyerData?.filter((lawyer: LawyerStatus) => lawyer.verification_status === 'VERIFIED')?.length ?? 0
            const pendingLawyers = lawyerData?.filter((lawyer: LawyerStatus) => lawyer.verification_status === 'PENDING')?.length ?? 0

            const activeCases = caseData?.filter((case) => case.status)
// const closedCases = caseData?.filter((case: CaseStatus) => case.status === 'CLOSED')?.length ?? 0


return {
    totalUsers: userCount ?? 0,
    totalLawyers: lawyerCount ?? 0,
    verifiedLawyers: verifiedLawyers,
    pendingVerification: pendingLawyers,

    totalCases: caseCount ?? 0,
    activeCases: activeCases,
    closedCases: closedCases,
    totalPayments: paymentCount ?? 0,
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
                .select("id, full_name, email, suspended")
                .eq("id", userId)
                .single()

            if (userError || !userData) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch user"
                })
            }

            if (userData.suspended) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "User is already suspended"
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

            await clerkClient.users.updateUser(userId, {
                publicMetaData: { suspended: true }
            })

            return {
                user: updatedUser,
            }


        }),

        removeReview: adminProcedure
            .input(z.object({ reviewId: z.uuid() }))
            .mutation(async ({ ctx, input }) => {
                const { data: reviewData, error: reviewError } = ctx.supabase
                    .from("reviews")
                    .select
            })
})