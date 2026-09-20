import type { H3Event } from 'h3'
import type { Link } from '#shared/schemas/link'
import { z } from 'zod'
import { SlugSchema, TagsSchema } from '#shared/schemas/link'

const MAX_LINKS_PER_REQUEST = 100

const BulkEditChangesSchema = z.object({
  comment: z.string().trim().max(2048).nullable().optional(),
  tags: TagsSchema.unwrap().optional(),
  title: z.string().trim().max(256).nullable().optional(),
  description: z.string().trim().max(2048).nullable().optional(),
}).strict().refine(changes => Object.keys(changes).length > 0, {
  message: 'At least one field must be provided',
})

const BulkEditSchema = z.object({
  slugs: z.array(SlugSchema.min(1)).min(1).max(MAX_LINKS_PER_REQUEST),
  changes: BulkEditChangesSchema,
})

type BulkEditChanges = z.infer<typeof BulkEditChangesSchema>
type BulkEditResult
  = | { link: Link }
    | { slug: string, error: 'not_found' | 'conflict' | 'update_failed' }

defineRouteMeta({
  openAPI: {
    description: 'Edit comment, tags, OpenGraph title, or OpenGraph description on multiple short links',
    security: [{ bearerAuth: [] }],
  },
})

function applyChanges(link: Link, changes: BulkEditChanges): Link {
  const updatedLink: Link = {
    ...link,
    updatedAt: Math.max(Math.floor(Date.now() / 1000), link.updatedAt + 1),
  }

  for (const field of ['comment', 'title', 'description'] as const) {
    if (!Object.hasOwn(changes, field))
      continue

    const value = changes[field]
    if (value === null)
      delete updatedLink[field]
    else
      updatedLink[field] = value
  }

  if (Object.hasOwn(changes, 'tags'))
    updatedLink.tags = changes.tags ?? []

  return updatedLink
}

async function updateOneLink(event: H3Event, slug: string, changes: BulkEditChanges): Promise<BulkEditResult> {
  try {
    const existingLink = await getAnyAuthoritativeLink(event, slug)
    if (!existingLink)
      return { slug, error: 'not_found' }

    const updatedLink = applyChanges(existingLink, changes)
    const updated = await updateLink(event, updatedLink, {
      id: existingLink.id,
      updatedAt: existingLink.updatedAt,
    })
    return updated
      ? { link: buildLinkResponse(event, updatedLink).link }
      : { slug, error: 'conflict' }
  }
  catch (error) {
    console.error({
      event: 'link.bulk-edit.failed',
      slug,
      error: error instanceof Error ? error.message : String(error),
    })
    return { slug, error: 'update_failed' }
  }
}

async function updateLinks(event: H3Event, slugs: string[], changes: BulkEditChanges) {
  const results: BulkEditResult[] = Array.from({ length: slugs.length })
  let nextIndex = 0

  async function worker() {
    while (nextIndex < slugs.length) {
      const index = nextIndex++
      results[index] = await updateOneLink(event, slugs[index]!, changes)
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, slugs.length) }, () => worker()))
  return results
}

export default eventHandler(async (event) => {
  const { previewMode } = useRuntimeConfig(event).public
  if (previewMode) {
    throw createError({
      status: 403,
      statusText: 'Preview mode cannot edit links.',
    })
  }

  const body = await readValidatedBody(event, BulkEditSchema.parse)
  const slugs = [...new Set(body.slugs.map(slug => normalizeSlug(event, slug)))]
  const results = await updateLinks(event, slugs, body.changes)

  return {
    links: results.flatMap(result => 'link' in result ? [result.link] : []),
    failed: results.flatMap(result => 'error' in result ? [{ slug: result.slug, error: result.error }] : []),
  }
})
