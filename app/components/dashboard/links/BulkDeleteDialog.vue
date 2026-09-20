<script setup lang="ts">
import { Loader2 } from '@lucide/vue'

const props = defineProps<{
  count: number
  processing?: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const open = defineModel<boolean>('open', { default: false })

function updateOpen(value: boolean) {
  if (!value && props.processing)
    return
  open.value = value
}
</script>

<template>
  <AlertDialog :open="open" @update:open="updateOpen">
    <AlertDialogContent @escape-key-down="processing && $event.preventDefault()">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t('links.bulk.delete_title', { count }) }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t('links.bulk.delete_description', { count }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="processing">
          {{ $t('common.cancel') }}
        </AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="processing"
          :aria-busy="processing"
          @click.prevent="emit('confirm')"
        >
          <Loader2 v-if="processing" class="motion-safe:animate-spin" aria-hidden="true" />
          {{ $t('links.bulk.delete_action', { count }) }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
