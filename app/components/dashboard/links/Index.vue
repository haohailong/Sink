<script setup lang="ts">
import type { LinkUpdateType } from '@/types'
import type { DashboardLink, DashboardLinkBulkPatch, DashboardLinkBulkUpdateResponse, DashboardLinkListResponse } from '@/types/dashboard-links'
import { AlertCircle, Inbox, LoaderCircle } from '@lucide/vue'
import { useInfiniteScroll } from '@vueuse/core'
import { toast } from 'vue-sonner'

const linksStore = useDashboardLinksStore()
const linksSearchStore = useDashboardLinksSearchStore()
const { t } = useI18n()

const links = ref<DashboardLink[]>([])
const selectedSlugs = ref<string[]>([])
const listComplete = ref(false)
const listError = ref(false)
const listLoading = ref(false)
const bulkProcessing = shallowRef(false)
const bulkEditOpen = shallowRef(false)
const bulkDeleteOpen = shallowRef(false)
const limit = 24
let cursor = ''
let requestGeneration = 0

const selectedSlugSet = computed(() => new Set(selectedSlugs.value))
const selectedLinks = computed(() => links.value.filter(link => selectedSlugSet.value.has(link.slug)))

const { countersMap, counterErrorIds, fetchCounters, resetCounters } = useLinkCounters()
provide(LINKS_COUNTERS_MAP_KEY, countersMap)
provide(LINKS_COUNTER_ERROR_IDS_KEY, counterErrorIds)
provide(RETRY_LINK_COUNTERS_KEY, (id: string) => void fetchCounters([id]))

const scrollContainer = shallowRef<HTMLElement | null>(null)

onMounted(() => {
  scrollContainer.value = document.getElementById('dashboard-main')
  void getLinks()
})

async function getLinks() {
  if (listLoading.value || listComplete.value)
    return

  const generation = requestGeneration
  const requestCursor = cursor
  listLoading.value = true
  try {
    const data = await useAPI<DashboardLinkListResponse>('/api/link/list', {
      query: {
        limit,
        cursor: requestCursor,
        sort: linksStore.sortBy,
        status: linksStore.status,
        tag: linksStore.tag,
      },
    })

    if (generation !== requestGeneration)
      return

    const newLinks = data.links.filter(Boolean)
    const existingSlugs = new Set(links.value.map(link => link.slug))
    links.value = links.value.concat(newLinks.filter(link => !existingSlugs.has(link.slug)))
    cursor = data.cursor
    listComplete.value = data.list_complete
    listError.value = false

    const ids = newLinks.map(l => l.id).filter(id => !countersMap.value[id])
    void fetchCounters(ids)
  }
  catch (error) {
    if (generation !== requestGeneration)
      return
    console.error(error)
    listError.value = true
  }
  finally {
    if (generation === requestGeneration)
      listLoading.value = false
  }
}

function resetAndLoad() {
  requestGeneration++
  links.value = []
  selectedSlugs.value = []
  bulkEditOpen.value = false
  bulkDeleteOpen.value = false
  resetCounters()
  cursor = ''
  listComplete.value = false
  listError.value = false
  listLoading.value = false
  void getLinks()
}

useInfiniteScroll(
  scrollContainer,
  getLinks,
  {
    distance: 0,
    interval: 1000,
    canLoadMore: () => {
      return !listError.value && !listComplete.value
    },
  },
)

watch(
  [() => linksStore.sortBy, () => linksStore.status, () => linksStore.tag],
  resetAndLoad,
)

function matchesCurrentFilters(link: DashboardLink) {
  const isExpired = Boolean(link.expiration && link.expiration <= Math.floor(Date.now() / 1000))
  return (linksStore.status === 'expired') === isExpired
    && (!linksStore.tag || link.tags?.includes(linksStore.tag))
}

function updateLinkList(link: DashboardLink, type: LinkUpdateType) {
  if (type === 'edit') {
    const index = links.value.findIndex(l => l.slug === link.slug)
    if (index >= 0 && matchesCurrentFilters(link)) {
      links.value[index] = link
    }
    else if (index >= 0) {
      links.value.splice(index, 1)
      selectedSlugs.value = selectedSlugs.value.filter(slug => slug !== link.slug)
    }
  }
  else if (type === 'delete') {
    const index = links.value.findIndex(l => l.slug === link.slug)
    if (index >= 0)
      links.value.splice(index, 1)
    selectedSlugs.value = selectedSlugs.value.filter(slug => slug !== link.slug)
  }
  else {
    if (!matchesCurrentFilters(link))
      return

    if (linksStore.sortBy !== 'newest') {
      linksStore.sortBy = 'newest'
      return
    }

    links.value = [link, ...links.value.filter(item => item.slug !== link.slug)]
  }
}

function updateSelection(slug: string, selected: boolean) {
  if (selected) {
    if (!selectedSlugSet.value.has(slug))
      selectedSlugs.value = [...selectedSlugs.value, slug]
  }
  else {
    selectedSlugs.value = selectedSlugs.value.filter(item => item !== slug)
  }
}

function toggleAll(selected: boolean) {
  selectedSlugs.value = selected ? links.value.map(link => link.slug) : []
}

function handleBulkResults(results: BulkOperationResult<DashboardLink>[], operation: 'update' | 'delete') {
  const failed = results.filter(result => result.error)
  const successCount = results.length - failed.length
  selectedSlugs.value = failed.map(result => result.item.slug)

  if (failed.length === 0) {
    toast(t(`links.bulk.${operation}_success`, { count: successCount }))
    return true
  }

  console.error(`Bulk link ${operation} failed`, failed.map(result => ({
    slug: result.item.slug,
    error: result.error,
  })))

  if (successCount > 0) {
    toast.error(t(`links.bulk.${operation}_partial`, {
      success: successCount,
      failed: failed.length,
    }))
  }
  else {
    toast.error(t(`links.bulk.${operation}_failed`, { count: failed.length }))
  }
  return false
}

async function bulkEdit(patch: DashboardLinkBulkPatch) {
  if (bulkProcessing.value || selectedLinks.value.length === 0)
    return

  const targets = [...selectedLinks.value]
  bulkProcessing.value = true
  try {
    const results: BulkOperationResult<DashboardLink>[] = []
    for (const chunk of chunkItems(targets, 100)) {
      try {
        const response = await useAPI<DashboardLinkBulkUpdateResponse>('/api/link/bulk-edit', {
          method: 'PUT',
          body: {
            slugs: chunk.map(link => link.slug),
            changes: createBulkEditChanges(patch),
          },
        })
        const updatedSlugs = new Set(response.links.map(link => link.slug))
        const failedBySlug = new Map(response.failed.map(failure => [failure.slug, failure.error]))

        for (const updatedLink of response.links) {
          linksSearchStore.syncLink(updatedLink, 'edit')
          linksStore.notifyLinkUpdate(updatedLink, 'edit')
        }
        for (const link of chunk) {
          results.push(updatedSlugs.has(link.slug)
            ? { item: link }
            : { item: link, error: failedBySlug.get(link.slug) ?? 'missing_result' })
        }
      }
      catch (error) {
        results.push(...chunk.map(item => ({ item, error })))
      }
    }

    if (handleBulkResults(results, 'update'))
      bulkEditOpen.value = false
  }
  finally {
    bulkProcessing.value = false
  }
}

async function bulkDelete() {
  if (bulkProcessing.value || selectedLinks.value.length === 0)
    return

  const targets = [...selectedLinks.value]
  bulkProcessing.value = true
  try {
    const results = await runBulkOperation(targets, async (link) => {
      await useAPI('/api/link/delete', {
        method: 'POST',
        body: { slug: link.slug },
      })
      linksSearchStore.syncLink(link, 'delete')
      linksStore.notifyLinkUpdate(link, 'delete')
    })

    if (handleBulkResults(results, 'delete'))
      bulkDeleteOpen.value = false
  }
  finally {
    bulkProcessing.value = false
  }
}

linksStore.onLinkUpdate(({ link, type }) => {
  updateLinkList(link, type)
})
</script>

<template>
  <template v-if="links.length">
    <DashboardLinksBulkActions
      class="mb-4"
      :total-count="links.length"
      :selected-count="selectedSlugs.length"
      :processing="bulkProcessing"
      @toggle-all="toggleAll"
      @clear="selectedSlugs = []"
      @edit="bulkEditOpen = true"
      @delete="bulkDeleteOpen = true"
    />
    <section
      class="
        grid grid-cols-1 gap-4
        md:grid-cols-2
        lg:grid-cols-3
      "
    >
      <DashboardLinksLink
        v-for="link in links"
        :key="link.slug"
        :link="link"
        :selected="selectedSlugSet.has(link.slug)"
        @update:selected="updateSelection(link.slug, $event)"
      />
    </section>
  </template>
  <section
    v-else-if="listLoading"
    class="
      grid grid-cols-1 gap-4
      md:grid-cols-2
      lg:grid-cols-3
    "
    role="status"
    aria-live="polite"
  >
    <DashboardLinksLinkSkeleton v-for="index in 6" :key="index" />
    <span class="sr-only">{{ $t('dashboard.loading') }}</span>
  </section>
  <div
    v-if="links.length"
    class="flex min-h-14 items-center justify-center py-4"
    role="status"
    aria-live="polite"
  >
    <template v-if="listLoading">
      <LoaderCircle class="motion-safe:animate-spin" aria-hidden="true" />
      <span class="sr-only">{{ $t('dashboard.loading') }}</span>
    </template>
    <span v-else-if="listComplete" class="text-sm">
      {{ $t('links.no_more') }}
    </span>
  </div>
  <Card v-if="!listLoading && listComplete && links.length === 0">
    <CardContent
      class="
        flex min-h-48 flex-col items-center justify-center gap-3 text-center
        text-muted-foreground
      "
    >
      <Inbox class="size-8" aria-hidden="true" />
      <p class="text-sm">
        {{ $t('links.no_filtered_results') }}
      </p>
    </CardContent>
  </Card>
  <Alert
    v-if="listError"
    variant="destructive"
    class="mx-auto max-w-xl"
  >
    <AlertCircle aria-hidden="true" />
    <AlertTitle>{{ $t('links.load_failed') }}</AlertTitle>
    <AlertDescription>
      <Button variant="link" size="sm" class="text-destructive" @click="getLinks">
        {{ $t('common.try_again') }}
      </Button>
    </AlertDescription>
  </Alert>

  <DashboardLinksBulkEditModal
    v-model:open="bulkEditOpen"
    :count="selectedLinks.length"
    :processing="bulkProcessing"
    @submit="bulkEdit"
  />
  <DashboardLinksBulkDeleteDialog
    v-model:open="bulkDeleteOpen"
    :count="selectedLinks.length"
    :processing="bulkProcessing"
    @confirm="bulkDelete"
  />
</template>
