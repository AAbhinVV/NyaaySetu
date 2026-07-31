import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('API authorization uses the database role and blocks suspended users', async () => {
    const source = await read('src/server/trpc/init.ts')
    assert.match(source, /select\('id, role, suspended'\)/)
    assert.match(source, /ctx\.suspended/)
    assert.doesNotMatch(source, /unsafeMetadata|set_config/)
})

test('public lawyer profiles do not embed unmoderated reviews or private proof fields', async () => {
    const source = await read('src/server/trpc/router/lawyer.router.ts')
    const publicProfile = source.slice(source.indexOf('getById:'), source.indexOf('getReviews:'))
    assert.doesNotMatch(publicProfile, /verification_document_url|bar_council_id|phone|email/)
    assert.doesNotMatch(publicProfile, /reviews\s*\(/)
})

test('hardening migration denies browser mutations and exposes atomic service RPCs', async () => {
    const migration = await read('supabase/migrations/20260801090000_security_integrity_hardening.sql')
    assert.match(migration, /drop policy if exists "notifications: insert"/)
    assert.match(migration, /create or replace function accept_connection_and_create_case/)
    assert.match(migration, /create or replace function register_case_document/)
    assert.match(migration, /create or replace function soft_delete_case_document/)
    assert.match(migration, /revoke all on function soft_delete_case_document.*authenticated/)
})

test('Clerk deletion preserves legal records through anonymization', async () => {
    const webhook = await read('src/app/api/webhooks/clerk/route.ts')
    assert.match(webhook, /deleted_at/)
    assert.doesNotMatch(webhook, /from\('users'\)[\s\S]{0,80}\.delete\(/)
})
