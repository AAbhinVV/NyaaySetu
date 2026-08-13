-- Security and integrity hardening for the Clerk-authenticated server API.
-- Authenticated mutations use a server-only service role after Clerk and DB
-- authorization. Direct anon/authenticated PostgREST access remains read-only.

alter table users
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_unique
  on notifications(dedupe_key);

update users
set onboarding_completed = true
where phone is not null and city is not null and state is not null;

create unique index if not exists lawyers_one_profile_per_user
  on lawyers(user_id);

create unique index if not exists cases_one_per_connection
  on cases(connection_id);

create unique index if not exists payments_one_captured_per_connection
  on payments(connection_id)
  where status = 'CAPTURED';

create unique index if not exists e_tokens_one_per_case
  on e_tokens(case_id);

alter table lawyers
  add constraint lawyers_fee_nonnegative check (fee_per_consultation >= 0) not valid,
  add constraint lawyers_experience_range check (years_of_experience between 0 and 80) not valid,
  add constraint lawyers_win_rate_range check (win_rate between 0 and 100) not valid,
  add constraint lawyers_counts_nonnegative check (total_cases >= 0 and review_count >= 0) not valid,
  add constraint lawyers_rating_range check (avg_rating between 0 and 5) not valid;

alter table payments
  add constraint payments_amount_positive check (amount > 0) not valid;

alter table cases
  add constraint cases_lawyer_profile_fkey
    foreign key (lawyer_id) references lawyers(user_id) on delete restrict;

alter table connections
  add constraint connections_lawyer_profile_fkey
    foreign key (lawyer_id) references lawyers(user_id) on delete restrict;

alter table reviews
  add constraint reviews_lawyer_profile_fkey
    foreign key (lawyer_id) references lawyers(user_id) on delete restrict;

create table if not exists saved_lawyers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  lawyer_id uuid not null references lawyers(id) on delete cascade,
  saved_at timestamptz not null default now(),
  constraint saved_lawyers_unique_pair unique (client_id, lawyer_id)
);

create index if not exists idx_saved_lawyers_client
  on saved_lawyers(client_id, saved_at desc);

alter table saved_lawyers enable row level security;

-- The app does not authenticate users with Supabase Auth. Prevent direct
-- browser mutations; the server performs authorization before using service role.
drop policy if exists "users: update own row" on users;
drop policy if exists "lawyers: insert own" on lawyers;
drop policy if exists "lawyers: update own" on lawyers;
drop policy if exists "connections: insert" on connections;
drop policy if exists "connections: update own" on connections;
drop policy if exists "payments: insert own" on payments;
drop policy if exists "cases: insert" on cases;
drop policy if exists "cases: update own" on cases;
drop policy if exists "case_timeline: insert if case member" on case_timeline;
drop policy if exists "case_messages: insert if case member" on case_messages;
drop policy if exists "documents: insert if case member" on documents;
drop policy if exists "documents: soft delete own uploads" on documents;
drop policy if exists "document_access_log: insert own" on document_access_log;
drop policy if exists "reviews: insert own" on reviews;
drop policy if exists "notifications: update own" on notifications;
drop policy if exists "notifications: insert" on notifications;

-- Reproducible private storage configuration. All object access is mediated by
-- authenticated server routes that issue short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

-- Atomic lawyer acceptance: lock the connection, verify captured payment, and
-- create the case, token, timeline, and notification in one transaction.
create or replace function accept_connection_and_create_case(
  p_connection_id uuid,
  p_lawyer_id uuid
) returns cases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_connection connections%rowtype;
  v_lawyer lawyers%rowtype;
  v_case cases%rowtype;
  v_token text;
  v_category case_category;
begin
  select * into v_connection
  from connections
  where id = p_connection_id and lawyer_id = p_lawyer_id
  for update;

  if not found then
    raise exception 'Connection not found';
  end if;
  if v_connection.status <> 'PENDING' then
    raise exception 'Connection is not pending';
  end if;
  if not exists (
    select 1 from payments
    where connection_id = p_connection_id and status = 'CAPTURED'
  ) then
    raise exception 'Captured payment required';
  end if;

  select * into strict v_lawyer from lawyers where user_id = p_lawyer_id;
  v_category := v_lawyer.specializations[1];
  v_token := 'NYS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;

  update connections
  set status = 'ACTIVE', accepted_at = now(), decline_reason = null
  where id = p_connection_id;

  insert into cases (
    connection_id, client_id, lawyer_id, title, category, status,
    jurisdiction_city, jurisdiction_state, e_token
  ) values (
    v_connection.id,
    v_connection.client_id,
    v_connection.lawyer_id,
    coalesce(initcap(replace(v_category::text, '_', ' ')) || ' Legal Matter', 'Legal Matter'),
    v_category,
    'IN_PROGRESS',
    v_lawyer.city,
    v_lawyer.state,
    v_token
  ) returning * into v_case;

  insert into case_timeline (case_id, event_type, description, created_by)
  values (v_case.id, 'CASE_CREATED', 'Case created after lawyer accepted connection request', p_lawyer_id);

  insert into e_tokens (case_id, token_number, status)
  values (v_case.id, v_token, 'ACTIVE');

  insert into notifications (user_id, type, title, body, case_id)
  values (
    v_connection.client_id,
    'CONNECTION_ACCEPTED',
    'Your lawyer has accepted your request',
    'Your connection has been accepted. Your case has been created and is now active.',
    v_case.id
  );

  return v_case;
end;
$$;

create or replace function schedule_case_hearing(
  p_case_id uuid,
  p_lawyer_id uuid,
  p_hearing_date timestamptz,
  p_court_name text,
  p_notes text default null
) returns cases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_case cases%rowtype;
begin
  select * into v_case
  from cases
  where id = p_case_id and lawyer_id = p_lawyer_id
  for update;

  if not found then raise exception 'Case not found'; end if;
  if v_case.status = 'CLOSED' then raise exception 'Case is closed'; end if;

  update cases
  set next_hearing_at = p_hearing_date,
      court_name = p_court_name,
      status = 'HEARING_SET'
  where id = p_case_id
  returning * into v_case;

  update e_tokens
  set hearing_date = p_hearing_date, court_name = p_court_name
  where case_id = p_case_id;

  insert into case_timeline (case_id, event_type, description, created_by)
  values (
    p_case_id,
    'HEARING_SCHEDULED',
    'Hearing scheduled at ' || p_court_name || ' on ' || p_hearing_date::text ||
      case when p_notes is null or btrim(p_notes) = '' then '' else '. Notes: ' || p_notes end,
    p_lawyer_id
  );

  insert into notifications (user_id, type, title, body, case_id)
  values (
    v_case.client_id,
    'HEARING_SCHEDULED',
    'Hearing date set',
    'Your hearing has been scheduled at ' || p_court_name || ' on ' || p_hearing_date::date::text,
    p_case_id
  );

  return v_case;
end;
$$;

create or replace function close_case_with_verdict(
  p_case_id uuid,
  p_lawyer_id uuid,
  p_outcome verdict_outcome,
  p_summary text default null
) returns cases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_case cases%rowtype;
begin
  select * into v_case
  from cases
  where id = p_case_id and lawyer_id = p_lawyer_id
  for update;

  if not found then raise exception 'Case not found'; end if;
  if v_case.status = 'CLOSED' then raise exception 'Verdict already recorded'; end if;

  update cases
  set status = 'CLOSED',
      verdict_outcome = p_outcome,
      verdict_summary = nullif(btrim(p_summary), ''),
      closed_at = now()
  where id = p_case_id
  returning * into v_case;

  insert into case_timeline (case_id, event_type, description, created_by)
  values (
    p_case_id,
    'VERDICT_RECORDED',
    'Verdict recorded: ' || p_outcome::text ||
      case when p_summary is null or btrim(p_summary) = '' then '' else '. ' || p_summary end,
    p_lawyer_id
  );

  insert into notifications (user_id, type, title, body, case_id)
  values (
    v_case.client_id,
    'VERDICT',
    'Your case verdict is in',
    'Your case outcome: ' || p_outcome::text || '. You can now leave a review for your lawyer.',
    p_case_id
  );

  return v_case;
end;
$$;

create or replace function register_case_document(
  p_case_id uuid,
  p_uploaded_by uuid,
  p_file_name text,
  p_storage_path text,
  p_sha512_hash text
) returns documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_case cases%rowtype;
  v_document documents%rowtype;
  v_recipient uuid;
begin
  select * into v_case from cases where id = p_case_id for update;
  if not found or (v_case.client_id <> p_uploaded_by and v_case.lawyer_id <> p_uploaded_by) then
    raise exception 'Case not found';
  end if;
  if v_case.status = 'CLOSED' then raise exception 'Case is closed'; end if;
  if p_sha512_hash !~ '^[0-9a-f]{128}$' then raise exception 'Invalid SHA-512 hash'; end if;

  insert into documents (case_id, file_name, file_url, sha512_hash, chain_tx_id, uploaded_by)
  values (p_case_id, p_file_name, p_storage_path, p_sha512_hash, 'pending', p_uploaded_by)
  returning * into v_document;

  insert into case_timeline (case_id, event_type, description, created_by)
  values (p_case_id, 'DOCUMENT_UPLOADED', 'Document uploaded: ' || p_file_name, p_uploaded_by);

  v_recipient := case when p_uploaded_by = v_case.client_id then v_case.lawyer_id else v_case.client_id end;
  insert into notifications (user_id, type, title, body, case_id)
  values (
    v_recipient,
    'DOCUMENT_UPLOADED',
    'New document uploaded',
    'A new document "' || p_file_name || '" has been uploaded to your case.',
    p_case_id
  );

  return v_document;
end;
$$;

create or replace function soft_delete_case_document(
  p_document_id uuid,
  p_deleted_by uuid
) returns documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_document documents%rowtype;
  v_case cases%rowtype;
  v_recipient uuid;
begin
  select * into v_document
  from documents
  where id = p_document_id and deleted_at is null
  for update;

  if not found then raise exception 'Document not found'; end if;
  if v_document.uploaded_by <> p_deleted_by then raise exception 'Only the uploader can delete this document'; end if;

  select * into strict v_case from cases where id = v_document.case_id for update;
  if v_case.client_id <> p_deleted_by and v_case.lawyer_id <> p_deleted_by then
    raise exception 'Case access denied';
  end if;
  if v_case.status = 'CLOSED' then raise exception 'Case is closed'; end if;

  update documents
  set deleted_at = now()
  where id = p_document_id
  returning * into v_document;

  insert into case_timeline (case_id, event_type, description, created_by)
  values (v_case.id, 'DOCUMENT_DELETED', 'Document removed: ' || v_document.file_name, p_deleted_by);

  v_recipient := case when p_deleted_by = v_case.client_id then v_case.lawyer_id else v_case.client_id end;
  insert into notifications (user_id, type, title, body, case_id)
  values (
    v_recipient,
    'DOCUMENT_DELETED',
    'Document removed',
    'A document was removed from your case: "' || v_document.file_name || '".',
    v_case.id
  );

  return v_document;
end;
$$;

revoke all on function accept_connection_and_create_case(uuid, uuid) from public, anon, authenticated;
revoke all on function schedule_case_hearing(uuid, uuid, timestamptz, text, text) from public, anon, authenticated;
revoke all on function close_case_with_verdict(uuid, uuid, verdict_outcome, text) from public, anon, authenticated;
revoke all on function register_case_document(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function soft_delete_case_document(uuid, uuid) from public, anon, authenticated;
grant execute on function accept_connection_and_create_case(uuid, uuid) to service_role;
grant execute on function schedule_case_hearing(uuid, uuid, timestamptz, text, text) to service_role;
grant execute on function close_case_with_verdict(uuid, uuid, verdict_outcome, text) to service_role;
grant execute on function register_case_document(uuid, uuid, text, text, text) to service_role;
grant execute on function soft_delete_case_document(uuid, uuid) to service_role;

create or replace function refresh_lawyer_review_stats()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lawyer_id uuid;
begin
  v_lawyer_id := case when tg_op = 'DELETE' then old.lawyer_id else new.lawyer_id end;
  update lawyers
  set avg_rating = coalesce((
        select round(avg(rating)::numeric, 2) from reviews
        where lawyer_id = v_lawyer_id and flagged = false
      ), 0),
      review_count = (
        select count(*) from reviews
        where lawyer_id = v_lawyer_id and flagged = false
      )
  where user_id = v_lawyer_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_refresh_lawyer_stats on reviews;
create trigger trg_reviews_refresh_lawyer_stats
after insert or update or delete on reviews
for each row execute function refresh_lawyer_review_stats();

create or replace function refresh_lawyer_case_stats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update lawyers
  set total_cases = (
        select count(*) from cases
        where lawyer_id = new.lawyer_id
          and status = 'CLOSED'
          and verdict_outcome is not null
      ),
      win_rate = coalesce((
        select round(100.0 * count(*) filter (where verdict_outcome = 'WON') / nullif(count(*), 0))::integer
        from cases
        where lawyer_id = new.lawyer_id
          and status = 'CLOSED'
          and verdict_outcome is not null
      ), 0)
  where user_id = new.lawyer_id;
  return new;
end;
$$;

drop trigger if exists trg_cases_refresh_lawyer_stats on cases;
create trigger trg_cases_refresh_lawyer_stats
after insert or update of status, verdict_outcome on cases
for each row execute function refresh_lawyer_case_stats();
