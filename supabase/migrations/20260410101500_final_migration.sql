-- extension
create extension if not exists "pg_trgm"; 

-- enums

create type user_role as enum ('CLIENT', 'LAWYER', 'ADMIN');

create type verification_status as enum ('PENDING', 'VERIFIED', 'REJECTED');

create type connection_status as enum ('PENDING', 'ACTIVE', 'DECLINED');

create type case_status as enum (
  'IN_PROGRESS',
  'HEARING_SET',
  'VERDICT',
  'CLOSED'
);

create type case_category as enum (
  'CIVIL',
  'CRIMINAL',
  'PROPERTY',
  'FAMILY',
  'DIGITAL_CRIME',
  'CONSUMER',
  'LABOUR',
  'CORPORATE'
);

create type court_level as enum (
  'DISTRICT',
  'HIGH_COURT',
  'SUPREME_COURT',
  'TRIBUNAL',
  'CONSUMER_FORUM'
);

create type payment_status as enum ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED');

create type verdict_outcome as enum ('WON', 'LOST', 'SETTLED');

create type notification_type as enum (
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'CONNECTION_DECLINED',
  'CASE_CREATED',
  'HEARING_SCHEDULED',
  'VERDICT',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'NEW_MESSAGE',
  'NEW_REVIEW',
  'REVIEW_REMOVED',
  'PROFILE_VERIFIED',
  'PROFILE_REJECTED',
  'REVIEW_FLAGGED'
);

create type timeline_event_type as enum (
  'CASE_CREATED',
  'STATUS_CHANGED',
  'HEARING_SCHEDULED',
  'VERDICT_RECORDED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
  'MESSAGE_SENT'
);

create type e_token_status as enum ('ACTIVE', 'USED', 'EXPIRED');

-- user table

create table users (
  id                  uuid primary key default gen_random_uuid(),
  clerk_user_id       text not null unique,
  role                user_role not null default 'CLIENT',
  full_name           text not null,
  email               text not null unique,
  phone               text,
  city                text,
  state               text,
  suspended           boolean not null default false,
  suspension_reason   text,
  suspended_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_users_clerk_user_id on users(clerk_user_id);
create index idx_users_role on users(role);
create index idx_users_email on users(email);

-- lawyer table

create table lawyers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  bar_council_id        text not null unique,
  state_bar_council     text,
  enrollment_year       integer,
  verification_document_url text,
  full_name             text not null,
  bio                   text,
  phone                 text,
  city                  text not null,
  state                 text not null,
  specializations       case_category[] not null default '{}',
  court_levels          court_level[] not null default '{}',
  fee_per_consultation  integer not null default 0, -- stored in paise
  years_of_experience   integer not null default 0,
  languages_spoken      text[] not null default '{}',
  verified              boolean not null default false,
  verification_status   verification_status not null default 'PENDING',
  rejection_reason      text,
  verified_at           timestamptz,
  win_rate              integer not null default 0, -- percentage 0-100
  total_cases           integer not null default 0,
  avg_rating            numeric(3, 2) not null default 0, -- e.g. 4.75
  review_count          integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_lawyers_user_id on lawyers(user_id);
create index idx_lawyers_verified on lawyers(verified);
create index idx_lawyers_verification_status on lawyers(verification_status);
create index idx_lawyers_city on lawyers(city);
create index idx_lawyers_state on lawyers(state);
create index idx_lawyers_avg_rating on lawyers(avg_rating desc);
create index idx_lawyers_win_rate on lawyers(win_rate desc);
create index idx_lawyers_full_name_trgm on lawyers using gin(full_name gin_trgm_ops);
create index idx_lawyers_bio_trgm on lawyers using gin(bio gin_trgm_ops);

-- ─── Connections ──────────────────────────────────────────────────────────────

create table connections (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references users(id) on delete cascade,
  lawyer_id             uuid not null references users(id) on delete cascade,
  status                connection_status not null default 'PENDING',
  decline_reason        text,
  accepted_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- one active or pending connection per client-lawyer pair at a time
  constraint unique_active_connection unique (client_id, lawyer_id)
);

create index idx_connections_client_id on connections(client_id);
create index idx_connections_lawyer_id on connections(lawyer_id);
create index idx_connections_status on connections(status);

-- ─── Payments ─────────────────────────────────────────────────────────────────

create table payments (
  id                    uuid primary key default gen_random_uuid(),
  connection_id         uuid not null references connections(id) on delete cascade,
  client_id             uuid not null references users(id) on delete cascade,
  stripe_session_id      text not null unique,
  stripe_payment_intent_id text unique,
  amount                integer not null, -- in paise, 49900 = ₹499
  currency              text not null default 'INR',
  status                payment_status not null default 'PENDING',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_payments_connection_id on payments(connection_id);
create index idx_payments_client_id on payments(client_id);
create index idx_payments_status on payments(status);
create index idx_payments_stripe_session_id on payments(stripe_session_id);

-- ─── Cases ────────────────────────────────────────────────────────────────────

create table cases (
  id                    uuid primary key default gen_random_uuid(),
  connection_id         uuid not null references connections(id) on delete cascade,
  client_id             uuid not null references users(id) on delete cascade,
  lawyer_id             uuid not null references users(id) on delete cascade,
  title                 text,
  category              case_category,
  status                case_status not null default 'IN_PROGRESS',
  e_token               text unique,
  court_name            text,
  jurisdiction_city     text,
  jurisdiction_state    text,
  next_hearing_at       timestamptz,
  verdict_outcome       verdict_outcome,
  verdict_summary       text,
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_cases_client_id on cases(client_id);
create index idx_cases_lawyer_id on cases(lawyer_id);
create index idx_cases_connection_id on cases(connection_id);
create index idx_cases_status on cases(status);
create index idx_cases_next_hearing_at on cases(next_hearing_at asc)
  where next_hearing_at is not null;

-- ─── Case Timeline ────────────────────────────────────────────────────────────

create table case_timeline (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references cases(id) on delete cascade,
  event_type    timeline_event_type not null,
  description   text not null,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_case_timeline_case_id on case_timeline(case_id);
create index idx_case_timeline_created_at on case_timeline(case_id, created_at asc);

-- ─── Case Messages ────────────────────────────────────────────────────────────

create table case_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  sender_id   uuid not null references users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index idx_case_messages_case_id on case_messages(case_id);
create index idx_case_messages_created_at on case_messages(case_id, created_at desc);

-- ─── E-Tokens ─────────────────────────────────────────────────────────────────

create table e_tokens (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(id) on delete cascade,
  token_number    text not null unique,
  court_name      text,
  hearing_date    timestamptz,
  status          e_token_status not null default 'ACTIVE',
  created_at      timestamptz not null default now()
);

create index idx_e_tokens_case_id on e_tokens(case_id);
create index idx_e_tokens_token_number on e_tokens(token_number);

-- ─── Documents ────────────────────────────────────────────────────────────────

create table documents (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(id) on delete cascade,
  file_name       text not null,
  file_url        text not null,
  sha512_hash     char(128) not null, -- SHA-512 hex is always exactly 128 chars
  chain_tx_id     text not null,     -- Polygon transaction ID
  uploaded_by     uuid not null references users(id) on delete cascade,
  deleted_at      timestamptz,       -- soft delete
  created_at      timestamptz not null default now()
);

create index idx_documents_case_id on documents(case_id);
create index idx_documents_uploaded_by on documents(uploaded_by);
-- partial index — only non-deleted documents, used by getByCaseId
create index idx_documents_active on documents(case_id)
  where deleted_at is null;

-- ─── Document Access Log ──────────────────────────────────────────────────────

create table document_access_log (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references documents(id) on delete cascade,
  accessed_by     uuid not null references users(id) on delete cascade,
  accessed_at     timestamptz not null default now(),
  ip_address      text
);

create index idx_doc_access_log_document_id on document_access_log(document_id);
create index idx_doc_access_log_accessed_at on document_access_log(document_id, accessed_at desc);

-- ─── Reviews ──────────────────────────────────────────────────────────────────

create table reviews (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases(id) on delete cascade,
  lawyer_id       uuid not null references users(id) on delete cascade,
  reviewer_id     uuid not null references users(id) on delete cascade,
  rating          smallint not null check (rating >= 1 and rating <= 5),
  outcome         verdict_outcome not null,
  body            text not null,
  flagged         boolean not null default false,
  flag_reason     text,
  flagged_at      timestamptz,
  created_at      timestamptz not null default now(),

  -- one review per case per reviewer
  constraint unique_review_per_case unique (case_id, reviewer_id)
);

create index idx_reviews_lawyer_id on reviews(lawyer_id);
create index idx_reviews_reviewer_id on reviews(reviewer_id);
-- partial index — only unflagged reviews, used by getByLawyer
create index idx_reviews_active on reviews(lawyer_id)
  where flagged = false;

-- ─── Notifications ────────────────────────────────────────────────────────────

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text not null,
  read        boolean not null default false,
  case_id     uuid references cases(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_read on notifications(user_id, read)
  where read = false; -- partial index, only unread rows
create index idx_notifications_created_at on notifications(user_id, created_at desc);

-- ─── Triggers: updated_at ─────────────────────────────────────────────────────
-- Automatically update updated_at on every row update

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users
  for each row execute function update_updated_at();

create trigger trg_lawyers_updated_at
  before update on lawyers
  for each row execute function update_updated_at();

create trigger trg_connections_updated_at
  before update on connections
  for each row execute function update_updated_at();

create trigger trg_payments_updated_at
  before update on payments
  for each row execute function update_updated_at();

create trigger trg_cases_updated_at
  before update on cases
  for each row execute function update_updated_at();

-- ─── RLS helper function ──────────────────────────────────────────────────────

create or replace function requesting_user_id()
returns text as $$
  select nullif(current_setting('app.user_id', true), '')::text;
$$ language sql stable;

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table users enable row level security;
alter table lawyers enable row level security;
alter table connections enable row level security;
alter table payments enable row level security;
alter table cases enable row level security;
alter table case_timeline enable row level security;
alter table case_messages enable row level security;
alter table e_tokens enable row level security;
alter table documents enable row level security;
alter table document_access_log enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;

-- users
create policy "users: read own row"
  on users for select
  using (id::text = requesting_user_id());

create policy "users: update own row"
  on users for update
  using (id::text = requesting_user_id());

-- lawyers
create policy "lawyers: public read verified"
  on lawyers for select
  using (verified = true);

create policy "lawyers: read own unverified"
  on lawyers for select
  using (user_id::text = requesting_user_id());

create policy "lawyers: insert own"
  on lawyers for insert
  with check (user_id::text = requesting_user_id());

create policy "lawyers: update own"
  on lawyers for update
  using (user_id::text = requesting_user_id());

-- connections
create policy "connections: read own"
  on connections for select
  using (
    client_id::text = requesting_user_id() or
    lawyer_id::text = requesting_user_id()
  );

create policy "connections: insert"
  on connections for insert
  with check (client_id::text = requesting_user_id());

create policy "connections: update own"
  on connections for update
  using (
    client_id::text = requesting_user_id() or
    lawyer_id::text = requesting_user_id()
  );

-- payments
create policy "payments: read own"
  on payments for select
  using (client_id::text = requesting_user_id());

create policy "payments: insert own"
  on payments for insert
  with check (client_id::text = requesting_user_id());

-- cases
create policy "cases: read own"
  on cases for select
  using (
    client_id::text = requesting_user_id() or
    lawyer_id::text = requesting_user_id()
  );

create policy "cases: insert"
  on cases for insert
  with check (
    client_id::text = requesting_user_id() or
    lawyer_id::text = requesting_user_id()
  );

create policy "cases: update own"
  on cases for update
  using (
    client_id::text = requesting_user_id() or
    lawyer_id::text = requesting_user_id()
  );

-- case_timeline
create policy "case_timeline: read if case member"
  on case_timeline for select
  using (
    exists (
      select 1 from cases
      where cases.id = case_timeline.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

create policy "case_timeline: insert if case member"
  on case_timeline for insert
  with check (
    exists (
      select 1 from cases
      where cases.id = case_timeline.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

-- case_messages
create policy "case_messages: read if case member"
  on case_messages for select
  using (
    exists (
      select 1 from cases
      where cases.id = case_messages.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

create policy "case_messages: insert if case member"
  on case_messages for insert
  with check (
    sender_id::text = requesting_user_id() and
    exists (
      select 1 from cases
      where cases.id = case_messages.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

-- e_tokens
create policy "e_tokens: read if case member"
  on e_tokens for select
  using (
    exists (
      select 1 from cases
      where cases.id = e_tokens.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

-- documents
create policy "documents: read if case member"
  on documents for select
  using (
    exists (
      select 1 from cases
      where cases.id = documents.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

create policy "documents: insert if case member"
  on documents for insert
  with check (
    uploaded_by::text = requesting_user_id() and
    exists (
      select 1 from cases
      where cases.id = documents.case_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

create policy "documents: soft delete own uploads"
  on documents for update
  using (uploaded_by::text = requesting_user_id());

-- document_access_log
create policy "document_access_log: insert own"
  on document_access_log for insert
  with check (accessed_by::text = requesting_user_id());

create policy "document_access_log: read if case member"
  on document_access_log for select
  using (
    exists (
      select 1 from documents
      join cases on cases.id = documents.case_id
      where documents.id = document_access_log.document_id
      and (
        cases.client_id::text = requesting_user_id() or
        cases.lawyer_id::text = requesting_user_id()
      )
    )
  );

-- reviews
create policy "reviews: public read unflagged"
  on reviews for select
  using (flagged = false);

create policy "reviews: insert own"
  on reviews for insert
  with check (reviewer_id::text = requesting_user_id());

-- notifications
create policy "notifications: read own"
  on notifications for select
  using (user_id::text = requesting_user_id());

create policy "notifications: update own"
  on notifications for update
  using (user_id::text = requesting_user_id());

create policy "notifications: insert"
  on notifications for insert
  with check (true); -- server inserts on behalf of any user

-- ─── Service role bypass ──────────────────────────────────────────────────────
-- When using createServiceRoleClient in webhook handlers and admin ops,
-- RLS is bypassed entirely. No additional policies needed for those operations.
