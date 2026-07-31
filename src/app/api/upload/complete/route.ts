import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { computeSHA512, anchorHashOnChain } from "@/lib/blockchain"
import { checkRateLimit } from '@/lib/ratelimit'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
])

function hasExpectedSignature(type: string, buffer: Buffer) {
    if (type === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-'
    if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (type === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
    if (type === 'application/msword') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    }
    if (type === 'text/plain') return !buffer.subarray(0, 1024).includes(0)
    return false
}

/**
 * POST /api/upload/complete
 *
 * Handles document upload: receives a file, stores it in Supabase Storage,
 * computes its SHA-512 hash, anchors the hash on-chain, and registers the
 * document via the documents table.
 *
 * Body: multipart/form-data with fields:
 *   - file: the file to upload
 *   - caseId: UUID of the case this document belongs to
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const rateLimit = await checkRateLimit('upload', userId)
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many uploads. Please wait and try again.' }, { status: 429 })
        }

        // 2. Parse form data
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const caseId = formData.get("caseId") as string | null

        if (!file || !caseId || !UUID_PATTERN.test(caseId)) {
            return NextResponse.json(
                { error: "Missing required fields: file, caseId" },
                { status: 400 }
            )
        }

        // 3. Validate file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024
        if (file.size === 0 || file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 413 }
            )
        }

        // 4. Read file buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        if (!ALLOWED_TYPES.has(file.type) || !hasExpectedSignature(file.type, buffer)) {
            return NextResponse.json(
                { error: 'Unsupported file type or invalid file contents.' },
                { status: 400 }
            )
        }

        // 5. Verify user has access to this case
        const supabase = createServiceRoleClient()

        const { data: dbUser } = await supabase
            .from("users")
            .select("id")
            .eq("clerk_user_id", userId)
            .single()

        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const { data: caseData, error: caseError } = await supabase
            .from("cases")
            .select("id, client_id, lawyer_id, status")
            .eq("id", caseId)
            .or(`client_id.eq.${dbUser.id},lawyer_id.eq.${dbUser.id}`)
            .single()

        if (caseError || !caseData) {
            return NextResponse.json(
                { error: "Case not found or you do not have access" },
                { status: 404 }
            )
        }

        if (caseData.status === "CLOSED") {
            return NextResponse.json(
                { error: "Cannot upload documents to a closed case" },
                { status: 400 }
            )
        }

        // 6. Compute SHA-512 hash
        const sha512Hash = computeSHA512(buffer)

        // 7. Upload to Supabase Storage
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || 'document'
        const storagePath = `cases/${caseId}/${timestamp}_${sanitizedName}`

        const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            })

        if (uploadError) {
            console.error("Supabase storage upload failed:", uploadError)
            return NextResponse.json(
                { error: "Failed to upload file to storage" },
                { status: 500 }
            )
        }

        // 8. Register document in DB. file_url intentionally stores a private
        // storage path; downloads must go through the authenticated download API.
        const { data: document, error: docError } = await supabase.rpc('register_case_document', {
            p_case_id: caseId,
            p_uploaded_by: dbUser.id,
            p_file_name: sanitizedName,
            p_storage_path: storagePath,
            p_sha512_hash: sha512Hash,
        })

        if (docError) {
            console.error("Document DB insert failed:", docError)
            await supabase.storage.from('documents').remove([storagePath])
            return NextResponse.json(
                { error: "Failed to register document" },
                { status: 500 }
            )
        }

        // 9. Anchor on blockchain using the immutable document ID. This same ID
        // is used by the public verification endpoint.
        let chainTxId = "pending"
        try {
            chainTxId = await anchorHashOnChain(document.id, sha512Hash)
            const { error: chainUpdateError } = await supabase
                .from("documents")
                .update({ chain_tx_id: chainTxId })
                .eq("id", document.id)

            if (chainUpdateError) {
                console.error("Failed to update document chain transaction:", chainUpdateError)
            }
        } catch (err) {
            console.error("Blockchain anchoring failed (document saved as pending):", err)
        }

        return NextResponse.json({
            success: true,
            document: {
                id: document.id,
                file_name: document.file_name,
                file_url: `/api/documents/${document.id}/download`,
                sha512_hash: document.sha512_hash,
                chain_tx_id: chainTxId,
            },
        })
    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
