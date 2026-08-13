import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from '@supabase/supabase-js'
import { anchorHashOnChain } from '@/lib/blockchain'
import { checkRateLimit } from '@/lib/ratelimit'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the current user is a party on the case. Returns the case row. */
async function verifyCaseAccess(
    supabase: SupabaseClient,
    caseId: string,
    userId: string
) {
    const { data, error } = await supabase
        .from('cases')
        .select('id, client_id, lawyer_id, status')
        .eq('id', caseId)
        .single()

    if (error || !data || (data.client_id !== userId && data.lawyer_id !== userId)) {
        throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Case not found or you do not have access',
        })
    }

    return data as { id: string; client_id: string; lawyer_id: string; status: string }
}

/** Verify the current user has access to a document via its parent case. */
async function verifyDocumentAccess(
    supabase: SupabaseClient,
    documentId: string,
    userId: string
) {
    const { data, error } = await supabase
        .from('documents')
        .select('id, case_id, cases!inner( client_id, lawyer_id )')
        .eq('id', documentId)
        .single()

    const caseRelation = data?.cases
    const caseRows = Array.isArray(caseRelation) ? caseRelation : caseRelation ? [caseRelation] : []
    const hasAccess = caseRows.some(
        (caseRow) => caseRow.client_id === userId || caseRow.lawyer_id === userId
    )

    if (error || !data || !hasAccess) {
        throw new TRPCError({
            code: 'NOT_FOUND',
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
            await verifyCaseAccess(ctx.supabase, input.caseId, ctx.userId)

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

    /** Soft-delete a document (only the uploader can delete) */
    deleteDocument: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { error } = await ctx.supabase.rpc('soft_delete_case_document', {
                p_document_id: input.documentId,
                p_deleted_by: ctx.userId,
            })

            if (error) {
                throw new TRPCError({
                    code: error.message.includes('not found') ? 'NOT_FOUND' : 'BAD_REQUEST',
                    message: error.message,
                })
            }

            return { success: true }
        }),

    /** Get access log for a document */
    getAccessLog: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .query(async ({ ctx, input }) => {
            // 1. Verify access via document → case ownership
            await verifyDocumentAccess(ctx.supabase, input.documentId, ctx.userId)

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

    /** Retry a document whose initial blockchain anchor failed. */
    retryBlockchainAnchor: protectedProcedure
        .input(z.object({ documentId: z.uuid() }))
        .mutation(async ({ ctx, input }) => {
            const rateLimit = await checkRateLimit('upload', ctx.userId)
            if (!rateLimit.success) {
                throw new TRPCError({
                    code: 'TOO_MANY_REQUESTS',
                    message: 'Too many anchoring attempts. Please wait and try again.',
                })
            }

            await verifyDocumentAccess(ctx.supabase, input.documentId, ctx.userId)

            const { data: document, error: documentError } = await ctx.supabase
                .from('documents')
                .select('id, sha512_hash, chain_tx_id')
                .eq('id', input.documentId)
                .is('deleted_at', null)
                .single()

            if (documentError || !document) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
            }
            if (document.chain_tx_id !== 'pending') {
                return { chainTxId: document.chain_tx_id, alreadyAnchored: true }
            }

            const chainTxId = await anchorHashOnChain(document.id, document.sha512_hash)
            const { error: updateError } = await ctx.supabase
                .from('documents')
                .update({ chain_tx_id: chainTxId })
                .eq('id', document.id)
                .eq('chain_tx_id', 'pending')

            if (updateError) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'The hash was anchored but local reconciliation failed.',
                })
            }

            return { chainTxId, alreadyAnchored: false }
        }),
})
