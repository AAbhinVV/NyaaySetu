"use client"

import { useState } from "react"
import { useUser, useSession } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh",
    "Puducherry", "Andaman & Nicobar", "Lakshadweep", "Dadra & Nagar Haveli"
] as const

const CASE_CATEGORIES = [
    { value: "CIVIL", label: "Civil" },
    { value: "CRIMINAL", label: "Criminal" },
    { value: "PROPERTY", label: "Property" },
    { value: "FAMILY", label: "Family" },
    { value: "DIGITAL_CRIME", label: "Digital Crime" },
    { value: "CONSUMER", label: "Consumer" },
    { value: "LABOUR", label: "Labour" },
    { value: "CORPORATE", label: "Corporate" },
] as const

const COURT_LEVELS = [
    { value: "DISTRICT", label: "District Court" },
    { value: "HIGH_COURT", label: "High Court" },
    { value: "SUPREME_COURT", label: "Supreme Court" },
    { value: "TRIBUNAL", label: "Tribunal" },
    { value: "CONSUMER_FORUM", label: "Consumer Forum" },
] as const

const LANGUAGES = [
    "Hindi", "English", "Bengali", "Telugu", "Marathi",
    "Tamil", "Gujarati", "Urdu", "Kannada", "Malayalam",
    "Odia", "Punjabi", "Assamese", "Maithili", "Sanskrit",
] as const

type Role = "CLIENT" | "LAWYER"
type Step = "role" | "details"

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const { isLoaded } = useUser()
    const { session } = useSession()
    const router = useRouter()

    // Flow state
    const [step, setStep] = useState<Step>("role")
    const [selectedRole, setSelectedRole] = useState<Role | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [clientConsent, setClientConsent] = useState(false)
    const [lawyerConsent, setLawyerConsent] = useState(false)

    // Client fields
    const [clientForm, setClientForm] = useState({
        fullName: "",
        phone: "",
        city: "",
        state: "",
    })

    // Lawyer fields
    type CaseCategoryValue = typeof CASE_CATEGORIES[number]["value"]
    type CourtLevelValue = typeof COURT_LEVELS[number]["value"]

    const [lawyerForm, setLawyerForm] = useState({
        fullName: "",
        phone: "",
        barCouncilId: "",
        stateBarCouncil: "",
        enrollmentYear: new Date().getFullYear(),
        verificationDocument: null as File | null,
        city: "",
        state: "",
        bio: "",
        specializations: [] as CaseCategoryValue[],
        courtLevels: [] as CourtLevelValue[],
        yearsOfExperience: 0,
        feePerConsultation: 49900, // ₹499 default in paise
        languagesSpoken: [] as string[],
    })

    // tRPC mutations
    const completeOnboarding = trpc.user.completeOnboarding.useMutation()

    const createLawyerProfile = trpc.lawyer.createProfile.useMutation()

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleRoleSelect = (role: Role) => {
        setSelectedRole(role)
        setStep("details")
        setError(null)
    }

    const handleBack = () => {
        setStep("role")
        setSelectedRole(null)
        setError(null)
    }

    const toggleArrayItem = <T extends string>(
        arr: T[],
        item: T,
        setter: (val: T[]) => void
    ) => {
        if (arr.includes(item)) {
            setter(arr.filter((v) => v !== item))
        } else {
            setter([...arr, item])
        }
    }

    const handleClientSubmit = async () => {
        setError(null)
        setIsSubmitting(true)

        try {
            // Validate
            if (!clientForm.fullName.trim() || clientForm.fullName.length < 2) {
                throw new Error("Full name must be at least 2 characters")
            }
            if (!/^[6-9]\d{9}$/.test(clientForm.phone)) {
                throw new Error("Enter a valid 10-digit Indian mobile number")
            }
            if (!clientForm.city.trim()) {
                throw new Error("City is required")
            }
            if (!clientForm.state) {
                throw new Error("State is required")
            }
            if (!clientConsent) {
                throw new Error("Please accept the Terms, Privacy Policy, and Legal Disclaimer")
            }

            // Save the profile first. The server derives the email from Clerk and
            // writes server-controlled role metadata only after validation.
            await completeOnboarding.mutateAsync({
                fullName: clientForm.fullName.trim(),
                phone: clientForm.phone,
                city: clientForm.city.trim(),
                state: clientForm.state,
                role: "CLIENT",
            })

            // 3. Reload Clerk session so the JWT token picks up the new role
            await session?.reload()

            // 4. Redirect to client dashboard
            router.push("/dashboard/client")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleLawyerSubmit = async () => {
        setError(null)
        setIsSubmitting(true)

        try {
            // Validate
            if (!lawyerForm.fullName.trim() || lawyerForm.fullName.length < 2) {
                throw new Error("Full name must be at least 2 characters")
            }
            if (!/^[6-9]\d{9}$/.test(lawyerForm.phone)) {
                throw new Error("Enter a valid 10-digit Indian mobile number")
            }
            if (!lawyerForm.barCouncilId.trim()) {
                throw new Error("Bar Council ID is required")
            }
            if (!lawyerForm.stateBarCouncil.trim()) {
                throw new Error("State Bar Council is required")
            }
            if (!lawyerForm.enrollmentYear || lawyerForm.enrollmentYear < 1900 || lawyerForm.enrollmentYear > new Date().getFullYear()) {
                throw new Error("Enter a valid enrolment year")
            }
            if (!lawyerForm.verificationDocument) {
                throw new Error("Upload Certificate of Practice or enrolment proof")
            }
            if (!lawyerForm.city.trim()) {
                throw new Error("City is required")
            }
            if (!lawyerForm.state) {
                throw new Error("State is required")
            }
            if (lawyerForm.specializations.length === 0) {
                throw new Error("Select at least one specialization")
            }
            if (lawyerForm.courtLevels.length === 0) {
                throw new Error("Select at least one court level")
            }
            if (!lawyerConsent) {
                throw new Error("Please confirm the lawyer declaration and verification policy")
            }

            // Save the base profile using the server-authoritative role.
            await completeOnboarding.mutateAsync({
                fullName: lawyerForm.fullName.trim(),
                phone: lawyerForm.phone,
                city: lawyerForm.city.trim(),
                state: lawyerForm.state,
                role: "LAWYER",
            })

            const verificationFormData = new FormData()
            verificationFormData.append("file", lawyerForm.verificationDocument)
            const verificationUpload = await fetch("/api/lawyers/verification-document", {
                method: "POST",
                body: verificationFormData,
            })
            const verificationData = await verificationUpload.json()

            if (!verificationUpload.ok) {
                throw new Error(verificationData.error || "Failed to upload verification document")
            }

            // 3. Create lawyer profile
            await createLawyerProfile.mutateAsync({
                fullName: lawyerForm.fullName.trim(),
                phone: lawyerForm.phone,
                barCouncilId: lawyerForm.barCouncilId.trim(),
                stateBarCouncil: lawyerForm.stateBarCouncil.trim(),
                enrollmentYear: lawyerForm.enrollmentYear,
                verificationDocumentUrl: verificationData.storagePath,
                city: lawyerForm.city.trim(),
                state: lawyerForm.state,
                bio: lawyerForm.bio.trim() || undefined,
                specializations: lawyerForm.specializations,
                courtLevels: lawyerForm.courtLevels,
                yearsOfExperience: lawyerForm.yearsOfExperience,
                feePerConsultation: lawyerForm.feePerConsultation,
                languagesSpoken: lawyerForm.languagesSpoken.length > 0
                    ? lawyerForm.languagesSpoken
                    : undefined,
            })

            // 4. Reload Clerk session so the JWT token picks up the new role
            await session?.reload()

            // 5. Redirect to lawyer dashboard
            router.push("/dashboard/lawyer")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Loading state ─────────────────────────────────────────────────────────

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8F6F1]">
                <div className="animate-pulse text-[#4A5568] font-body text-lg">Loading...</div>
            </div>
        )
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#F8F6F1] flex flex-col items-center justify-center px-4 py-12">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-[#1B2A4A] mb-2">
                    NyaaySetu
                </h1>
                <p className="text-[#4A5568] font-body text-lg">
                    {step === "role"
                        ? "Welcome! Let\u2019s set up your account."
                        : selectedRole === "CLIENT"
                            ? "Tell us about yourself"
                            : "Set up your lawyer profile"
                    }
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="w-full max-w-lg mb-4 p-3 bg-red-50 border border-red-200 rounded-card text-red-700 text-sm font-body">
                    {error}
                </div>
            )}

            {/* ── Step 1: Role Selection ───────────────────────────────────── */}
            {step === "role" && (
                <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                    <RoleCard
                        title="I'm a Client"
                        description="Find manually reviewed lawyer profiles, connect for a flat ₹499 fee, and manage your cases digitally."
                        icon="👤"
                        onClick={() => handleRoleSelect("CLIENT")}
                    />
                    <RoleCard
                        title="I'm a Lawyer"
                        description="Get discovered by clients, manage cases, and build your digital reputation."
                        icon="⚖️"
                        onClick={() => handleRoleSelect("LAWYER")}
                    />
                </div>
            )}

            {/* ── Step 2: Client Details ───────────────────────────────────── */}
            {step === "details" && selectedRole === "CLIENT" && (
                <Card className="w-full max-w-lg border-[#E2E0D9] shadow-card bg-white">
                    <CardHeader>
                        <CardTitle className="font-heading text-2xl text-[#1B2A4A]">
                            Client Profile
                        </CardTitle>
                        <CardDescription className="text-[#4A5568]">
                            Basic information to get started
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FormField label="Full Name" required>
                            <Input
                                id="client-fullName"
                                placeholder="e.g. Priya Sharma"
                                value={clientForm.fullName}
                                onChange={(e) => setClientForm({ ...clientForm, fullName: e.target.value })}
                                className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                            />
                        </FormField>

                        <FormField label="Phone Number" required>
                            <Input
                                id="client-phone"
                                placeholder="e.g. 9876543210"
                                maxLength={10}
                                value={clientForm.phone}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "")
                                    setClientForm({ ...clientForm, phone: val })
                                }}
                                className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                            />
                        </FormField>

                        <FormField label="City" required>
                            <Input
                                id="client-city"
                                placeholder="e.g. Mumbai"
                                value={clientForm.city}
                                onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                                className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                            />
                        </FormField>

                        <FormField label="State" required>
                            <select
                                id="client-state"
                                value={clientForm.state}
                                onChange={(e) => setClientForm({ ...clientForm, state: e.target.value })}
                                className="w-full h-10 px-3 rounded-button border border-[#E2E0D9] bg-white text-sm text-[#1C1C2E] font-body focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:ring-offset-1"
                            >
                                <option value="">Select state</option>
                                {INDIAN_STATES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </FormField>

                        <label className="flex items-start gap-3 rounded-lg border border-[#E2E0D9] bg-[#FBF9F4] p-3 text-sm text-[#4A5568]">
                            <input
                                type="checkbox"
                                checked={clientConsent}
                                onChange={(e) => setClientConsent(e.target.checked)}
                                className="mt-1"
                            />
                            <span>
                                I agree to the <Link href="/terms" className="text-[#1B2A4A] underline">Terms</Link>, <Link href="/privacy" className="text-[#1B2A4A] underline">Privacy Policy</Link>, and <Link href="/disclaimer" className="text-[#1B2A4A] underline">Legal Disclaimer</Link>. I understand NyaaySetu connects users with independent legal professionals and does not provide legal advice directly.
                            </span>
                        </label>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="flex-1 border-[#1B2A4A] text-[#1B2A4A] hover:bg-[#1B2A4A]/5"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleClientSubmit}
                                disabled={isSubmitting || !clientConsent}
                                className="flex-1 bg-[#1B2A4A] text-white hover:bg-[#243760]"
                            >
                                {isSubmitting ? "Setting up..." : "Continue"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Step 2: Lawyer Details ───────────────────────────────────── */}
            {step === "details" && selectedRole === "LAWYER" && (
                <Card className="w-full max-w-2xl border-[#E2E0D9] shadow-card bg-white">
                    <CardHeader>
                        <CardTitle className="font-heading text-2xl text-[#1B2A4A]">
                            Lawyer Profile
                        </CardTitle>
                        <CardDescription className="text-[#4A5568]">
                            Your profile will be reviewed for verification before going live
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Row 1: Name + Phone */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Full Name" required>
                                <Input
                                    id="lawyer-fullName"
                                    placeholder="e.g. Adv. Rajesh Kumar"
                                    value={lawyerForm.fullName}
                                    onChange={(e) => setLawyerForm({ ...lawyerForm, fullName: e.target.value })}
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>

                            <FormField label="Phone Number" required>
                                <Input
                                    id="lawyer-phone"
                                    placeholder="e.g. 9876543210"
                                    maxLength={10}
                                    value={lawyerForm.phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "")
                                        setLawyerForm({ ...lawyerForm, phone: val })
                                    }}
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>
                        </div>

                        {/* Bar Council ID */}
                        <FormField label="Bar Council ID" required hint="e.g. MH/1234/2019">
                            <Input
                                id="lawyer-barCouncilId"
                                placeholder="MH/1234/2019"
                                value={lawyerForm.barCouncilId}
                                onChange={(e) => setLawyerForm({ ...lawyerForm, barCouncilId: e.target.value })}
                                className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                            />
                        </FormField>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="State Bar Council" required hint="e.g. Bar Council of Maharashtra & Goa">
                                <Input
                                    id="lawyer-stateBarCouncil"
                                    placeholder="State Bar Council name"
                                    value={lawyerForm.stateBarCouncil}
                                    onChange={(e) => setLawyerForm({ ...lawyerForm, stateBarCouncil: e.target.value })}
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>

                            <FormField label="Enrolment Year" required>
                                <Input
                                    id="lawyer-enrollmentYear"
                                    type="number"
                                    min={1900}
                                    max={new Date().getFullYear()}
                                    value={lawyerForm.enrollmentYear || ""}
                                    onChange={(e) =>
                                        setLawyerForm({
                                            ...lawyerForm,
                                            enrollmentYear: parseInt(e.target.value) || new Date().getFullYear(),
                                        })
                                    }
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>
                        </div>

                        <FormField label="Certificate of Practice / Enrolment Proof" required hint="PDF, DOC, DOCX, JPG, PNG, or WEBP up to 5MB">
                            <Input
                                id="lawyer-verificationDocument"
                                type="file"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => setLawyerForm({ ...lawyerForm, verificationDocument: e.target.files?.[0] ?? null })}
                                className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                            />
                            {lawyerForm.verificationDocument && (
                                <p className="text-xs text-[#718096] mt-1">
                                    Selected: {lawyerForm.verificationDocument.name}
                                </p>
                            )}
                        </FormField>

                        {/* Row 2: City + State */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="City" required>
                                <Input
                                    id="lawyer-city"
                                    placeholder="e.g. Delhi"
                                    value={lawyerForm.city}
                                    onChange={(e) => setLawyerForm({ ...lawyerForm, city: e.target.value })}
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>

                            <FormField label="State" required>
                                <select
                                    id="lawyer-state"
                                    value={lawyerForm.state}
                                    onChange={(e) => setLawyerForm({ ...lawyerForm, state: e.target.value })}
                                    className="w-full h-10 px-3 rounded-button border border-[#E2E0D9] bg-white text-sm text-[#1C1C2E] font-body focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:ring-offset-1"
                                >
                                    <option value="">Select state</option>
                                    {INDIAN_STATES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>

                        {/* Specializations — multi-select chips */}
                        <FormField label="Specializations" required hint="Select at least one">
                            <div className="flex flex-wrap gap-2">
                                {CASE_CATEGORIES.map((cat) => {
                                    const selected = lawyerForm.specializations.includes(cat.value)
                                    return (
                                        <Badge
                                            key={cat.value}
                                            variant={selected ? "default" : "outline"}
                                            className={`cursor-pointer select-none transition-all duration-200 ${selected
                                                ? "bg-[#1B2A4A] text-white hover:bg-[#243760] border-[#1B2A4A]"
                                                : "border-[#E2E0D9] text-[#4A5568] hover:border-[#1B2A4A] hover:text-[#1B2A4A]"
                                                }`}
                                            onClick={() =>
                                                toggleArrayItem(
                                                    lawyerForm.specializations,
                                                    cat.value,
                                                    (v) => setLawyerForm({ ...lawyerForm, specializations: v })
                                                )
                                            }
                                        >
                                            {cat.label}
                                        </Badge>
                                    )
                                })}
                            </div>
                        </FormField>

                        {/* Court Levels — multi-select chips */}
                        <FormField label="Court Levels" required hint="Select at least one">
                            <div className="flex flex-wrap gap-2">
                                {COURT_LEVELS.map((cl) => {
                                    const selected = lawyerForm.courtLevels.includes(cl.value)
                                    return (
                                        <Badge
                                            key={cl.value}
                                            variant={selected ? "default" : "outline"}
                                            className={`cursor-pointer select-none transition-all duration-200 ${selected
                                                ? "bg-[#2D3F6B] text-white hover:bg-[#1B2A4A] border-[#2D3F6B]"
                                                : "border-[#E2E0D9] text-[#4A5568] hover:border-[#2D3F6B] hover:text-[#2D3F6B]"
                                                }`}
                                            onClick={() =>
                                                toggleArrayItem(
                                                    lawyerForm.courtLevels,
                                                    cl.value,
                                                    (v) => setLawyerForm({ ...lawyerForm, courtLevels: v })
                                                )
                                            }
                                        >
                                            {cl.label}
                                        </Badge>
                                    )
                                })}
                            </div>
                        </FormField>

                        {/* Row 3: Experience + Fee */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Years of Experience" required>
                                <Input
                                    id="lawyer-experience"
                                    type="number"
                                    min={0}
                                    max={60}
                                    placeholder="e.g. 5"
                                    value={lawyerForm.yearsOfExperience || ""}
                                    onChange={(e) =>
                                        setLawyerForm({
                                            ...lawyerForm,
                                            yearsOfExperience: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>

                            <FormField label="Consultation Fee (₹)" required hint="Default: ₹499">
                                <Input
                                    id="lawyer-fee"
                                    type="number"
                                    min={0}
                                    placeholder="499"
                                    value={lawyerForm.feePerConsultation / 100 || ""}
                                    onChange={(e) =>
                                        setLawyerForm({
                                            ...lawyerForm,
                                            feePerConsultation: Math.round((parseFloat(e.target.value) || 0) * 100),
                                        })
                                    }
                                    className="border-[#E2E0D9] focus-visible:ring-[#C9A84C]"
                                />
                            </FormField>
                        </div>

                        {/* Languages — multi-select chips */}
                        <FormField label="Languages Spoken" hint="Optional">
                            <div className="flex flex-wrap gap-2">
                                {LANGUAGES.map((lang) => {
                                    const selected = lawyerForm.languagesSpoken.includes(lang)
                                    return (
                                        <Badge
                                            key={lang}
                                            variant={selected ? "default" : "outline"}
                                            className={`cursor-pointer select-none transition-all duration-200 text-xs ${selected
                                                ? "bg-[#C9A84C] text-[#1B2A4A] hover:bg-[#B8953F] border-[#C9A84C]"
                                                : "border-[#E2E0D9] text-[#718096] hover:border-[#C9A84C] hover:text-[#C9A84C]"
                                                }`}
                                            onClick={() =>
                                                toggleArrayItem(
                                                    lawyerForm.languagesSpoken,
                                                    lang,
                                                    (v) => setLawyerForm({ ...lawyerForm, languagesSpoken: v })
                                                )
                                            }
                                        >
                                            {lang}
                                        </Badge>
                                    )
                                })}
                            </div>
                        </FormField>

                        {/* Bio */}
                        <FormField label="Bio" hint="Optional — max 1000 characters">
                            <textarea
                                id="lawyer-bio"
                                rows={3}
                                maxLength={1000}
                                placeholder="Tell clients about your practice, experience, and areas of expertise..."
                                value={lawyerForm.bio}
                                onChange={(e) => setLawyerForm({ ...lawyerForm, bio: e.target.value })}
                                className="w-full px-3 py-2 rounded-button border border-[#E2E0D9] bg-white text-sm text-[#1C1C2E] font-body placeholder:text-[#718096] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:ring-offset-1 resize-none"
                            />
                            <p className="text-xs text-[#718096] mt-1 text-right">
                                {lawyerForm.bio.length}/1000
                            </p>
                        </FormField>

                        <label className="flex items-start gap-3 rounded-lg border border-[#E2E0D9] bg-[#FBF9F4] p-3 text-sm text-[#4A5568]">
                            <input
                                type="checkbox"
                                checked={lawyerConsent}
                                onChange={(e) => setLawyerConsent(e.target.checked)}
                                className="mt-1"
                            />
                            <span>
                                I confirm that my Bar Council details and profile information are true and accurate. I understand NyaaySetu performs manual profile review, not official automated Bar Council verification, and false submissions may lead to rejection or suspension. I agree to the <Link href="/lawyer-verification-policy" className="text-[#1B2A4A] underline">Lawyer Verification Policy</Link>.
                            </span>
                        </label>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                className="flex-1 border-[#1B2A4A] text-[#1B2A4A] hover:bg-[#1B2A4A]/5"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleLawyerSubmit}
                                disabled={isSubmitting || !lawyerConsent}
                                className="flex-1 bg-[#1B2A4A] text-white hover:bg-[#243760]"
                            >
                                {isSubmitting ? "Setting up..." : "Submit for Verification"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Footer note */}
            <p className="text-xs text-[#718096] mt-8 text-center max-w-md">
                By continuing, you agree to NyaaySetu&apos;s Terms of Service and Privacy Policy.
                {selectedRole === "LAWYER" && " Your profile will be manually reviewed before it goes live."}
            </p>
        </div>
    )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleCard({
    title,
    description,
    icon,
    onClick,
}: {
    title: string
    description: string
    icon: string
    onClick: () => void
}) {
    return (
        <Card
            onClick={onClick}
            className="cursor-pointer border-[#E2E0D9] bg-white shadow-card hover:shadow-card-hover hover:border-[#C9A84C] transition-all duration-200 group"
        >
            <CardContent className="p-8 text-center">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    {icon}
                </div>
                <h2 className="font-heading text-2xl font-bold text-[#1B2A4A] mb-2">
                    {title}
                </h2>
                <p className="text-[#4A5568] font-body text-sm leading-relaxed">
                    {description}
                </p>
                <div className="mt-6">
                    <span className="inline-block px-4 py-2 bg-[#1B2A4A] text-white text-sm font-medium rounded-button group-hover:bg-[#243760] transition-colors duration-200">
                        Select
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}

function FormField({
    label,
    required,
    hint,
    children,
}: {
    label: string
    required?: boolean
    hint?: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium text-[#1C1C2E] font-body">
                {label}
                {required && <span className="text-[#C53030] ml-0.5">*</span>}
            </Label>
            {hint && (
                <p className="text-xs text-[#718096]">{hint}</p>
            )}
            {children}
        </div>
    )
}
