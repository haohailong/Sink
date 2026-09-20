import type { DashboardLinkBulkChanges, DashboardLinkBulkPatch } from '@/types/dashboard-links'

export interface BulkOperationResult<T> {
  item: T
  error?: unknown
}

export function createBulkEditChanges(patch: DashboardLinkBulkPatch): DashboardLinkBulkChanges {
  const changes: DashboardLinkBulkChanges = {}
  for (const field of ['comment', 'title', 'description'] as const) {
    if (Object.hasOwn(patch, field))
      changes[field] = patch[field] ?? null
  }
  if (Object.hasOwn(patch, 'tags'))
    changes.tags = patch.tags ?? []
  return changes
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size)
    chunks.push(items.slice(index, index + size))
  return chunks
}

export async function runBulkOperation<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 4,
): Promise<BulkOperationResult<T>[]> {
  const results: BulkOperationResult<T>[] = Array.from({ length: items.length })
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]!
      try {
        await worker(item)
        results[index] = { item }
      }
      catch (error) {
        results[index] = { item, error }
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}
