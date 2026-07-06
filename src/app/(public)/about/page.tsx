import Link from "next/link"

export default function AboutPage() {
    return (
        <div className="max-w-[960px] mx-auto py-16 px-6">
            {/* Hero */}
            <section className="text-center mb-16">
                <h1 className="font-serif-heading text-[2.75rem] max-md:text-[2rem] font-bold text-primary tracking-tight leading-tight">
                    Bridging Citizens to Justice
                </h1>
                <p className="font-body text-lg text-muted-foreground mt-4 max-w-[600px] mx-auto leading-relaxed">
                    NyaaySetu — <span className="text-gold font-medium">The Bridge of Justice</span> — is a blockchain-secured legal platform connecting citizens with manually reviewed lawyer profiles.
                </p>
            </section>

            {/* Mission */}
            <section className="mb-16">
                <div className="bg-card rounded-2xl shadow-lawyer p-8 md:p-10">
                    <h2 className="font-serif-heading text-2xl font-semibold text-primary mb-4">Our Mission</h2>
                    <p className="font-body text-base text-foreground/80 leading-relaxed">
                        India&apos;s legal system serves 1.4 billion people, yet access to quality legal counsel remains a privilege for the few.
                        NyaaySetu exists to change that — providing a transparent, blockchain-backed platform where every citizen can discover reviewed
                        lawyer profiles, manage cases securely, and verify document integrity.
                    </p>
                </div>
            </section>

            {/* Values */}
            <section className="mb-16">
                <h2 className="font-serif-heading text-[1.75rem] font-semibold text-primary mb-6">What We Stand For</h2>
                <div className="grid grid-cols-3 max-md:grid-cols-1 gap-6">
                    {[
                        {
                            title: "Transparency",
                            desc: "Lawyer profiles are manually reviewed from submitted Bar Council details and supporting proof. Ratings, win rates, and fees are publicly visible.",
                            icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",
                            icon2: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
                        },
                        {
                            title: "Security",
                            desc: "Documents are hashed with SHA-512 and anchored on the Polygon blockchain. Once filed, evidence cannot be altered.",
                            icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                        },
                        {
                            title: "Accessibility",
                            desc: "From district courts to the Supreme Court, NyaaySetu connects you with lawyers across every jurisdiction and specialization in India.",
                            icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
                            icon2: "M9 7a4 4 0 1 0 0-0.01",
                        },
                    ].map((v, i) => (
                        <div key={i} className="bg-card rounded-xl shadow-lawyer p-6 hover:shadow-lg transition-shadow">
                            <div className="w-11 h-11 rounded-lg bg-primary/[0.06] flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d={v.icon}/>{v.icon2 && <path d={v.icon2}/>}</svg>
                            </div>
                            <h3 className="font-serif-heading text-lg font-semibold text-primary mb-2">{v.title}</h3>
                            <p className="font-body text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Tech Stack */}
            <section className="mb-16">
                <h2 className="font-serif-heading text-[1.75rem] font-semibold text-primary mb-6">Built With</h2>
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                    {[
                        { name: "Next.js 16", desc: "Server-rendered React framework for speed and SEO" },
                        { name: "Supabase", desc: "PostgreSQL database with row-level security and real-time capabilities" },
                        { name: "Polygon Blockchain", desc: "Immutable document anchoring via smart contracts" },
                        { name: "Clerk", desc: "Enterprise-grade authentication with multi-factor support" },
                        { name: "tRPC", desc: "End-to-end type-safe API layer connecting frontend and backend" },
                        { name: "Stripe", desc: "Secure payment processing for lawyer connection fees" },
                    ].map((t, i) => (
                        <div key={i} className="flex items-start gap-3 bg-card rounded-xl p-4 shadow-sm">
                            <div className="w-2 h-2 rounded-full bg-gold mt-2 shrink-0" />
                            <div>
                                <p className="font-body text-sm font-semibold text-foreground">{t.name}</p>
                                <p className="font-body text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="text-center bg-card rounded-2xl shadow-lawyer p-10">
                <h2 className="font-serif-heading text-2xl font-semibold text-primary mb-3">Ready to Get Started?</h2>
                <p className="font-body text-sm text-muted-foreground mb-6">Join thousands of Indians who are finding legal help through NyaaySetu.</p>
                <div className="flex justify-center gap-3">
                    <Link href="/sign-up" className="px-6 py-2.5 rounded-lg bg-primary-gradient text-white font-body text-sm font-medium hover:shadow-lg transition-shadow">Create Account</Link>
                    <Link href="/lawyers" className="px-6 py-2.5 rounded-lg bg-muted text-foreground font-body text-sm font-medium hover:bg-surface-high transition-colors">Browse Lawyers</Link>
                </div>
            </section>
        </div>
    )
}
