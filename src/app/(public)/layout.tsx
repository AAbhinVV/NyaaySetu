import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "NyaaySetu — India's First Blockchain Legal Platform",
    description:
        "Find verified lawyers, manage cases digitally, and secure documents with blockchain. Transparent fees, real reviews, real justice.",
}

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#FBF9F4] flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center px-8 max-md:px-5 py-5 max-w-[1200px] mx-auto w-full">
                <Link href="/" className="flex items-center gap-3 no-underline">
                    <div className="w-10 h-10 rounded-lg bg-gold/12 flex items-center justify-center shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                    <h1 className="font-serif-heading text-xl font-bold text-primary leading-tight tracking-tight">
                        NyaaySetu
                    </h1>
                </Link>
                <nav className="flex items-center gap-6 max-md:gap-3 font-body text-sm font-medium">
                    <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors max-md:hidden">
                        About
                    </Link>
                    <Link href="/pricing" className="text-muted-foreground hover:text-primary transition-colors max-md:hidden">
                        Pricing
                    </Link>
                    <Link href="/lawyers" className="text-muted-foreground hover:text-primary transition-colors">
                        Find a Lawyer
                    </Link>
                    <Link
                        href="/sign-in"
                        className="px-5 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/sign-up"
                        className="px-5 py-2 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow max-md:hidden"
                    >
                        Sign Up
                    </Link>
                </nav>
            </header>

            {/* Page Content */}
            <main className="flex-1">{children}</main>

            {/* Footer */}
            <footer className="border-t border-border/50 bg-[#F5F3EE]">
                <div className="max-w-[1200px] mx-auto px-8 max-md:px-5 py-10">
                    <div className="grid grid-cols-4 max-md:grid-cols-2 gap-8 mb-8">
                        {/* Brand */}
                        <div className="max-md:col-span-2">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-md bg-gold/12 flex items-center justify-center">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <span className="font-serif-heading text-base font-bold text-primary">NyaaySetu</span>
                            </div>
                            <p className="font-body text-xs text-muted-foreground/70 leading-relaxed max-w-[240px]">
                                India&apos;s first blockchain-secured legal platform bridging citizens to verified counsel.
                            </p>
                        </div>

                        {/* Platform */}
                        <div>
                            <h4 className="font-body text-[0.6875rem] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">Platform</h4>
                            <div className="flex flex-col gap-2">
                                <Link href="/lawyers" className="font-body text-sm text-muted-foreground hover:text-primary transition-colors">Find a Lawyer</Link>
                                <Link href="/pricing" className="font-body text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link>
                                <Link href="/about" className="font-body text-sm text-muted-foreground hover:text-primary transition-colors">About Us</Link>
                            </div>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="font-body text-[0.6875rem] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-3">Legal</h4>
                            <div className="flex flex-col gap-2">
                                <span className="font-body text-sm text-muted-foreground/50">Terms of Service</span>
                                <span className="font-body text-sm text-muted-foreground/50">Privacy Policy</span>
                                <span className="font-body text-sm text-muted-foreground/50">Refund Policy</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-border/50 pt-6 flex max-md:flex-col justify-between items-center gap-3">
                        <p className="font-body text-xs text-muted-foreground/50">
                            © {new Date().getFullYear()} NyaaySetu. All rights reserved.
                        </p>
                        <p className="font-body text-xs text-muted-foreground/50">
                            Secured by Polygon Blockchain
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
