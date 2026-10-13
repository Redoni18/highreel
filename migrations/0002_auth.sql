-- Sign-in on Better Auth (SPEC M2.14 P3): its tables, and businesses tied to
-- its users. Apply with `corepack pnpm db:migrate` (local) or
-- `wrangler d1 migrations apply highreel --remote` (P7).
--
-- Better Auth's tables are what its schema generator gives for our plugins
-- (anonymous, magic link, rate limits in the database), as of 1.7.7.
-- tests/auth.test.ts runs Better Auth's own migration check against these
-- migrations and fails when a plugin or an upgrade needs more, printing the
-- SQL to put in a new migration. Column names are Better Auth's (camelCase).
-- It writes times as ISO 8601 text, the same format as ours, and booleans as 0/1.

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "isAnonymous" integer);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create table "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

-- businesses.owner_id becomes a reference to the user, so deleting a user
-- (a demo after it's kept or cleaned up, an account deletion) deletes the
-- business and, by cascade, everything in it. SQLite can't add a foreign key
-- to an existing table, so the table is made again. The rows there were owned
-- by Supabase Auth's users, which don't exist here: nothing is live (SPEC
-- M2.14), so local data goes (campaigns and the rest cascade). A business's
-- files in R2 stay behind; `corepack pnpm db:reset` users can ignore them.
delete from businesses;
drop table businesses;
create table businesses (
  id text primary key,
  -- One business per user (Better Auth's user ids aren't UUIDs).
  owner_id text not null unique references "user" ("id") on delete cascade,
  name text not null,
  accent_color text not null default '#111111',
  logo_path text,
  logo_shape text not null default 'circle' check (logo_shape in ('circle', 'square')),
  website_url text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
