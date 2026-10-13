-- Blocked addresses (SPEC M2.15): an admin blocks an account that abuses
-- Highreel, from the admin pages (server/utils/moderation.ts). While its
-- address is here, it can't sign in or sign up again (no sign-in link is sent,
-- and Better Auth won't start a session for it or create a user with it:
-- server/utils/auth.ts), and the account's published Highreels don't open
-- (server/utils/recap.ts). Blocking also ends the account's sessions.
-- Removing an account from the admin pages can leave its address here, so it
-- can't come back with a new account. Unblocking deletes the row.
--
-- Like account_deletions, the table has no business: it's about an address.
-- The privacy policy says it's kept until the block is lifted.
create table blocked_emails (
  -- lowercased, like Better Auth's addresses
  email text primary key check (email = lower(email) and length(email) between 3 and 320),
  -- the admin's note, for the next admin
  reason text check (reason is null or length(reason) <= 300),
  -- the admin who blocked it (gone if that account is deleted)
  blocked_by text references "user"(id) on delete set null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
