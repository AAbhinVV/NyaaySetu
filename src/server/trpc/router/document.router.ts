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
                    code: 'FORBIDDEN',
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
                .select(`
                    id, 
                    file_name, 
                    file_url, 
                    sha256_hash, 
                    chain_tx_id, 
                    uploaded_by, 
                    created_at
                    users!uploaded_by(
                        id,
                        full_name,
                        email
                    )
                    `)
                .eq('case_id', input.caseId)
                .is('deleted_at', null)
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
            fileName: z.string().min(1),
            fileUrl: z.url(),
            sha256Hash: z.string().length(64),
            chainTxId: z.string().min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const { data: caseData, error: ownershipError } = await ctx.supabase
                .from('cases')
                .select('*', { count: 'exact', head: true })
                .eq('id', input.caseId)
                .or(`client_id.eq.${ctx.userId},lawyer_id.eq.${ctx.userId}`)

            if (ownershipError) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Failed to fetch case',
                })
            }

            if (ownershipError.count === 0) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Case not found',
                })
            }

            if (caseData.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Case is closed'
                })
            }

            const { data: documentData, error: documentError } = await ctx.supabase
                .from('documents')
                .insert({
                    case_id: input.caseId,
                    file_name: input.fileName,
                    file_url: input.fileUrl,
                    sha256_hash: input.sha256Hash,
                    chain_tx_id: input.chainTxId,
                    uploaded_by: ctx.userId,
                })
                .select('*')
                .single()

            const { data: notificationData, error: notificationError } = await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: ctx.userId,
                    case_id: input.caseId,
                    type: 'DOCUMENT_UPLOADED',
                    message: `Document ${input.fileName} uploaded`,
                    read: false,
                })
                .select('*')
                .single()

            if (documentError || notificationError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to register upload',
                })
            }

            return {
                document: documentData,
            }
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