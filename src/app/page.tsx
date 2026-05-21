import Link from "next/link"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center px-8 py-6 max-w-[1200px] mx-auto w-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/12 flex items-center justify-center shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="font-serif-heading text-xl font-bold text-primary leading-tight tracking-tight">NyaaySetu</h1>
                    </div>
                </div>
                <nav className="flex items-center gap-6 font-body text-sm font-medium">
                    <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About</Link>
                    <Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
                    <Link href="/lawyers" className="text-muted-foreground hover:text-primary transition-colors">Find a Lawyer</Link>
                    <Link href="/sign-in" className="px-5 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors">Sign In</Link>
                    <Link href="/sign-up" className="px-5 py-2 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow">Sign Up</Link>
                </nav>
            </header>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-[960px] mx-auto w-full">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 text-gold font-body text-xs font-semibold uppercase tracking-wider mb-8">
                    <span className="w-2 h-2 rounded-full bg-gold" />
                    India&apos;s First Blockchain Legal Platform
                </div>
                <h2 className="font-serif-heading text-[3.5rem] max-md:text-[2.5rem] font-bold text-primary tracking-tight leading-[1.1] mb-6">
                    Connect with Verified Lawyers.<br/>
                    Secure Your Legal Future.
                </h2>
                <p className="font-body text-lg text-muted-foreground max-w-[600px] mb-10 leading-relaxed">
                    NyaaySetu bridges the gap between citizens and justice. Find Bar Council-verified advocates, manage cases end-to-end, and store evidence on an immutable blockchain.
                </p>
                <div className="flex gap-4">
                    <Link href="/sign-up" className="px-8 py-3.5 rounded-xl bg-primary-gradient text-white font-body text-base font-medium hover:shadow-lg transition-shadow">
                        Get Started
                    </Link>
                    <Link href="/lawyers" className="px-8 py-3.5 rounded-xl bg-white text-primary border border-border font-body text-base font-medium hover:bg-surface-high transition-colors">
                        Browse Lawyers
                    </Link>
                </div>

                {/* Features */}
                <div className="grid grid-cols-3 max-md:grid-cols-1 gap-6 mt-24 text-left w-full">
                    {[
                        {
                            title: "Verified Counsel",
                            desc: "Every lawyer on NyaaySetu is verified against the Bar Council database, ensuring you get authentic legal advice.",
                            icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z",
                            icon2: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
                        },
                        {
                            title: "Blockchain Vault",
                            desc: "Your case documents and evidence are hashed and anchored on the Polygon blockchain, guaranteeing immutability.",
                            icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                        },
                        {
                            title: "Transparent Fees",
                            desc: "No hidden charges. Connect with any lawyer for a flat fee and manage all case-related payments securely.",
                            icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
                            icon2: "M9 7a4 4 0 1 0 0-0.01",
                        },
                    ].map((v, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-lawyer p-6">
                            <div className="w-11 h-11 rounded-lg bg-primary/[0.06] flex items-center justify-center mb-4">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d={v.icon}/>{v.icon2 && <path d={v.icon2}/>}</svg>
                            </div>
                            <h3 className="font-serif-heading text-lg font-semibold text-primary mb-2">{v.title}</h3>
                            <p className="font-body text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 border-t border-border text-center">
                <p className="font-body text-sm text-muted-foreground">© {new Date().getFullYear()} NyaaySetu. All rights reserved.</p>
            </footer>
        </div>
    )
}
