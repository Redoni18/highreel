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
  const auth = useAuth()
  const route = useRoute()

  /** The server says the session is gone: sign in again, and come back here. */
  async function endSession() {
    if (ending)
      return
    ending = true
    auth.forget()
    await navigateTo({ path: '/login', query: { expired: '1', next: route.fullPath } })
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
    await auth.signOut()
    await navigateTo('/login')
  }

  /** Upload a shrunk logo or photo (SPEC M2.14 P2); the server picks its path in the business's folder. */
  async function uploadMedia(blob: Blob, query: { kind: 'logo' } | { kind: 'photo', campaign: string }): Promise<string> {
    const { path } = await api<{ path: string }>('/api/media', { method: 'POST', query, body: blob, headers: { 'content-type': blob.type } })
    return path
  }

  /** Delete files the business no longer uses; a failure only leaves a stray file behind. */
  async function deleteMedia(paths: string[]) {
    if (paths.length)
      await api('/api/media', { method: 'DELETE', body: { paths } }).catch(() => {})
  }

  return { api, fail, endSession, signOut, uploadMedia, deleteMedia }
}
