<script setup lang="ts">
// "Publish 195 recaps? 5 rows need fixing and will be skipped." (SPEC §6.3)
// With checkout on (SPEC §10), an account's campaign pays first: the size
// that fits its list, in Whop's checkout right here, then it publishes. On a
// wide screen that's two columns, what's bought and its price on the left and
// Whop's payment on the right; a phone stacks them as one.
import { useMediaQuery } from '@vueuse/core'
import { Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { bestTier, type Charge, dollars } from '#shared/utils/pricing'

const open = defineModel<boolean>('open', { default: false })
const ws = useWorkspace()
const { fail } = useApi()
const n = computed(() => ws.counts.value)
const fmt = (x: number) => x.toLocaleString('en-US')

const title = computed(() => ws.isPublished.value
  ? `Publish ${fmt(n.value.ready)} new ${n.value.ready === 1 ? 'Highreel' : 'Highreels'}?`
  : `Publish ${fmt(n.value.ready)} ${n.value.ready === 1 ? 'Highreel' : 'Highreels'}?`)

// Whether this opening pays first, fixed when the dialog opens: paying turns
// the charge to null, and the dialog shouldn't flip to the plain one under it.
const charge = ref<Charge | null | undefined>(null)
type Stage = 'pay' | 'confirming' | 'pending' | 'failed'
const stage = ref<Stage>('pay')
/** Remounts the checkout after a failed payment. */
const attempt = ref(0)
watch(open, (isOpen) => {
  if (isOpen) {
    charge.value = ws.charge.value
    stage.value = 'pay'
  }
})
const paid = computed(() => bestTier(ws.campaign.value?.paid ?? []))
const size = (x: number) => `up to ${fmt(x)} customers`

// Payment sheets (Apple Pay's QR code, Google Pay's, Whop's order details)
// mount on <body>, beside the app rather than in this dialog. A modal dialog
// turns pointer events off on <body> and pulls focus back to itself, so they
// couldn't be clicked or typed in (2026-10-16, Apple Pay's QR sheet). So the
// paying dialog isn't modal: its own backdrop, the app behind it inert, and it
// stays open when a sheet is clicked, focused or gets Escape. The plain
// publish dialog stays modal.
const paying = computed(() => open.value && !!charge.value)
function appInert(on: boolean) {
  const app = import.meta.client ? document.getElementById('__nuxt') : null
  if (app)
    app.inert = on
}
watch(paying, appInert)
onBeforeUnmount(() => appInert(false))
/** A press on the backdrop (or the app) closes the dialog; anything else outside it is a payment sheet's. */
function keepForSheets(event: CustomEvent<{ originalEvent: Event }>) {
  const target = event.target instanceof Element ? event.target : null
  if (event.detail.originalEvent.type !== 'pointerdown' || !target?.closest('#__nuxt, [data-checkout-backdrop]'))
    event.preventDefault()
}
/** Escape closes the dialog, unless it was meant for a payment sheet that has the focus. */
function escapeHere(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (target && target !== document.body && !target.closest('[data-slot="dialog-content"]'))
    event.preventDefault()
}
/** Tailwind's md: the two columns. */
const split = useMediaQuery('(min-width: 768px)')
/** The left column's label-value list. */
const facts = computed(() => {
  const c = charge.value
  if (!c)
    return []
  const list: { label: string, value: string, warn?: boolean }[] = [{ label: 'Campaign', value: ws.campaign.value?.name ?? '' }]
  if (c.upgrade && paid.value)
    list.push({ label: 'Paid for', value: size(paid.value.max) }, { label: 'Upgrade to', value: size(c.tier.max) })
  else
    list.push({ label: 'Size', value: `Up to ${fmt(c.tier.max)} customers` })
  list.push({ label: 'Highreels', value: fmt(n.value.ready + n.value.published) })
  if (n.value.errors)
    list.push({ label: 'Skipped', value: `${fmt(n.value.errors)} ${n.value.errors === 1 ? 'row needs' : 'rows need'} fixing`, warn: true })
  list.push({ label: 'Billing', value: 'Once, no subscription' })
  return list
})

async function confirm() {
  open.value = false
  await ws.publish()
}

let polling: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => polling && clearTimeout(polling))

/** Whop says it's paid: have the server read it back, then publish. */
async function onPaid(payment: string, tries = 0) {
  stage.value = 'confirming'
  try {
    const res = await ws.confirmPayment(payment)
    if (res.status === 'paid') {
      open.value = false
      await ws.publish()
    }
    else if (res.status === 'failed') {
      stage.value = 'failed'
    }
    else {
      // A bank transfer and the like: Whop is still collecting it. Look again for a few minutes.
      stage.value = 'pending'
      if (tries < 40 && open.value)
        polling = setTimeout(() => onPaid(payment, tries + 1), 5000)
    }
  }
  catch (e) {
    fail('Couldn\'t confirm the payment', e)
    stage.value = 'pending'
  }
}
</script>

<template>
  <Dialog v-model:open="open" :modal="!charge">
    <Teleport to="body">
      <div v-if="paying" data-checkout-backdrop class="fixed inset-0 isolate z-[49] animate-in bg-black/10 duration-100 fade-in-0 supports-backdrop-filter:backdrop-blur-xs" />
    </Teleport>
    <DialogContent v-if="charge" @interact-outside="keepForSheets" @escape-key-down="escapeHere" class="max-h-[92dvh] max-w-[calc(100%-1rem)] gap-5 overflow-y-auto px-0 pt-6 pb-4 sm:max-w-[620px] md:max-w-[960px] md:grid-cols-[340px_minmax(0,1fr)] md:gap-0 md:rounded-[16px] md:p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div class="min-w-0 px-4 md:border-r md:bg-subtle md:p-8">
        <div class="flex flex-col gap-6 md:sticky md:top-8">
          <DialogHeader>
            <DialogTitle>{{ charge.upgrade ? `Upgrade to ${fmt(charge.tier.max)} customers` : 'Pay once, then publish' }}</DialogTitle>
            <DialogDescription class="flex flex-col gap-1.5 md:hidden">
              <span v-if="charge.upgrade && paid">
                This campaign is paid for {{ size(paid.max) }}, and {{ fmt(n.ready + n.published) }} would get a Highreel.
                Upgrading to {{ size(charge.tier.max) }} costs <b class="text-foreground">{{ dollars(charge.price) }}</b>, the difference.
              </span>
              <span v-else>
                One payment for this campaign, {{ size(charge.tier.max) }}: <b class="text-foreground">{{ dollars(charge.price) }}</b><template v-if="charge.tier.was">, the founding price (usually {{ dollars(charge.tier.was) }})</template>.
                Not per customer, and no subscription.
              </span>
              <span v-if="n.errors" class="text-destructive">{{ fmt(n.errors) }} {{ n.errors === 1 ? 'row needs' : 'rows need' }} fixing and will be skipped.</span>
            </DialogDescription>
          </DialogHeader>
          <div v-if="split" class="flex flex-col gap-6" data-testid="checkout-summary">
            <div class="flex flex-col gap-1">
              <p class="flex items-baseline gap-2.5">
                <span class="text-[44px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{{ dollars(charge.price) }}</span>
                <s v-if="!charge.upgrade && charge.tier.was" class="text-[18px] text-muted-foreground tabular-nums">{{ dollars(charge.tier.was) }}</s>
              </p>
              <p class="text-[14px] text-muted-foreground">
                {{ charge.upgrade ? 'The difference to the bigger size' : charge.tier.was ? 'Founding price, for the whole campaign' : 'For the whole campaign, not per customer' }}
              </p>
            </div>
            <dl class="flex flex-col text-[14px]">
              <div v-for="f in facts" :key="f.label" class="flex min-h-[38px] items-center justify-between gap-3 border-b border-dashed last:border-b-0">
                <dt class="flex-none text-muted-foreground">{{ f.label }}</dt>
                <dd class="min-w-0 truncate text-right" :class="{ 'text-destructive': f.warn }">{{ f.value }}</dd>
              </div>
            </dl>
            <p class="text-[12.5px] leading-relaxed text-muted-foreground">
              Whop processes the payment: it charges in your currency and adds sales tax or VAT where it applies.
            </p>
          </div>
        </div>
      </div>
      <div class="min-w-0 md:px-4 md:pt-12 md:pb-6 md:dark:bg-[#111111]">
        <CheckoutStep v-if="stage === 'pay'" :key="attempt" :split @paid="p => onPaid(p)" />
        <p v-else-if="stage === 'confirming'" class="mx-4 flex items-center gap-2 text-[14px] text-muted-foreground">
          <Loader2 class="size-4 animate-spin" /> Confirming your payment…
        </p>
        <p v-else-if="stage === 'pending'" class="mx-4 text-[14px]" role="status">
          Whop is still collecting your payment. This campaign publishes as soon as it's through; you can close this and come back.
        </p>
        <div v-else class="mx-4 flex flex-col items-start gap-3">
          <p class="text-[14px] text-destructive" role="alert">The payment didn't go through, and nothing was taken.</p>
          <Button size="sm" @click="attempt++; stage = 'pay'">Try again</Button>
        </div>
      </div>
    </DialogContent>
    <DialogContent v-else class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="flex flex-col gap-1.5">
          <span>Each Highreel gets a private link, ready to send from Share: by email from your own account, on WhatsApp or as a links file.</span>
          <span v-if="n.errors" class="text-destructive">{{ fmt(n.errors) }} {{ n.errors === 1 ? 'row needs' : 'rows need' }} fixing and will be skipped.</span>
          <span v-if="n.published">{{ fmt(n.published) }} published {{ n.published === 1 ? 'link stays' : 'links stay' }} the same; their ranks are refreshed.</span>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
        <Button size="sm" @click="confirm">Publish</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
