<script setup lang="ts">
// Click-to-rename text (business and campaign names in the top bar).
const props = defineProps<{ value: string, label: string, maxLength?: number }>()
const emit = defineEmits<{ save: [value: string] }>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

function start() {
  draft.value = props.value
  editing.value = true
  nextTick(() => input.value?.select())
}
function commit() {
  if (!editing.value)
    return
  editing.value = false
  const v = draft.value.trim()
  if (v && v !== props.value)
    emit('save', v)
}
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    v-model="draft"
    class="h-8 min-w-0 rounded-full bg-background px-2.5 text-[15px] font-medium outline-none ring-2 ring-primary"
    :style="{ width: `${Math.max(6, draft.length + 2)}ch` }"
    :maxlength="maxLength"
    :aria-label="label"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="editing = false"
    @blur="commit"
  >
  <button
    v-else
    type="button"
    class="h-8 truncate rounded-full px-2.5 text-[15px] font-medium hover:bg-muted"
    :title="`Rename ${label.toLowerCase()}`"
    @click="start"
  >
    {{ value }}
  </button>
</template>
