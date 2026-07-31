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
            const clientId = session.metadata?.clientId
            const lawyerId = session.metadata?.lawyerId
            const paymentIntentId =
                typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id ?? null

            if (!connectionId || !clientId || !lawyerId || !paymentIntentId) {
                console.error('Stripe webhook missing required metadata', {
                    sessionId: session.id,
                    connectionId,
                    lawyerId,
                })
                return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
            }

            const { data: existingPayment, error: existingError } = await supabase
                .from('payments')
                .select(`
                    id,
                    status,
                    amount,
                    currency,
                    connection_id,
                    client_id,
                    connections!inner(lawyer_id)
                `)
                .eq('stripe_session_id', session.id)
                .single()

            if (existingError || !existingPayment) {
                console.error('Stripe webhook payment row not found', existingError)
                return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
            }

            const connectionRelation = Array.isArray(existingPayment.connections)
                ? existingPayment.connections[0]
                : existingPayment.connections
            const sessionMatchesPayment =
                existingPayment.connection_id === connectionId &&
                existingPayment.client_id === clientId &&
                connectionRelation?.lawyer_id === lawyerId &&
                session.client_reference_id === connectionId &&
                session.amount_total === existingPayment.amount &&
                session.currency?.toUpperCase() === existingPayment.currency.toUpperCase()

            if (!sessionMatchesPayment) {
                console.error('Stripe webhook data did not match the local payment', {
                    sessionId: session.id,
                    connectionId,
                })
                return NextResponse.json({ error: 'Payment data mismatch' }, { status: 400 })
            }

            if (existingPayment.status !== 'CAPTURED') {
                const { error: paymentError } = await supabase
                    .from('payments')
                    .update({
                        status: 'CAPTURED',
                        stripe_payment_intent_id: paymentIntentId,
                    })
                    .eq('id', existingPayment.id)
                    .in('status', ['PENDING', 'FAILED'])

                if (paymentError) {
                    console.error('Failed to mark Stripe payment captured:', paymentError)
                    return NextResponse.json({ error: 'Payment update failed' }, { status: 500 })
                }
            }

            const { error: notificationError } = await supabase.from('notifications').upsert({
                user_id: lawyerId,
                type: 'CONNECTION_REQUEST',
                title: 'New paid connection request',
                body: 'A client has paid the connection fee and requested to connect with you.',
                case_id: null,
                dedupe_key: `stripe:${session.id}:connection-request`,
            }, { onConflict: 'dedupe_key', ignoreDuplicates: true })

            if (notificationError) {
                console.error('Failed to notify lawyer about captured payment:', notificationError)
                return NextResponse.json({ error: 'Notification failed' }, { status: 500 })
            }
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data.object as Stripe.Checkout.Session
            const { error: expirationError } = await supabase
                .from('payments')
                .update({ status: 'FAILED' })
                .eq('stripe_session_id', session.id)
                .eq('status', 'PENDING')

            if (expirationError) {
                return NextResponse.json({ error: 'Payment expiration update failed' }, { status: 500 })
            }
        }

        if (event.type === 'charge.refunded') {
            const charge = event.data.object as Stripe.Charge
            const paymentIntentId = typeof charge.payment_intent === 'string'
                ? charge.payment_intent
                : charge.payment_intent?.id

            if (paymentIntentId && charge.refunded) {
                const { error: refundUpdateError } = await supabase
                    .from('payments')
                    .update({ status: 'REFUNDED' })
                    .eq('stripe_payment_intent_id', paymentIntentId)

                if (refundUpdateError) {
                    return NextResponse.json({ error: 'Refund reconciliation failed' }, { status: 500 })
                }
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error) {
        console.error('Stripe webhook handler failed:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
