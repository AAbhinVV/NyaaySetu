import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
    createTRPCRouter,
    baseProcedure,
    protectedProcedure,
    lawyerProcedure,
    adminProcedure,
} from '../init'

// ─── Input Schemas ────────────────────────────────────────────────────────────

const CourtLevel = z.enum([
    'DISTRICT',
    'HIGH_COURT',
    'SUPREME_COURT',
    'TRIBUNAL',
    'CONSUMER_FORUM',
])

const CaseCategory = z.enum([
    'CIVIL',
    'CRIMINAL',
    'PROPERTY',
    'FAMILY',
    'DIGITAL_CRIME',
    'CONSUMER',
    'LABOUR',
    'CORPORATE',
])

const VerificationStatus = z.enum(['PENDING', 'VERIFIED', 'REJECTED'])

const createProfileSchema = z.object({
    barCouncilId: z.string().min(3, 'Bar Council ID is required'),
    fullName: z.string().min(2),
    bio: z.string().max(1000).optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    specializations: z.array(CaseCategory).min(1, 'Select at least one specialization'),
    courtLevels: z.array(CourtLevel).min(1, 'Select at least one court level'),
    feePerConsultation: z.number().min(0),
    yearsOfExperience: z.number().min(0).max(60),
    languagesSpoken: z.array(z.string()).optional(),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
})

const updateProfileSchema = createProfileSchema.partial().omit({ barCouncilId: true })

const searchSchema = z.object({
    query: z.string().optional(),
    category: CaseCategory.optional(),
    courtLevel: CourtLevel.optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    minRating: z.number().min(1).max(5).optional(),
    maxFee: z.number().min(0).optional(),
    minExperience: z.number().min(0).optional(),
    verifiedOnly: z.boolean().default(true),
    sortBy: z.enum(['rating', 'experience', 'fee', 'win_rate']).default('rating'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(50).default(12),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const lawyerRouter = createTRPCRouter({

    // ── Public: search lawyers ─────────────────────────────────────────────────
    search: baseProcedure
        .input(searchSchema)
        .query(async ({ ctx, input }) => {
            const {
                query,
                category,
                courtLevel,
                city,
                state,
                minRating,
                maxFee,
                minExperience,
                verifiedOnly,
                sortBy,
                sortOrder,
                page,
                limit,
            } = input

            const offset = (page - 1) * limit

            let dbQuery = ctx.supabase
                .from('lawyers')
                .select(
                    `
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
          users!inner ( email )
        `,
                    { count: 'exact' }
                )

            if (verifiedOnly) {
                dbQuery = dbQuery.eq('verified', true)
            }

            if (query) {
                dbQuery = dbQuery.or(
                    `full_name.ilike.%${query}%,bio.ilike.%${query}%`
                )
            }

            if (category) {
                dbQuery = dbQuery.contains('specializations', [category])
            }

            if (courtLevel) {
                dbQuery = dbQuery.contains('court_levels', [courtLevel])
            }

            if (city) {
                dbQuery = dbQuery.ilike('city', `%${city}%`)
            }

            if (state) {
                dbQuery = dbQuery.ilike('state', `%${state}%`)
            }

            if (minRating !== undefined) {
                dbQuery = dbQuery.gte('avg_rating', minRating)
            }

            if (maxFee !== undefined) {
                dbQuery = dbQuery.lte('fee_per_consultation', maxFee)
            }

            if (minExperience !== undefined) {
                dbQuery = dbQuery.gte('years_of_experience', minExperience)
            }

            const columnMap: Record<string, string> = {
                rating: 'avg_rating',
                experience: 'years_of_experience',
                fee: 'fee_per_consultation',
                win_rate: 'win_rate',
            }

            dbQuery = dbQuery
                .order(columnMap[sortBy], { ascending: sortOrder === 'asc' })
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

    // ── Public: get lawyer by ID (full profile) ────────────────────────────────
    getById: baseProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            const { data, error } = await ctx.supabase
                .from('lawyers')
                .select(
                    `
          *,
          users!inner ( email, created_at ),
          reviews (
            id,
            rating,
            outcome,
            body,
            created_at,
            users!reviewer_id ( full_name )
          )
        `
                )
                .eq('id', input.id)
                .eq('verified', true)
                .single()

            if (error || !data) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Lawyer profile not found',
                })
            }

            return data
        }),

    // ── Public: get paginated reviews for a lawyer ─────────────────────────────
    getReviews: baseProcedure
        .input(
            z.object({
                lawyerId: z.string().uuid(),
                page: z.number().min(1).default(1),
                limit: z.number().min(1).max(20).default(10),
            })
        )
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit

            const { data, error, count } = await ctx.supabase
                .from('reviews')
                .select(
                    `
          id,
          rating,
          outcome,
          body,
          created_at,
          users!reviewer_id ( full_name )
        `,
                    { count: 'exact' }
                )
                .eq('lawyer_id', input.lawyerId)
                .eq('flagged', false)
                .order('created_at', { ascending: false })
                .range(offset, offset + input.limit - 1)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return {
                reviews: data ?? [],
                total: count ?? 0,
                page: input.page,
                totalPages: Math.ceil((count ?? 0) / input.limit),
            }
        }),

    // ── Protected (Lawyer): get own profile ───────────────────────────────────
    getMyProfile: lawyerProcedure.query(async ({ ctx }) => {
        const { data, error } = await ctx.supabase
            .from('lawyers')
            .select('*')
            .eq('user_id', ctx.userId)
            .single()

        if (error || !data) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Lawyer profile not found. Complete onboarding first.',
            })
        }

        return data
    }),

    // ── Protected (Lawyer): create profile on onboarding ──────────────────────
    createProfile: lawyerProcedure
        .input(createProfileSchema)
        .mutation(async ({ ctx, input }) => {
            // Check profile doesn't already exist
            const { data: existing } = await ctx.supabase
                .from('lawyers')
                .select('id')
                .eq('user_id', ctx.userId)
                .single()

            if (existing) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Lawyer profile already exists',
                })
            }

            // Check Bar Council ID uniqueness
            const { data: duplicateBar } = await ctx.supabase
                .from('lawyers')
                .select('id')
                .eq('bar_council_id', input.barCouncilId)
                .single()

            if (duplicateBar) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'This Bar Council ID is already registered',
                })
            }

            const { data, error } = await ctx.supabase
                .from('lawyers')
                .insert({
                    user_id: ctx.userId,
                    bar_council_id: input.barCouncilId,
                    full_name: input.fullName,
                    bio: input.bio ?? null,
                    city: input.city,
                    state: input.state,
                    specializations: input.specializations,
                    court_levels: input.courtLevels,
                    fee_per_consultation: input.feePerConsultation,
                    years_of_experience: input.yearsOfExperience,
                    languages_spoken: input.languagesSpoken ?? [],
                    phone: input.phone,
                    verified: false,
                    win_rate: 0,
                    total_cases: 0,
                    avg_rating: 0,
                    review_count: 0,
                })
                .select()
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return data
        }),

    // ── Protected (Lawyer): update own profile ────────────────────────────────
    updateProfile: lawyerProcedure
        .input(updateProfileSchema)
        .mutation(async ({ ctx, input }) => {
            const updatePayload: Record<string, unknown> = {}

            if (input.fullName !== undefined) updatePayload.full_name = input.fullName
            if (input.bio !== undefined) updatePayload.bio = input.bio
            if (input.city !== undefined) updatePayload.city = input.city
            if (input.state !== undefined) updatePayload.state = input.state
            if (input.specializations !== undefined) updatePayload.specializations = input.specializations
            if (input.courtLevels !== undefined) updatePayload.court_levels = input.courtLevels
            if (input.feePerConsultation !== undefined) updatePayload.fee_per_consultation = input.feePerConsultation
            if (input.yearsOfExperience !== undefined) updatePayload.years_of_experience = input.yearsOfExperience
            if (input.languagesSpoken !== undefined) updatePayload.languages_spoken = input.languagesSpoken
            if (input.phone !== undefined) updatePayload.phone = input.phone

            if (Object.keys(updatePayload).length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'No fields provided to update',
                })
            }

            const { data, error } = await ctx.supabase
                .from('lawyers')
                .update(updatePayload)
                .eq('user_id', ctx.userId)
                .select()
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return data
        }),

    // ── Protected (Admin): verify or reject a lawyer ──────────────────────────
    updateVerificationStatus: adminProcedure
        .input(
            z.object({
                lawyerId: z.string().uuid(),
                status: VerificationStatus,
                rejectionReason: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const { data: lawyer, error: fetchError } = await ctx.supabase
                .from('lawyers')
                .select('id, user_id, full_name, verification_status')
                .eq('id', input.lawyerId)
                .single()

            if (fetchError || !lawyer) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Lawyer not found',
                })
            }

            const { data, error } = await ctx.supabase
                .from('lawyers')
                .update({
                    verified: input.status === 'VERIFIED',
                    verification_status: input.status,
                    rejection_reason: input.rejectionReason ?? null,
                    verified_at: input.status === 'VERIFIED' ? new Date().toISOString() : null,
                })
                .eq('id', input.lawyerId)
                .select()
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return data
        }),

    // ── Internal: recalculate win rate after verdict ───────────────────────────
    // Called server-side from case.recordVerdict, not exposed to clients directly
    updateWinRate: protectedProcedure
        .input(z.object({ lawyerId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            // Count total closed cases and won cases for this lawyer
            const { data: stats, error: statsError } = await ctx.supabase
                .from('cases')
                .select('verdict_outcome')
                .eq('lawyer_id', input.lawyerId)
                .eq('status', 'CLOSED')
                .not('verdict_outcome', 'is', null)

            if (statsError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: statsError.message,
                })
            }

            const total = stats?.length ?? 0
            const won = stats?.filter((c) => c.verdict_outcome === 'WON').length ?? 0
            const winRate = total > 0 ? Math.round((won / total) * 100) : 0

            const { data, error } = await ctx.supabase
                .from('lawyers')
                .update({
                    win_rate: winRate,
                    total_cases: total,
                })
                .eq('id', input.lawyerId)
                .select('id, win_rate, total_cases')
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return data
        }),

    // ── Internal: recalculate avg rating after a new review ───────────────────
    // Called server-side from review.submit
    recalculateRating: protectedProcedure
        .input(z.object({ lawyerId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { data: reviews, error: reviewError } = await ctx.supabase
                .from('reviews')
                .select('rating')
                .eq('lawyer_id', input.lawyerId)
                .eq('flagged', false)

            if (reviewError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: reviewError.message,
                })
            }

            const count = reviews?.length ?? 0
            const avg =
                count > 0
                    ? parseFloat(
                        (
                            reviews.reduce((sum, r) => sum + r.rating, 0) / count
                        ).toFixed(2)
                    )
                    : 0

            const { data, error } = await ctx.supabase
                .from('lawyers')
                .update({ avg_rating: avg, review_count: count })
                .eq('id', input.lawyerId)
                .select('id, avg_rating, review_count')
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                })
            }

            return data
        }),
})