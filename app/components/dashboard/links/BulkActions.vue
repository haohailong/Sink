<script setup lang="ts">
import { SquarePen, Trash2, X } from '@lucide/vue'

const props = defineProps<{
  totalCount: number
  selectedCount: number
  processing?: boolean
}>()

const emit = defineEmits<{
  toggleAll: [selected: boolean]
  clear: []
  edit: []
  delete: []
}>()

const checkboxState = computed<boolean | 'indeterminate'>(() => {
  if (props.selectedCount === 0)
    return false
  if (props.selectedCount === props.totalCount)
    return true
  return 'indeterminate'
})

const selectAllId = useId()
</script>

<template>
  <Card size="sm">
    <CardContent
      class="flex flex-wrap items-center gap-3"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <Checkbox
          :id="selectAllId"
          :model-value="checkboxState"
          :disabled="processing"
          :aria-label="$t('links.bulk.select_all')"
          @update:model-value="emit('toggleAll', $event === true)"
        />
        <label :for="selectAllId" class="cursor-pointer text-sm font-medium">
          {{ $t('links.bulk.select_all') }}
        </label>
        <Badge v-if="selectedCount" variant="secondary">
          {{ $t('links.bulk.selected_count', { count: selectedCount }) }}
        </Badge>
      </div>

      <div v-if="selectedCount" class="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          :disabled="processing"
          @click="emit('clear')"
        >
          <X aria-hidden="true" />
          {{ $t('links.bulk.clear') }}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="processing"
          @click="emit('edit')"
        >
          <SquarePen aria-hidden="true" />
          {{ $t('links.bulk.edit') }}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          :disabled="processing"
          @click="emit('delete')"
        >
          <Trash2 aria-hidden="true" />
          {{ $t('links.bulk.delete') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
