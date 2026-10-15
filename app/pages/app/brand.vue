<script setup lang="ts">
// Your brand (SPEC M2.6, in the editor's shell since M2.8): the business-wide
// basics every recap uses (name, logo, website), set once here instead of
// inside each recap. No colour since M2.17: colour belongs to each
// Highreel's design (owner, 2026-10-15). A phone beside the settings plays an
// example recap with them as they change, and goes to the cover while the
// name or logo is being changed. Name, logo shape and website save with Save;
// the logo saves when it's chosen or dropped on its box. Since M2.9 the email
// account recap emails go out from is connected here too.
// Client-only (see routeRules).
import { ArrowLeft, ImagePlus, Loader2, Mail, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type PhoneStage from '~/components/workspace/PhoneStage.vue'
import type { Business, LogoShape, RecapPayload } from '#shared/types/recap'
import { readableOn } from '#shared/utils/color'
import { resolveLook } from '#shared/templates/designs'
import { type EmailConnection, presetFor } from '#shared/utils/smtp'
import { shrinkImage } from '~/utils/media'
import { EXAMPLES } from '~/data/examples'
import type { MailState } from '~/composables/useAppCache'

useHead({ title: 'Your brand · Highreel' })
const { api, fail, endSession, uploadMedia, deleteMedia } = useApi()
const { cache, setBusiness } = useAppCache()

// From the home or an earlier visit here: the last answer at once, a fresh one underneath (SPEC §7.7).
const business = ref<Business | null>(cache.brand?.business ?? null)
const anonymous = ref(cache.brand?.anonymous ?? false)
/** Asking the server while showing the last answer (the page is aria-busy). */
const refreshing = ref(!!business.value)
const loadError = ref<string | null>(null)
const form = reactive({ name: '', website: '', shape: 'circle' as LogoShape })

function reset(b: Business) {
  form.name = b.name
  form.website = b.website_url ?? ''
  form.shape = b.logo_shape
}
if (business.value)
  reset(business.value)
// Every copy of the business follows what this page saves (the home's header too).
watch(business, (b) => {
  if (b)
    setBusiness(b, anonymous.value)
})
// The email account recap emails go out from (M2.9).
const mail = ref<MailState | null>(cache.mail)
watch(mail, (m) => {
  cache.mail = m
})
const connectOpen = ref(false)
async function loadMail() {
  try {
    mail.value = await api<MailState>('/api/business/email')
  }
  catch (e) {
    fail('Couldn\'t load your email account', e)
  }
}
async function disconnect() {
  try {
    await api('/api/business/email', { method: 'DELETE' })
    if (mail.value)
      mail.value.connection = null
    toast.success('Email disconnected', { description: 'Highreels can still go out by WhatsApp or the links file.' })
  }
  catch (e) {
    fail('Couldn\'t disconnect', e)
  }
}
function connected(c: EmailConnection) {
  if (mail.value)
    mail.value.connection = c
  toast.success('Email connected', { description: `Highreels now go out from ${c.from_email}. A test is in that inbox.` })
}
onMounted(loadMail)

onMounted(async () => {
  try {
    const res = await api<{ business: Business, anonymous: boolean }>('/api/business')
    // Edits already started on the last answer stay; otherwise the form takes the fresh one.
    const editing = dirty.value
    anonymous.value = res.anonymous
    business.value = res.business
    if (!editing)
      reset(res.business)
  }
  catch (e) {
    if (isUnauthorized(e))
      return endSession()
    if (business.value)
      fail('Couldn\'t refresh your brand', e)
    else
      loadError.value = errorMessage(e)
  }
  finally {
    refreshing.value = false
  }
})

// The example Highreel on the phone wears its own design's colour; the logo previews take it too.
const exampleAccent = resolveLook(EXAMPLES[0]!.payload.settings.look).accent
const onAccent = readableOn(exampleAccent)
const shapes = [{ value: 'circle' as const, label: 'Circle' }, { value: 'square' as const, label: 'Square' }]

const dirty = computed(() => !!business.value && (
  form.name.trim() !== business.value.name
  || form.website.trim() !== (business.value.website_url ?? '')
  || form.shape !== business.value.logo_shape))
const saving = ref(false)
async function save() {
  if (!form.name.trim())
    return
  saving.value = true
  try {
    business.value = await api<Business>('/api/business', {
      method: 'PATCH',
      body: { name: form.name.trim(), website_url: form.website.trim(), logo_shape: form.shape },
    })
    reset(business.value)
    toast.success('Brand saved', { description: 'Every Highreel uses it, published ones included.' })
  }
  catch (e) {
    fail('Couldn\'t save', e)
  }
  finally {
    saving.value = false
  }
}

// --- Logo: shrunk in the browser, PNG (link previews can't read WebP), in the business's folder.
const logoInput = ref<HTMLInputElement | null>(null)
const logoBusy = ref(false)
const dropping = ref(false)
async function setLogo(path: string | null) {
  business.value = await api<Business>('/api/business', { method: 'PATCH', body: { logo_path: path } })
}
function chooseLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    uploadLogo(file)
}
function dropLogo(e: DragEvent) {
  dropping.value = false
  const files = [...(e.dataTransfer?.files ?? [])]
  const file = files.find(f => /^image\/(?:png|jpeg|webp)$/.test(f.type))
  if (file)
    uploadLogo(file)
  else if (files.length)
    toast.error('Use a PNG, JPEG or WebP image')
}
async function uploadLogo(file: File) {
  if (!business.value || logoBusy.value)
    return
  logoBusy.value = true
  toCover()
  const previous = business.value.logo_path
  try {
    const img = await shrinkImage(file, 512, 'logo')
    const path = await uploadMedia(img.blob, { kind: 'logo' })
    await setLogo(path)
    if (previous)
      await deleteMedia([previous])
  }
  catch (err) {
    fail('Couldn\'t upload the logo', err)
  }
  finally {
    logoBusy.value = false
  }
}
async function removeLogo() {
  const previous = business.value?.logo_path
  if (!previous)
    return
  try {
    await setLogo(null)
    await deleteMedia([previous])
  }
  catch (err) {
    fail('Couldn\'t remove the logo', err)
  }
}

// --- The phone: an example recap in these colours ---------------------------------
const stage = ref<InstanceType<typeof PhoneStage> | null>(null)
function toCover() {
  const p = stage.value?.player
  if (p && p.index !== 0) {
    p.playing = false
    p.go(0)
  }
}
const payload = computed<RecapPayload | null>(() => {
  const b = business.value
  if (!b)
    return null
  const ex = EXAMPLES[0]!.payload
  return {
    ...ex,
    year: new Date().getFullYear(),
    business: { ...b, name: form.name.trim() || b.name, logo_shape: form.shape, website_url: form.website.trim() || null },
    settings: { ...ex.settings, cta_label: '', cta_url: '' },
  }
})
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <DemoBanner v-if="anonymous" />
    <header class="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <NuxtLink to="/app" class="wordmark" aria-label="All Highreels"><Wordmark /></NuxtLink>
      <span class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <NuxtLink to="/app" class="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground">
        <ArrowLeft class="size-3.5" /> Your Highreels
      </NuxtLink>
    </header>

    <div v-if="loadError" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p class="text-[18px] font-semibold">Couldn't load your brand</p>
      <p class="max-w-md text-[14px] text-muted-foreground">{{ loadError }}</p>
    </div>
    <div v-else-if="!business" class="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
    </div>

    <div v-else class="flex min-h-0 flex-1" :aria-busy="refreshing">
      <form class="flex min-w-0 flex-1 flex-col" @submit.prevent="save">
        <div class="relative min-h-0 flex-1 overflow-y-auto">
          <div class="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-8 pt-8 pb-14">
            <header class="flex flex-col gap-1.5">
              <h1 class="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em]">Your brand</h1>
              <p class="text-[14px] text-muted-foreground">On every Highreel you make, published ones included. Change it here and they all follow. Colors come with each Highreel's design.</p>
            </header>

            <div class="settings">
              <!-- Name -->
              <div class="set-row">
                <div class="set-label">
                  <label for="br-name">Business name</label>
                  <p>On the cover, every slide and the share image.</p>
                </div>
                <Input id="br-name" v-model="form.name" maxlength="60" required class="h-10 rounded-full px-4" @focus="toCover" />
              </div>

              <!-- Logo -->
              <div class="set-row">
                <div class="set-label">
                  <span id="br-logo">Logo</span>
                  <p>Square images work best. Without one, Highreels show your first letter.</p>
                </div>
                <div class="flex flex-col gap-3">
                  <div
                    class="drop"
                    :class="{ over: dropping }"
                    data-testid="logo-drop"
                    @dragenter.prevent="dropping = true"
                    @dragover.prevent="dropping = true"
                    @dragleave.self="dropping = false"
                    @drop.prevent="dropLogo"
                  >
                    <RecapMonogram :name="form.name || business.name" :logo-url="business.logo_url" :shape="form.shape" :bg="exampleAccent" :fg="onAccent" size="52px" />
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p class="text-[13px] font-medium">{{ logoBusy ? 'Uploading…' : business.logo_path ? 'Your logo' : 'Drop a logo here' }}</p>
                      <p class="text-[12px] text-muted-foreground">PNG, JPEG or WebP. Saves straight away.</p>
                    </div>
                    <div class="flex shrink-0 gap-1">
                      <Button type="button" variant="outline" size="sm" :disabled="logoBusy" @click="logoInput?.click()">
                        <Loader2 v-if="logoBusy" class="animate-spin" /><ImagePlus v-else />
                        {{ business.logo_path ? 'Replace' : 'Upload' }}
                      </Button>
                      <Button v-if="business.logo_path" type="button" variant="ghost" size="icon-sm" :disabled="logoBusy" aria-label="Remove logo" @click="removeLogo">
                        <Trash2 />
                      </Button>
                    </div>
                    <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-testid="logo-input" aria-labelledby="br-logo" @change="chooseLogo">
                  </div>
                  <Segmented v-slot="{ option }" v-model="form.shape" :options="shapes" label="Logo shape" class="w-fit" data-testid="logo-shape" @update:model-value="toCover">
                    <RecapMonogram :name="form.name || business.name" :logo-url="business.logo_url" :shape="option.value" :bg="exampleAccent" :fg="onAccent" size="20px" />
                    {{ option.label }}
                  </Segmented>
                </div>
              </div>

              <!-- Website -->
              <div class="set-row">
                <div class="set-label">
                  <label for="br-web">Website</label>
                  <p>Your name links to it in the emails with your Highreels.</p>
                </div>
                <Input id="br-web" v-model="form.website" placeholder="https://" class="h-10 rounded-full px-4" />
              </div>

              <!-- Email: the account recap emails go out from (M2.9) -->
              <div class="set-row" data-testid="brand-email">
                <div class="set-label">
                  <span>Email</span>
                  <p>Highreels go out through your own email account, from your address.</p>
                </div>
                <div v-if="!mail" class="flex items-center text-muted-foreground"><Loader2 class="size-4 animate-spin" /></div>
                <div v-else-if="mail.connection" class="flex flex-col items-start gap-2.5">
                  <div class="drop w-full">
                    <span class="grid size-11 shrink-0 place-items-center rounded-full bg-background text-primary"><Mail class="size-5" /></span>
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p class="truncate text-[13px] font-medium" data-testid="brand-email-from">{{ mail.connection.from_name }} &lt;{{ mail.connection.from_email }}&gt;</p>
                      <p class="text-[12px] text-muted-foreground">Through {{ presetFor(mail.connection.provider).label }} · up to {{ mail.connection.daily_limit.toLocaleString('en-US') }} a day</p>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <Button type="button" variant="outline" size="sm" @click="connectOpen = true">Change</Button>
                    <Button type="button" variant="ghost" size="sm" @click="disconnect">Disconnect</Button>
                  </div>
                </div>
                <div v-else class="flex flex-col items-start gap-2">
                  <p v-if="mail.anonymous" class="text-[13px] text-muted-foreground">Add your email in the banner at the top first, to keep your work.</p>
                  <template v-else>
                    <Button type="button" variant="outline" data-testid="connect-email" @click="connectOpen = true"><Mail /> Connect your email</Button>
                    <p class="text-[12px] text-muted-foreground">Gmail, Google Workspace, Microsoft 365, iCloud, Zoho, or a sending service like Resend, Postmark or SendGrid.</p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2 border-t bg-background px-5 py-2.5">
          <span class="text-[13px] text-muted-foreground">{{ dirty ? 'Unsaved changes' : 'All changes saved' }}</span>
          <Button type="button" variant="ghost" size="sm" class="ml-auto" :disabled="!dirty || saving" @click="reset(business)">Discard</Button>
          <Button type="submit" size="sm" class="px-4" :disabled="!dirty || saving || !form.name.trim()">{{ saving ? 'Saving…' : 'Save' }}</Button>
        </div>
      </form>

      <EmailConnectDialog v-if="mail" v-model:open="connectOpen" :connection="mail.connection" :business-name="business?.name ?? ''" :dev="mail.dev" @connected="connected" />

      <PhoneStage ref="stage" :payload="payload" :accent="exampleAccent" :ink="onAccent">
        An example Highreel with your name and logo.
      </PhoneStage>
    </div>
  </div>
</template>

<style scoped>
.wordmark {
  padding: 0 6px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.035em;
}
.settings {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}
.set-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 22px 0;
  border-bottom: 1px solid var(--border);
}
@media (min-width: 720px) {
  .set-row { grid-template-columns: 190px minmax(0, 1fr); gap: 28px; }
}
.set-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.set-label > label,
.set-label > span {
  font-size: 14px;
  font-weight: 600;
}
.set-label > p {
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.45;
}
.drop {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 18px;
  background: var(--subtle);
  box-shadow: inset 0 0 0 1.5px var(--border);
  transition: box-shadow 150ms ease, background-color 150ms ease;
}
.drop.over {
  background: color-mix(in oklab, var(--primary) 6%, var(--background));
  box-shadow: inset 0 0 0 1.5px var(--primary);
}
</style>
