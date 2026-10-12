<script setup lang="ts">
// Sign in (SPEC M2a.2): magic link, Google (when configured), or a demo
// session without an account (Supabase anonymous sign-in).
import { ArrowRight, Loader2, Mail } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

useHead({ title: 'Sign in · Highreel' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const config = useRuntimeConfig()
const route = useRoute()

const email = ref('')
const sent = ref(false)
const busy = ref<null | 'email' | 'google' | 'demo'>(null)
const error = ref<string | null>(null)
const isDev = import.meta.dev
const expired = computed(() => route.query.expired === '1')

// Signed-in (non-demo) users skip this page.
watch(user, (u) => {
  if (u && !u.is_anonymous)
    navigateTo('/app')
}, { immediate: true })

const callback = () => `${window.location.origin}/confirm`

async function sendLink() {
  error.value = null
  busy.value = 'email'
  const { error: e } = await supabase.auth.signInWithOtp({
    email: email.value.trim(),
    options: { emailRedirectTo: callback() },
  })
  busy.value = null
  if (e)
    error.value = e.message
  else
    sent.value = true
}

async function google() {
  error.value = null
  busy.value = 'google'
  const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
  if (e) {
    busy.value = null
    error.value = e.message
  }
}

async function demo() {
  error.value = null
  busy.value = 'demo'
  const { error: e } = await supabase.auth.signInAnonymously()
  if (e) {
    busy.value = null
    error.value = e.message
    return
  }
  // The home opens a first draft for a new demo (SPEC M2.5 P3).
  await navigateTo('/app?start=demo')
}

onMounted(() => {
  if (route.query.demo === '1' && !user.value)
    demo()
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-[76px] shrink-0 items-center px-5 md:px-10">
      <NuxtLink to="/" class="text-[23px] font-bold tracking-[-0.035em]">highreel</NuxtLink>
    </header>
    <main class="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-7 px-4 pb-24">
      <div class="flex flex-col gap-2 text-center">
        <h1 class="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">Sign in</h1>
        <p class="text-[17px] font-medium text-muted-foreground">Upload a sheet, brand it, and send every customer their own highlight reel.</p>
      </div>

      <p v-if="expired && !sent" class="rounded-2xl bg-muted px-4 py-3 text-[14px]" role="status">
        Your session ended, so we signed you out. Sign in again, or start a new demo session.
      </p>

      <div v-if="sent" class="flex flex-col gap-2 rounded-[24px] bg-muted p-5" role="status">
        <p class="flex items-center gap-2 text-[16px] font-semibold"><Mail class="size-4" /> Check your email</p>
        <p class="text-[14px] text-muted-foreground">We sent a sign-in link to <span class="font-medium text-foreground">{{ email }}</span>. Open it on this device.</p>
        <p v-if="isDev" class="text-[13px] text-muted-foreground">
          Local development: the email is in <a href="http://127.0.0.1:54424" target="_blank" rel="noopener" class="underline">Mailpit</a>.
        </p>
        <button type="button" class="self-start text-[13px] text-muted-foreground underline underline-offset-4" @click="sent = false">Use a different email</button>
      </div>

      <form v-else class="flex flex-col gap-3" @submit.prevent="sendLink">
        <div class="flex flex-col gap-1.5">
          <Label for="email" class="pl-4 text-[13px]">Work email</Label>
          <Input id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@business.com" class="h-12 rounded-full px-5 text-[16px] md:text-[16px]" />
        </div>
        <Button type="submit" size="lg" class="h-12 text-[16px]" :disabled="!!busy">
          <Loader2 v-if="busy === 'email'" class="animate-spin" />
          Email me a sign-in link
        </Button>
        <Button v-if="config.public.authGoogle" type="button" variant="outline" size="lg" class="h-12 text-[16px]" :disabled="!!busy" @click="google">
          <Loader2 v-if="busy === 'google'" class="animate-spin" />
          Continue with Google
        </Button>
      </form>

      <div class="flex items-center gap-3 text-[13px] text-muted-foreground">
        <span class="h-px flex-1 bg-border" /> or <span class="h-px flex-1 bg-border" />
      </div>

      <div class="flex flex-col items-center gap-2">
        <Button variant="secondary" size="lg" class="h-12 w-full text-[16px]" :disabled="!!busy" @click="demo">
          <Loader2 v-if="busy === 'demo'" class="animate-spin" />
          Try it without an account <ArrowRight />
        </Button>
        <p class="note-hand text-center text-[22px]">a demo lives in this browser; add your email later to keep it</p>
      </div>

      <p class="text-center text-[13px] text-muted-foreground" data-testid="legal-note">
        By continuing you agree to our <NuxtLink to="/terms" class="underline underline-offset-2 hover:text-foreground">terms</NuxtLink>
        and <NuxtLink to="/privacy" class="underline underline-offset-2 hover:text-foreground">privacy policy</NuxtLink>.
      </p>

      <p v-if="error" class="text-center text-[14px] text-destructive" role="alert">{{ error }}</p>
    </main>
  </div>
</template>
