<script setup lang="ts">
// The email footer's unsubscribe link (SPEC M2.8). A button, not the link
// itself, does it: mail scanners open links, and they shouldn't unsubscribe
// anyone. Mail apps' own one-click unsubscribe posts to the same route.
// The button is a form post, so it also works before hydration.
import { mix, readableOn } from '#shared/utils/color'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))
const { data, error } = await useFetch<{ business: { name: string, accent_color: string }, hasEmail: boolean, done: boolean }>(() => `/api/r/${token.value}/unsubscribe`, {
  key: () => `unsubscribe-${token.value}`,
})
if (import.meta.server && error.value) {
  const event = useRequestEvent()
  if (event)
    setResponseStatus(event, error.value.statusCode ?? 404)
}

const accent = computed(() => data.value?.business.accent_color ?? '#4560FF')
useHead({
  title: () => data.value ? `Unsubscribe from ${data.value.business.name}` : 'Unsubscribe',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }],
  bodyAttrs: { class: 'unsub-page' },
})

const busy = ref(false)
const done = ref(false)
watch(data, d => (done.value = !!d?.done), { immediate: true })
async function unsubscribe() {
  busy.value = true
  try {
    await $fetch(`/api/r/${token.value}/unsubscribe`, { method: 'POST' })
    done.value = true
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="page" :style="{ background: mix(accent, '#FFFFFF', 0.1) }">
    <div class="card">
      <template v-if="data">
        <span class="mark" :style="{ background: accent, color: readableOn(accent) }" aria-hidden="true">{{ data.business.name.charAt(0).toUpperCase() }}</span>
        <template v-if="done">
          <h1>You're unsubscribed.</h1>
          <p>{{ data.business.name }} won't email you highlight reels again. Your link still works.</p>
        </template>
        <template v-else-if="!data.hasEmail">
          <h1>Nothing to unsubscribe.</h1>
          <p>We don't have an email address for this highlight reel.</p>
        </template>
        <template v-else>
          <h1>Stop highlight reel emails from {{ data.business.name }}?</h1>
          <p>You won't get highlight reels by email from them again. Their other emails, if any, are up to them.</p>
          <!-- A plain form too, so it works before the page's script has loaded. -->
          <form method="post" :action="`/api/r/${token}/unsubscribe`" @submit.prevent="unsubscribe">
            <input type="hidden" name="page" value="1">
            <button type="submit" class="btn" :disabled="busy">{{ busy ? 'Unsubscribing…' : 'Unsubscribe' }}</button>
          </form>
        </template>
      </template>
      <template v-else>
        <h1>This link isn't valid.</h1>
        <p>It may be mistyped. Nothing was changed.</p>
      </template>
    </div>
  </main>
</template>

<style>
body.unsub-page { background: #FFFFFF; color: #222222; }
</style>

<style scoped>
.page {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 16px;
  font-family: var(--font-sans);
}
.card {
  display: flex;
  width: 100%;
  max-width: 420px;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 28px;
  border-radius: 24px;
  background: #FFFFFF;
  box-shadow: 0 10px 30px -12px rgb(0 0 0 / 0.18);
}
.mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  font-size: 18px;
  font-weight: 700;
}
h1 {
  font-size: 22px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.015em;
}
p {
  color: #6F6F6F;
  font-size: 15px;
  line-height: 1.5;
}
.btn {
  height: 44px;
  margin-top: 6px;
  padding: 0 22px;
  border-radius: 9999px;
  background: #222222;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 600;
}
.btn:disabled { opacity: 0.6; }
</style>
