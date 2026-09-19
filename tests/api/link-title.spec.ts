import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteStoredLinks, getD1Link, getStoredLink, postJson, setLinkStoreD1Mode } from '../utils'

const slugs: string[] = []

beforeEach(async () => {
  await setLinkStoreD1Mode()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteStoredLinks(slugs.splice(0))
})

describe('create API automatic titles', () => {
  it.each([
    [undefined, '<title>Fallback</title><meta property="og:title" content="OG &amp; title">', 'OG & title'],
    [undefined, '<title>Fallback</title></head>', 'Fallback'],
    [undefined, '', ''],
    ['Custom', '<title>Other</title>', 'Custom'],
    ['', '<title>Other</title>', ''],
  ])('persists title %s in D1 and KV', async (title, page, expected) => {
    const network = vi.fn(async (input: string | URL | Request) => {
      if (String(input).startsWith('https://cloudflare-dns.com/'))
        return Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.215.14' }] })
      return new Response(page, { headers: { 'content-type': 'text/html' } })
    })
    vi.stubGlobal('fetch', network)
    const slug = `title-${crypto.randomUUID()}`
    slugs.push(slug)
    const response = await postJson('/api/link/create', { url: 'https://example.com', slug, title })
    expect(response.status).toBe(201)
    const result = await response.json() as { link: { title: string } }
    expect(result.link.title).toBe(expected)
    expect((await getD1Link(slug))?.title).toBe(expected)
    expect((await getStoredLink(slug))?.title).toBe(expected)
    if (title !== undefined)
      expect(network).not.toHaveBeenCalled()
  })

  it('creates the short link when fetching fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))
    const slug = `title-${crypto.randomUUID()}`
    slugs.push(slug)
    const response = await postJson('/api/link/create', { url: 'https://example.com', slug })
    expect(response.status).toBe(201)
    expect((await getStoredLink(slug))?.title).toBe('')
  })

  it('creates private target links without fetching them', async () => {
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    const slug = `title-${crypto.randomUUID()}`
    slugs.push(slug)
    const response = await postJson('/api/link/create', { url: 'http://127.0.0.1', slug })
    expect(response.status).toBe(201)
    expect(network).not.toHaveBeenCalled()
    expect((await getD1Link(slug))?.title).toBe('')
  })
})
