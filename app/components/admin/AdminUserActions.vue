<script setup lang="ts">
// Block, unblock or remove a user (SPEC M2.15), from a row's "⋯" menu on
// Users or as buttons on the user's page. Blocking signs them out, keeps
// their address from signing in and takes their Highreels offline until
// they're unblocked; removing deletes the account now and, unless unticked,
// blocks the address too. Admins have neither (the owner makes them a client
// by hand first); a demo has no address, so it can only be removed.
import { Ban, Ellipsis, Loader2, Trash2, Undo2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdminUser } from '#shared/types/admin'

const props = withDefaults(defineProps<{
  user: Pick<AdminUser, 'id' | 'email' | 'demo' | 'role' | 'blocked'>
  variant?: 'menu' | 'buttons'
}>(), { variant: 'menu' })
const emit = defineEmits<{ changed: [], removed: [] }>()

const { api, fail } = useApi()
const name = computed(() => props.user.email ?? 'this demo')
const blockOpen = ref(false)
const removeOpen = ref(false)
const reason = ref('')
const alsoBlock = ref(true)
const busy = ref(false)

function openBlock() {
  reason.value = ''
  blockOpen.value = true
}
function openRemove() {
  reason.value = ''
  alsoBlock.value = true
  removeOpen.value = true
}

async function run(title: string, work: () => Promise<unknown>, done: string, after: () => void) {
  busy.value = true
  try {
    await work()
    blockOpen.value = false
    removeOpen.value = false
    toast(done)
    after()
  }
  catch (e) {
    fail(title, e)
  }
  finally {
    busy.value = false
  }
}

// The answer is { ok: true }: typed by hand, since inferring it from the route table overflows TypeScript here.
type Ok = { ok: boolean }
const block = () => run('Couldn\'t block them', () => api<Ok>(`/api/admin/users/${props.user.id}/block`, { method: 'POST', body: { reason: reason.value } }), `Blocked ${name.value}`, () => emit('changed'))
const unblock = () => run('Couldn\'t unblock them', () => api<Ok>('/api/admin/unblock', { method: 'POST', body: { email: props.user.email } }), `Unblocked ${name.value}`, () => emit('changed'))
const remove = () => run('Couldn\'t remove the account', () => api<Ok>(`/api/admin/users/${props.user.id}/remove`, { method: 'POST', body: { block: !props.user.demo && alsoBlock.value, reason: reason.value } }), `Removed ${name.value}`, () => emit('removed'))
</script>

<template>
  <template v-if="user.role !== 'admin'">
    <DropdownMenu v-if="variant === 'menu'">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon-sm" class="size-7" :aria-label="`Actions for ${name}`" data-testid="user-actions">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48 text-[13px]">
        <DropdownMenuItem @select="navigateTo(`/app/admin/users/${user.id}`)">Open</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem v-if="user.blocked" @select="unblock"><Undo2 /> Unblock</DropdownMenuItem>
        <DropdownMenuItem v-else-if="!user.demo" @select="openBlock"><Ban /> Block…</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" @select="openRemove"><Trash2 /> Remove account…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <div v-else class="flex flex-wrap gap-2">
      <Button v-if="user.blocked" variant="outline" size="sm" :disabled="busy" @click="unblock"><Undo2 /> Unblock</Button>
      <Button v-else-if="!user.demo" variant="outline" size="sm" @click="openBlock"><Ban /> Block</Button>
      <Button variant="outline" size="sm" class="text-destructive hover:text-destructive" @click="openRemove"><Trash2 /> Remove account</Button>
    </div>

    <Dialog v-model:open="blockOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="break-all">Block {{ name }}?</DialogTitle>
          <DialogDescription>
            They're signed out now and can't sign in again with this address. Their published Highreels stop opening. Unblock them to undo all of it.
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-1.5" @submit.prevent="block">
          <Label for="block-reason" class="text-[13px]">Note for admins <span class="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="block-reason" v-model="reason" maxlength="300" placeholder="What happened" />
        </form>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="blockOpen = false">Cancel</Button>
          <Button variant="destructive" size="sm" :disabled="busy" data-testid="confirm-block" @click="block">
            <Loader2 v-if="busy" class="animate-spin" /> Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="removeOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="break-all">Remove {{ name }}?</DialogTitle>
          <DialogDescription>
            This deletes the account now, with its business, every Highreel and their files. Their customers' links stop working. It can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div v-if="!user.demo" class="flex flex-col gap-3">
          <Label class="flex items-start gap-2.5 text-[14px] font-normal">
            <Checkbox v-model="alsoBlock" class="mt-0.5" data-testid="remove-block" />
            <span>Also block this address, so it can't sign up again</span>
          </Label>
          <div v-if="alsoBlock" class="flex flex-col gap-1.5">
            <Label for="remove-reason" class="text-[13px]">Note for admins <span class="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="remove-reason" v-model="reason" maxlength="300" placeholder="What happened" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="removeOpen = false">Cancel</Button>
          <Button variant="destructive" size="sm" :disabled="busy" data-testid="confirm-remove" @click="remove">
            <Loader2 v-if="busy" class="animate-spin" /> Remove account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </template>
</template>
