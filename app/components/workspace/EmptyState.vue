<script setup lang="ts">
// Empty workspace (SPEC §6.3): three ways in, and the column contract below.
import { FileDown, Sparkles, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { idColumnOf } from '#shared/templates'

const ws = useWorkspace()
const businessName = ref('')
async function saveName() {
  if (businessName.value.trim())
    await ws.updateCampaign({ business: { name: businessName.value.trim() } })
}
const idColumn = computed(() => idColumnOf(ws.template.value))
const typeLabel = { text: 'text', email: 'email', phone: 'phone', date: 'date', int: 'number', decimal: 'decimal' }
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-7 px-6 pt-14 pb-20">
      <form v-if="ws.business.value?.name === 'My business'" class="flex flex-col gap-2 rounded-[20px] bg-muted p-4" @submit.prevent="saveName">
        <label for="first-name" class="text-[14px] font-medium">First, what's your business called? It appears on every Highreel.</label>
        <div class="flex gap-2">
          <Input id="first-name" v-model="businessName" maxlength="60" placeholder="Your business name" class="h-9 max-w-72 rounded-full bg-background px-4" />
          <Button type="submit" variant="outline" :disabled="!businessName.trim()">Save</Button>
        </div>
      </form>

      <div class="flex flex-col gap-3">
        <p class="w-fit rounded-full bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground">{{ ws.template.value.label }} template</p>
        <h1 class="text-[36px] leading-[1.1] font-semibold tracking-[-0.025em]">Start with your sheet.</h1>
        <p class="max-w-[38rem] text-[16px] text-muted-foreground">
          One row per customer. Each valid row becomes a personal Highreel with its own link.
          Your own column names are fine: we'll match them, and any other column can become a slide of its own. Drop a file anywhere on this page, or:
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="lg" @click="ws.downloadSheet()">
          <FileDown /> Download template
        </Button>
        <Button variant="outline" size="lg" @click="ws.pickFile()">
          <Upload /> Upload CSV or Excel
        </Button>
        <Button size="lg" :disabled="!!ws.busy.value" @click="ws.loadSample()">
          <Sparkles /> Use sample data
        </Button>
        <span class="note-hand ml-2 text-[23px]">no sheet yet? try ours</span>
      </div>

      <div class="mt-3 overflow-x-auto rounded-2xl border">
        <table class="w-full text-left text-[13px]">
          <thead class="border-b bg-subtle text-[12px] text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">Column</th>
              <th class="px-2 py-2 font-medium">Type</th>
              <th class="px-2 py-2 font-medium">Required</th>
              <th class="px-2 py-2 font-medium">Rule</th>
              <th class="px-2 py-2 font-medium">Used for</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in ws.template.value.columns" :key="c.key" class="border-b last:border-0">
              <td class="px-3 py-1.5 font-mono text-[12px]">{{ c.key }}</td>
              <td class="px-2 py-1.5 text-muted-foreground">{{ typeLabel[c.type] }}</td>
              <td class="px-2 py-1.5">{{ c.required ? 'yes' : '' }}</td>
              <td class="px-2 py-1.5 text-muted-foreground">{{ c.rule }}</td>
              <td class="px-2 py-1.5 text-muted-foreground">{{ c.usedFor }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[13px] text-muted-foreground">
        Tip: leave <span class="font-mono text-[12px]">email</span> out. You can join the exported links back to your email tool on <span class="font-mono text-[12px]">{{ idColumn }}</span>.
      </p>
    </div>
  </div>
</template>
