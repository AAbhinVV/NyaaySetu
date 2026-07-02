export default function LawyerVerificationPolicyPage() {
    return (
        <main className="max-w-[820px] mx-auto px-6 py-14">
            <p className="font-body text-xs font-semibold text-gold uppercase tracking-wider mb-3">Trust</p>
            <h1 className="font-serif-heading text-4xl font-bold text-primary tracking-tight mb-4">Lawyer Verification Policy</h1>
            <div className="space-y-6 font-body text-sm leading-7 text-foreground/80">
                <p>For the MVP, NyaaySetu manually reviews lawyer profiles using submitted Bar Council enrolment details and supporting documents. We do not claim automated or official Bar Council database verification unless such an integration is formally implemented.</p>
                <p>Lawyers may be asked to submit their full legal name, Bar Council enrolment number, State Bar Council, year of enrolment, Certificate of Practice or enrolment proof, practice areas, court levels, city, and contact details.</p>
                <p>Admin review may result in approval, rejection, or a request for more information. False or misleading submissions may lead to rejection, suspension, removal, or reporting to appropriate authorities where legally required.</p>
                <p>A reviewed profile badge means NyaaySetu has reviewed the submitted information. It is not a government endorsement and does not guarantee case outcome, skill level, or professional suitability.</p>
            </div>
        </main>
    )
}
