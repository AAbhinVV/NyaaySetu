"use client"

import { useState } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc/client"

export default function ClientSettingsPage() {
    const { user } = useUser()
    const profile = trpc.client.getMyProfile.useQuery()
    const updateProfile = trpc.client.updateMyProfile.useMutation({ onSuccess: () => { profile.refetch(); setEditing(false) } })

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ full_name: "", phone: "", city: "", state: "" })

    const p = profile.data

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
                        <p className="font-body text-base font-semibold text-foreground">{p?.full_name ?? user?.firstName ?? "User"}</p>
                        <p className="font-body text-sm text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
                    </div>
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
                    </div>
                ) : (
                    <div className="space-y-3">
                        {[
                            { label: "Phone", value: p?.phone ?? "Not set" },
                            { label: "City", value: p?.city ?? "Not set" },
                            { label: "State", value: p?.state ?? "Not set" },
                            { label: "Member Since", value: p?.created_at ? new Date(p.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—" },
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

            {/* Security Section */}
            <section className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                <h2 className="font-serif-heading text-lg font-semibold text-primary mb-4">Security</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Password</p>
                            <p className="font-body text-xs text-muted-foreground">Managed via your authentication provider</p>
                        </div>
                        <UserButton appearance={{ elements: { avatarBox: { display: "none" } } }} />
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Two-Factor Authentication</p>
                            <p className="font-body text-xs text-muted-foreground">Manage 2FA through your account provider</p>
                        </div>
                        <span className="font-body text-xs font-medium text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">Via Clerk</span>
                    </div>
                </div>
            </section>

            {/* Data & Privacy */}
            <section className="bg-card rounded-xl shadow-lawyer p-6">
                <h2 className="font-serif-heading text-lg font-semibold text-primary mb-4">Data & Privacy</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Document Encryption</p>
                            <p className="font-body text-xs text-muted-foreground">All documents are blockchain-verified and tamper-proof</p>
                        </div>
                        <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                            Active
                        </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <div>
                            <p className="font-body text-sm font-medium text-foreground">Blockchain Anchoring</p>
                            <p className="font-body text-xs text-muted-foreground">Evidence files anchored on Polygon for immutability</p>
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
