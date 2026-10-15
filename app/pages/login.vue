<script setup lang="ts">
// Sign in (SPEC M2a.2, M2.14 P3): an email link, Google (when configured), or
// a demo session without an account. Turnstile (BotCheck) vouches for the
// first and the last. ?next= is where to go afterwards; ?demo=1 starts a demo
// at once (the landing's "Try the demo"); ?expired=1 says why you're here;
// ?error= is a Google sign-in that failed.
import { ArrowRight, Loader2, Mail } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const config = useRuntimeConfig()
const route = useRoute()
const auth = useAuth()

// The landing's "Get started" lands here too: the same email link creates the
// account for a new address, so only the heading changes.
const heading = computed(() => (route.query.start === '1' ? 'Get started' : 'Sign in'))
useHead({ title: () => `${heading.value} · Highreel` })
usePublicAnalytics()

const bot = ref<{ token: () => Promise<string> }>()
const email = ref('')
const sent = ref(false)
const busy = ref<null | 'email' | 'google' | 'demo'>(null)
const error = ref<string | null>(null)
const isDev = import.meta.dev
const expired = computed(() => route.query.expired === '1')
const next = computed(() => safeNext(route.query.next))

// What Google's errors mean (Better Auth sends ?error= back here).
const GOOGLE_ERRORS: Record<string, string> = {
  access_denied: 'Google sign-in was canceled.',
  account_not_linked: 'That email already signs in with an email link. Use the link once, then Google works too.',
  email_not_found: 'Google didn\'t share an email address. Use an email link instead.',
}
const googleError = computed(() => {
  const code = route.query.error
  return typeof code === 'string' ? GOOGLE_ERRORS[code] ?? 'Google sign-in didn\'t work. Try again, or use an email link.' : null
})

async function sendLink() {
  error.value = null
  busy.value = 'email'
  try {
    await auth.sendLink(email.value.trim(), next.value, await bot.value!.token())
    sent.value = true
  }
  catch (e) {
    error.value = authError(e, 'We couldn\'t send the link. Try again.')
  }
  busy.value = null
}

async function google() {
  error.value = null
  busy.value = 'google'
  try {
    await auth.google(next.value)
  }
  catch {
    busy.value = null
    error.value = 'Google sign-in isn\'t available right now. Use an email link instead.'
  }
}

async function demo() {
  error.value = null
  busy.value = 'demo'
  // Already in a demo: carry on with it.
  if (auth.user.value?.isAnonymous)
    return navigateTo('/app')
  try {
    await auth.startDemo(await bot.value!.token())
  }
  catch (e) {
    busy.value = null
    error.value = authError(e, 'We couldn\'t start a demo. Try again.')
    return
  }
  // The home opens a first draft for a new demo (SPEC M2.5 P3).
  await navigateTo('/app?start=demo')
}

onMounted(async () => {
  const user = await auth.ensure()
  // Signed in with an account: nothing to do here.
  if (user && !user.isAnonymous)
    return navigateTo(next.value)
  if (route.query.demo === '1')
    demo()
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-[76px] shrink-0 items-center justify-between px-5 md:px-10">
      <NuxtLink to="/" class="text-[26px] font-bold tracking-[-0.035em]"><Wordmark /></NuxtLink>
      <ThemeToggle />
    </header>
    <main class="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-7 px-4 pb-24">
      <div class="flex flex-col gap-2 text-center">
        <h1 class="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">{{ heading }}</h1>
        <p class="text-[17px] font-medium text-muted-foreground">Upload a sheet, brand it, and send every customer their own Highreel.</p>
      </div>

      <p v-if="expired && !sent" class="rounded-2xl bg-muted px-4 py-3 text-[14px]" role="status">
        Your session ended, so we signed you out. Sign in again, or start a new demo session.
      </p>
      <p v-else-if="googleError && !sent" class="rounded-2xl bg-muted px-4 py-3 text-[14px]" role="status">
        {{ googleError }}
      </p>

      <div v-if="sent" class="flex flex-col gap-2 rounded-[24px] bg-muted p-5" role="status">
        <p class="flex items-center gap-2 text-[16px] font-semibold"><Mail class="size-4" /> Check your email</p>
        <p class="text-[14px] text-muted-foreground">We sent a sign-in link to <span class="font-medium text-foreground">{{ email }}</span>. It works for an hour.</p>
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
          <!-- Google's own "G" in its four colours, unchanged, as its sign-in branding asks. -->
          <svg v-else data-google-logo viewBox="0 0 48 48" class="size-[18px]" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Sign in with Google
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

      <BotCheck ref="bot" />

      <p class="text-center text-[13px] text-muted-foreground" data-testid="legal-note">
        By continuing you agree to our <NuxtLink to="/terms" class="underline underline-offset-2 hover:text-foreground">terms</NuxtLink>
        and <NuxtLink to="/privacy" class="underline underline-offset-2 hover:text-foreground">privacy policy</NuxtLink>.
      </p>

      <p v-if="error" class="text-center text-[14px] text-destructive" role="alert">{{ error }}</p>
    </main>
  </div>
</template>
