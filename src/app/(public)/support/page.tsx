export default function SupportPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Support</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Grievance & Support</h1>
            <div className="space-y-6 font-body text-sm leading-7 text-foreground/80">
                <p>For MVP support, users can contact the NyaaySetu team for payment disputes, account issues, lawyer profile complaints, document access concerns, data correction, or deletion requests.</p>
                <div className="bg-card rounded-lg p-5 shadow-lawyer">
                    <p className="font-semibold text-primary">Support email</p>
                    <p>support@nyaaysetu.example</p>
                </div>
                <div className="bg-card rounded-lg p-5 shadow-lawyer">
                    <p className="font-semibold text-primary">Expected response time</p>
                    <p>We aim to acknowledge support and grievance requests within 3 business days during the MVP phase.</p>
                </div>
                <p>Before launch, replace the placeholder email with your real support/grievance contact and have counsel confirm whether you need a named grievance officer for your operating model.</p>
            </div>
        </main>
    )
}
