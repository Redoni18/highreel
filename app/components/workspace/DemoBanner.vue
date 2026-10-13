<script setup lang="ts">
// Shown in demo (anonymous) sessions: add an email to keep the work (SPEC
// M2a.3, M2.14 P3). The emailed link signs in to the account for that address
// (a new one, or one without Highreels yet) and this demo's work moves into
// it; opened in another browser, /confirm moves it there. An address whose
// account already has Highreels is refused before anything is sent.
// Turnstile vouches for the request (BotCheck, loaded on first use).
import { toast } from 'vue-sonner'

const auth = useAuth()
const route = useRoute()
const bot = ref<{ token: () => Promise<string> }>()
const email = ref('')
const sending = ref(false)
const sentTo = ref<string | null>(null)

async function keep() {
  sending.value = true
  try {
    await auth.sendLink(email.value.trim(), route.fullPath, await bot.value!.token(), true)
    sentTo.value = email.value.trim()
  }
  catch (e) {
    toast.error('Couldn\'t send the link', { description: authError(e, 'Try again in a moment.') })
  }
  sending.value = false
}
</script>

<template>
  <div class="relative flex h-9 shrink-0 items-center gap-3 bg-primary/8 px-3 text-[13px]">
    <span class="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-medium text-primary-foreground">Demo session</span>
    <template v-if="sentTo">
      <span class="text-muted-foreground">Check {{ sentTo }} and open the link to keep this work.</span>
    </template>
    <template v-else>
      <span class="hidden text-foreground/75 sm:inline">This work lives only in this browser. Add your email to keep it.</span>
      <form class="ml-auto flex items-center gap-1.5" @submit.prevent="keep">
        <input
          v-model="email"
          type="email"
          required
          placeholder="you@business.com"
          aria-label="Email to keep this work"
          class="h-7 w-56 rounded-full border border-transparent bg-background px-3 text-[13px] outline-none focus-visible:border-primary"
        >
        <button type="submit" :disabled="sending" class="h-7 rounded-full bg-foreground px-3 font-medium text-background transition-transform active:scale-[0.97] disabled:opacity-50">
          {{ sending ? 'Sending…' : 'Keep my work' }}
        </button>
      </form>
    </template>
    <!-- Shows only if Cloudflare wants a click. -->
    <BotCheck ref="bot" lazy class="absolute top-10 right-3 z-50" />
  </div>
</template>
