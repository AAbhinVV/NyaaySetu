"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

const CASE_CATEGORIES = ["CIVIL","CRIMINAL","PROPERTY","FAMILY","DIGITAL_CRIME","CONSUMER","LABOUR","CORPORATE"] as const
const COURT_LEVELS = ["DISTRICT","HIGH_COURT","SUPREME_COURT","TRIBUNAL","CONSUMER_FORUM"] as const
const LANGUAGES = ["Hindi","English","Bengali","Telugu","Marathi","Tamil","Gujarati","Urdu","Kannada","Malayalam","Odia","Punjabi"] as const

export default function LawyerProfilePage() {
    const profile = trpc.lawyer.getMyProfile.useQuery()
    const updateProfile = trpc.lawyer.updateProfile.useMutation({ onSuccess: () => { profile.refetch(); setEditing(false) } })
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState<Record<string, any>>({})

    const p = profile.data

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

    const toggle = (arr: string[], item: string) => arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item]

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

    if (profile.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading profile…</p></div>
    if (!p) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Profile not found. Complete onboarding first.</p></div>

    const vBadge = p.verified
        ? <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">✓ Verified</span>
        : <span className="flex items-center gap-1 font-body text-xs font-semibold text-gold bg-gold/10 px-2.5 py-1 rounded-md">⏳ Pending Verification</span>

    return (
        <div className="max-w-[960px]">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">My Profile</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">Manage your professional profile</p>
                </div>
                {vBadge}
            </div>

            {/* Stats Row */}
            <section className="grid grid-cols-4 max-md:grid-cols-2 gap-4 mb-6">
                {[
                    { val: p.avg_rating?.toFixed(1) ?? "—", label: `${p.review_count} Reviews`, color: "text-gold" },
                    { val: `${p.win_rate}%`, label: "Win Rate", color: "text-emerald" },
                    { val: p.total_cases, label: "Total Cases", color: "text-primary" },
                    { val: `₹${(p.fee_per_consultation / 100).toLocaleString("en-IN")}`, label: "Consult Fee", color: "text-primary" },
                ].map((s, i) => (
                    <div key={i} className="bg-card rounded-xl p-5 shadow-lawyer text-center">
                        <p className={`font-serif-heading text-2xl font-bold ${s.color}`}>{s.val}</p>
                        <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-1">{s.label}</p>
                    </div>
                ))}
            </section>

            {/* Profile Details */}
            <section className="bg-card rounded-xl shadow-lawyer p-6">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary">Profile Details</h2>
                    {!editing && <button onClick={startEditing} className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer">Edit</button>}
                </div>

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
                            <button onClick={handleSave} disabled={updateProfile.isPending} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-50">{updateProfile.isPending ? "Saving…" : "Save"}</button>
                            <button onClick={() => setEditing(false)} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-muted text-muted-foreground border-none cursor-pointer">Cancel</button>
                        </div>
                        {updateProfile.error && <p className="font-body text-sm text-destructive mt-2">{updateProfile.error.message}</p>}
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                            {[{ l: "Name", v: p.full_name }, { l: "Phone", v: p.phone }, { l: "City", v: p.city }, { l: "State", v: p.state }, { l: "Bar Council ID", v: p.bar_council_id }, { l: "Experience", v: `${p.years_of_experience} years` }].map(f => (
                                <div key={f.l}><p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider">{f.l}</p><p className="font-body text-sm font-medium text-foreground mt-px">{f.v ?? "—"}</p></div>
                            ))}
                        </div>
                        {p.bio && <div><p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider mb-1">Bio</p><p className="font-body text-sm text-foreground/80 leading-relaxed">{p.bio}</p></div>}
                        <div><p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider mb-1.5">Specializations</p><div className="flex flex-wrap gap-1.5">{(p.specializations ?? []).map((s: string) => <span key={s} className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary">{s}</span>)}</div></div>
                        <div><p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider mb-1.5">Court Levels</p><div className="flex flex-wrap gap-1.5">{(p.court_levels ?? []).map((c: string) => <span key={c} className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-gold/[0.06] text-[#96790C]">{c.replace(/_/g, " ")}</span>)}</div></div>
                        {p.languages_spoken?.length > 0 && <div><p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider mb-1">Languages</p><p className="font-body text-sm text-foreground">{p.languages_spoken.join(", ")}</p></div>}
                    </div>
                )}
            </section>
        </div>
    )
}
