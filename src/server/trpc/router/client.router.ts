import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, clientProcedure, protectedProcedure, baseProcedure, adminProcedure } from '../init'

export const clientRouter = createTRPCRouter({

    getDashboardSummary: clientProcedure
        .query(async ({ ctx }) => {
            const [
                { count: totalCases, error: e1 },
                { count: activeCases, error: e2 },
                { count: unreadNotifications, error: e3 },
                { count: activeConnections, error: e4 },
                { data: upcomingHearings, error: e5 },
            ] = await Promise.all([

                // total cases ever
                ctx.supabase
                    .from('cases')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId),

                // cases currently in progress
                ctx.supabase
                    .from('cases')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .in('status', ['IN_PROGRESS', 'HEARING_SET']),

                // unread notifications
                ctx.supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', ctx.userId)
                    .eq('read', false),

                // active lawyer connections
                ctx.supabase
                    .from('connections')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', ctx.userId)
                    .eq('status', 'ACTIVE'),

                // next 3 upcoming hearings with minimal fields
                ctx.supabase
                    .from('cases')
                    .select('id, title, next_hearing_at, status, lawyers(full_name)')
                    .eq('client_id', ctx.userId)
                    .in('status', ['IN_PROGRESS', 'HEARING_SET'])
                    .not('next_hearing_at', 'is', null)
                    .gt('next_hearing_at', new Date().toISOString())
                    .order('next_hearing_at', { ascending: true })
                    .limit(3),

            ])

            if (e1 || e2 || e3 || e4 || e5) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch dashboard summary',
                })
            }

            return {
                totalCases: totalCases ?? 0,
                activeCases: activeCases ?? 0,
                unreadNotifications: unreadNotifications ?? 0,
                activeConnections: activeConnections ?? 0,
                upcomingHearings: upcomingHearings ?? [],
            }
        }),


    getSavedLawyers: clientProcedure
        .query(async ({ ctx }) => {
            const { data, error } = await ctx.supabase
                .from('saved_lawyers')
                .select(`
                        id,
                        lawyer_id,
                        saved_at,
                        lawyers(
                            id,
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
                        )
                    `)
                .eq('client_id', ctx.userId)
                .order('saved_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch saved lawyers',
                })
            }

            return data ?? []
        }),

})