import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ docId: string }> }
) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { docId } = await params
    const supabase = createServiceRoleClient()

    const { data: dbUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .single()

    if (userError || !dbUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, file_url, file_name, cases!inner(client_id, lawyer_id)')
        .eq('id', docId)
        .is('deleted_at', null)
        .single()

    if (docError || !document) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const caseRows = Array.isArray(document.cases) ? document.cases : [document.cases]
    const hasAccess = caseRows.some(
        (caseRow) => caseRow.client_id === dbUser.id || caseRow.lawyer_id === dbUser.id
    )

    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await supabase.from('document_access_log').insert({
        document_id: document.id,
        accessed_by: dbUser.id,
        ip_address:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            req.headers.get('x-real-ip') ??
            null,
    })

    if (/^https?:\/\//i.test(document.file_url)) {
        return NextResponse.redirect(document.file_url)
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_url, 60)

    if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('Failed to create signed document URL:', signedUrlError)
        return NextResponse.json({ error: 'Could not prepare document download' }, { status: 500 })
    }

    return NextResponse.redirect(signedUrlData.signedUrl)
}
