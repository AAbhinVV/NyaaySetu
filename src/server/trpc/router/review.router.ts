import { z } from "zod";
import { baseProcedure, clientProcedure, adminProcedure, createTRPCRouter, } from "../init";
import { TRPCError } from "@trpc/server";





const caseResult = z.enum(['WON', 'LOST', 'SETTLED'])

export const reviewRouter = createTRPCRouter({
    getByLawyer: baseProcedure
        .input(z.object({ lawyerId: z.uuid(), page: z.number().min(1).default(1), limit: z.number().min(1).max(20).default(10) }))
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data, count, error } = await ctx.supabase
                .from("reviews")
                .select(`
                    id,
                    rating,
                    comment,
                    created_at,
                    users!reviewer_id(
                        id,
                        full_name,
                        email
                    )
                `, { count: 'exact' })
                .eq("lawyer_id", input.lawyerId)
                .eq("flagged", false)
                .range(offset, offset + input.limit - 1)
                .order("created_at", { ascending: false })

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
                totalPages: Math.ceil((data?.length ?? 0) / input.limit)
            }
        }),

    submitReview: clientProcedure
        .input(z.object({ caseId: z.uuid(), rating: z.number().min(1).max(5).int(), outcome: caseResult, body: z.string().min(10).max(1000) }))
        .mutation(async ({ ctx, input }) => {
            const { data: caseData, error: caseError } = await ctx.supabase
                .from("cases")
                .select("*")
                .eq("client_id", ctx.userId)
                .order("created_at", { ascending: true })

            if (caseError) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Failed to fetch case"
                })
            }

            if (caseData?.length === 0) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Cases not found"
                })
            }



            if (caseData.status !== "CLOSED") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Case must be closed to submit a review"
                })
            }

            const { data: existingReview } = await ctx.supabase
                .from('reviews')
                .select('id')
                .eq('case_id', input.caseId)
                .eq('reviewer_id', ctx.userId)
                .single()

            if (existingReview) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'You have already submitted a review for this case',
                })
            }

            const { data: reviewData, error: reviewError } = await ctx.supabase
                .from("reviews")
                .insert({
                    case_id: input.caseId,
                    lawyer_id: caseData.lawyer_id,
                    reviewer_id: ctx.userId,
                    rating: input.rating,
                    outcome: input.outcome,
                    body: input.body,
                    flagged: false,
                })
                .select("*")
                .single()

            if (reviewError) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to submit review"
                })
            }

            try {
                const { createCallerFactory } = await import('../init')
                const { lawyerRouter } = await import('./lawyer.router')

                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                await serverCaller.recalculateRating({ lawyerId: caseData.lawyer_id })

            } catch (error) {
                console.error('Failed to recalculate lawyer rating after review:', error)
            }

            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: caseData.lawyer_id,
                    type: 'NEW_REVIEW',
                    title: 'You have a new review',
                    body: `A client left you a ${input.rating}-star review.`,
                    case_id: input.caseId,
                })

            return {
                review: reviewData,
            }
        }),

    flagReview: adminProcedure
        .input(z.object({ reviewId: z.uuid(), reason: z.string().min(5).max(500) }))
        .mutation(async ({ ctx, input }) => {
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
                    `)
                .eq("id", input.reviewId)
                .single()

            if (reviewError) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch review"
                })
            }

            if (!reviewData) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Review not found"
                })
            }

            if (reviewData.flagged) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Review is already flagged"
                })
            }

            const { data: updatedReview, error: updateError } = await ctx.supabase
                .from("reviews")
                .update({
                    flagged: true,
                    flagged_reason: input.reason,
                    flagged_at: new Date().toISOString(),
                })
                .eq("id", input.reviewId)
                .select("*")
                .single()

            if (updateError) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to flag review"
                })
            }

            try {
                const { createCallerFactory } = await import('../init')
                const { lawyerRouter } = await import('./lawyer.router')

                const createCaller = createCallerFactory(lawyerRouter)
                const serverCaller = createCaller(ctx)
                await serverCaller.recalculateRating({ lawyerId: reviewData.lawyer_id })

            } catch (error) {
                console.error('Failed to recalculate lawyer rating after review:', error)
            }

            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: reviewData.lawyer_id,
                    type: 'REVIEW_FLAGGED',
                    title: 'Your review has been flagged',
                    body: `Your review has been flagged by an admin.`,
                    case_id: reviewData.case_id,
                })

            return {
                review: updatedReview,
            }
        })
})