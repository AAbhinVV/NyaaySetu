const items = [
    ["Data We Collect", "Account details, contact information, role, lawyer verification details, case metadata, uploaded documents, payment metadata, blockchain transaction references, access logs, and security telemetry."],
    ["Why We Use Data", "To authenticate users, review lawyer profiles, process payments, manage cases, secure documents, provide notifications, prevent abuse, and meet legal or security obligations."],
    ["Sharing", "We share data only where needed with service providers such as Clerk, Supabase, Stripe, Vercel, email providers, blockchain infrastructure, and authorized case participants."],
    ["User Rights", "Users may request access, correction, deletion, or grievance support for their personal data, subject to legal retention, security, payment, dispute, and blockchain limitations."],
    ["Security", "Documents are intended to be stored in private buckets, downloaded through authenticated access checks, and logged when accessed. No production system should rely on public document URLs."],
    ["Children", "NyaaySetu is not intended for children. Users should not create accounts for minors unless a lawful guardian/legal basis applies and the platform has explicitly supported that use case."],
]

export default function PrivacyPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Privacy</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Privacy Policy</h1>
            <p className="font-body text-sm text-muted-foreground mb-10">
                This policy is designed around Indian digital personal data expectations, including notice, consent, purpose limitation, user rights, and grievance support.
            </p>
            <div className="space-y-7">
                {items.map(([title, body]) => (
                    <section key={title}>
                        <h2 className="font-serif-heading text-xl font-semibold text-primary mb-2">{title}</h2>
                        <p className="font-body text-sm leading-7 text-foreground/80">{body}</p>
                    </section>
                ))}
            </div>
        </main>
    )
}
