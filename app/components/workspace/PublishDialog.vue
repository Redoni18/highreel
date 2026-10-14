<script setup lang="ts">
// "Publish 195 recaps? 5 rows need fixing and will be skipped." (SPEC §6.3)
// With checkout on (SPEC §10), an account's campaign pays first: the size
// that fits its list, in Whop's checkout right here, then it publishes.
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
  <Dialog v-model:open="open">
    <DialogContent v-if="charge" class="max-h-[92dvh] overflow-y-auto sm:max-w-[620px]">
      <DialogHeader>
        <DialogTitle>{{ charge.upgrade ? `Upgrade to ${fmt(charge.tier.max)} customers` : 'Pay once, then publish' }}</DialogTitle>
        <DialogDescription class="flex flex-col gap-1.5">
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
      <CheckoutStep v-if="stage === 'pay'" :key="attempt" @paid="p => onPaid(p)" />
      <p v-else-if="stage === 'confirming'" class="flex items-center gap-2 text-[14px] text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> Confirming your payment…
      </p>
      <p v-else-if="stage === 'pending'" class="text-[14px]" role="status">
        Whop is still collecting your payment. This campaign publishes as soon as it's through; you can close this and come back.
      </p>
      <div v-else class="flex flex-col items-start gap-3">
        <p class="text-[14px] text-destructive" role="alert">The payment didn't go through, and nothing was taken.</p>
        <Button size="sm" @click="attempt++; stage = 'pay'">Try again</Button>
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
