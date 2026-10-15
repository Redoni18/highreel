<script setup lang="ts">
// Group photos of a recap (SPEC M2c), in the Design tab: the same photos for
// everyone, one slide each before the note. They save as soon as they
// change; the consent checkbox comes before the first upload.
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MAX_PHOTOS } from '#shared/utils/recap'

const ws = useWorkspace()
const photoInput = ref<HTMLInputElement | null>(null)
const consent = ref(false)

const settings = computed(() => ws.campaign.value!.settings)
const consented = computed(() => !!settings.value.photos_consent_at)
const canAdd = computed(() => (consented.value || consent.value) && ws.photos.value.length < MAX_PHOTOS && !ws.mediaBusy.value)

function files(e: Event): File[] {
  const input = e.target as HTMLInputElement
  const list = [...(input.files ?? [])]
  input.value = ''
  return list
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="!consented" class="flex items-start gap-2.5">
      <Checkbox id="ph-consent" v-model="consent" class="mt-0.5" data-testid="photo-consent" />
      <Label for="ph-consent" class="text-[13px] leading-snug font-normal">I'm allowed to share these photos with the people receiving this Highreel.</Label>
    </div>

    <ul v-if="ws.photos.value.length" class="grid gap-2 sm:grid-cols-2">
      <li v-for="(photo, i) in ws.photos.value" :key="photo.id" class="flex gap-2 rounded-2xl bg-muted p-1.5">
        <img :src="photo.url" :alt="photo.caption || `Photo ${i + 1}`" class="size-16 shrink-0 rounded-xl object-cover">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <Input
            :model-value="photo.caption"
            maxlength="80"
            placeholder="Caption (optional)"
            :aria-label="`Caption for photo ${i + 1}`"
            class="h-7 bg-background px-2 text-[12px]"
            @change="(e: Event) => ws.setPhotoCaption(photo.id, (e.target as HTMLInputElement).value)"
          />
          <div class="flex items-center gap-0.5 text-muted-foreground">
            <Button type="button" variant="ghost" size="icon-xs" :disabled="i === 0" :aria-label="`Move photo ${i + 1} up`" @click="ws.movePhoto(photo.id, -1)"><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-xs" :disabled="i === ws.photos.value.length - 1" :aria-label="`Move photo ${i + 1} down`" @click="ws.movePhoto(photo.id, 1)"><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon-xs" class="ml-auto hover:text-destructive" :aria-label="`Remove photo ${i + 1}`" @click="ws.removePhoto(photo.id)"><Trash2 /></Button>
          </div>
        </div>
      </li>
    </ul>

    <div class="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" :disabled="!canAdd" @click="photoInput?.click()">
        <Loader2 v-if="ws.mediaBusy.value" class="animate-spin" />
        <ImagePlus v-else />
        Add photos
      </Button>
      <span class="font-mono text-[12px] text-muted-foreground">{{ ws.photos.value.length }}/{{ MAX_PHOTOS }}</span>
    </div>
    <input ref="photoInput" type="file" accept="image/png,image/jpeg,image/webp" multiple class="hidden" data-testid="photo-input" @change="e => ws.addPhotos(files(e), consent)">

    <div v-if="ws.photos.value.length" class="flex items-start gap-2.5">
      <Switch
        id="ph-share"
        size="sm"
        class="mt-0.5"
        :model-value="settings.photo_in_share_image"
        @update:model-value="v => ws.updateCampaign({ settings: { photo_in_share_image: v === true } })"
      />
      <Label for="ph-share" class="block flex-1 text-[13px] leading-snug font-normal">Put the first photo on the share image <span class="text-muted-foreground">(off by default: people post that image publicly, and group photos can show other people's children)</span></Label>
      <InfoTip topic="shareImage" />
    </div>
  </div>
</template>
