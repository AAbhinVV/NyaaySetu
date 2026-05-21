import Link from "next/link"

export default function PricingPage() {
    return (
        <div className="max-w-[960px] mx-auto py-16 px-6">
            <section className="text-center mb-12">
                <h1 className="font-serif-heading text-[2.75rem] max-md:text-[2rem] font-bold text-primary tracking-tight">
                    Simple, Transparent Pricing
                </h1>
                <p className="font-body text-lg text-muted-foreground mt-4 max-w-[550px] mx-auto">
                    No subscriptions. No hidden fees. Pay only when you connect with a lawyer.
                </p>
            </section>

            {/* Pricing Card */}
            <section className="flex justify-center mb-16">
                <div className="bg-card rounded-2xl shadow-lawyer p-8 md:p-10 max-w-[480px] w-full relative overflow-hidden">
                    {/* Gold accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />

                    <div className="text-center mb-8">
                        <p className="font-body text-[0.6875rem] text-gold font-semibold uppercase tracking-wider mb-2">Connection Fee</p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="font-serif-heading text-[3.5rem] font-bold text-primary leading-none">₹499</span>
                            <span className="font-body text-sm text-muted-foreground">/connection</span>
                        </div>
                        <p className="font-body text-sm text-muted-foreground mt-2">One-time fee per lawyer connection</p>
                    </div>

                    <div className="space-y-3 mb-8">
                        {[
                            "Connect with a Bar Council-verified lawyer",
                            "End-to-end encrypted case communication",
                            "Blockchain-anchored document verification",
                            "Real-time case timeline & hearing updates",
                            "Secure document vault with access logs",
                            "Direct messaging with your counsel",
                            "Notification system for case milestones",
                        ].map((feat, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                <span className="font-body text-sm text-foreground">{feat}</span>
                            </div>
                        ))}
                    </div>

                    <Link href="/sign-up" className="block w-full text-center px-6 py-3 rounded-xl bg-primary-gradient text-white font-body text-base font-medium hover:shadow-lg transition-shadow">
                        Get Started
                    </Link>
                </div>
            </section>

            {/* Free for Lawyers */}
            <section className="mb-16">
                <div className="bg-card rounded-2xl shadow-lawyer p-8 md:p-10 text-center">
                    <div className="w-14 h-14 rounded-xl bg-emerald/[0.06] flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <h2 className="font-serif-heading text-2xl font-semibold text-primary mb-3">Free for Lawyers</h2>
                    <p className="font-body text-base text-muted-foreground max-w-[500px] mx-auto leading-relaxed mb-6">
                        Creating a lawyer profile, getting verified, accepting clients, managing cases, and using the document vault is
                        <span className="font-semibold text-emerald"> completely free</span>. NyaaySetu charges clients, not counsel.
                    </p>
                    <Link href="/sign-up" className="inline-block px-6 py-2.5 rounded-lg bg-emerald/10 text-[#226B4B] font-body text-sm font-semibold hover:bg-emerald/20 transition-colors">
                        Register as a Lawyer →
                    </Link>
                </div>
            </section>

            {/* FAQ */}
            <section>
                <h2 className="font-serif-heading text-[1.75rem] font-semibold text-primary mb-6 text-center">Frequently Asked Questions</h2>
                <div className="space-y-4 max-w-[700px] mx-auto">
                    {[
                        { q: "Why is there a connection fee?", a: "The ₹499 fee ensures that clients are serious about engaging legal help, and it covers the cost of our blockchain verification infrastructure. There are no recurring charges." },
                        { q: "What payment methods do you accept?", a: "We accept all major credit/debit cards, UPI, and net banking through our secure Stripe payment gateway." },
                        { q: "Can I get a refund?", a: "If your chosen lawyer declines your connection request, you can connect with another lawyer at no additional cost. Contact support for refund queries." },
                        { q: "Is there a subscription plan?", a: "No. NyaaySetu operates on a simple pay-per-connection model. No subscriptions, no monthly fees, no surprises." },
                    ].map((faq, i) => (
                        <div key={i} className="bg-card rounded-xl shadow-sm p-5">
                            <h3 className="font-body text-sm font-semibold text-foreground">{faq.q}</h3>
                            <p className="font-body text-sm text-muted-foreground mt-2 leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
