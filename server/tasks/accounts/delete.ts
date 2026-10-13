// Daily (server/schedule.ts): the accounts the owner was asked to delete,
// listed in account_deletions (migrations/0003_cleanup.sql has the commands).
// The privacy policy deletes an account within 30 days of asking.
export default defineTask({
  meta: { description: 'Delete the accounts listed in account_deletions' },
  async run({ context }) {
    const result = await deleteRequestedAccounts(taskBindings(context))
    console.log('[accounts:delete]', JSON.stringify(result))
    return { result }
  },
})
