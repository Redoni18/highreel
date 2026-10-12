<script setup lang="ts">
// Shown in demo (anonymous) sessions: add an email to keep the work. The
// confirmation link turns the same user into a permanent account (SPEC M2a.3).
import { toast } from 'vue-sonner'

const supabase = useSupabaseClient()
const emit = defineEmits<{ kept: [] }>()
const email = ref('')
const sending = ref(false)
const sentTo = ref<string | null>(null)

async function keep() {
  sending.value = true
  const { error } = await supabase.auth.updateUser(
    { email: email.value.trim() },
    { emailRedirectTo: `${window.location.origin}/confirm` },
  )
  sending.value = false
  if (error) {
    toast.error('Couldn\'t send the link', { description: error.message })
    return
  }
  // With email confirmations off (some local setups) the change applies at once.
  const { data } = await supabase.auth.refreshSession()
  if (data.user && !data.user.is_anonymous) {
    toast.success('Your work is saved', { description: `Sign in with ${data.user.email} from now on.` })
    emit('kept')
    return
  }
  sentTo.value = email.value.trim()
}
</script>

<template>
  <div class="flex h-9 shrink-0 items-center gap-3 bg-primary/8 px-3 text-[13px]">
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
  </div>
</template>
