// When the scheduled jobs run (SPEC M2.14 P4), in UTC. Nitro's scheduledTasks
// (nuxt.config.ts) read this, and wrangler.jsonc's `triggers.crons` must list
// the same expressions: a Cron Trigger runs the tasks of the expression it
// fires for, so one missing there never runs (tests/cloudflare.test.ts checks).
// The dev server runs them on this schedule too.
export const SCHEDULE: Record<string, string[]> = {
  // Expired sessions and sign-in links, idle rate-limit counts: the privacy
  // policy deletes them when a session ends, and the counts within a day.
  '0 * * * *': ['cleanup:auth'],
  // Demos nobody kept, 30 days after they started; accounts the owner was asked to delete.
  '0 3 * * *': ['cleanup:demo', 'accounts:delete'],
}
