import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the current user is a party on the case. Returns the case row. */
async function verifyCaseAccess(
    supabase: any,
    caseId: string,
    userId: string
) {
    const { data, error } = await supabase
        .from('cases')
        .select('id, client_id, lawyer_id, status')
        .eq('id', caseId)
        .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
        .single()

    if (error || !data) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Case not found or you do not have access',
        })
    }

    return data as { id: string; client_id: string; lawyer_id: string; status: string }
}

/** Verify the current user has access to a document via its parent case. */
async function verifyDocumentAccess(
    supabase: any,
    documentId: string,
    userId: string
) {
    const { data, error } = await supabase
        .from('documents')
        .select('id, case_id, cases!inner( client_id, lawyer_id )')
        .eq('id', documentId)
        .or(`cases.client_id.eq.${userId},cases.lawyer_id.eq.${userId}`)
        .single()

    if (error || !data) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Document not found or you do not have access',
        })
    }

    return data
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const documentRouter = createTRPCRouter({
    /** Get all documents for a case (excludes soft-deleted) */
    getCaseDocuments: protectedProcedure
        .input(z.object({ caseId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            // 1. Ownership check
            await verifyCaseAccess(ctx.supabase, input.caseId, ctx.userId!)

            // 2. Fetch documents
            const { data, error } = await ctx.supabase
                .from('documents')
                .select(`
                    id,
                    file_name,
                    file_url,
                    sha512_hash,
                    chain_tx_id,
                    uploaded_by,
                    created_at,
                    users!uploaded_by (
                        id,
                        full_name,
                        email
                    )
                `)
                .eq('case_id', input.caseId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch documents',
                })
            }

            return data ?? []
        }),

    /** Register a document upload (after client-side upload + blockchain anchor) */
    registerUpload: protectedProcedure
        .input(z.object({
            caseId: z.uuid(),
            fileName: z.string().min(1),
            fileUrl: z.url(),
            sha512Hash: z.string().length(128),
            chainTxId: z.string().min(1),
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Ownership check — also gives us case data for status check
            const caseData = await verifyCaseAccess(ctx.supabase, input.caseId, ctx.userId!)

            // 2. Cannot upload to a closed case
            if (caseData.status === 'CLOSED') {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Cannot upload documents to a closed case',
                })
            }

            // 3. Insert document
            const { data: document, error: documentError } = await ctx.supabase
                .from('documents')
                .insert({
                    case_id: input.caseId,
                    file_name: input.fileName,
                    file_url: input.fileUrl,
                    sha512_hash: input.sha512Hash,
                    chain_tx_id: input.chainTxId,
                    uploaded_by: ctx.userId,
                })
                .select()
                .single()

            if (documentError || !document) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to register document upload',
                })
            }

            // 4. Notify the OTHER party on the case
            const recipientId = ctx.userId === caseData.client_id
                ? caseData.lawyer_id
                : caseData.client_id

            await ctx.supabase
                .from('notifications')
                .insert({
                    user_id: recipientId,
                    type: 'DOCUMENT_UPLOADED',
                    title: 'New document uploaded',
                    body: `A new document "${input.fileName}" has been uploaded to your case.`,
                    case_id: input.caseId,
                })

            return document
        }),

    /** Soft-delete a document (only the uploader can delete) */
    deleteDocument: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch the document and verify ownership via case
            const { data: doc, error: docError } = await ctx.supabase
                .from('documents')
                .select('id, case_id, uploaded_by')
                .eq('id', input.documentId)
                .is('deleted_at', null)
                .single()

            if (docError || !doc) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Document not found',
                })
            }

            // 2. Only the uploader can delete
            if (doc.uploaded_by !== ctx.userId) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'Only the uploader can delete this document',
                })
            }

            // 3. Soft delete
            const { error } = await ctx.supabase
                .from('documents')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', input.documentId)

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to delete document',
                })
            }

            return { success: true }
        }),

    /** Get access log for a document */
    getAccessLog: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // 1. Verify access via document → case ownership
            await verifyDocumentAccess(ctx.supabase, input.documentId, ctx.userId!)

            // 2. Fetch access log
            const { data, error } = await ctx.supabase
                .from('document_access_log')
                .select(`
                    id,
                    accessed_by,
                    accessed_at,
                    ip_address,
                    users!accessed_by ( full_name )
                `)
                .eq('document_id', input.documentId)
                .order('accessed_at', { ascending: false })

            if (error) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to fetch access log',
                })
            }

            return data ?? []
        }),
})