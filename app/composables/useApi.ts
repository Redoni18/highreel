// Server calls from the signed-in pages (home and workspace). A 401 means the
// session is gone (signed out elsewhere, user deleted, demo session cleaned
// up): drop it in this browser and go sign in again.

import { toast } from 'vue-sonner'

export function errorMessage(e: unknown): string {
  const err = e as { data?: { message?: string }, message?: string }
  return err?.data?.message ?? err?.message ?? 'Something went wrong'
}

export function isUnauthorized(e: unknown): boolean {
  return (e as { statusCode?: number })?.statusCode === 401
}

let ending = false

export function useApi() {
  const supabase = useSupabaseClient()

  async function endSession() {
    if (ending)
      return
    ending = true
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    await navigateTo('/login?expired=1')
    ending = false
  }

  const api = $fetch.create({
    onResponseError({ response }) {
      if (response.status === 401)
        endSession()
    },
  })

  /** Error toast, except for 401s (those already go to the sign-in page). */
  function fail(title: string, e: unknown) {
    if (!isUnauthorized(e))
      toast.error(title, { description: errorMessage(e) })
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error)
      await supabase.auth.signOut({ scope: 'local' })
    await navigateTo('/login')
  }

  return { api, fail, endSession, signOut }
}
