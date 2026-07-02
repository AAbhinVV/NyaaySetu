const rules = [
    "If payment succeeds but the lawyer rejects the request, the client may request a refund or choose another lawyer where supported.",
    "If payment succeeds but the lawyer does not respond within the stated review window, the client may contact support for resolution.",
    "Once a lawyer accepts the request and a case is created, the connection fee is generally non-refundable.",
    "Duplicate or failed charges will be reviewed against Stripe records and refunded where applicable.",
    "Approved refunds may take 5-10 business days depending on payment provider and bank timelines.",
]

export default function RefundPolicyPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Payments</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Refund & Cancellation Policy</h1>
            <p className="font-body text-sm text-muted-foreground mb-8">The ₹499 fee is a one-time lawyer connection fee processed through Stripe.</p>
            <ul className="space-y-4">
                {rules.map((rule) => (
                    <li key={rule} className="font-body text-sm leading-7 text-foreground/80 bg-card rounded-lg p-4 shadow-lawyer">{rule}</li>
                ))}
            </ul>
        </main>
    )
}
