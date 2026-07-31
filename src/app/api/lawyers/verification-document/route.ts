import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ratelimit'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

function hasExpectedSignature(type: string, buffer: Buffer) {
    if (type === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-'
    if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    if (type === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
    if (type === 'application/msword') return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
}

export async function POST(req: NextRequest) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit('upload', userId)
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many uploads. Please wait and try again.' }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
        return NextResponse.json({ error: 'Verification document is required' }, { status: 400 })
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 413 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .single()

    if (userError || !dbUser) {
        return NextResponse.json({ error: 'Complete account onboarding before uploading verification proof' }, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasExpectedSignature(file.type, buffer)) {
        return NextResponse.json({ error: 'The file contents do not match the selected file type.' }, { status: 400 })
    }

    const { data: existingProfile } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', dbUser.id)
        .maybeSingle()

    if (existingProfile) {
        return NextResponse.json({ error: 'A lawyer profile already exists for this account.' }, { status: 409 })
    }

    // Only one unclaimed onboarding proof is retained per lawyer account.
    const verificationFolder = `lawyer-verification/${dbUser.id}`
    const { data: existingFiles } = await supabase.storage.from('documents').list(verificationFolder)
    if (existingFiles?.length) {
        await supabase.storage.from('documents').remove(
            existingFiles.map((item) => `${verificationFolder}/${item.name}`)
        )
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${verificationFolder}/${Date.now()}_${sanitizedName}`

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
        })

    if (uploadError) {
        console.error('Lawyer verification upload failed:', uploadError)
        return NextResponse.json({ error: 'Failed to upload verification document' }, { status: 500 })
    }

    return NextResponse.json({
        storagePath,
        fileName: file.name,
    })
}
