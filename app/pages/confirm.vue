<script setup lang="ts">
// Where sign-in and email-confirmation links land. The Supabase client
// finishes the sign-in from the URL; then we go where the user was headed.
import { Loader2 } from '@lucide/vue'

useHead({ title: 'Signing in · Highreel' })

const user = useSupabaseUser()
const redirect = useSupabaseCookieRedirect()
const route = useRoute()
const failed = computed(() => typeof route.query.error_description === 'string' ? route.query.error_description : null)

watch(user, (u) => {
  if (u)
    navigateTo(redirect.pluck() || '/app')
}, { immediate: true })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
    <template v-if="failed">
      <p class="text-[22px] font-semibold tracking-[-0.02em]">That link didn't work</p>
      <p class="text-[14px] text-muted-foreground">{{ failed }}</p>
      <NuxtLink to="/login" class="text-[14px] underline underline-offset-4">Back to sign in</NuxtLink>
    </template>
    <template v-else>
      <Loader2 class="size-4 animate-spin text-muted-foreground" />
      <p class="text-[13px] text-muted-foreground">Signing you in…</p>
    </template>
  </main>
</template>
