import Stripe from 'stripe'

// ─── Lazy-init Stripe instance ────────────────────────────────────────────────

let _stripe: Stripe | null = null

function getStripeInstance(): Stripe {
    if (!_stripe) {
        const secretKey = process.env.STRIPE_SECRET_KEY

        if (!secretKey) {
            throw new Error('Missing env var: STRIPE_SECRET_KEY')
        }

        _stripe = new Stripe(secretKey, {
            apiVersion: '2025-03-31.basil',
        })
    }
    return _stripe
}

// ─── Create Checkout Session ──────────────────────────────────────────────────

/** Create a Stripe Checkout session for the ₹499 connection fee. Amount in paise. */
export async function createStripeCheckoutSession(options: {
    amount: number              // in paise (49900 = ₹499)
    connectionId: string        // used as client_reference_id
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
}) {
    const stripe = getStripeInstance()

    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: options.connectionId,
        line_items: [
            {
                price_data: {
                    currency: 'inr',
                    unit_amount: options.amount,
                    product_data: {
                        name: 'Lawyer Connection Fee',
                        description: 'One-time fee to connect with a verified lawyer on Nyaya Setu',
                    },
                },
                quantity: 1,
            },
        ],
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        metadata: options.metadata ?? {},
    })

    return session
}

// ─── Verify Webhook Signature ─────────────────────────────────────────────────

/** Verify a Stripe webhook event using the webhook signing secret. */
export function verifyStripeWebhookSignature(params: {
    payload: string | Buffer
    signature: string
}): Stripe.Event {
    const stripe = getStripeInstance()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
        throw new Error('Missing env var: STRIPE_WEBHOOK_SECRET')
    }

    return stripe.webhooks.constructEvent(
        params.payload,
        params.signature,
        webhookSecret
    )
}

// ─── Retrieve Session ─────────────────────────────────────────────────────────

/** Retrieve a Checkout Session by ID (to confirm payment after redirect). */
export async function retrieveStripeSession(sessionId: string) {
    const stripe = getStripeInstance()
    return stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
    })
}
