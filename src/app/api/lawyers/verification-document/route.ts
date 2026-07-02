import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export async function POST(req: NextRequest) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
        return NextResponse.json({ error: 'Verification document is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
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
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `lawyer-verification/${dbUser.id}/${Date.now()}_${sanitizedName}`

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
