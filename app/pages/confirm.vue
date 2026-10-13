<script setup lang="ts">
// Where sign-in links land (SPEC M2.14 P3): /confirm?token=…&next=…[&keep=1].
// The page signs in from its script (Better Auth's GET /magic-link/verify),
// so link checkers and chat previews that fetch the link without running it
// can't use up the one-time token first. Then on to `next`. A "Keep my work"
// link (keep=1) opened outside the demo's browser also claims the demo here.
import { Loader2 } from '@lucide/vue'

useHead({ title: 'Signing in · Highreel' })

const route = useRoute()
const auth = useAuth()
const failed = ref(false)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  // On success Better Auth answers with the session (and its cookie); a used,
  // expired or unknown token is a redirect, which `manual` leaves unfollowed.
  const res = token
    ? await fetch(`/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`, { redirect: 'manual' }).catch(() => null)
    : null
  if (!res?.ok) {
    failed.value = true
    return
  }
  if (route.query.keep === '1')
    await $fetch('/api/account/keep', { method: 'POST', body: { token } }).catch(() => {})
  await auth.refresh()
  await navigateTo(safeNext(route.query.next), { replace: true })
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
    <template v-if="failed">
      <p class="text-[22px] font-semibold tracking-[-0.02em]">That link didn't work</p>
      <p class="text-[14px] text-muted-foreground">It may have expired (links work for an hour) or been used already. Ask for a new one.</p>
      <NuxtLink to="/login" class="text-[14px] underline underline-offset-4">Back to sign in</NuxtLink>
    </template>
    <template v-else>
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
      <p class="text-[13px] text-muted-foreground">Signing you in…</p>
    </template>
  </main>
</template>
