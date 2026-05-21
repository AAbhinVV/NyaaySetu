import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { computeSHA512, anchorHashOnChain } from "@/lib/blockchain"

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

        // 2. Parse form data
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const caseId = formData.get("caseId") as string | null

        if (!file || !caseId) {
            return NextResponse.json(
                { error: "Missing required fields: file, caseId" },
                { status: 400 }
            )
        }

        // 3. Validate file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 10MB." },
                { status: 413 }
            )
        }

        // 4. Read file buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // 5. Verify user has access to this case
        const supabase = await createServerClient()

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
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
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

        // 8. Get public URL
        const { data: urlData } = supabase.storage
            .from("documents")
            .getPublicUrl(storagePath)

        const fileUrl = urlData?.publicUrl ?? ""

        // 9. Anchor on blockchain (best-effort — don't fail the upload if this fails)
        let chainTxId = ""
        try {
            chainTxId = await anchorHashOnChain(storagePath, sha512Hash)
        } catch (err) {
            console.error("Blockchain anchoring failed (non-fatal):", err)
            // Continue — document is still saved, just not anchored
        }

        // 10. Register document in DB
        const { data: document, error: docError } = await supabase
            .from("documents")
            .insert({
                case_id: caseId,
                file_name: file.name,
                file_url: fileUrl,
                sha512_hash: sha512Hash,
                chain_tx_id: chainTxId || null,
                uploaded_by: dbUser.id,
            })
            .select()
            .single()

        if (docError) {
            console.error("Document DB insert failed:", docError)
            return NextResponse.json(
                { error: "Failed to register document" },
                { status: 500 }
            )
        }

        // 11. Notify the other party
        const recipientId =
            dbUser.id === caseData.client_id
                ? caseData.lawyer_id
                : caseData.client_id

        await supabase.from("notifications").insert({
            user_id: recipientId,
            type: "DOCUMENT_UPLOADED",
            title: "New document uploaded",
            body: `A new document "${file.name}" has been uploaded to your case.`,
            case_id: caseId,
        })

        return NextResponse.json({
            success: true,
            document: {
                id: document.id,
                file_name: document.file_name,
                file_url: document.file_url,
                sha512_hash: document.sha512_hash,
                chain_tx_id: document.chain_tx_id,
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
