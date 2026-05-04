import { Webhook } from "svix"
import { WebhookEvent } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

// ─── POST /api/webhooks/clerk ─────────────────────────────────────────────────
// Handles Clerk user lifecycle events and syncs to Supabase `users` table.
// Uses the service-role client to bypass RLS (this is a server-to-server call).

export async function POST(req: NextRequest) {
    try {
        const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

        if (!WEBHOOK_SECRET) {
            console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set")
            return NextResponse.json(
                { error: "Server misconfiguration" },
                { status: 500 }
            )
        }

        // ── Verify Svix signature ─────────────────────────────────────────
        const headerPayload = await headers()
        const svix_id = headerPayload.get("svix-id")
        const svix_timestamp = headerPayload.get("svix-timestamp")
        const svix_signature = headerPayload.get("svix-signature")

        if (!svix_id || !svix_timestamp || !svix_signature) {
            return NextResponse.json(
                { error: "Missing Svix headers" },
                { status: 400 }
            )
        }

        const payload = await req.text()
        const wh = new Webhook(WEBHOOK_SECRET)

        let evt: WebhookEvent
        try {
            evt = wh.verify(payload, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }) as WebhookEvent
        } catch (err) {
            console.error("Clerk webhook signature verification failed:", err)
            return NextResponse.json(
                { error: "Invalid webhook signature" },
                { status: 400 }
            )
        }

        // ── Create service-role Supabase client (bypasses RLS) ────────────
        const supabase = createServiceRoleClient()
        const eventType = evt.type

        switch (eventType) {
            // ── user.created ──────────────────────────────────────────────
            case "user.created": {
                const { id: clerkUserId, email_addresses, first_name, last_name } = evt.data
                const email = email_addresses?.[0]?.email_address
                const fullName = [first_name, last_name].filter(Boolean).join(" ") || "User"

                if (!email) {
                    console.error("Clerk user.created: no email address found", clerkUserId)
                    return NextResponse.json(
                        { error: "No email address in webhook payload" },
                        { status: 400 }
                    )
                }

                const { error } = await supabase.from("users").insert({
                    clerk_user_id: clerkUserId,
                    email: email,
                    full_name: fullName,
                    role: "CLIENT", // default role; updated during onboarding
                })

                if (error) {
                    // Handle duplicate — Clerk may re-fire the event
                    if (error.code === "23505") {
                        console.warn("Clerk user.created: duplicate ignored", clerkUserId)
                        break
                    }
                    console.error("Failed to insert user:", error)
                    return NextResponse.json(
                        { error: "Database insert failed" },
                        { status: 500 }
                    )
                }

                console.log("User created in Supabase:", clerkUserId)
                break
            }

            // ── user.updated ──────────────────────────────────────────────
            case "user.updated": {
                const { id: clerkUserId, email_addresses, first_name, last_name } = evt.data
                const email = email_addresses?.[0]?.email_address
                const fullName = [first_name, last_name].filter(Boolean).join(" ")

                const updatePayload: Record<string, unknown> = {}
                if (email) updatePayload.email = email
                if (fullName) updatePayload.full_name = fullName

                if (Object.keys(updatePayload).length === 0) {
                    console.log("Clerk user.updated: no relevant fields changed", clerkUserId)
                    break
                }

                const { error } = await supabase
                    .from("users")
                    .update(updatePayload)
                    .eq("clerk_user_id", clerkUserId)

                if (error) {
                    console.error("Failed to update user:", error)
                    return NextResponse.json(
                        { error: "Database update failed" },
                        { status: 500 }
                    )
                }

                console.log("User updated in Supabase:", clerkUserId)
                break
            }

            // ── user.deleted ──────────────────────────────────────────────
            case "user.deleted": {
                const clerkUserId = evt.data.id

                if (!clerkUserId) {
                    console.error("Clerk user.deleted: no user ID in payload")
                    return NextResponse.json(
                        { error: "Missing user ID" },
                        { status: 400 }
                    )
                }

                // CASCADE on users.id handles lawyers, connections, cases, etc.
                const { error } = await supabase
                    .from("users")
                    .delete()
                    .eq("clerk_user_id", clerkUserId)

                if (error) {
                    console.error("Failed to delete user:", error)
                    return NextResponse.json(
                        { error: "Database delete failed" },
                        { status: 500 }
                    )
                }

                console.log("User deleted from Supabase:", clerkUserId)
                break
            }

            default: {
                console.log(`Clerk webhook: unhandled event type "${eventType}"`)
                break
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
        console.error("Clerk webhook unexpected error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}