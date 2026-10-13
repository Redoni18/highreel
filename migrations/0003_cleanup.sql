-- Scheduled jobs (SPEC M2.14 P4, server/utils/cleanup.ts).

-- Account deletions. The privacy policy deletes an account within 30 days of
-- asking. There's no admin route: the owner adds the address here,
--   corepack pnpm exec wrangler d1 execute highreel --remote --command "insert into account_deletions (email) values ('ana@example.com')"
-- and the daily job (accounts:delete) deletes that account's files and its
-- user, whose sessions, business and everything in the business cascade, then
-- marks the request done:
--   corepack pnpm exec wrangler d1 execute highreel --remote --command "select * from account_deletions"
-- A done request (the address and dates) is kept 30 days, to confirm it to
-- whoever asked, then the job removes it. Nothing in the app reads or writes
-- this table, and it belongs to no business.
create table account_deletions (
  id integer primary key,
  email text not null check (email like '%_@_%'),
  requested_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  done_at text,
  -- 'deleted', or 'no account' (no account at that address: a typo, or a demo's)
  result text check (result in ('deleted', 'no account')),
  check ((done_at is null) = (result is null))
);

-- The demo cleanup's lookup (anonymous users by age) without reading every user.
-- Better Auth's schema check (tests/auth.test.ts) compares columns, not indexes.
create index user_demo_created on "user" ("createdAt") where "isAnonymous" = 1;
