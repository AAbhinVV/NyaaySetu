"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

export default function ClientProfilePage() {
    const { user } = useUser()
    const profile = trpc.client.getMyProfile.useQuery()
    const connections = trpc.client.getMyConnections.useQuery({ status: "ACTIVE" })
    const updateProfile = trpc.client.updateMyProfile.useMutation({ onSuccess: () => { profile.refetch(); setEditing(false) } })

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ full_name: "", phone: "", city: "", state: "" })

    const p = profile.data
    const connList = connections.data ?? []

    const startEditing = () => {
        if (p) setForm({ full_name: p.full_name ?? "", phone: p.phone ?? "", city: p.city ?? "", state: p.state ?? "" })
        setEditing(true)
    }

    const handleSave = () => {
        updateProfile.mutate({
            full_name: form.full_name || undefined,
            phone: form.phone || undefined,
            city: form.city || undefined,
            state: form.state || undefined,
        })
    }

    if (profile.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading profile…</p></div>

    return (
        <div className="max-w-[960px]">
            <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight mb-6">My Profile</h1>

            {/* Profile Card */}
            <section className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h2 className="font-serif-heading text-xl font-semibold text-primary">{p?.full_name ?? "—"}</h2>
                        <p className="font-body text-sm text-muted-foreground mt-0.5">{user?.emailAddresses?.[0]?.emailAddress}</p>
                    </div>
                    {!editing && (
                        <button onClick={startEditing} className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer">Edit Profile</button>
                    )}
                </div>

                {editing ? (
                    <div className="space-y-4">
                        {[
                            { label: "Full Name", key: "full_name", placeholder: "Your full name" },
                            { label: "Phone", key: "phone", placeholder: "10-digit mobile number" },
                            { label: "City", key: "city", placeholder: "Your city" },
                            { label: "State", key: "state", placeholder: "Your state" },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">{f.label}</label>
                                <input
                                    value={form[f.key as keyof typeof form]}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder={f.placeholder}
                                    className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold border-none"
                                />
                            </div>
                        ))}
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={updateProfile.isPending} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-50">
                                {updateProfile.isPending ? "Saving…" : "Save Changes"}
                            </button>
                            <button onClick={() => setEditing(false)} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-surface-high transition-colors border-none cursor-pointer">Cancel</button>
                        </div>
                        {updateProfile.error && <p className="font-body text-sm text-destructive mt-2">{updateProfile.error.message}</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                        {[
                            { label: "Phone", value: p?.phone ?? "—" },
                            { label: "City", value: p?.city ?? "—" },
                            { label: "State", value: p?.state ?? "—" },
                            { label: "Member Since", value: p?.created_at ? new Date(p.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—" },
                        ].map(f => (
                            <div key={f.label}>
                                <p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider">{f.label}</p>
                                <p className="font-body text-sm font-medium text-foreground mt-px">{f.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Connected Lawyers */}
            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Connected Lawyers ({connList.length})</h2>
                {connList.length === 0 ? (
                    <div className="text-center py-10 bg-card rounded-xl shadow-lawyer">
                        <p className="font-body text-sm text-muted-foreground">No active connections yet.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                        {connList.map((c, i) => (
                            <div key={c.id} className={`flex items-center gap-4 px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                                <div className="w-10 h-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-body text-sm font-semibold text-foreground truncate">{firstRelation(c.lawyers)?.full_name ?? "Lawyer"}</p>
                                    <p className="font-body text-xs text-muted-foreground">{firstRelation(c.lawyers)?.city}, {firstRelation(c.lawyers)?.state} • {firstRelation(c.lawyers)?.specializations?.join(", ")}</p>
                                </div>
                                <span className="font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md bg-emerald/10 text-emerald shrink-0">Active</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
