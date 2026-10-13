// Hourly (server/schedule.ts): expired sessions and sign-in links, idle
// rate-limit counts. The privacy policy's "Sign-in records".
export default defineTask({
  meta: { description: 'Delete expired sessions and sign-in links, and rate-limit counts idle for an hour' },
  async run({ context }) {
    const result = await cleanupAuth(taskBindings(context))
    console.log('[cleanup:auth]', JSON.stringify(result))
    return { result }
  },
})
