import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

export const documentRouter = createTRPCRouter({
    getCaseById: protectedProcedure
        .input(z.object({ caseId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)

            if (ownershipError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case',
                })
            }

            if (ownershipError.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            const { data: documents, error: documentError } = await ctx.supabase
                .from('documents')
                .select('*')
                .eq('case_id', input.caseId)
                .order('created_at', { ascending: false })

            if (documentError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch documents',
                })
            }

            return documents ?? []
        }),

    registerUpload: protectedProcedure
        .input(z.object({
            caseId: z.uuid(),
            fileName: z.string(),
            fileType: z.string(),
            fileSize: z.number(),
            storagePath: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)

            if (ownershipError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case',
                })
            }

            if (ownershipError.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            const { data, error } = await ctx.supabase
                .from('documents')
                .insert({
                    case_id: input.caseId,
                    file_name: input.fileName,
                    file_type: input.fileType,
                    file_size: input.fileSize,
                    storage_path: input.storagePath,
                })
                .select('*')
                .single()

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to register upload',
                })
            }

            return data
        }),

    deleteDocument: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('id', input.documentId)
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)

            if (ownershipError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case',
                })
            }

            if (ownershipError.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            const { error } = await ctx.supabase
                .from('documents')
                .delete()
                .eq('id', input.documentId)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to delete document',
                })
            }

            return true
        }),

    getAccessLog: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .query(async ({ ctx, input }) => {

            const { error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('id', input.documentId)
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)

            if (ownershipError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch case',
                })
            }

            if (ownershipError.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            const { data, error } = await ctx.supabase
                .from('document_access_log')
                .select('*')
                .eq('document_id', input.documentId)
                .order('accessed_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch access log',
                })
            }

            return data ?? []
        })
})