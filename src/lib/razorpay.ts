import Razorpay from 'razorpay'

// ─── Lazy-init Razorpay instance ──────────────────────────────────────────────

let _razorpay: Razorpay | null = null

function getRazorpayInstance(): Razorpay {
    if (!_razorpay) {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            throw new Error('Missing Razorpay env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET')
        }

        _razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
        })
    }
    return _razorpay
}

// ─── Create Order ─────────────────────────────────────────────────────────────

/** Create a Razorpay order for the ₹499 connection fee. Amount in paise. */
export async function createRazorpayOrder(options: {
    amount: number          // in paise (49900 = ₹499)
    receipt: string         // unique receipt ID (e.g., connection request ID)
    notes?: Record<string, string>
}) {
    const razorpay = getRazorpayInstance()

    const order = await razorpay.orders.create({
        amount: options.amount,
        currency: 'INR',
        receipt: options.receipt,
        notes: options.notes ?? {},
    })

    return order
}

// ─── Verify Signature ─────────────────────────────────────────────────────────

/** Verify the Razorpay payment signature (webhook or client-side callback). */
export function verifyRazorpaySignature(params: {
    orderId: string
    paymentId: string
    signature: string
}): boolean {
    const { createHmac } = require('crypto')
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keySecret) {
        throw new Error('RAZORPAY_KEY_SECRET is not set')
    }

    const body = `${params.orderId}|${params.paymentId}`
    const expectedSignature = createHmac('sha256', keySecret)
        .update(body)
        .digest('hex')

    return expectedSignature === params.signature
}
