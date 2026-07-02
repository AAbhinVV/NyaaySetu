export default function DisclaimerPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Disclaimer</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Legal Disclaimer</h1>
            <div className="space-y-6 font-body text-sm leading-7 text-foreground/80">
                <p>NyaaySetu is a technology platform for legal discovery, case workflow support, and document verification support. NyaaySetu does not provide legal advice, legal representation, or lawyer-client services directly.</p>
                <p>Any legal advice is provided only by independent advocates or legal professionals after they choose to engage with a client. Users should independently evaluate a lawyer&apos;s credentials, suitability, and advice.</p>
                <p>Blockchain document verification confirms that a stored hash matches a recorded hash. It does not prove that a document is legally valid, complete, admissible, or accepted by any court or authority.</p>
            </div>
        </main>
    )
}
