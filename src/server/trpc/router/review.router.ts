import { z } from "zod";
import { baseProcedure, clientProcedure, adminProcedure, createTRPCRouter } from "../init";
import { TRPCError } from "@trpc/server";
import { recalculateLawyerRating } from './lawyer.router'

const caseResult = z.enum(['WON', 'LOST', 'SETTLED'])

export const reviewRouter = createTRPCRouter({
    /** Public: get paginated reviews for a lawyer (unflagged only) */
    getByLawyer: baseProcedure
        .input(z.object({
            lawyerId: z.string().uuid(),
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(20).default(10),
        }))
        .query(async ({ input }) => {
            const offset = (input.page - 1) * input.limit
            const publicDb = createServiceRoleClient()

            const { data, count, error } = await publicDb
                .from("reviews")
                .select(`
                    id,
                    rating,
                    outcome,
                    body,
                    created_at,
                    users!reviewer_id (
                        id,
                        full_name
                    )
                `, { count: 'exact' })
                .eq("lawyer_id", input.lawyerId)
                .eq("flagged", false)
                .order("created_at", { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch reviews",
                })
            }

            const total = count ?? 0
            return {
                reviews: data ?? [],
                total,
                page: input.page,
                totalPages: Math.ceil(total / input.limit),
            }
        }),

    /** Client: submit a review for a closed case */
    submitReview: clientProcedure
        .input(z.object({
            caseId: z.string().uuid(),
            rating: z.number().min(1).max(5).int(),
            outcome: caseResult,
            body: z.string().min(10).max(1000),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch the SPECIFIC case by ID and verify client ownership
            const { data: caseData, error: caseError } = await ctx.supabase
                .from("cases")
                .select("id, status, lawyer_id, verdict_outcome")
                .eq("id", input.caseId)
                .eq("client_id", ctx.userId)
                .single()

            if (caseError || !caseData) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Case not found or you do not have access",
                })
            }

            // 2. Case must be CLOSED
            if (caseData.status !== "CLOSED") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Reviews can only be submitted for closed cases",
                })
            }

            if (!caseData.verdict_outcome || input.outcome !== caseData.verdict_outcome) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'The review outcome must match the recorded case verdict.',
                })
            }

            // 3. No duplicate reviews
            const { data: existingReview } = await ctx.supabase
                .from('reviews')
                .select('id')
                .eq('case_id', input.caseId)
                .eq('reviewer_id', ctx.userId)
                .maybeSingle()

            if (existingReview) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'You have already submitted a review for this case',
                })
            }

            // 4. Insert review
            const { data: reviewData, error: reviewError } = await ctx.supabase
                .from("reviews")
                .insert({
                    case_id: input.caseId,
                    lawyer_id: caseData.lawyer_id,
                    reviewer_id: ctx.userId,
                    rating: input.rating,
                    outcome: input.outcome,
                    body: input.body.trim(),
                })
                .select()
                .single()

            if (reviewError || !reviewData) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to submit review",
                })
            }

            // 5. Recalculate lawyer rating
            try {
                await recalculateLawyerRating(ctx, caseData.lawyer_id)
            } catch (err) {
                console.error('Failed to recalculate lawyer rating after review:', err)
            }

            // 6. Notify the lawyer
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: caseData.lawyer_id,
                    type: 'NEW_REVIEW',
                    title: 'You have a new review',
                    body: `A client left you a ${input.rating}-star review.`,
                    case_id: input.caseId,
                })

            return reviewData
        }),

    /** Admin: flag a review (hides it from public listings) */
    flagReview: adminProcedure
        .input(z.object({
            reviewId: z.string().uuid(),
            reason: z.string().min(5).max(500),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch review — include 'flagged' in select for the guard check
            const { data: reviewData, error: reviewError } = await ctx.supabase
                .from("reviews")
                .select(`
                    id,
                    case_id,
                    lawyer_id,
                    reviewer_id,
                    rating,
                    outcome,
                    body,
                    flagged
                `)
                .eq("id", input.reviewId)
                .single()

            if (reviewError || !reviewData) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Review not found",
                })
            }

            if (reviewData.flagged) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Review is already flagged",
                })
            }

            // 2. Flag the review (DB column is 'flag_reason', not 'flagged_reason')
            const { data: updatedReview, error: updateError } = await ctx.supabase
                .from("reviews")
                .update({
                    flagged: true,
                    flag_reason: input.reason,
                    flagged_at: new Date().toISOString(),
                })
                .eq("id", input.reviewId)
                .select()
                .single()

            if (updateError || !updatedReview) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to flag review",
                })
            }

            // 3. Recalculate lawyer rating (flagged reviews are excluded)
            try {
                await recalculateLawyerRating(ctx, reviewData.lawyer_id)
            } catch (err) {
                console.error('Failed to recalculate lawyer rating after flagging:', err)
            }

            // 4. Notify the lawyer
            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: reviewData.lawyer_id,
                    type: 'REVIEW_FLAGGED',
                    title: 'A review on your profile has been flagged',
                    body: 'A review has been flagged by our moderation team for review.',
                    case_id: reviewData.case_id,
                })

            return updatedReview
        }),
})
