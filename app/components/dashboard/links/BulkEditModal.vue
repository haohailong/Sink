<script setup lang="ts">
import type { DashboardLinkBulkPatch } from '@/types/dashboard-links'
import { Loader2 } from '@lucide/vue'

defineProps<{
  count: number
  processing?: boolean
}>()

const emit = defineEmits<{
  submit: [patch: DashboardLinkBulkPatch]
}>()

const open = defineModel<boolean>('open', { default: false })
const formId = useId()
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="$t('links.bulk.edit_title', { count })"
    :description="$t('links.bulk.edit_description')"
    :prevent-close="processing"
  >
    <DashboardLinksBulkEditForm
      v-if="open"
      :form-id="formId"
      :submitting="processing"
      @submit="emit('submit', $event)"
    />

    <template #footer>
      <Button
        type="button"
        variant="secondary"
        :disabled="processing"
        @click="open = false"
      >
        {{ $t('common.cancel') }}
      </Button>
      <Button
        type="submit"
        :form="formId"
        :disabled="processing"
        :aria-busy="processing"
      >
        <Loader2 v-if="processing" class="motion-safe:animate-spin" aria-hidden="true" />
        {{ $t('links.bulk.save') }}
      </Button>
    </template>
  </ResponsiveModal>
</template>
