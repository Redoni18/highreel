// Hourly (server/schedule.ts): Whop's fee on payments recorded before Whop had
// worked it out (SPEC M2.16), for the admin pages' "Whop's fees" and "Taken
// home". Nothing to do while checkout is off.
export default defineTask({
  meta: { description: 'Ask Whop for its fee on payments that don\'t have it yet' },
  async run({ context }) {
    const w = whopFrom(useRuntimeConfig())
    if (!w)
      return { result: { checked: 0, filled: 0 } }
    const result = await fillNets(taskBindings(context), w)
    console.log('[payments:fees]', JSON.stringify(result))
    return { result }
  },
})
