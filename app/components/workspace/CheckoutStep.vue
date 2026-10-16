<script setup lang="ts">
// The payment step of publishing (SPEC §10): Whop's checkout for this
// campaign, embedded in the publish dialog. The server makes the checkout
// (the size, its price, the campaign in its metadata); this mounts it in
// Whop's frames and says when it's paid. If Whop's script can't load (a
// blocker, offline), Whop's own checkout page takes the same payment.
import { ExternalLink, Loader2 } from '@lucide/vue'
import type { CheckoutSession } from '#shared/types/recap'
import { loadWhopElements, type WhopCheckoutHandle } from '~/utils/whopElements'

/** Beside the dialog's own summary (wide screens): Whop's summary keeps only its details link. */
const props = defineProps<{ split?: boolean }>()
const emit = defineEmits<{ paid: [payment: string] }>()
const ws = useWorkspace()
const { api } = useApi()
const { user } = useAuth()
const colorMode = useColorMode()

const session = ref<CheckoutSession | null>(null)
const error = ref<string | null>(null)
const embedFailed = ref(false)
const loading = ref(true)
const host = ref<HTMLElement | null>(null)
let handle: WhopCheckoutHandle | null = null
let stopped = false

// The landing's blue on the pay button, as a pill; the rest follows Whop's
// theme in our light or dark (its frames can't read our styles or fonts).
const BLUE = '#4560FF'
// Split, the dialog's left column says what's bought and its price, so
// Whop's order summary shrinks to its "Promo code & details" link (owner,
// 2026-10-16: the price there is redundant, the link isn't: it holds promo
// codes, the currency and the tax breakdown) and the form starts under it. A
// phone keeps Whop's whole summary. Whop takes visual declarations only, no
// layout: its own two columns start at 1024px, too wide for a dialog. The
// summary's grey and black text are the variant's checkout styling, inline on
// Whop's root, so a class can't change them: an inset shadow in the frame's
// background (#FFFFFF, #111111 in dark) paints over the grey, and dark gets
// its own link colour.
function appearance(dark: boolean, split: boolean) {
  return {
    theme: { appearance: dark ? 'dark' as const : 'light' as const, accentColor: 'indigo', grayColor: 'gray' },
    classes: {
      'whop-CheckoutPayButton': { backgroundColor: BLUE, color: '#FFFFFF', borderRadius: '9999px' },
      ...(split && {
        'whop-CheckoutDetails': { boxShadow: `inset 0 0 0 9999px ${dark ? '#111111' : '#FFFFFF'}`, padding: '0 16px' },
        'whop-CheckoutSellerLogo': { display: 'none' },
        'whop-CheckoutSeller': { display: 'none' },
        'whop-CheckoutItem': { display: 'none' },
        'whop-CheckoutItemHeadline': { display: 'none' },
        'whop-CheckoutPrice': { display: 'none' },
        ...(dark && { 'whop-CheckoutDetailsToggle': { color: '#A3A3A3' } }),
      }),
    },
  }
}
const dark = computed(() => colorMode.value === 'dark')
watch([dark, () => props.split], () => handle?.update({ appearance: appearance(dark.value, !!props.split) }))

onMounted(async () => {
  const id = ws.campaign.value!.id
  try {
    session.value = await api<CheckoutSession>(`/api/campaigns/${id}/checkout`, { method: 'POST' })
  }
  catch (e) {
    error.value = errorMessage(e)
    loading.value = false
    return
  }
  try {
    const WhopElements = await loadWhopElements()
    if (stopped || !host.value)
      return
    handle = WhopElements({ environment: session.value.environment, toasts: false }).checkout.create({
      checkoutConfiguration: session.value.id,
      // After a step off the page (3D Secure, a bank), Whop comes back here with `payment` and `status`
      // (after an ordinary payment, to the checkout's redirect_url: SPEC §10).
      returnUrl: new URL(`/app/c/${id}/share?checkout=return`, location.origin).toString(),
      appearance: appearance(dark.value, !!props.split),
      onLoadingChange: (l) => { loading.value = l },
      onComplete: (c) => {
        if (c.result === 'payment' && c.paymentId)
          emit('paid', c.paymentId)
      },
    })
    // The account's email to start with; Whop sends its receipt there.
    handle.create('checkout', { buyerEmail: user.value?.email ?? '' }).mount(host.value)
    // Whop says when it's ready; don't spin forever if it never does.
    setTimeout(() => { loading.value = false }, 15_000)
  }
  catch {
    embedFailed.value = true
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopped = true
  handle?.destroy()
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3" data-testid="checkout-step">
    <p v-if="session?.environment === 'sandbox'" class="mx-4 rounded-xl bg-[var(--marker)] px-3 py-2 text-[13px] text-[#222]">
      <b>Test mode.</b> Pay with 4242 4242 4242 4242, any future date and any CVC. No money moves.
    </p>
    <p v-if="error" class="mx-4 text-[14px] text-destructive">{{ error }}</p>
    <template v-else>
      <div class="relative min-h-[420px]">
        <div ref="host" />
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-muted-foreground" aria-busy="true">
          <Loader2 class="size-4 animate-spin" />
        </div>
      </div>
      <p v-if="embedFailed && session" class="mx-4 text-[14px]">
        The checkout couldn't load on this page. <a :href="session.purchase_url" class="font-medium underline underline-offset-2">Pay on Whop's page</a> instead; it comes back here.
      </p>
      <a v-else-if="session" :href="session.purchase_url" class="mx-4 inline-flex w-fit items-center gap-1 text-[13px] text-muted-foreground underline-offset-2 hover:underline">
        Trouble paying here? Open the checkout on Whop <ExternalLink class="size-3" />
      </a>
    </template>
  </div>
</template>
