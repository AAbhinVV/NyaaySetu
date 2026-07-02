const points = [
    ["Active Case Documents", "Documents are retained while a case is active so authorized case participants can access them."],
    ["Closed Cases", "Documents for closed cases may be retained for legal, audit, dispute, and user convenience purposes unless deletion is requested and legally permitted."],
    ["Deletion", "File deletion may remove or disable access to the stored file, but audit logs, payment records, security logs, and legally necessary metadata may be retained."],
    ["Blockchain Hashes", "Blockchain records are designed to be immutable. A document file may be deleted from platform storage, but a previously anchored hash or transaction reference may remain on-chain."],
    ["Access Logs", "Document access logs may be retained for security, dispute resolution, and audit purposes."],
]

export default function DocumentRetentionPolicyPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Documents</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Document Retention & Deletion Policy</h1>
            <div className="space-y-5">
                {points.map(([title, body]) => (
                    <section key={title} className="bg-card rounded-lg p-5 shadow-lawyer">
                        <h2 className="font-serif-heading text-lg font-semibold text-primary mb-2">{title}</h2>
                        <p className="font-body text-sm leading-7 text-foreground/80">{body}</p>
                    </section>
                ))}
            </div>
        </main>
    )
}
