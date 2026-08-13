import { Resend } from 'resend'

// ─── Lazy-init Resend client ──────────────────────────────────────────────────

let _resend: Resend | null = null

function getResendClient(): Resend {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
            throw new Error('Missing RESEND_API_KEY environment variable')
        }
        _resend = new Resend(apiKey)
    }
    return _resend
}

const FROM_ADDRESS = 'NyaaySetu <noreply@nyaaysetu.com>'

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character] ?? character)
}

// ─── Email Functions ──────────────────────────────────────────────────────────

/** Notify lawyer of a new connection request */
export async function sendConnectionRequestEmail(to: string, clientName: string) {
    const resend = getResendClient()
    const safeClientName = escapeHtml(clientName)
    return resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'New Connection Request — NyaaySetu',
        html: `
            <h2>You have a new client connection request</h2>
            <p><strong>${safeClientName}</strong> has paid the connection fee and wants to connect with you.</p>
            <p>Log in to your dashboard to accept or decline.</p>
        `,
    })
}

/** Notify client their connection was accepted */
export async function sendConnectionAcceptedEmail(to: string, lawyerName: string) {
    const resend = getResendClient()
    const safeLawyerName = escapeHtml(lawyerName)
    return resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'Your Lawyer Accepted Your Request — NyaaySetu',
        html: `
            <h2>Your connection has been accepted</h2>
            <p><strong>${safeLawyerName}</strong> has accepted your request. Your case has been created.</p>
            <p>Visit your dashboard to view case details.</p>
        `,
    })
}

/** Notify client of upcoming hearing */
export async function sendHearingReminderEmail(
    to: string,
    caseTitle: string,
    hearingDate: string,
    courtName: string
) {
    const resend = getResendClient()
    const safeCaseTitle = escapeHtml(caseTitle)
    const safeHearingDate = escapeHtml(hearingDate)
    const safeCourtName = escapeHtml(courtName)
    return resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `Hearing Reminder: ${caseTitle.replace(/[\r\n]/g, ' ')} — NyaaySetu`,
        html: `
            <h2>Upcoming Hearing Reminder</h2>
            <p>Your case <strong>${safeCaseTitle}</strong> has a hearing scheduled:</p>
            <ul>
                <li><strong>Date:</strong> ${safeHearingDate}</li>
                <li><strong>Court:</strong> ${safeCourtName}</li>
            </ul>
            <p>Please plan accordingly.</p>
        `,
    })
}

/** Notify lawyer of verification decision */
export async function sendVerificationEmail(
    to: string,
    status: 'VERIFIED' | 'REJECTED',
    reason?: string
) {
    const resend = getResendClient()
    const isVerified = status === 'VERIFIED'
    const safeReason = escapeHtml(reason ?? 'Please contact support for more details.')

    return resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: isVerified
            ? 'Your Profile is Verified — NyaaySetu'
            : 'Profile Verification Update — NyaaySetu',
        html: isVerified
            ? `
                <h2>Congratulations! Your profile is now verified.</h2>
                <p>Your profile is now visible to clients on NyaaySetu. You will start receiving connection requests.</p>
            `
            : `
                <h2>Your profile verification was not approved</h2>
                <p>Reason: ${safeReason}</p>
                <p>You can update your profile and resubmit for verification.</p>
            `,
    })
}
