import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { computeSHA512, anchorHashOnChain } from '@/lib/blockchain'

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/**
 * POST /api/documents/upload
 * Handles multipart/form-data document upload:
 *   1. Auth check
 *   2. File validation (type + size)
 *   3. SHA-512 hash
 *   4. Supabase Storage upload
 *   5. Blockchain anchor
 *   6. Insert document record in DB
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Auth check
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Parse form data
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const caseId = formData.get('caseId') as string | null

        if (!file || !caseId) {
            return NextResponse.json(
                { error: 'Missing required fields: file, caseId' },
                { status: 400 }
            )
        }

        // 3. Validate file
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            )
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: `File type not allowed: ${file.type}` },
                { status: 400 }
            )
        }

        // 4. Ownership check — user must be client or lawyer on this case
        const supabase = await createServerClient()
        const { data: caseData, error: caseError } = await supabase
            .from('cases')
            .select('id')
            .eq('id', caseId)
            .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
            .single()

        if (caseError || !caseData) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 })
        }

        // 5. Hash the file with SHA-512
        const buffer = Buffer.from(await file.arrayBuffer())
        const sha512Hash = computeSHA512(buffer)

        // 6. Upload to Supabase Storage
        const filePath = `documents/${caseId}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
            .from('case-documents')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (uploadError) {
            console.error('Storage upload failed:', uploadError)
            return NextResponse.json(
                { error: 'Failed to upload file to storage' },
                { status: 500 }
            )
        }

        // 7. Get public URL
        const { data: urlData } = supabase.storage
            .from('case-documents')
            .getPublicUrl(filePath)

        // 8. Anchor hash on blockchain
        let chainTxId = 'pending'
        try {
            chainTxId = await anchorHashOnChain(caseId, sha512Hash)
        } catch (err) {
            console.error('Blockchain anchoring failed (non-fatal):', err)
            // Continue — document is saved even if blockchain fails
        }

        // 9. Insert document record
        const { data: doc, error: insertError } = await supabase
            .from('documents')
            .insert({
                case_id: caseId,
                file_name: file.name,
                file_url: urlData.publicUrl,
                sha512_hash: sha512Hash,
                chain_tx_id: chainTxId,
                uploaded_by: userId,
            })
            .select('id, file_name, file_url, sha512_hash, chain_tx_id, created_at')
            .single()

        if (insertError) {
            console.error('Document insert failed:', insertError)
            return NextResponse.json(
                { error: 'Failed to save document record' },
                { status: 500 }
            )
        }

        // 10. Add timeline event (fire-and-forget)
        await supabase.from('case_timeline').insert({
            case_id: caseId,
            event_type: 'DOCUMENT_UPLOADED',
            description: `Document "${file.name}" uploaded`,
            created_by: userId,
        })

        return NextResponse.json({ document: doc }, { status: 201 })
    } catch (error) {
        console.error('Document upload error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
