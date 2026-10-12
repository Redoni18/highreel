<script setup lang="ts">
// Duplicate a recap (SPEC M2.5 P3): brand, copy and photos, no rows. The
// year defaults to the next one: "run it again for 2027".
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HomeCampaign } from '#shared/types/recap'
import { nextName } from '#shared/utils/home'

const props = defineProps<{
  campaign: HomeCampaign | null
  duplicate: (input: { name: string, year: number }) => Promise<boolean>
}>()
const open = defineModel<boolean>('open', { default: false })

const name = ref('')
const year = ref(2026)
const saving = ref(false)
watch(open, (v) => {
  if (v && props.campaign) {
    year.value = props.campaign.year + 1
    name.value = nextName(props.campaign.name, props.campaign.year, year.value)
  }
})

async function submit() {
  saving.value = true
  const ok = await props.duplicate({ name: name.value.trim(), year: Number(year.value) })
  saving.value = false
  if (ok)
    open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Duplicate “{{ campaign?.name }}”</DialogTitle>
          <DialogDescription>
            {{ campaign?.kind === 'business'
              ? 'Copies the brand, the text and the photos. Update the numbers before you publish.'
              : 'Copies the brand, the slide text and the photos, without the rows. Upload this year\'s sheet next.' }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid grid-cols-[1fr_96px] gap-3">
          <div class="flex flex-col gap-1.5">
            <Label for="dup-name" class="text-[12px]">Name</Label>
            <Input id="dup-name" v-model="name" maxlength="80" required class="h-8" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="dup-year" class="text-[12px]">Year</Label>
            <Input id="dup-year" v-model="year" type="number" min="2000" max="2100" required class="h-8 font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" @click="open = false">Cancel</Button>
          <Button type="submit" size="sm" :disabled="saving || !name.trim()">{{ saving ? 'Duplicating…' : 'Duplicate' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
