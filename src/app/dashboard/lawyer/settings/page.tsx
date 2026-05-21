"use client"

import { useState } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc/client"

const CASE_CATEGORIES = ["CIVIL","CRIMINAL","PROPERTY","FAMILY","DIGITAL_CRIME","CONSUMER","LABOUR","CORPORATE"] as const
const COURT_LEVELS = ["DISTRICT","HIGH_COURT","SUPREME_COURT","TRIBUNAL","CONSUMER_FORUM"] as const
const LANGUAGES = ["Hindi","English","Bengali","Telugu","Marathi","Tamil","Gujarati","Urdu","Kannada","Malayalam","Odia","Punjabi"] as const

export default function LawyerSettingsPage() {
    const { user } = useUser()
    const profile = trpc.lawyer.getMyProfile.useQuery()
    const updateProfile = trpc.lawyer.updateProfile.useMutation({ onSuccess: () => { profile.refetch(); setEditing(false) } })

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState<Record<string, any>>({})

    const p = profile.data

    const toggle = (arr: string[], item: string) => arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item]

    const startEditing = () => {
        if (!p) return
        setForm({
            fullName: p.full_name ?? "", bio: p.bio ?? "", city: p.city ?? "", state: p.state ?? "",
            phone: p.phone ?? "", specializations: [...(p.specializations ?? [])],
            courtLevels: [...(p.court_levels ?? [])], yearsOfExperience: p.years_of_experience ?? 0,
            feePerConsultation: p.fee_per_consultation ?? 0, languagesSpoken: [...(p.languages_spoken ?? [])],
        })
        setEditing(true)
    }

    const handleSave = () => {
        updateProfile.mutate({
            fullName: form.fullName || undefined, bio: form.bio || undefined,
            city: form.city || undefined, state: form.state || undefined, phone: form.phone || undefined,
            specializations: form.specializations?.length ? form.specializations : undefined,
            courtLevels: form.courtLevels?.length ? form.courtLevels : undefined,
            yearsOfExperience: form.yearsOfExperience ?? undefined,
            feePerConsultation: form.feePerConsultation ?? undefined,
            languagesSpoken: form.languagesSpoken?.length ? form.languagesSpoken : undefined,
        })
    }

    if (profile.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading settings…</p></div>

    return (
        <div className="max-w-[960px]">
            <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight mb-6">Settings</h1>

            {/* Account Section */}
            <section className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                <h2 className="font-serif-heading text-lg font-semibold text-primary mb-5">Account</h2>
                <div className="flex items-center gap-4 pb-5 border-b border-border mb-5">
                    <UserButton appearance={{ elements: { avatarBox: { width: 56, height: 56 } } }} />
                    <div>
                        <p className="font-body text-base font-semibold text-foreground">{p?.full_name ?? user?.firstName ?? "Lawyer"}</p>
                        <p className="font-body text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
                        <div className="flex items-center gap-2 mt-1">
                            {p?.verified ? (
                                <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2 py-0.5 rounded-md">✓ Verified</span>
                            ) : (
                                <span className="flex items-center gap-1 font-body text-xs font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-md">⏳ Pending</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Edit */}
                {editing ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                            {[{ l: "Full Name", k: "fullName" }, { l: "Phone", k: "phone" }, { l: "City", k: "city" }, { l: "State", k: "state" }].map(f => (
                                <div key={f.k}>
                                    <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">{f.l}</label>
                                    <input value={form[f.k] ?? ""} onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                                        className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold border-none" />
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Bio</label>
                            <textarea value={form.bio ?? ""} onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))} rows={3} maxLength={1000}
                                className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold resize-none border-none" />
                        </div>
                        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                            <div>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Years of Experience</label>
                                <input type="number" min={0} max={60} value={form.yearsOfExperience ?? 0} onChange={e => setForm(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold border-none" />
                            </div>
                            <div>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Consultation Fee (₹)</label>
                                <input type="number" min={0} value={(form.feePerConsultation ?? 0) / 100} onChange={e => setForm(prev => ({ ...prev, feePerConsultation: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                                    className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold border-none" />
                            </div>
                        </div>
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Specializations</label>
                            <div className="flex flex-wrap gap-1.5">
                                {CASE_CATEGORIES.map(c => (
                                    <button key={c} onClick={() => setForm(prev => ({ ...prev, specializations: toggle(prev.specializations, c) }))}
                                        className={`font-body text-[0.6875rem] font-medium px-2.5 py-1 rounded-md border-none cursor-pointer transition-all ${form.specializations?.includes(c) ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"}`}>{c}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Court Levels</label>
                            <div className="flex flex-wrap gap-1.5">
                                {COURT_LEVELS.map(c => (
                                    <button key={c} onClick={() => setForm(prev => ({ ...prev, courtLevels: toggle(prev.courtLevels, c) }))}
                                        className={`font-body text-[0.6875rem] font-medium px-2.5 py-1 rounded-md border-none cursor-pointer transition-all ${form.courtLevels?.includes(c) ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"}`}>{c.replace(/_/g, " ")}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Languages</label>
                            <div className="flex flex-wrap gap-1.5">
                                {LANGUAGES.map(l => (
                                    <button key={l} onClick={() => setForm(prev => ({ ...prev, languagesSpoken: toggle(prev.languagesSpoken, l) }))}
                                        className={`font-body text-[0.6875rem] font-medium px-2.5 py-1 rounded-md border-none cursor-pointer transition-all ${form.languagesSpoken?.includes(l) ? "bg-gold text-sidebar" : "bg-muted text-muted-foreground hover:bg-gold/10"}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={updateProfile.isPending} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-50">{updateProfile.isPending ? "Saving…" : "Save Changes"}</button>
                            <button onClick={() => setEditing(false)} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-muted text-muted-foreground border-none cursor-pointer">Cancel</button>
                        </div>
                        {updateProfile.error && <p className="font-body text-sm text-destructive mt-2">{updateProfile.error.message}</p>}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[
                            { label: "Phone", value: p?.phone ?? "Not set" },
                            { label: "City", value: p?.city ?? "Not set" },
                            { label: "State", value: p?.state ?? "Not set" },
                            { label: "Bar Council ID", value: p?.bar_council_id ?? "—" },
                            { label: "Experience", value: `${p?.years_of_experience ?? 0} years` },
                            { label: "Consultation Fee", value: `₹${((p?.fee_per_consultation ?? 0) / 100).toLocaleString("en-IN")}` },
                        ].map(f => (
                            <div key={f.label} className="flex justify-between items-center py-2">
                                <span className="font-body text-sm text-muted-foreground">{f.label}</span>
                                <span className="font-body text-sm font-medium text-foreground">{f.value}</span>
                            </div>
                        ))}
                        <button onClick={startEditing} className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer mt-2">Edit Profile</button>
                    </div>
                )}
            </section>

            {/* Security */}
            <section className="bg-card rounded-xl shadow-lawyer p-6">
                <h2 className="font-serif-heading text-lg font-semibold text-primary mb-4">Security & Privacy</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Password & 2FA</p>
                            <p className="font-body text-xs text-muted-foreground">Managed via Clerk authentication</p>
                        </div>
                        <span className="font-body text-xs font-medium text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">Via Clerk</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Document Encryption</p>
                            <p className="font-body text-xs text-muted-foreground">All case documents are blockchain-anchored</p>
                        </div>
                        <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                            Active
                        </span>
                    </div>
                </div>
            </section>
        </div>
    )
}
