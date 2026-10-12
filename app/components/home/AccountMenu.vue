<script setup lang="ts">
// The home's account menu: dark mode and signing out (SPEC M2.5 P3).
import { Ellipsis, LogOut, Moon, Sun } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

defineProps<{ anonymous: boolean }>()
const { signOut } = useApi()
const colorMode = useColorMode()
const endOpen = ref(false)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" class="size-7" aria-label="Account">
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48 text-[13px]">
      <DropdownMenuItem @select="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
        <Sun v-if="colorMode.value === 'dark'" />
        <Moon v-else />
        {{ colorMode.value === 'dark' ? 'Light mode' : 'Dark mode' }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="anonymous ? (endOpen = true) : signOut()">
        <LogOut /> {{ anonymous ? 'End demo session' : 'Sign out' }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <ConfirmDialog
    v-model:open="endOpen"
    title="End the demo session?"
    description="A demo session isn't tied to an email, so its highlight reels can't be opened again after you leave. Add your email in the banner to keep them."
    confirm-label="End session"
    @confirm="signOut()"
  />
</template>
