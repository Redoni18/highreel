<script setup lang="ts">
// A user's role on the admin pages (SPEC M2.15): admins stand out, clients don't.
import type { Role } from '#shared/types/admin'

defineProps<{ role: Role }>()
</script>

<template>
  <span v-if="role === 'admin'" class="inline-flex h-6 items-center rounded-full bg-primary/12 px-2.5 text-[12px] font-medium text-primary">admin</span>
  <span v-else class="text-muted-foreground">client</span>
</template>
