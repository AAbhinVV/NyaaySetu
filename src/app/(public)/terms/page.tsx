const sections = [
    {
        title: "Platform Role",
        body: "NyaaySetu is a technology platform that helps users discover independent legal professionals, manage case-related workflows, and store legal documents securely. NyaaySetu does not itself provide legal advice, legal representation, or court services.",
    },
    {
        title: "User Accounts",
        body: "Users must provide accurate account information and keep login credentials secure. NyaaySetu may suspend accounts that submit false information, misuse documents, attempt unauthorized access, or violate platform policies.",
    },
    {
        title: "Lawyer Profiles",
        body: "Lawyer profiles are manually reviewed using submitted Bar Council details and supporting documents. Approval on NyaaySetu is not a government endorsement and does not replace independent due diligence by clients.",
    },
    {
        title: "Payments",
        body: "The client connection fee is processed through Stripe. A lawyer can receive and accept a connection request only after payment has been verified by Stripe and recorded by NyaaySetu.",
    },
    {
        title: "Documents",
        body: "Users must upload only documents they are legally allowed to share. Uploaded files are stored privately, access is restricted to authorized case participants, and document access may be logged for audit and security.",
    },
    {
        title: "Limitations",
        body: "NyaaySetu is provided on an MVP basis and may change over time. To the maximum extent permitted by law, NyaaySetu is not liable for legal outcomes, lawyer advice, court delays, user-provided information, or third-party service outages.",
    },
]

export default function TermsPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Legal</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Terms of Service</h1>
            <p className="font-body text-sm text-muted-foreground mb-10">
                Last updated: July 2, 2026. These MVP terms should be reviewed by qualified legal counsel before a full public launch.
            </p>
            <div className="space-y-7">
                {sections.map((section) => (
                    <section key={section.title}>
                        <h2 className="font-serif-heading text-xl font-semibold text-primary mb-2">{section.title}</h2>
                        <p className="font-body text-sm leading-7 text-foreground/80">{section.body}</p>
                    </section>
                ))}
            </div>
        </main>
    )
}
