-- What Whop pays out for a payment after its fees (SPEC M2.16): Whop's own
-- amount_after_fees on the payment, in the currency's minor units like
-- `amount`, so Whop's fee is amount - net (payments.ts keeps net <= amount;
-- the check doesn't, so an odd answer from Whop never stops a payment being
-- recorded). Right after a payment Whop still says the whole amount, so it's
-- usually filled in later by the hourly payments:fees job (fillNets in
-- server/utils/payments.ts). Null until then (payments recorded before
-- 2026-10-15 too, until the job reaches them); the admin pages count those as
-- "not counted yet".
alter table payments add column net integer check (net is null or net >= 0);

-- A payment of nothing (a 100% promo code) paid Whop nothing either.
update payments set net = 0 where amount = 0 and net is null;
