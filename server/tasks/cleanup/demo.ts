// Daily (server/schedule.ts): demo sessions nobody kept, 30 days after they
// started, with their business and files. The privacy policy's "The demo".
export default defineTask({
  meta: { description: 'Delete demo sessions started more than 30 days ago, with their files' },
  async run({ context }) {
    const result = await cleanupDemos(taskBindings(context))
    console.log('[cleanup:demo]', JSON.stringify(result))
    return { result }
  },
})
