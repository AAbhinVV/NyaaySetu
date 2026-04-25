import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import supabaseClient from "@/utils/supabase-client";


interface UserWebhookEvent {
    data: {
        id: string;
        username?: string | null;
        email_addresses?: Array<{ email_address: string }>;
        first_name?: string | null;
        last_name?: string | null;
        image_url?: string | null;
    };


}

export async function POST(req: NextRequest) {
    try {
        const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

        if (!WEBHOOK_SECRET) {
            throw new Error("CLERK_WEBHOOK_SIGNING_SECRET is not defined in environment variables");
        }

        const headerPayload = await headers();
        const svix_id = headerPayload.get("svix-id");
        const svix_timestamp = headerPayload.get("svix-timestamp");
        const svix_signature = headerPayload.get("svix-signature");

        if (!svix_id || !svix_timestamp || !svix_signature) {
            return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
        }

        const payload = await req.text();
        const wh = new Webhook(WEBHOOK_SECRET);

        let evt: WebhookEvent;

        try {
            evt = wh.verify(payload, {
                'svix-id': svix_id,
                'svix-timestamp': svix_timestamp,
                'svix-signature': svix_signature
            }) as WebhookEvent;
        } catch (err) {
            console.error("Failed to verify webhook:", err);
            return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
        }

        const eventType = evt.type;

        const { data: user } = evt as UserWebhookEvent;
        const email = user?.email_addresses?.[0]?.email_address || "No email";

        switch (eventType) {
            case "user.created": {
                const { error: userError } = await supabaseClient.from("userProfile").upsert({
                    id: user.id,
                    email_address: email,
                    first_name: user.first_name || null,
                    last_name: user.last_name || null,
                    username: user.username || null,
                    profile_image_url: user.image_url || null
                })
                if (userError) {
                    console.error("Failed to insert user into database:", userError);
                    return NextResponse.json({ error: "Failed to insert user into database" }, { status: 500 });
                }

                const { error: walletError } = await supabaseClient.from("wallets").insert({
                    user_id: user.id,
                    balance: 1000
                })
                if (walletError) {
                    console.error("Failed to create wallet for user:", walletError);
                    return NextResponse.json({ error: "Failed to create wallet" }, { status: 500 });
                }


                console.log('User created:', user.id);
                break;
            }
            case "user.updated": {
                const { error: userError } = await supabaseClient.from("userProfile").update({
                    email_address: email,
                    first_name: user.first_name || null,
                    last_name: user.last_name || null,
                    username: user.username || null,
                    profile_image_url: user.image_url || null
                }).eq("id", user.id);
                if (userError) {
                    console.error("Failed to update user in database:", userError);
                    return NextResponse.json({ error: "Failed to update user in database" }, { status: 500 });
                }
                console.log('User updated:', user.id);
                break;
            }

            case "user.deleted": {
                const { error: userError } = await supabaseClient.from("userProfile").delete()
                if (userError) {
                    console.error("Failed to delete user in database: ", userError);
                    return NextResponse.json({ error: "Failed to delete user from database" }, { status: 500 })
                }
            }

            default: {
                console.log(`Unhandled event type: ${eventType}`, user);
                break;
            }
        }

        return NextResponse.json("Webhook processed", { status: 200 });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: "Webhook error" }, { status: 400 });
    }

}