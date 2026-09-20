import type { Link, LinkFormData, LinkListResponse, LinkSearchItem } from '@/types'

export type DashboardLinkStatus = 'active' | 'expired'

export type DashboardLink = Link & {
  tags?: string[]
}

export type DashboardLinkBulkPatch = Partial<Pick<DashboardLink, 'comment' | 'tags' | 'title' | 'description'>>

export type DashboardLinkBulkChanges = Partial<{
  comment: string | null
  tags: string[]
  title: string | null
  description: string | null
}>

export interface DashboardLinkBulkUpdateResponse {
  links: DashboardLink[]
  failed: { slug: string, error: string }[]
}

export type DashboardLinkFormData = Omit<LinkFormData, 'tags'> & {
  tags: string[]
}

export type DashboardLinkSearchItem = LinkSearchItem & {
  expiration?: number
  tags?: string[]
}

export type DashboardLinkListResponse = Omit<LinkListResponse, 'links'> & {
  links: DashboardLink[]
}
