# Nyaya Setu — Full Project Handoff Document
> For: Claude Opus 4.6 via Antigravity
> Purpose: Continue development from exact stopping point
> Prepared by: Claude Sonnet 4.6

---

## 0. How to Use This Document

Read this entire document before writing a single line of code or asking any clarifying questions. Everything you need to understand the project, its current state, decisions made, and what to build next is in here. Do not deviate from decisions already made unless explicitly asked by the user. The user has already spent significant time arriving at these decisions — respect them.

---

## 1. Project Overview

**Name:** Nyaya Setu (formerly called E-LAWYER in the original document)
**Type:** Legal tech platform — India focused
**Purpose:** Connects clients with verified lawyers through transparent discovery, digital case management, and blockchain-secured documentation.

**Core value propositions:**
- Clients pay a flat ₹499 connection fee to connect with a lawyer — no hidden charges
- Lawyer profiles show honest win rates, verified bar council IDs, real client reviews
- All case documents are SHA-256 hashed and anchored on Polygon blockchain for tamper-proof storage
- Real-time case tracking, hearing reminders, verdict notifications
- Court e-token generation with geo-matched jurisdiction

**Three user roles:**
- `CLIENT` — finds lawyers, pays connection fee, tracks cases, uploads documents, leaves reviews
- `LAWYER` — accepts client connections, manages cases, sets hearing dates, records verdicts, uploads documents
- `ADMIN` — verifies lawyer profiles, suspends users, removes flagged reviews, views platform stats

---

## 2. Tech Stack — Final Decisions

Every technology below was deliberately chosen. Do not suggest replacements.

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 App Router | SSR, server components, API routes |
| Auth | Clerk | Sessions, role management, webhooks |
| Database | Supabase (Postgres) | RLS, Realtime, Storage, no Prisma |
| ORM | None — Supabase JS client only | Prisma was explicitly rejected |
| Type safety | `supabase gen types typescript` | Replaces Prisma types |
| API layer (internal) | tRPC | Type-safe client↔server calls |
| API layer (external) | Next.js REST route handlers | Webhooks, file upload, public verify |
| Payments | Razorpay | Indian payment gateway, ₹499 flat fee |
| Blockchain | Polygon (ethers.js) | Document hash anchoring |
| Email | Resend | Transactional emails |
| SMS | Twilio | Hearing reminders (future sprint) |
| Rate limiting | Upstash Redis + @upstash/ratelimit | Per-user and per-IP limits |
| UI components | Shadcn/ui + Tailwind CSS | Component library |
| Hosting | Vercel | Edge functions, deployment |
| Type checking | Zod | Input validation on all tRPC procedures |

**Key architectural decision — tRPC vs REST:**
- tRPC: everything internal (frontend → backend, server → server)
- REST: only webhooks (Clerk, Razorpay), file upload (multipart/form-data), public document verify endpoint

**No Prisma — this was a deliberate decision:**
Supabase already provides migrations, type generation, and a JS client. Adding Prisma creates two schema sources of truth and doesn't understand RLS, Storage, or Realtime. Use `supabase gen types typescript` and regenerate on every schema change.

---

## 3. Folder Structure

```
nyaya-setu/
├── src/
│   ├── app/                          ← Next.js App Router
│   │   ├── (marketing)/              ← public pages, no auth
│   │   │   ├── page.tsx              ← landing
│   │   │   ├── about/
│   │   │   ├── lawyers/
│   │   │   └── pricing/
│   │   ├── (auth)/                   ← Clerk auth pages
│   │   │   ├── sign-in/
│   │   │   ├── sign-up/
│   │   │   └── onboarding/           ← role selection post-signup
│   │   ├── (client)/                 ← client dashboard, role-gated
│   │   │   ├── dashboard/
│   │   │   ├── lawyers/
│   │   │   │   ├── page.tsx          ← browse + filter
│   │   │   │   └── [lawyerId]/       ← lawyer profile
│   │   │   ├── cases/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [caseId]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── documents/
│   │   │   └── notifications/
│   │   ├── (lawyer)/                 ← lawyer dashboard, role-gated
│   │   │   ├── dashboard/
│   │   │   ├── cases/
│   │   │   ├── clients/
│   │   │   ├── profile/
│   │   │   └── earnings/
│   │   ├── (admin)/                  ← admin panel, role-gated
│   │   │   ├── dashboard/
│   │   │   ├── lawyers/
│   │   │   ├── cases/
│   │   │   └── users/
│   │   └── api/
│   │       ├── trpc/[trpc]/route.ts  ← tRPC HTTP adapter
│   │       ├── webhooks/
│   │       │   ├── clerk/route.ts    ← SKIPPED for now
│   │       │   └── razorpay/route.ts ← SKIPPED for now
│   │       ├── payments/
│   │       │   └── create/route.ts   ← SKIPPED for now
│   │       └── documents/
│   │           ├── upload/route.ts   ← WRITTEN
│   │           └── verify/[docId]/route.ts ← WRITTEN
│   ├── server/
│   │   ├── trpc/
│   │   │   ├── init.ts               ← WRITTEN
│   │   │   ├── middleware.ts         ← logger middleware
│   │   │   └── routers/
│   │   │       ├── lawyer.router.ts  ← WRITTEN + COMPLETE
│   │   │       ├── client.router.ts  ← WRITTEN + COMPLETE
│   │   │       ├── case.router.ts    ← WRITTEN + COMPLETE
│   │   │       ├── connection.router.ts ← WRITTEN, needs review
│   │   │       ├── document.router.ts   ← WRITTEN, needs review
│   │   │       ├── notification.router.ts ← WRITTEN, needs review
│   │   │       ├── review.router.ts     ← WRITTEN, needs review
│   │   │       ├── admin.router.ts      ← WRITTEN, needs review
│   │   │       └── user.router.ts       ← WRITTEN, needs review
│   │   └── db/
│   │       ├── client.ts             ← supabase server client
│   │       └── types.ts              ← generated supabase types
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             ← WRITTEN
│   │   │   └── client.ts             ← WRITTEN
│   │   ├── blockchain.ts             ← WRITTEN
│   │   ├── razorpay.ts               ← WRITTEN
│   │   ├── notifications.ts          ← WRITTEN (email via Resend)
│   │   ├── geo.ts                    ← WRITTEN
│   │   ├── ratelimit.ts              ← WRITTEN
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/                       ← shadcn primitives
│   │   ├── lawyer/                   ← LawyerCard, ProfileHeader, etc.
│   │   ├── case/                     ← CaseTimeline, StatusBadge, etc.
│   │   ├── document/                 ← VaultGrid, UploadZone, etc.
│   │   └── shared/                   ← Navbar, Sidebar, Guards, etc.
│   ├── hooks/
│   │   ├── useLawyerSearch.ts
│   │   ├── useCaseUpdates.ts         ← Supabase Realtime subscription
│   │   └── useNotifications.ts
│   ├── types/
│   │   ├── supabase.ts               ← generated, never edit manually
│   │   └── index.ts
│   └── middleware.ts                 ← WRITTEN — Clerk + route protection
├── supabase/
│   └── migrations/
│       └── 20240101000000_initial_schema.sql ← WRITTEN, needs to be run
├── .env.local
└── next.config.ts
```

---

## 4. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_secret

# Blockchain (Polygon Mumbai testnet for dev)
POLYGON_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-key
BLOCKCHAIN_PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=your_deployed_contract_address

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Resend (email)
RESEND_API_KEY=re_xxx

# Twilio (SMS — future sprint)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=xxx
```

---

## 5. Database Schema — Complete

The full schema is one migration file. Tables in dependency order:

### Enums
```sql
user_role: CLIENT | LAWYER | ADMIN
verification_status: PENDING | VERIFIED | REJECTED
connection_status: PENDING | ACTIVE | DECLINED
case_status: IN_PROGRESS | HEARING_SET | VERDICT | CLOSED
case_category: CIVIL | CRIMINAL | PROPERTY | FAMILY | DIGITAL_CRIME | CONSUMER | LABOUR | CORPORATE
court_level: DISTRICT | HIGH_COURT | SUPREME_COURT | TRIBUNAL | CONSUMER_FORUM
payment_status: PENDING | CAPTURED | FAILED | REFUNDED
verdict_outcome: WON | LOST | SETTLED
notification_type: CONNECTION_REQUEST | CONNECTION_ACCEPTED | CONNECTION_DECLINED | CASE_CREATED | HEARING_SCHEDULED | VERDICT | DOCUMENT_UPLOADED | DOCUMENT_DELETED | NEW_MESSAGE | NEW_REVIEW | REVIEW_REMOVED | PROFILE_VERIFIED | PROFILE_REJECTED | REVIEW_FLAGGED
timeline_event_type: CASE_CREATED | STATUS_CHANGED | HEARING_SCHEDULED | VERDICT_RECORDED | DOCUMENT_UPLOADED | DOCUMENT_DELETED | MESSAGE_SENT
e_token_status: ACTIVE | USED | EXPIRED
```

### Tables (10 total)
```
users              — id, clerk_user_id, role, full_name, email, phone, city, state, suspended, suspension_reason, suspended_at
lawyers            — id, user_id(FK→users), bar_council_id, full_name, bio, phone, city, state, specializations[], court_levels[], fee_per_consultation(paise), years_of_experience, languages_spoken[], verified, verification_status, rejection_reason, verified_at, win_rate, total_cases, avg_rating, review_count
connections        — id, client_id(FK→users), lawyer_id(FK→users), status, decline_reason, accepted_at — UNIQUE(client_id, lawyer_id)
payments           — id, connection_id(FK), client_id(FK), razorpay_order_id, razorpay_payment_id, amount(paise), currency, status
cases              — id, connection_id(FK), client_id(FK), lawyer_id(FK), title, category, status, e_token, court_name, jurisdiction_city, jurisdiction_state, next_hearing_at, verdict_outcome, verdict_summary, closed_at
case_timeline      — id, case_id(FK), event_type, description, created_by(FK→users nullable)
case_messages      — id, case_id(FK), sender_id(FK→users), content
e_tokens           — id, case_id(FK), token_number(unique), court_name, hearing_date, status
documents          — id, case_id(FK), file_name, file_url, sha256_hash(char 64), chain_tx_id, uploaded_by(FK→users), deleted_at(soft delete)
document_access_log — id, document_id(FK), accessed_by(FK→users), accessed_at, ip_address
reviews            — id, case_id(FK), lawyer_id(FK→users), reviewer_id(FK→users), rating(1-5), outcome, body, flagged, flag_reason, flagged_at — UNIQUE(case_id, reviewer_id)
notifications      — id, user_id(FK), type, title, body, read, case_id(FK nullable)
```

### Key schema decisions
- `fee_per_consultation` stored in **paise** (integer), not rupees. 49900 = ₹499
- `sha256_hash` is `char(64)` — SHA-256 hex is always exactly 64 characters
- `documents.deleted_at` is soft delete — row never deleted, hash retained for audit
- `reviews` has hard delete (unlike documents) — removed reviews leave no trace
- `connections` has UNIQUE(client_id, lawyer_id) — prevents duplicate connections at DB level
- RLS enabled on all tables using `requesting_user_id()` function reading `app.user_id` from session config
- Clerk and Supabase Auth are NOT integrated — Clerk handles auth UI, user ID is passed via `app.user_id` config for RLS

---

## 6. tRPC Setup — init.ts Pattern

```typescript
// Context shape
type TRPCContext = {
  userId: string | null       // from Clerk auth()
  role: string | null         // from Clerk sessionClaims.metadata.role
  supabase: SupabaseClient    // server client with cookie handling
}

// Procedure hierarchy
baseProcedure      → no auth required (public)
protectedProcedure → userId must exist (any logged-in user)
clientProcedure    → protectedProcedure + role === 'CLIENT'
lawyerProcedure    → protectedProcedure + role === 'LAWYER'
adminProcedure     → protectedProcedure + role === 'ADMIN'
```

**Critical pattern — Supabase RLS user context:**
Set before every query so RLS policies work:
```typescript
if (userId) {
  await supabase.rpc('set_config', {
    setting: 'app.user_id',
    value: userId,
  })
}
```

**Server-side caller pattern (for calling one router from another):**
```typescript
// Use dynamic import to avoid circular dependencies
const { createCallerFactory } = await import('../init')
const { lawyerRouter } = await import('./lawyer.router')
const createCaller = createCallerFactory(lawyerRouter)
const serverCaller = createCaller(ctx)
await serverCaller.recalculateRating({ lawyerId: someId })
```

**Internal function pattern (preferred over server-side caller for cross-router calls):**
```typescript
// Export a plain async function alongside the router
export async function createCaseInternal(ctx: TRPCContext, input: {...}) {
  // logic here
}
// Import and call directly — avoids circular import issues
import { createCaseInternal } from './case.router'
```

---

## 7. Router Files — Status and Procedure List

### `lawyer.router.ts` — COMPLETE
```
search              baseProcedure   query     — full-text + filter search with pagination
getById             baseProcedure   query     — full profile with reviews
getReviews          baseProcedure   query     — paginated reviews for a lawyer
getMyProfile        lawyerProcedure query     — lawyer's own profile
createProfile       lawyerProcedure mutation  — initial profile on onboarding
updateProfile       lawyerProcedure mutation  — update bio, fees, availability
updateVerificationStatus adminProcedure mutation — admin approves/rejects
updateWinRate       protectedProcedure mutation — internal, called after verdict
recalculateRating   protectedProcedure mutation — internal, called after review
```

### `client.router.ts` — COMPLETE (bugs fixed)
```
getDashboardSummary clientProcedure query    — Promise.all: counts + upcoming hearings
getMyConnections    clientProcedure query    — connections with status filter
getConnectionStatus clientProcedure query    — check if connected to specific lawyer
initiatePayment     clientProcedure mutation — create Razorpay order, return orderId
getMyCases          clientProcedure query    — paginated cases with status filter
getCaseById         clientProcedure query    — full case detail, ownership scoped
getCaseTimeline     clientProcedure query    — ordered events, ownership checked
getCaseMessages     clientProcedure query    — paginated messages DESC
sendMessage         clientProcedure mutation — sanitizes HTML, notifies lawyer
getCaseDocuments    clientProcedure query    — excludes soft-deleted
getNotifications    clientProcedure query    — unread first, with unreadCount
getUnreadCount      clientProcedure query    — head:true, navbar badge
markNotificationRead clientProcedure mutation — scoped to ctx.userId
submitReview        clientProcedure mutation — 3 guards, triggers recalculateRating
getMyProfile        clientProcedure query    — reads from users table (NOT clients table)
```

**Known bugs already fixed in client.router.ts:**
- `ctx.session.user.id` → `ctx.userId`
- `z.uuid()` → `z.string().uuid()` everywhere
- `updatePayload.fullName ===` → `updatePayload.full_name =` (was comparison not assignment)
- `from('clients')` → `from('users')` (no clients table exists)
- `from('messages')` → `from('case_messages')`
- `getMyReviews` was missing return statement

### `case.router.ts` — COMPLETE
```
create        lawyerProcedure    mutation — wraps createCaseInternal
getAll        protectedProcedure query   — role-based column switch (lawyer_id vs client_id)
getById       protectedProcedure query   — role-based, throws NOT_FOUND not FORBIDDEN
updateStatus  lawyerProcedure    mutation — adds timeline event, blocks CLOSED→anything
addHearingDate lawyerProcedure   mutation — updates next_hearing_at, notifies client
recordVerdict  lawyerProcedure   mutation — closes case, triggers updateWinRate via dynamic import
getTimeline    protectedProcedure query  — role-based ownership check, ASC order
sendMessage    protectedProcedure mutation — shared between roles, notifies other party

// Exported plain function (not a procedure):
export async function createCaseInternal(ctx, input) — called from connection.accept
```

### `connection.router.ts` — WRITTEN, needs review
```
create              protectedProcedure mutation — called by Razorpay webhook, checks duplicates
accept              lawyerProcedure    mutation — WRITTEN IN FULL, see below
decline             lawyerProcedure    mutation — updates status, notifies client with reason
getIncomingRequests lawyerProcedure    query   — joins users!client_id + payments, filters CAPTURED
getMyConnections    lawyerProcedure    query   — ACTIVE only, joins to cases
isConnected         protectedProcedure query   — head:true, returns { connected: boolean }
```

**`connection.accept` — full implementation already written:**
- Fetches connection, verifies `lawyer_id === ctx.userId`
- Guards: status must be PENDING
- Updates connection to ACTIVE with `accepted_at`
- Calls `createCaseInternal(ctx, {...})` — plain function import, not server-side caller
- Manual rollback on case creation failure (resets to PENDING)
- Inserts notification for client
- Returns `{ connection, case }`

### `document.router.ts` — WRITTEN, needs review
```
getByCaseId     protectedProcedure query   — role-based ownership, excludes deleted_at IS NOT NULL
registerUpload  protectedProcedure mutation — called by REST upload route, inserts metadata
delete          protectedProcedure mutation — soft delete only (sets deleted_at), uploader-only
getAccessLog    protectedProcedure query   — join chain: documents→cases→client_id/lawyer_id
```

### `notification.router.ts` — WRITTEN, needs review
```
getAll          protectedProcedure query   — read=false first, then created_at DESC, includes unreadCount
getUnreadCount  protectedProcedure query   — head:true only
markRead        protectedProcedure mutation — scoped to user_id (prevents marking others' notifications)
markAllRead     protectedProcedure mutation — only touches read=false rows, returns { updated: count }
```

### `review.router.ts` — WRITTEN, needs review
```
getByLawyer     baseProcedure   query   — public, filters flagged=false, exposes full_name only (not reviewer_id UUID)
submit          clientProcedure mutation — 3 guards (ownership→closed→no duplicate), derives lawyer_id from case
flag            adminProcedure  mutation — sets flagged=true, triggers recalculateRating via dynamic import
```

### `admin.router.ts` — WRITTEN, needs review
```
getAllLawyers    adminProcedure query   — joins users!user_id, filter by verification_status
getPlatformStats adminProcedure query  — Promise.all of 8 queries, revenue summed in JS
verifyLawyer    adminProcedure mutation — notifies lawyer of decision
suspendUser     adminProcedure mutation — DB suspend + Clerk API disable + lawyer unverify if LAWYER role
removeReview    adminProcedure mutation — hard delete (only hard delete in codebase), recalculateRating
```

**`getPlatformStats` bug already fixed:**
- `case` is reserved keyword — use `c` as parameter name
- `activeCases = totalCases - closedCases` (arithmetic, no filter needed)
- Status values: `IN_PROGRESS`, `HEARING_SET`, `VERDICT`, `CLOSED` (not ACTIVE/COMPLETED/CANCELLED)

### `user.router.ts` — WRITTEN, needs review
```
getMyProfile     protectedProcedure query   — base users data + conditional lawyer profile if LAWYER role
updateMyProfile  protectedProcedure mutation — snake_case columns, no email update allowed
getDashboardSummary protectedProcedure query — role-branch: client vs lawyer data, Promise.all
```

---

## 8. Lib Files — Status

### Written and complete:
```
src/lib/supabase/server.ts    — createServerClient (anon key, cookie handling)
                                createServiceRoleClient (service role, bypasses RLS)
src/lib/supabase/client.ts    — createClient (browser, for Realtime subscriptions)
src/lib/razorpay.ts           — razorpay instance, createRazorpayOrder(), verifyRazorpaySignature()
src/lib/blockchain.ts         — computeSHA256(), anchorHashOnChain(), verifyHashOnChain()
src/lib/geo.ts                — getCourtForCity(), generateEToken() with city→court map
src/lib/ratelimit.ts          — generalLimiter, paymentLimiter, authLimiter, uploadLimiter, checkRateLimit()
src/lib/notifications.ts      — Resend email functions for each notification type
```

### Not yet written:
```
src/lib/webhooks.ts           — Svix signature verify (Clerk), HMAC verify (Razorpay) — SKIPPED
src/lib/utils.ts              — general utilities
```

---

## 9. REST Routes — Status

### Written:
```
POST /api/documents/upload          — multipart/form-data, auth check, rate limit,
                                      file validation (type + size), SHA-256 hash,
                                      Supabase Storage upload, blockchain anchor,
                                      calls document.registerUpload tRPC internally
GET  /api/documents/verify/[docId]  — public, no auth, fetches hash from DB,
                                      verifies against Polygon chain, returns { verified, document }
```

### Skipped (do later):
```
POST /api/webhooks/clerk            — Svix signature verify, sync user to Supabase
POST /api/webhooks/razorpay         — HMAC verify, call connection.create
POST /api/payments/create           — actually this should be a tRPC mutation, not REST
```

---

## 10. Critical Patterns and Rules

**Never break these — they were arrived at through careful discussion:**

1. **Ownership scope on every query** — every DB query must include `client_id = ctx.userId` OR `lawyer_id = ctx.userId`. A query with only `id = input.someId` is a BOLA vulnerability.

2. **NOT_FOUND not FORBIDDEN** — when a resource doesn't exist OR user doesn't own it, always throw `NOT_FOUND`. Never distinguish between the two — that leaks information.

3. **Soft delete on documents** — never hard delete documents. `deleted_at = now()` only. Hash and chain_tx_id must be retained forever.

4. **Hard delete on reviews** — only place in codebase with hard delete. After delete always call `recalculateRating`.

5. **Derive lawyer_id from case, never from input** — in `review.submit`, get `lawyer_id` from the case record, not from frontend input. A client could pass any lawyerId otherwise.

6. **`z.string().uuid()` not `z.uuid()`** — `z.uuid()` does not exist as standalone. Always `z.string().uuid()`.

7. **`case` is reserved** — never use `case` as a variable or parameter name. Use `c`, `caseItem`, `caseData` etc.

8. **Money in paise** — `fee_per_consultation` and `payments.amount` are stored as integers in paise. 49900 = ₹499. Convert only in UI.

9. **`head: true` for counts** — whenever you only need a count, use `select('*', { count: 'exact', head: true })`. Never fetch rows just to count them.

10. **Dynamic import for cross-router calls** — to avoid circular imports, use `await import('./router.file')` inside the mutation body, not at the top of the file.

11. **Role check via `ctx.role === 'LAWYER'`** — for shared procedures (protectedProcedure) that serve both roles, switch on `ctx.role` to determine which column to filter on.

12. **Notifications are fire-and-forget** — always insert notifications directly via `ctx.supabase.from('notifications').insert(...)` inline in mutations. No separate notification service call needed for creating — `notification.router.ts` is only for reading/managing.

13. **No email in Supabase** — email is owned by Clerk, synced to `users` table via webhook. Never allow email updates via `updateMyProfile`. Never call Clerk SDK to read email — read from your own `users` table.

14. **`app.user_id` must be set** — set `current_setting('app.user_id')` in `createTRPCContext` before any Supabase query or RLS policies won't work.

15. **`!client_id` join hint** — when joining `users` from `connections` (which has both `client_id` and `lawyer_id` pointing to `users`), always use `users!client_id` or `users!lawyer_id` to disambiguate.

---

## 11. What Remains To Be Built

### Immediate — backend completion

**Step 1: Run migration and generate types**
```bash
npx supabase migration new initial_schema
# paste the full schema SQL
npx supabase db push
npx supabase gen types typescript --project-id YOUR_ID > src/types/supabase.ts
```

**Step 2: Review all router files**
All routers are written but the user wants to review them before moving forward. When reviewing, check for:
- All `z.uuid()` → `z.string().uuid()`
- All `case` parameter names → `c` or `caseData`
- All `updatePayload.x ===` → `updatePayload.x =`
- Column names match schema (snake_case)
- Ownership scopes on every query

**Step 3: Wire up tRPC client on frontend**
```typescript
// src/lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/trpc/init'
export const trpc = createTRPCReact<AppRouter>()
```

```typescript
// src/lib/trpc/server.ts — for server components
import { createCallerFactory } from '@/server/trpc/init'
import { appRouter } from '@/server/trpc/init'
const createCaller = createCallerFactory(appRouter)
export const serverClient = createCaller(createTRPCContext)
```

### Frontend build order (10 pages)

Build in this exact order — each page depends on the previous being complete:

**1. Onboarding page** (`/onboarding`)
- Role selection: CLIENT or LAWYER
- On select: call Clerk `updateUser` to set `publicMetadata.role`
- If LAWYER: show lawyer profile creation form (calls `lawyer.createProfile`)
- Redirect to appropriate dashboard after completion

**2. Lawyer browse page** (`/lawyers`)
- Search input, filter sidebar (category, city, court level, fee, rating)
- Lawyer cards grid with pagination
- Calls `trpc.lawyer.search`
- Connection status badge via `trpc.client.getConnectionStatus`

**3. Lawyer profile page** (`/lawyers/[lawyerId]`)
- Full profile: stats row, specializations, checklist, reviews
- Calls `trpc.lawyer.getById` + `trpc.lawyer.getReviews`
- CTA: "Connect for ₹499" button — calls `trpc.client.initiatePayment`
- Razorpay checkout modal opens with returned `orderId`

**4. Client dashboard** (`/dashboard`)
- Stats cards: total cases, active cases, connections, unread notifications
- Upcoming hearings list
- Calls `trpc.user.getDashboardSummary`

**5. My cases page** (`/cases`)
- Case list with status badges, next hearing date, lawyer name
- Filter by status
- Calls `trpc.case.getAll`

**6. Case detail page** (`/cases/[caseId]`)
- Timeline, case info, court details, e-token
- Calls `trpc.case.getById` + `trpc.case.getTimeline`
- Tab: Messages (calls `trpc.case.getCaseMessages`)
- Message input (calls `trpc.case.sendMessage`)
- Tab: Documents (calls `trpc.document.getByCaseId`)

**7. Document vault** (inside case detail)
- Document grid with hash, upload time, uploader name
- Upload button → calls `/api/documents/upload` REST endpoint
- Verify button → calls `/api/documents/verify/[docId]`
- Blockchain badge showing chain_tx_id

**8. Notifications page** (`/notifications`)
- List with unread first
- Mark read on click
- Calls `trpc.notification.getAll` + `trpc.notification.markRead`

**9. Lawyer dashboard** (`/lawyer/dashboard`)
- Pending requests, active cases, upcoming hearings
- Accept/decline buttons on requests
- Calls `trpc.connection.getIncomingRequests`
- Accept: calls `trpc.connection.accept`
- Decline: calls `trpc.connection.decline`

**10. Admin dashboard** (`/admin`)
- Pending lawyers verification queue
- Platform stats
- Calls `trpc.admin.getAllLawyers` + `trpc.admin.getPlatformStats`
- Verify button: calls `trpc.lawyer.updateVerificationStatus`

---

## 12. Design System

The UI design was specified in a Stitch prompt. Key decisions:

**Typography:**
- Headings: Cormorant Garamond or Playfair Display — authoritative, legal
- Body: DM Sans — clean, readable
- Never: Inter, Roboto, Arial

**Color palette:**
- Primary: Deep navy `#1B2A4A`
- Accent: Warm gold `#C9A84C`
- Background: Warm ivory `#F8F6F1`
- Surface: `#FFFFFF`
- Text: `#1C1C2E` (body), `#4A5568` (secondary)
- Gradient: navy `#1B2A4A` → slate blue `#2D3F6B`
- Success/verified: muted emerald `#2E7D5E`

**Tone:** Trust-forward, professional, modern but not SaaS-corporate. A prestigious law firm that got a digital makeover. No bubbly illustrations, no candy colors.

**Components:**
- Cards: soft shadow, 8-12px radius, warm white, subtle gold left border for verified states
- Buttons: Primary = solid navy; Secondary = outlined navy; CTA = gold background
- Badges: Verified (emerald), Specialization (slate blue pill), Case Status (color-coded)
- No flashy animations — 200-300ms transitions only
- Trust signals persistent on all screens (blockchain badge, verified chip, bar council ID)

---

## 13. Packages to Install

```bash
# Core
npm i @trpc/server @trpc/client @trpc/react-query @trpc/next
npm i @tanstack/react-query
npm i zod superjson

# Auth
npm i @clerk/nextjs

# Database
npm i @supabase/supabase-js @supabase/ssr

# Payments
npm i razorpay

# Blockchain
npm i ethers

# Email
npm i resend

# Rate limiting
npm i @upstash/ratelimit @upstash/redis

# UI
npm i tailwindcss shadcn-ui
npx shadcn-ui@latest init

# Utilities
npm i crypto  # built-in Node, no install needed
```

---

## 14. Immediate Next Actions for Opus 4.6

When the user starts the conversation, they want to:

1. **Review existing router code** — go through each router file the user pastes and check for the bugs listed in section 10
2. **Wire up tRPC client** — set up the frontend tRPC provider in `src/app/layout.tsx`
3. **Build the frontend** — starting with onboarding page, then following the order in section 11
4. **Run migration** — once user confirms schema is correct
5. **Generate types** — after migration runs

**Do not:**
- Suggest changing any technology in the stack
- Suggest adding Prisma
- Suggest a different folder structure
- Ask clarifying questions about decisions already made — they are final
- Use `case` as a variable name anywhere
- Use `z.uuid()` standalone — always `z.string().uuid()`

---

## 15. Sprints Remaining

```
Sprint 1-4:  ✅ Complete (auth, schema, routers, lib files, REST routes)
Sprint 5:    ⏳ Router review + tRPC client setup
Sprint 6:    ⏳ Frontend — onboarding + lawyer browse + profile
Sprint 7:    ⏳ Frontend — client dashboard + cases + documents
Sprint 8:    ⏳ Frontend — notifications + lawyer dashboard
Sprint 9:    ⏳ Admin dashboard + webhook handlers
Sprint 10:   ⏳ QA + Razorpay live keys + Polygon mainnet + launch prep
```

---

*End of handoff document. Opus 4.6 should have everything needed to continue without asking the user to repeat context.*
