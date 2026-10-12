<script setup lang="ts">
// Connect your email (SPEC M2.9): recap emails go out through the business's
// own account over SMTP, so they come from its real address. Pick the
// provider (presets fill the server and say which password it wants), the
// address, a password. The server logs in and sends a test to that address
// before anything is saved; a refusal shows in the mail server's own words.
// Used by Your brand and by Share.
import { ExternalLink, Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldInput } from '@/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type EmailConnection, loginFor, presetFor, SMTP_PRESETS } from '#shared/utils/smtp'

const props = defineProps<{
  /** the saved connection, to change it */
  connection: EmailConnection | null
  businessName: string
  /** a development server: offer the local test inbox */
  dev: boolean
}>()
const emit = defineEmits<{ connected: [connection: EmailConnection] }>()
const open = defineModel<boolean>('open', { default: false })
const { api } = useApi()

const presets = computed(() => SMTP_PRESETS.filter(p => !p.dev || props.dev))
const form = reactive({ provider: 'gmail', email: '', name: '', username: '', password: '', host: '', port: 587, secure: false, replyTo: '', limit: 450 })
const preset = computed(() => presetFor(form.provider))
const custom = computed(() => !!preset.value.editable || preset.value.key === 'other')
const more = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)

function pick(key: unknown) {
  if (typeof key !== 'string' || !key)
    return
  form.provider = key
  const p = presetFor(key)
  form.host = p.host
  form.port = p.port
  form.secure = p.secure
  form.limit = p.dailyLimit
  if (p.dev && !form.email)
    form.email = 'hello@your-business.test'
}
watch(open, (v) => {
  if (!v)
    return
  error.value = null
  const c = props.connection
  if (c) {
    form.provider = c.provider
    form.email = c.from_email
    form.name = c.from_name
    form.username = c.username
    form.password = ''
    form.host = c.host
    form.port = c.port
    form.secure = c.secure
    form.replyTo = c.reply_to ?? ''
    form.limit = c.daily_limit
  }
  else {
    form.email = ''
    form.name = props.businessName
    form.username = ''
    form.password = ''
    form.replyTo = ''
    pick(props.dev ? 'local' : 'gmail')
  }
  more.value = false
})

// Keep a saved password when only the name, reply address or limit change.
const keepsPassword = computed(() => !!props.connection && props.connection.host === form.host && props.connection.username === loginFor(preset.value, { email: form.email, username: form.username, password: form.password || '\u0000' }))

async function connect() {
  error.value = null
  saving.value = true
  try {
    const res = await api<{ connection: EmailConnection }>('/api/business/email', {
      method: 'PUT',
      body: {
        provider: form.provider,
        host: form.host,
        port: Number(form.port),
        secure: form.secure,
        username: loginFor(preset.value, { email: form.email, username: form.username, password: form.password }),
        password: form.password,
        from_email: form.email,
        from_name: form.name,
        reply_to: form.replyTo,
        daily_limit: Number(form.limit),
      },
    })
    emit('connected', res.connection)
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ connection ? 'Change your email' : 'Connect your email' }}</DialogTitle>
        <DialogDescription>Highlight reels go out through your own email account, from your address, so people see who they're from. We check the login and send you a test before saving.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="connect">
        <div class="field">
          <Label for="ec-provider">Your email provider</Label>
          <Select :model-value="form.provider" @update:model-value="pick">
            <SelectTrigger id="ec-provider" class="w-full" data-testid="ec-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" class="max-h-72">
              <SelectItem v-for="p in presets" :key="p.key" :value="p.key">{{ p.label }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="preset.note" class="hint">{{ preset.note }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="field">
            <Label for="ec-email">Send from</Label>
            <Input id="ec-email" v-model="form.email" type="email" required autocomplete="email" placeholder="hello@yourbusiness.com" />
          </div>
          <div class="field">
            <Label for="ec-name">Name people see</Label>
            <Input id="ec-name" v-model="form.name" maxlength="60" :placeholder="businessName" />
          </div>
        </div>

        <div v-if="preset.username === 'ask'" class="field">
          <Label for="ec-user">Login</Label>
          <Input id="ec-user" v-model="form.username" autocomplete="username" :placeholder="preset.dev ? 'Not needed' : 'Usually your email address'" />
        </div>

        <div class="field">
          <Label for="ec-pass">{{ preset.password.label }}</Label>
          <Input id="ec-pass" v-model="form.password" type="password" autocomplete="new-password" :placeholder="keepsPassword ? 'Saved (leave blank to keep it)' : ''" :required="!keepsPassword && !preset.dev" />
          <p v-if="preset.password.help" class="hint">
            {{ preset.password.help }}
            <a v-if="preset.password.url" :href="preset.password.url" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 underline underline-offset-2">Open it <ExternalLink class="size-3" /></a>
          </p>
        </div>

        <div v-if="custom" class="grid grid-cols-[1fr_96px] gap-3">
          <div class="field">
            <Label for="ec-host">Server</Label>
            <Input id="ec-host" v-model="form.host" required placeholder="smtp.yourprovider.com" class="font-mono" />
          </div>
          <NumberField id="ec-port" v-model="form.port" class="field" :min="1" :max="65535" :format-options="{ useGrouping: false }">
            <Label for="ec-port">Port</Label>
            <NumberFieldContent><NumberFieldInput class="font-mono" /></NumberFieldContent>
          </NumberField>
          <div class="col-span-2 flex items-center gap-2.5">
            <Checkbox id="ec-secure" v-model="form.secure" />
            <Label for="ec-secure" class="text-[13px] font-normal">Secure connection from the start (port 465). Otherwise it upgrades with STARTTLS.</Label>
          </div>
        </div>

        <Button type="button" variant="link" class="h-auto w-fit p-0 text-[13px] text-muted-foreground" @click="more = !more">{{ more ? 'Fewer settings' : 'More settings' }}</Button>
        <div v-if="more" class="grid gap-3 sm:grid-cols-2">
          <div class="field">
            <Label for="ec-reply">Replies go to</Label>
            <Input id="ec-reply" v-model="form.replyTo" type="email" placeholder="The same address" />
          </div>
          <NumberField id="ec-limit" v-model="form.limit" class="field" :min="1" :max="100000">
            <Label for="ec-limit">Emails a day, at most</Label>
            <NumberFieldContent><NumberFieldInput class="font-mono" /></NumberFieldContent>
          </NumberField>
        </div>

        <p v-if="error" class="rounded-xl bg-destructive/10 px-3 py-2 text-[13px] text-destructive" role="alert" data-testid="ec-error">{{ error }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="saving || !form.email.trim()">
            <Loader2 v-if="saving" class="animate-spin" />
            {{ saving ? 'Checking your login…' : connection ? 'Save' : 'Connect' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field :deep(label) { font-size: 13px; font-weight: 500; }
.hint {
  color: var(--muted-foreground);
  font-size: 12.5px;
  line-height: 1.45;
}
</style>
