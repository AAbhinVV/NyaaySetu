import { z } from 'zod'
import { adminProcedure, createTRPCRouter } from "../init";
import { TRPCError } from '@trpc/server';

const VerificationStatus = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

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

        }),

    verifyLawyer: adminProcedure
        .input(z.object({ lawyerId: z.uuid(), status: VerificationStatus, rejectionReason: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {

        }),

    suspendUser: adminProcedure
        .input(z.object({ userId: z.uuid(), reason: z.string().min(5).max(500) }))
        .mutation(async ({ ctx, input }) => {

        }),

    removeReview: adminProcedure
        .input(z.object({ reviewId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {

        })
})