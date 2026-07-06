import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyHashOnChain } from '@/lib/blockchain'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * GET /api/documents/verify/[docId]
 * Public endpoint — no auth required.
 * Fetches the document's hash from DB and verifies it against the Polygon blockchain.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ docId: string }> }
) {
    try {
        const { docId } = await params

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
        }

        if (!UUID_PATTERN.test(docId)) {
            return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 })
        }

        const supabase = createServiceRoleClient()

        // Fetch document from DB (include soft-deleted for verification purposes)
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('id, file_name, sha512_hash, chain_tx_id, case_id, created_at, deleted_at')
            .eq('id', docId)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // Verify against blockchain
        let verified = false
        let verificationError: string | null = null

        try {
            verified = await verifyHashOnChain(doc.id, doc.sha512_hash)
        } catch (err) {
            verificationError = 'Blockchain verification service unavailable'
            console.error('Blockchain verify failed:', err)
        }

        return NextResponse.json({
            verified,
            document: {
                id: doc.id,
                fileName: doc.file_name,
                sha512Hash: doc.sha512_hash,
                chainTxId: doc.chain_tx_id,
                uploadedAt: doc.created_at,
                isDeleted: doc.deleted_at !== null,
            },
            ...(verificationError && { warning: verificationError }),
        })
    } catch (error) {
        console.error('Document verification error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
