import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ lawyerId: string }> }
) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()
    const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('id, role')
        .eq('clerk_user_id', userId)
        .single()

    if (adminError || adminUser?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { lawyerId } = await params
    const { data: lawyer, error: lawyerError } = await supabase
        .from('lawyers')
        .select('verification_document_url')
        .eq('id', lawyerId)
        .single()

    if (lawyerError || !lawyer?.verification_document_url) {
        return NextResponse.json({ error: 'Verification document not found' }, { status: 404 })
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(lawyer.verification_document_url, 60)

    if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Failed to create lawyer verification signed URL:', signedUrlError)
        return NextResponse.json({ error: 'Could not prepare verification document' }, { status: 500 })
    }

    return NextResponse.redirect(signedUrlData.signedUrl)
}
