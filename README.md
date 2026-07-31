# NyaaySetu — The Bridge of Justice

Blockchain-secured legal platform connecting citizens with manually reviewed lawyer profiles. File cases, manage evidence with tamper-proof blockchain anchoring, and communicate securely — all in one place.

![Next.js](https://img.shields.io/badge/Next.js_16-black?logo=next.js) ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white) ![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white) ![Polygon](https://img.shields.io/badge/Polygon-7B3FE4?logo=polygon&logoColor=white)

---

## Features

- **Reviewed Lawyer Profiles** — Lawyer profiles are manually reviewed using submitted Bar Council details and supporting documents before appearing publicly.
- **Blockchain Document Vault** — Case evidence is hashed (SHA-512) and anchored on the Polygon blockchain, ensuring immutability.
- **Role-Based Dashboards** — Separate views for Clients, Lawyers, and Admins with tailored workflows.
- **Case Messaging** — Access-controlled messages between a client and their counsel.
- **Case Management** — Full lifecycle from filing → hearings → verdict with a visual timeline.
- **Stripe Payments** — Flat ₹499 connection fee processed via Stripe Checkout.
- **In-App Notifications** — Notification inbox with mark-as-read and badge counts.
- **Admin Panel** — Platform statistics, lawyer verification queue, and user management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Database** | Supabase (PostgreSQL + Row Level Security) |
| **Auth** | Clerk (SSO, MFA, session management) |
| **API** | tRPC v11 (end-to-end type-safe RPC) |
| **Payments** | Stripe Checkout |
| **Blockchain** | Polygon (ethers.js v6, custom smart contract) |
| **Styling** | Tailwind CSS 4 + custom design tokens |
| **Email** | Resend |
| **Rate Limiting** | Upstash Redis |

---

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Sign-in, Sign-up, Onboarding
│   ├── (public)/           # About, Pricing, Lawyer Directory
│   ├── dashboard/          # Protected dashboards
│   │   ├── client/         # Client views (cases, lawyers, documents, payments)
│   │   ├── lawyer/         # Lawyer views (cases, clients, documents, earnings)
│   │   └── admin/          # Admin panel (stats, user management)
│   └── api/                # API routes (upload, webhooks, tRPC)
├── server/trpc/            # tRPC routers & procedures
│   └── router/
│       ├── client.router.ts
│       ├── lawyer.router.ts
│       ├── case.router.ts
│       ├── connection.router.ts
│       ├── document.router.ts
│       ├── notification.router.ts
│       ├── review.router.ts
│       ├── admin.router.ts
│       └── user.router.ts
└── lib/                    # Shared utilities
    ├── blockchain.ts       # Polygon anchoring & verification
    ├── stripe.ts           # Stripe Checkout & webhooks
    ├── supabase/           # Supabase client (server + service role)
    └── trpc/               # tRPC client & provider
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- A [Supabase](https://supabase.com) project
- A [Clerk](https://clerk.com) application
- A [Stripe](https://stripe.com) account

### 1. Clone & Install

```bash
git clone https://github.com/your-username/nyaaysetu.git
cd nyaaysetu
npm install
```

### 2. Configure Environment

Copy `.env.example` (or `.env`) and fill in the required values:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Blockchain (Polygon)
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/...
POLYGON_CHAIN_ID=137
BLOCKCHAIN_PRIVATE_KEY=...
CONTRACT_ADDRESS=0x...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (Email)
RESEND_API_KEY=re_...

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Run Development Server

Apply every SQL file in `supabase/migrations/` to the target Supabase project in filename order before starting the app. Keep the `documents` Storage bucket private; the hardening migration creates or corrects it automatically.

```bash
npm run dev
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

---

## User Flows

### Client
1. Sign up → Complete onboarding (name, phone, city)
2. Browse reviewed lawyer profiles → Pay ₹499 connection fee via Stripe
3. Lawyer accepts → Case is auto-created with e-token
4. Upload documents (blockchain-anchored) → Message counsel → Track hearings

### Lawyer
1. Sign up → Complete onboarding (Bar Council ID, specializations, court levels)
2. Admin verifies profile → Appears in public directory
3. Accept connection requests → Manage cases
4. Schedule hearings → Record verdicts → Upload evidence

### Admin
1. View platform statistics (users, cases, revenue)
2. Verify or reject lawyer registrations
3. Suspend users, remove flagged reviews

---

## Design System

NyaaySetu uses a **"Sovereign Legal"** design language:

- **Background**: `#FBF9F4` (warm ivory)
- **Primary**: `#1B2A4A` (navy)
- **Gold Accent**: `#C9A84C`
- **Emerald**: `#2E7D5E` (success/verified states)
- **Headings**: Cormorant Garamond (serif)
- **Body**: Inter (sans-serif)

---

## License

This project is proprietary. All rights reserved.
