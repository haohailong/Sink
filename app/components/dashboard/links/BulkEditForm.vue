<script setup lang="ts">
import type { DashboardLinkBulkPatch } from '@/types/dashboard-links'

defineProps<{
  formId: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [patch: DashboardLinkBulkPatch]
}>()

const { t } = useI18n()
const changeComment = shallowRef(false)
const changeTags = shallowRef(false)
const changeTitle = shallowRef(false)
const changeDescription = shallowRef(false)
const comment = shallowRef('')
const tags = ref<string[]>([])
const title = shallowRef('')
const description = shallowRef('')
const error = shallowRef('')
const tagsInput = useTemplateRef<{ commit: () => boolean }>('tagsInput')

const commentId = useId()
const tagsId = useId()
const titleId = useId()
const descriptionId = useId()

async function submitForm() {
  error.value = ''

  if (![changeComment.value, changeTags.value, changeTitle.value, changeDescription.value].some(Boolean)) {
    error.value = t('links.bulk.no_fields')
    return
  }

  if (changeTags.value && tagsInput.value?.commit() === false)
    return

  const patch: DashboardLinkBulkPatch = {}
  if (changeComment.value)
    patch.comment = comment.value.trim() || undefined
  if (changeTags.value)
    patch.tags = tags.value
  if (changeTitle.value)
    patch.title = title.value.trim() || undefined
  if (changeDescription.value)
    patch.description = description.value.trim() || undefined

  emit('submit', patch)
}
</script>

<template>
  <form
    :id="formId"
    class="w-full space-y-5 px-1"
    :aria-busy="submitting"
    @submit.prevent="submitForm"
  >
    <Alert>
      <AlertDescription>
        {{ $t('links.bulk.edit_hint') }}
      </AlertDescription>
    </Alert>

    <fieldset :disabled="submitting" class="space-y-5">
      <Field>
        <div class="flex items-center gap-3">
          <Checkbox :id="commentId" v-model="changeComment" />
          <FieldLabel :for="commentId">
            {{ $t('links.bulk.change_field', { field: $t('links.form.comment') }) }}
          </FieldLabel>
        </div>
        <Textarea
          v-model="comment"
          :disabled="!changeComment"
          :maxlength="2048"
          :placeholder="$t('links.form.comment')"
          rows="3"
        />
      </Field>

      <Separator />

      <Field>
        <div class="flex items-center gap-3">
          <Checkbox :id="tagsId" v-model="changeTags" />
          <FieldLabel :for="tagsId">
            {{ $t('links.bulk.change_field', { field: $t('links.form.tags') }) }}
          </FieldLabel>
        </div>
        <fieldset :disabled="!changeTags">
          <DashboardLinksEditorTagsInput ref="tagsInput" v-model="tags" />
        </fieldset>
      </Field>

      <Separator />

      <Field>
        <div class="flex items-center gap-3">
          <Checkbox :id="titleId" v-model="changeTitle" />
          <FieldLabel :for="titleId">
            {{ $t('links.bulk.change_field', { field: $t('links.form.og_title') }) }}
          </FieldLabel>
        </div>
        <Input
          v-model="title"
          :disabled="!changeTitle"
          :maxlength="256"
          :placeholder="$t('links.form.og_title_placeholder')"
        />
      </Field>

      <Field>
        <div class="flex items-center gap-3">
          <Checkbox :id="descriptionId" v-model="changeDescription" />
          <FieldLabel :for="descriptionId">
            {{ $t('links.bulk.change_field', { field: $t('links.form.og_description') }) }}
          </FieldLabel>
        </div>
        <Textarea
          v-model="description"
          :disabled="!changeDescription"
          :maxlength="2048"
          :placeholder="$t('links.form.og_description_placeholder')"
          rows="3"
        />
      </Field>
    </fieldset>

    <p v-if="error" class="text-sm text-destructive" role="alert">
      {{ error }}
    </p>
  </form>
</template>
