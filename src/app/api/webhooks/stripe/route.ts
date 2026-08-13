import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyStripeWebhookSignature } from '@/lib/stripe'

export async function POST(req: NextRequest) {
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        const payload = await req.text()
        event = verifyStripeWebhookSignature({ payload, signature })
    } catch (error) {
        console.error('Stripe webhook signature verification failed:', error)
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session

            if (session.payment_status !== 'paid') {
                return NextResponse.json({ received: true }, { status: 200 })
            }

            const connectionId = session.metadata?.connectionId
            const lawyerId = session.metadata?.lawyerId
            const paymentIntentId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id ?? null

            if (!connectionId || !lawyerId) {
                console.error('Stripe webhook missing required metadata', {
                    sessionId: session.id,
                    connectionId,
                    lawyerId,
                })
                return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
            }

            const { data: existingPayment, error: existingError } = await supabase
                .from('payments')
                .select('id, status')
                .eq('stripe_session_id', session.id)
                .single()

            if (existingError || !existingPayment) {
                console.error('Stripe webhook payment row not found', existingError)
                return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
            }

            if (existingPayment.status !== 'CAPTURED') {
                const { error: paymentError } = await supabase
                    .from('payments')
                    .update({
                        status: 'CAPTURED',
                        stripe_payment_intent_id: paymentIntentId,
                    })
                    .eq('id', existingPayment.id)

                if (paymentError) {
                    console.error('Failed to mark Stripe payment captured:', paymentError)
                    return NextResponse.json({ error: 'Payment update failed' }, { status: 500 })
                }

                await supabase.from('notifications').insert({
                    user_id: lawyerId,
                    type: 'CONNECTION_REQUEST',
                    title: 'New paid connection request',
                    body: 'A client has paid the connection fee and requested to connect with you.',
                    case_id: null,
                })
            }
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data.object as Stripe.Checkout.Session
            const connectionId = session.metadata?.connectionId

            await supabase
                .from('payments')
                .update({ status: 'FAILED' })
                .eq('stripe_session_id', session.id)
                .eq('status', 'PENDING')

            if (connectionId) {
                await supabase
                    .from('connections')
                    .update({
                        status: 'DECLINED',
                        decline_reason: 'Payment session expired before completion',
                    })
                    .eq('id', connectionId)
                    .eq('status', 'PENDING')
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
        console.error('Stripe webhook handler failed:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
