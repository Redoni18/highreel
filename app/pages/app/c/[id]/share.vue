<script setup lang="ts">
// Share, step three of a recap (SPEC M2.6, M2.8, M2.9): publish (what goes
// out, what's skipped), then send, three ways: Email (through the business's
// own email account; Highreel never sends from an address of its own), WhatsApp
// (one tap per person: their chat opens with the message and link typed in,
// on the business's own WhatsApp), or the links file for any other tool. The
// phone beside it shows what the previewed person gets. Then how a link looks
// and how it's going. A business recap gets its link and images here.
import { Check, Copy, Download, ExternalLink, Loader2, Mail, MessageCircle, Send, Undo2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { idColumnOf } from '#shared/templates'
import type { Recipient } from '#shared/types/recap'
import { hasErrors } from '#shared/utils/validate'
import { BODY_MAX, DEFAULT_BODY, DEFAULT_SUBJECT, recapEmail, SUBJECT_MAX } from '#shared/utils/email'
import { type EmailConnection, presetFor } from '#shared/utils/smtp'
import { DEFAULT_WHATSAPP, WHATSAPP_MAX, waLink, waNumber, whatsappText } from '#shared/utils/whatsapp'
import { shareTexts } from '#shared/utils/slides'
import { downloadBlob, renderShareImage, shareFileName, type ShareFormat } from '~/utils/shareImage'
import { bestTier, dollars } from '#shared/utils/pricing'

const ws = useWorkspace()
const { api, fail } = useApi()
const n = computed(() => ws.counts.value)
const fmt = (x: number) => x.toLocaleString('en-US')
const publishOpen = ref(false)
const campaign = computed(() => ws.campaign.value!)
const business = computed(() => ws.business.value!)
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
const since = computed(() => campaign.value.published_at ? day(campaign.value.published_at) : null)
const people = (x: number) => `${fmt(x)} ${x === 1 ? 'person' : 'people'}`

function fixRows() {
  ws.filter.value = 'errors'
  navigateTo(`/app/c/${campaign.value.id}`)
}

// --- Paying (SPEC §10) ------------------------------------------------------------------
const paidFor = computed(() => (ws.paysToPublish.value ? bestTier(campaign.value.paid) : null))
const route = useRoute()
const router = useRouter()
// Back from Whop: after every payment Whop takes the tab to its return page
// and then here, with ?checkout=return&payment_id=pay_…&status=success (and
// after a 3D Secure or bank step, `payment` and `status`). The status only
// picks what to say; whether it's paid is the server's to ask Whop.
onMounted(async () => {
  const q = route.query
  if (q.checkout !== 'return')
    return
  const payment = [q.payment, q.payment_id, q.receipt_id].find((v): v is string => typeof v === 'string' && v.startsWith('pay_'))
  const status = typeof q.status === 'string' ? q.status : null
  await router.replace({ query: {} })
  if (status === 'failed' || status === 'canceled') {
    toast.error('The payment didn\'t go through', { description: 'Nothing was taken. Publish to try again.' })
    return
  }
  if (!payment)
    return
  try {
    const res = await ws.confirmPayment(payment)
    if (res.status === 'paid') {
      toast.success('Payment received')
      if (!ws.charge.value && n.value.ready)
        await ws.publish()
    }
    else if (res.status === 'pending') {
      toast('Whop is still collecting your payment', { description: 'Publish once it\'s through.' })
    }
    else {
      toast.error('The payment didn\'t go through', { description: 'Nothing was taken. Publish to try again.' })
    }
  }
  catch (e) {
    fail('Couldn\'t confirm the payment', e)
  }
})

// The first published row: its link preview and a recap to open.
const live = computed(() => ws.rows.value.filter(r => r.token && !hasErrors(r.errors)))
const sampleToken = computed(() => live.value[0]?.token ?? null)

// --- How to send ---------------------------------------------------------------------
type Channel = 'email' | 'whatsapp' | 'links'
const channel = ref<Channel>('email')
/** Set once someone picks a tab, so loading never switches it under them. */
const chose = ref(false)
function pickChannel(c: unknown) {
  if (c !== 'email' && c !== 'whatsapp' && c !== 'links')
    return
  chose.value = true
  channel.value = c
}
const withPhone = computed(() => live.value.filter(r => r.data.phone).length)

// --- Email, through the business's own account (M2.8, M2.9) --------------------------
interface SendStatus {
  connection: EmailConnection | null
  accountEmail: string | null
  anonymous: boolean
  pending: number
  sent: number
  failed: number
  noEmail: number
  unsubscribed: number
  bounced: number
  sentToday: number
  limit: number
}
const status = ref<SendStatus | null>(null)
const dev = ref(false)
async function loadStatus() {
  if (ws.isBusiness.value || !campaign.value)
    return
  try {
    status.value = await api<SendStatus>(`/api/campaigns/${campaign.value.id}/send`)
  }
  catch (e) {
    fail('Couldn\'t load sending', e)
  }
}
onMounted(async () => {
  await loadStatus()
  // Start on WhatsApp when email isn't set up but the sheet has phone numbers.
  if (!chose.value && status.value && !status.value.connection && withPhone.value)
    channel.value = 'whatsapp'
  if (!ws.isBusiness.value)
    dev.value = (await api<{ dev: boolean }>('/api/business/email').catch(() => ({ dev: false }))).dev
})
// Publishing, or someone signing up from the demo banner, changes who can get it.
watch(() => [n.value.published, ws.anonymous.value], loadStatus)

const connectOpen = ref(false)
function connected() {
  toast.success('Email connected', { description: 'A test is in that inbox. Highreels go out from it now.' })
  loadStatus()
}

const subject = ref('')
const body = ref('')
const waBody = ref('')
const waCountry = ref('')
// Filled once per recap: after that these fields are the truth (a save on
// blur mustn't put back what's being typed in another one).
watch(() => campaign.value.id, () => {
  const s = campaign.value.settings
  subject.value = s.email?.subject ?? ''
  body.value = s.email?.body ?? ''
  waBody.value = s.whatsapp?.body ?? ''
  waCountry.value = s.whatsapp?.country ?? ''
}, { immediate: true })
const copyDirty = computed(() => subject.value.trim() !== (campaign.value.settings.email?.subject ?? '') || body.value.trim() !== (campaign.value.settings.email?.body ?? ''))
async function saveCopy(): Promise<boolean> {
  if (!copyDirty.value)
    return true
  return ws.updateCampaign({ settings: { email: { subject: subject.value.trim(), body: body.value.trim() } } })
}
const waDirty = computed(() => waBody.value.trim() !== (campaign.value.settings.whatsapp?.body ?? '') || waCountry.value.trim() !== (campaign.value.settings.whatsapp?.country ?? ''))
async function saveWhatsapp(): Promise<boolean> {
  if (!waDirty.value)
    return true
  return ws.updateCampaign({ settings: { whatsapp: { body: waBody.value.trim(), country: waCountry.value.trim() } } })
}

const consent = ref(false)
const consented = computed(() => !!campaign.value.settings.email_consent_at)

// The person the previews show (a published row if there is one).
const previewRow = computed(() => {
  const sel = ws.selectedRow.value
  return sel?.token ? sel : live.value[0] ?? sel
})
const firstName = (r?: Recipient | null) => String(r?.data.first_name ?? '').trim() || 'Ana'
const origin = import.meta.client ? window.location.origin : ''
const linkFor = (r?: Recipient | null) => (r?.token ? ws.recapUrl(r.token) : `${origin}/r/…`)
const preview = computed(() => recapEmail({
  business: business.value,
  first_name: firstName(previewRow.value),
  year: campaign.value.year,
  copy: { subject: subject.value, body: body.value },
  url: linkFor(previewRow.value),
  unsubscribeUrl: `${origin}/unsubscribe/…`,
}))
const messageFor = (r?: Recipient | null) => whatsappText(waBody.value, { first_name: firstName(r), business: business.value.name, year: campaign.value.year, link: linkFor(r) })

const sending = ref<null | 'test' | 'all'>(null)
const progress = ref({ sent: 0, failed: 0, total: 0 })
const confirmOpen = ref(false)

async function sendTest() {
  if (!(await saveCopy()))
    return
  sending.value = 'test'
  try {
    const res = await api<{ to: string }>(`/api/campaigns/${campaign.value.id}/send`, { method: 'POST', body: { test: true, recipient_id: previewRow.value?.id } })
    toast.success(`Test sent to ${res.to}`, { description: `${firstName(previewRow.value)}'s email, with "[Test]" in the subject.` })
  }
  catch (e) {
    fail('Couldn\'t send the test', e)
  }
  finally {
    sending.value = null
  }
}

async function sendAll(retry = false) {
  if (!(await saveCopy()))
    return
  if (!consented.value && !(await ws.updateCampaign({ settings: { email_consent: true } })))
    return
  sending.value = 'all'
  const total = retry ? status.value?.failed ?? 0 : status.value?.pending ?? 0
  progress.value = { sent: 0, failed: 0, total }
  let waiting = 0
  let bounced = 0
  let stopped: string | null = null
  try {
    let first = true
    // 25 per call; the server says how many are left, and why it stopped early (M2.11).
    for (let guard = 0; guard < 2000; guard++) {
      const res = await api<{ sent: number, failed: number, bounced: number, remaining: number, waiting: number, stopped: string | null }>(`/api/campaigns/${campaign.value.id}/send`, { method: 'POST', body: { retry: retry && first } })
      first = false
      progress.value.sent += res.sent
      progress.value.failed += res.failed + res.bounced
      bounced += res.bounced
      waiting = res.waiting
      stopped = res.stopped
      if (!res.remaining || (!res.sent && !res.failed && !res.bounced))
        break
    }
    // The new numbers first, so the button never offers the same send again.
    await Promise.all([loadStatus(), ws.refreshEngagement(true)])
    const p = progress.value
    const description = [
      bounced ? `${fmt(bounced)} bounced: ${bounced === 1 ? 'that address doesn\'t' : 'those addresses don\'t'} take email.` : '',
      p.failed > bounced ? `${fmt(p.failed - bounced)} didn't go out.` : '',
      waiting ? `${fmt(waiting)} wait for tomorrow (your account's daily limit).` : '',
    ].filter(Boolean).join(' ') || undefined
    if (stopped)
      toast.error(p.sent ? `Stopped after ${fmt(p.sent)} sent` : 'Nothing went out', { description: [stopped, description].filter(Boolean).join(' '), duration: 12000 })
    else
      toast.success(`${fmt(p.sent)} ${p.sent === 1 ? 'Highreel' : 'Highreels'} sent`, { description })
  }
  catch (e) {
    fail('Sending stopped', e)
    await Promise.all([loadStatus(), ws.refreshEngagement(true)])
  }
  finally {
    sending.value = null
  }
}

const lastSent = computed(() => {
  let at: string | null = null
  for (const r of ws.rows.value) {
    if (r.emailed_at && (!at || r.emailed_at > at))
      at = r.emailed_at
  }
  return at
})

// --- WhatsApp, one tap per person (M2.9) -----------------------------------------------
interface WaRow { row: Recipient, name: string, phone: string, number: string | null, sentAt: string | null }
const waRows = computed<WaRow[]>(() => live.value.filter(r => r.data.phone).map(r => ({
  row: r,
  name: firstName(r),
  phone: String(r.data.phone),
  number: waNumber(String(r.data.phone), waCountry.value),
  sentAt: r.whatsapp_at ?? null,
})))
const waSent = computed(() => waRows.value.filter(w => w.sentAt).length)
const waBad = computed(() => waRows.value.filter(w => !w.number).length)
const waNext = computed(() => waRows.value.find(w => !w.sentAt && w.number) ?? null)
const waPreviewRow = computed(() => (previewRow.value?.data.phone ? previewRow.value : waNext.value?.row ?? previewRow.value))

function setWhatsapp(id: string, at: string | null) {
  ws.rows.value = ws.rows.value.map(r => (r.id === id ? { ...r, whatsapp_at: at } : r))
}
async function openChat(w: WaRow) {
  if (!w.number)
    return
  // Open first, inside the click, or the browser blocks the new tab.
  window.open(waLink(w.number, messageFor(w.row)), '_blank', 'noopener')
  setWhatsapp(w.row.id, new Date().toISOString())
  saveWhatsapp()
  try {
    await api(`/api/campaigns/${campaign.value.id}/whatsapp`, { method: 'POST', body: { recipient_id: w.row.id, sent: true } })
  }
  catch (e) {
    setWhatsapp(w.row.id, null)
    fail('Couldn\'t mark it sent', e)
  }
}
async function undoChat(w: WaRow) {
  const before = w.sentAt
  setWhatsapp(w.row.id, null)
  try {
    await api(`/api/campaigns/${campaign.value.id}/whatsapp`, { method: 'POST', body: { recipient_id: w.row.id, sent: false } })
  }
  catch (e) {
    setWhatsapp(w.row.id, before)
    fail('Couldn\'t undo', e)
  }
}
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)
    return 'just now'
  if (s < 3600)
    return `${Math.round(s / 60)} min ago`
  if (s < 86400)
    return `${Math.round(s / 3600)} h ago`
  return day(iso)
}

// --- The links file -------------------------------------------------------------------
// A message to paste into another tool; {first_name} and {link} are the export's columns.
const message = computed(() => `Subject: {first_name}, your ${campaign.value.year} with ${business.value.name}

Hi {first_name},

We made something just for you: your ${campaign.value.year} with ${business.value.name}, in a few taps.

Open it here: {link}

Thank you for being part of our year.
${business.value.name}`)
const copied = ref<null | 'message' | 'link'>(null)
async function copy(what: 'message' | 'link', text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = what
  setTimeout(() => (copied.value = null), 1600)
}

// --- The phone: what the previewed person gets ------------------------------------------
const chatRow = computed(() => (channel.value === 'whatsapp' ? waPreviewRow.value : previewRow.value))
const chatText = computed(() => channel.value === 'whatsapp'
  ? messageFor(chatRow.value)
  : message.value.replace(/^Subject:.*\n\n/, '').replaceAll('{first_name}', firstName(chatRow.value)).replaceAll('{link}', linkFor(chatRow.value)))
const card = computed(() => {
  const p = ws.previewPayload.value
  const row = chatRow.value
  return {
    image: row?.token ? `/api/r/${row.token}/og.png` : null,
    title: p ? shareTexts(ws.previewTemplate.value, p).title : `Your ${campaign.value.year} with ${business.value.name}`,
    site: import.meta.client ? window.location.host : '',
  }
})

// How it's going, from the rows' first-party counters.
const going = computed(() => {
  let opened = 0
  let saved = 0
  let shared = 0
  let clicked = 0
  for (const r of ws.rows.value) {
    if (!r.token)
      continue
    if (r.view_count > 0)
      opened++
    if (r.saved_at)
      saved++
    if (r.shared_at)
      shared++
    if (r.cta_clicked_at)
      clicked++
  }
  return { opened, saved, shared, clicked, pct: n.value.published ? Math.round((opened / n.value.published) * 100) : 0 }
})
onMounted(() => ws.refreshEngagement())

// A business recap: its link and images.
const token = computed(() => (ws.isBusiness.value ? ws.rows.value[0]?.token ?? null : null))
const url = computed(() => (token.value ? ws.recapUrl(token.value) : ''))
const drawing = ref<ShareFormat | null>(null)
async function saveImage(format: ShareFormat) {
  const p = ws.previewPayload.value
  if (!p)
    return
  drawing.value = format
  try {
    downloadBlob(await renderShareImage(p, format), shareFileName(p, format))
  }
  finally {
    drawing.value = null
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <div class="relative min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-[680px] flex-col gap-12 px-8 pt-9 pb-20">
        <header class="flex flex-col gap-2">
          <p class="note-hand text-[24px]">step three</p>
          <h1 class="text-[34px] leading-[1.1] font-semibold tracking-[-0.025em]">{{ ws.isBusiness.value ? 'Post it.' : 'Share it with your members.' }}</h1>
          <p class="text-[15px] text-muted-foreground">
            {{ ws.isBusiness.value
              ? 'Publish to get a link, then post the link or the images wherever your followers are.'
              : 'Publish, then send everyone their own link from your email or your WhatsApp.' }}
          </p>
        </header>

        <!-- Publish -->
        <section class="flex flex-col gap-4" aria-labelledby="s-publish" data-testid="share-publish">
          <h2 id="s-publish" class="section-title"><span class="step-n">1</span>Publish</h2>
          <template v-if="ws.isBusiness.value">
            <p v-if="ws.isPublished.value" class="lead">Your Highreel is live<template v-if="since">{{ ` since ${since}` }}</template>. Saving the form updates it in place.</p>
            <template v-else>
              <p class="lead">Nothing is public yet. Publishing saves the form and gives the Highreel its link.</p>
              <Button size="lg" class="w-fit" :disabled="!!ws.busy.value || hasErrors(ws.businessRow.value.errors)" @click="ws.publishBusiness()">Publish your Highreel</Button>
              <p v-if="hasErrors(ws.businessRow.value.errors)" class="hint">Fill in the first number and its label in <NuxtLink :to="`/app/c/${campaign.id}`" class="underline underline-offset-2">Content</NuxtLink> first.</p>
            </template>
          </template>
          <template v-else>
            <p v-if="!n.total" class="lead">No one to send to yet: <NuxtLink :to="`/app/c/${campaign.id}`" class="underline underline-offset-4">add your sheet</NuxtLink> first.</p>
            <template v-else-if="!ws.isPublished.value">
              <p class="lead"><b>{{ fmt(n.ready) }}</b> {{ n.ready === 1 ? 'Highreel is' : 'Highreels are' }} ready to go out.<template v-if="n.errors">{{ ' ' }}<b>{{ fmt(n.errors) }}</b> {{ n.errors === 1 ? 'row needs' : 'rows need' }} fixing and will be skipped.</template></p>
              <div class="flex flex-wrap items-center gap-2">
                <Button size="lg" :disabled="!n.ready || !!ws.busy.value" @click="publishOpen = true">Publish {{ fmt(n.ready) }} {{ n.ready === 1 ? 'Highreel' : 'Highreels' }}</Button>
                <Button v-if="n.errors" variant="outline" size="lg" @click="fixRows">Fix {{ n.errors === 1 ? 'it' : 'them' }} first</Button>
              </div>
              <p v-if="ws.charge.value?.upgrade && paidFor" class="hint" data-testid="price-hint">The list has grown past the {{ fmt(paidFor.max) }} customers paid for: publishing it takes an upgrade to {{ fmt(ws.charge.value.tier.max) }}, <b>{{ dollars(ws.charge.value.price) }}</b>.</p>
              <p v-else-if="ws.charge.value" class="hint" data-testid="price-hint">Publishing takes one payment for this campaign: <b>{{ dollars(ws.charge.value.price) }}</b> for up to {{ fmt(ws.charge.value.tier.max) }} customers<template v-if="ws.charge.value.tier.was"> (founding price, usually {{ dollars(ws.charge.value.tier.was) }})</template>.</p>
              <p v-else-if="paidFor" class="hint">Paid for up to {{ fmt(paidFor.max) }} customers.</p>
            </template>
            <template v-else>
              <p class="lead"><b>{{ fmt(n.published) }}</b> {{ n.published === 1 ? 'Highreel is' : 'Highreels are' }} live<template v-if="since">{{ ` since ${since}` }}</template>.<template v-if="n.ready">{{ ' ' }}<b>{{ fmt(n.ready) }}</b> new {{ n.ready === 1 ? 'row is' : 'rows are' }} ready.</template><template v-if="n.errors">{{ ` ${fmt(n.errors)} still ${n.errors === 1 ? 'needs' : 'need'} fixing.` }}</template></p>
              <div v-if="n.ready || n.errors" class="flex flex-wrap items-center gap-2">
                <Button v-if="n.ready" size="lg" :disabled="!!ws.busy.value" @click="publishOpen = true">Publish {{ fmt(n.ready) }} new</Button>
                <Button v-if="n.errors" variant="outline" size="lg" @click="fixRows">Fix {{ n.errors === 1 ? 'it' : 'them' }}</Button>
              </div>
              <p v-if="ws.charge.value?.upgrade && paidFor" class="hint" data-testid="price-hint">The list has grown past the {{ fmt(paidFor.max) }} customers paid for: publishing the new rows takes an upgrade to {{ fmt(ws.charge.value.tier.max) }}, <b>{{ dollars(ws.charge.value.price) }}</b>.</p>
              <p class="hint">Editing a published row in the Sheet updates its Highreel; its link stays the same.</p>
            </template>
          </template>
        </section>

        <!-- Business recap: link and images -->
        <section v-if="ws.isBusiness.value" class="flex flex-col gap-4" aria-labelledby="s-post">
          <h2 id="s-post" class="section-title"><span class="step-n">2</span>Your link and images</h2>
          <div v-if="token" class="flex max-w-xl gap-2">
            <Input :model-value="url" readonly aria-label="Link" class="h-10 rounded-full px-4 font-mono text-[13px]" @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()" />
            <Button variant="outline" class="h-10" @click="copy('link', url)">
              <Check v-if="copied === 'link'" /><Copy v-else /> {{ copied === 'link' ? 'Copied' : 'Copy' }}
            </Button>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" :disabled="!!drawing" @click="saveImage('story')">
              <Loader2 v-if="drawing === 'story'" class="animate-spin" /><Download v-else /> Story image <span class="font-mono text-[12px] text-muted-foreground">1080×1920</span>
            </Button>
            <Button variant="outline" :disabled="!!drawing" @click="saveImage('square')">
              <Loader2 v-if="drawing === 'square'" class="animate-spin" /><Download v-else /> Square image <span class="font-mono text-[12px] text-muted-foreground">1080×1080</span>
            </Button>
          </div>
          <p v-if="!token" class="hint">The images work already; the link comes with publishing.</p>
        </section>

        <!-- Customers: send by email, WhatsApp or the links file -->
        <section v-else class="flex flex-col gap-5" aria-labelledby="s-send" data-testid="share-send">
          <h2 id="s-send" class="section-title"><span class="step-n">2</span>Send</h2>
          <Tabs :model-value="channel" @update:model-value="pickChannel">
            <TabsList class="h-10" aria-label="How to send">
              <TabsTrigger value="email" class="px-4" data-channel="email"><Mail /> Email</TabsTrigger>
              <TabsTrigger value="whatsapp" class="px-4" data-channel="whatsapp"><MessageCircle /> WhatsApp</TabsTrigger>
              <TabsTrigger value="links" class="px-4" data-channel="links"><Download /> Links file</TabsTrigger>
            </TabsList>
          </Tabs>

          <p v-if="!ws.isPublished.value && channel !== 'links'" class="lead">Publish first: each message carries that person's own link.</p>

          <!-- Email -->
          <template v-else-if="channel === 'email' && status">
            <p class="lead" data-testid="send-lead">
              <template v-if="status.sent">
                <b>{{ fmt(status.sent) }}</b> sent<template v-if="lastSent">{{ ` on ${day(lastSent)}` }}</template>.<template v-if="status.pending">{{ ' ' }}<b>{{ fmt(status.pending) }}</b> more {{ status.pending === 1 ? 'has' : 'have' }} an email and {{ status.pending === 1 ? 'hasn\'t' : 'haven\'t' }} had it yet.</template>
              </template>
              <template v-else>
                <b>{{ people(status.pending) }}</b> {{ status.pending === 1 ? 'has' : 'have' }} an email address<template v-if="status.noEmail">{{ ' ' }}and <b>{{ fmt(status.noEmail) }}</b> {{ status.noEmail === 1 ? 'doesn\'t' : 'don\'t' }}</template>.
              </template>
            </p>
            <p v-if="status.failed || status.bounced || status.unsubscribed || (status.sent && status.noEmail)" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground" data-testid="send-extra">
              <span v-if="status.failed" class="text-destructive">{{ fmt(status.failed) }} didn't go out</span>
              <Button v-if="status.failed && status.connection" variant="outline" size="sm" :disabled="!!sending" @click="sendAll(true)">Try again</Button>
              <Tooltip v-if="status.bounced">
                <TooltipTrigger as-child>
                  <span class="cursor-default text-destructive underline decoration-dotted underline-offset-2" tabindex="0" data-testid="bounced">{{ fmt(status.bounced) }} bounced</span>
                </TooltipTrigger>
                <TooltipContent class="max-w-64">Their mail servers say these addresses don't exist, so they're skipped from now on. Fix them in the Sheet to send again.</TooltipContent>
              </Tooltip>
              <span v-if="status.unsubscribed">{{ fmt(status.unsubscribed) }} unsubscribed</span>
              <span v-if="status.sent && status.noEmail">{{ fmt(status.noEmail) }} without an email</span>
            </p>

            <div v-if="status.anonymous" class="note">Add your email in the banner at the top first, to keep your work. Then connect the email account Highreels go out from.</div>
            <div v-else-if="!status.connection" class="connect" data-testid="email-connect">
              <span class="grid size-11 shrink-0 place-items-center rounded-full bg-background text-primary"><Mail class="size-5" /></span>
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <p class="font-semibold">Send from your own email</p>
                <p class="hint">Highreels go out through your email account, from your address, so people know who they're from. Gmail, Workspace, Microsoft 365, iCloud, Zoho, Resend, Postmark, SendGrid and more.</p>
              </div>
              <Button class="shrink-0" data-testid="connect-email" @click="connectOpen = true">Connect your email</Button>
            </div>
            <div v-else class="email-form">
              <p class="text-[13px] text-muted-foreground" data-testid="send-from">
                From <b class="font-medium text-foreground">{{ status.connection.from_name }}</b> &lt;{{ status.connection.from_email }}&gt; through {{ presetFor(status.connection.provider).label }}
                · <Button type="button" variant="link" class="h-auto p-0 text-[13px] text-muted-foreground underline" @click="connectOpen = true">Change</Button>
              </p>
              <div class="field">
                <Label for="s-subject">Subject</Label>
                <Input id="s-subject" v-model="subject" :maxlength="SUBJECT_MAX" :placeholder="DEFAULT_SUBJECT" @blur="saveCopy" />
              </div>
              <div class="field">
                <Label for="s-body">Message</Label>
                <Textarea id="s-body" v-model="body" :maxlength="BODY_MAX" rows="6" class="min-h-0" :placeholder="DEFAULT_BODY" @blur="saveCopy" />
                <p class="hint"><span class="font-mono">{first_name}</span>, <span class="font-mono">{business}</span> and <span class="font-mono">{year}</span> fill in for each person. The button to their Highreel and an unsubscribe link come after it.</p>
              </div>
              <div v-if="!consented" class="flex items-start gap-2.5">
                <Checkbox id="s-consent" v-model="consent" class="mt-0.5" data-testid="email-consent" />
                <Label for="s-consent" class="text-[13px] leading-snug font-normal">These people are my customers, and they expect to hear from me.</Label>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Button size="lg" :disabled="!!sending || !status.pending || (!consented && !consent)" data-testid="send-all" @click="confirmOpen = true">
                  <Loader2 v-if="sending === 'all'" class="animate-spin" /><Send v-else />
                  {{ sending === 'all' ? `Sending… ${fmt(progress.sent + progress.failed)} of ${fmt(progress.total)}` : status.pending ? (status.sent ? `Send ${fmt(status.pending)} new` : `Send ${fmt(status.pending)} ${status.pending === 1 ? 'email' : 'emails'}`) : 'Everyone has it' }}
                </Button>
                <Button variant="outline" size="lg" :disabled="!!sending" data-testid="send-test" @click="sendTest">
                  <Loader2 v-if="sending === 'test'" class="animate-spin" /><Mail v-else /> Send a test to me
                </Button>
              </div>
              <p v-if="status.limit && status.pending > status.limit - status.sentToday" class="hint">Your account sends up to {{ fmt(status.limit) }} a day: {{ fmt(Math.max(0, status.limit - status.sentToday)) }} go now, the rest tomorrow.</p>
            </div>
          </template>

          <!-- WhatsApp -->
          <template v-else-if="channel === 'whatsapp'">
            <p class="lead" data-testid="wa-lead">
              <template v-if="!waRows.length">Nobody has a phone number yet. Add a <span class="font-mono text-[0.8em]">phone</span> column to your sheet to send on WhatsApp.</template>
              <template v-else-if="waSent"><b>{{ fmt(waSent) }}</b> of {{ fmt(waRows.length) }} sent.<template v-if="waNext">{{ ' ' }}Next up: <b>{{ waNext.name }}</b>.</template></template>
              <template v-else><b>{{ people(waRows.length) }}</b> {{ waRows.length === 1 ? 'has' : 'have' }} a phone number.</template>
            </p>
            <template v-if="waRows.length">
              <p class="hint">Each tap opens that person's chat in your WhatsApp with the message and link already typed. Press send there, then come back for the next one. It goes from your own number, so they know it's you.</p>
              <div class="field">
                <Label for="s-wa">Message</Label>
                <Textarea id="s-wa" v-model="waBody" :maxlength="WHATSAPP_MAX" rows="3" class="min-h-0" :placeholder="DEFAULT_WHATSAPP" @blur="saveWhatsapp" />
                <p class="hint"><span class="font-mono">{first_name}</span>, <span class="font-mono">{business}</span>, <span class="font-mono">{year}</span> and <span class="font-mono">{link}</span> fill in for each person; without <span class="font-mono">{link}</span> the link goes at the end.</p>
              </div>
              <div class="flex flex-wrap items-end gap-3">
                <div class="field">
                  <Label for="s-wa-cc">Country code for numbers without one</Label>
                  <Input id="s-wa-cc" v-model="waCountry" maxlength="6" placeholder="+383" class="w-28 font-mono" @blur="saveWhatsapp" />
                </div>
                <p v-if="waBad" class="pb-2 text-[13px] text-destructive" data-testid="wa-bad">{{ fmt(waBad) }} {{ waBad === 1 ? 'number needs' : 'numbers need' }} a country code</p>
              </div>
              <div>
                <Button v-if="waNext" size="lg" data-testid="wa-next" @click="openChat(waNext)"><MessageCircle /> Send next: {{ waNext.name }}</Button>
                <p v-else class="text-[14px] font-medium text-ok-text">Everyone with a number has it.</p>
              </div>
              <ul class="wa-list" data-testid="wa-list">
                <li v-for="w in waRows" :key="w.row.id" :data-wa="w.row.id" :class="{ done: w.sentAt }">
                  <span class="min-w-0 flex-1 truncate font-medium">{{ w.name }}</span>
                  <span class="font-mono text-[12px]" :class="w.number ? 'text-muted-foreground' : 'text-destructive'">{{ w.number ? `+${w.number}` : `${w.phone} · needs a country code` }}</span>
                  <span v-if="w.sentAt" class="flex w-36 items-center justify-end gap-1 text-[12px] text-muted-foreground">
                    <Check class="size-3.5 text-ok" /> {{ ago(w.sentAt) }}
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button type="button" variant="ghost" size="icon-xs" :aria-label="`Undo sent for ${w.name}`" @click="undoChat(w)"><Undo2 /></Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as not sent</TooltipContent>
                    </Tooltip>
                  </span>
                  <span v-else class="flex w-36 justify-end">
                    <Button size="sm" variant="outline" :disabled="!w.number" :aria-label="`Send to ${w.name} on WhatsApp`" @click="openChat(w)">Send</Button>
                  </span>
                </li>
              </ul>
            </template>
          </template>

          <!-- The links file -->
          <div v-else-if="channel === 'links'" class="send-step">
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p class="font-semibold">The links file</p>
              <p class="hint">A CSV with <span class="font-mono">{{ idColumnOf(ws.template.value) }}</span>, <span class="font-mono">first_name</span>, <span class="font-mono">email</span> and <span class="font-mono">link</span> for every published row, for your newsletter tool, a mail merge, or anything else.</p>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" class="w-fit" :disabled="!n.published" @click="ws.exportLinks()"><Download /> Export links CSV</Button>
                <Button variant="outline" class="w-fit" @click="copy('message', message)">
                  <Check v-if="copied === 'message'" /><Copy v-else /> {{ copied === 'message' ? 'Copied' : 'Copy a message for it' }}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <!-- How a link looks -->
        <section v-if="sampleToken" class="flex flex-col gap-3" aria-labelledby="s-preview">
          <h2 id="s-preview" class="section-title">How a link looks</h2>
          <p class="hint">In WhatsApp, iMessage, Slack and LinkedIn, each link shows a preview with that person's numbers.</p>
          <img :src="`/api/r/${sampleToken}/og.png`" alt="Link preview of one Highreel" width="1200" height="630" class="w-full max-w-lg rounded-2xl border">
          <a :href="`/r/${sampleToken}`" target="_blank" rel="noopener" class="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">Open a Highreel <ExternalLink class="size-3.5" /></a>
        </section>

        <!-- How it's going -->
        <section v-if="!ws.isBusiness.value && n.published" class="flex flex-col gap-3" aria-labelledby="s-going">
          <h2 id="s-going" class="section-title"><span class="step-n">3</span>How it's going</h2>
          <p class="going" data-testid="going">
            <b>{{ fmt(going.opened) }}</b> of {{ fmt(n.published) }} opened their Highreel ({{ going.pct }}%).
            <b>{{ fmt(going.saved) }}</b> saved the image, <b>{{ fmt(going.shared) }}</b> shared it and <b>{{ fmt(going.clicked) }}</b> tapped your button.
          </p>
          <p class="hint">Who did what is in the Sheet's <span class="font-mono">viewed</span> and <span class="font-mono">did</span> columns.</p>
        </section>
      </div>
    </div>

    <!-- What the previewed person gets, on a phone -->
    <aside v-if="!ws.isBusiness.value" class="mail-stage hidden w-[min(36vw,440px)] shrink-0 flex-col items-center justify-center gap-4 border-l px-6 lg:flex" :style="{ '--accent': business.accent_color }" aria-label="Message preview">
      <PhoneFrame class="phone" ink="#111111">
        <MessagePreview v-if="channel === 'email'" channel="email" :business="business" :person="firstName(previewRow)" :email="preview" />
        <MessagePreview v-else channel="chat" :business="business" :person="firstName(chatRow)" :message="chatText" :card="card" />
      </PhoneFrame>
      <p class="max-w-[300px] text-center text-[12px] text-muted-foreground">
        {{ channel === 'email' ? `${firstName(previewRow)}'s email` : channel === 'whatsapp' ? `${firstName(chatRow)}'s WhatsApp message` : 'The copied message, filled in' }}. Pick someone else in the Sheet.
      </p>
    </aside>

    <PublishDialog v-model:open="publishOpen" />
    <EmailConnectDialog v-model:open="connectOpen" :connection="status?.connection ?? null" :business-name="business.name" :dev="dev" @connected="connected" />
    <ConfirmDialog
      v-model:open="confirmOpen"
      tone="primary"
      :title="`Send ${fmt(status?.pending ?? 0)} ${status?.pending === 1 ? 'email' : 'emails'}?`"
      :description="`Each person gets their own Highreel link, from ${status?.connection?.from_name} <${status?.connection?.from_email}>. People without an email, who unsubscribed or whose address bounced are skipped.`"
      confirm-label="Send now"
      @confirm="sendAll()"
    />
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.hint {
  font-size: 13px;
  color: var(--muted-foreground);
}
.lead {
  max-width: 34em;
  color: var(--muted-foreground);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: -0.015em;
}
.lead b { color: var(--foreground); font-weight: 700; }
.going {
  max-width: 34em;
  color: var(--muted-foreground);
  font-size: 20px;
  font-weight: 500;
  line-height: 1.35;
}
.going b { color: var(--foreground); font-weight: 700; }
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field :deep(label) { font-size: 13px; font-weight: 500; }
.email-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.email-form :deep(input),
.email-form :deep(textarea) { background: var(--background); }
.note {
  padding: 14px 16px;
  border-radius: 16px;
  background: color-mix(in oklab, var(--shape-marigold) 16%, var(--background));
  font-size: 14px;
}
.connect {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 20px;
  background: var(--muted);
  font-size: 15px;
}
.wa-list {
  display: flex;
  flex-direction: column;
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
}
.wa-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 4px 8px 4px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
}
.wa-list li:last-child { border-bottom: 0; }
.wa-list li.done { background: var(--subtle); }
.send-step {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
  background: var(--muted);
  font-size: 15px;
}
.step-n {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--foreground);
  color: var(--background);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}
.mail-stage {
  background: color-mix(in oklab, var(--accent) 10%, var(--subtle));
}
.phone {
  width: min(290px, calc((100dvh - 210px) * 0.479));
}
</style>
