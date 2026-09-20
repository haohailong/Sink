import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLinkTitle, populateLinkTitle, TITLE_MAX_BYTES, TITLE_TIMEOUT_MS, titleFetchURL } from '../../server/utils/link-title'

function mockNetwork(page: () => Response | Promise<Response>, answers = ['93.184.215.14']) {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      return Response.json({ Status: 0, Answer: answers.map(data => ({ type: data.includes(':') ? 28 : 1, data })) })
    }
    return page()
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function html(text: string) {
  return new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('automatic link titles', () => {
  it.each([
    ['<head><title>Fallback</title><meta content="OG &amp; 中文" property="og:title"></head>', 'OG & 中文'],
    ['<head><title> A  &amp; B &#x1f600; </title></head>', 'A & B 😀'],
    ['<!-- <meta property="og:title" content="wrong"> --><script>"<title>wrong</title>"</script><title>Right</title>', 'Right'],
    ['<meta property="OG:TITLE" content=""><title>Fallback</title></head>', 'Fallback'],
    ['<title>Unclosed', ''],
    ['<head></head><body><meta property="og:title" content="Wrong">', ''],
    ['<title>Fallback</title><meta property="og:title" content="A &quot;quote&quot; > B">', 'A "quote" > B'],
  ])('parses HTML safely: %s', async (page, expected) => {
    mockNetwork(() => html(page))
    expect(await fetchLinkTitle('https://example.com')).toBe(expected)
  })

  it('uses redirect handling supported by Cloudflare Workers for DNS lookups', async () => {
    const network = mockNetwork(() => html('<title>Found</title>'))
    expect(await fetchLinkTitle('https://example.com')).toBe('Found')
    const dnsCalls = network.mock.calls.filter(call => new URL(String(call[0])).hostname === 'cloudflare-dns.com')
    expect(dnsCalls).toHaveLength(2)
    expect(dnsCalls.every(call => (call[1] as RequestInit).redirect === 'manual')).toBe(true)
  })

  it('decodes multibyte text and tags split across chunks, then cancels immediately', async () => {
    const cancel = vi.fn()
    const bytes = new TextEncoder().encode('<meta property="og:title" content="中文 &amp; title">')
    let index = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index < bytes.length)
          controller.enqueue(bytes.slice(index, ++index))
        // Never close: completion must come from finding the title.
      },
      cancel,
    }, { highWaterMark: 0 })
    mockNetwork(() => new Response(stream, { headers: { 'content-type': 'text/html' } }))
    expect(await fetchLinkTitle('https://example.com')).toBe('中文 & title')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('stops at the byte cap and uses the completed fallback', async () => {
    let pulls = 0
    const cancel = vi.fn()
    const first = '<title>Fallback</title>'
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(new TextEncoder().encode(pulls === 1 ? first + ' '.repeat(TITLE_MAX_BYTES - first.length) : '<meta property="og:title" content="Too late">'))
      },
      cancel,
    }, { highWaterMark: 0 })
    mockNetwork(() => new Response(stream, { headers: { 'content-type': 'text/html' } }))
    expect(await fetchLinkTitle('https://example.com')).toBe('Fallback')
    expect(pulls).toBe(1)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('ignores a title beyond the cap within an oversized chunk', async () => {
    mockNetwork(() => html(`${' '.repeat(TITLE_MAX_BYTES)}<title>Too late</title>`))
    expect(await fetchLinkTitle('https://example.com')).toBe('')
  })

  it('limits titles to the existing schema without breaking surrogate pairs', async () => {
    mockNetwork(() => html(`<title>${'a'.repeat(255)}😀</title>`))
    expect(await fetchLinkTitle('https://example.com')).toBe('a'.repeat(255))
  })

  it.each(['file:///etc/passwd', 'ftp://example.com', 'http://localhost.', 'http://a.localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://10.0.0.1', 'http://172.16.0.1', 'http://192.168.1.1', 'http://169.254.169.254', 'http://100.100.100.200', 'http://168.63.129.16', 'http://0.0.0.0', 'http://224.0.0.1', 'http://[::1]', 'http://[fc00::1]', 'http://[fe80::1]', 'http://[::ffff:7f00:1]', 'http://[2002:7f00:1::]', 'http://metadata.google.internal', 'http://instance-data.ec2.internal', 'http://example.com:8080', 'http://user:pass@example.com'])('blocks %s without network access', async (url) => {
    const network = mockNetwork(() => html('<title>No</title>'))
    expect(() => titleFetchURL(url)).toThrow()
    expect(await fetchLinkTitle(url)).toBe('')
    expect(network).not.toHaveBeenCalled()
  })

  it.each(['10.0.0.1', '::1', 'fe80::1', '::ffff:127.0.0.1'])('rejects mixed public/private DNS: %s', async (address) => {
    const page = vi.fn(() => html('<title>No</title>'))
    mockNetwork(page, ['93.184.215.14', address])
    expect(await fetchLinkTitle('https://example.com')).toBe('')
    expect(page).not.toHaveBeenCalled()
  })

  it('rejects redirects to private destinations without following them', async () => {
    const page = vi.fn(() => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }))
    mockNetwork(page)
    expect(await fetchLinkTitle('https://example.com')).toBe('')
    expect(page).toHaveBeenCalledOnce()
  })

  it('follows relative redirects manually and limits loops', async () => {
    const page = vi.fn(() => new Response(null, { status: 302, headers: { location: '/next' } }))
    const network = mockNetwork(page)
    expect(await fetchLinkTitle('https://example.com')).toBe('')
    expect(page).toHaveBeenCalledTimes(4)
    expect(network.mock.calls.every(call => String(call[0]).startsWith('https://'))).toBe(true)
  })

  it.each([() => new Response('pdf', { headers: { 'content-type': 'application/pdf' } }), () => new Response('error', { status: 500 }), () => {
    throw new Error('Network failed')
  }])('fails open for unusable responses', async (page) => {
    mockNetwork(page)
    expect(await fetchLinkTitle('https://example.com')).toBe('')
  })

  it('bounds even a fetch that ignores abort', async () => {
    vi.useFakeTimers()
    mockNetwork(() => new Promise<Response>(() => {}))
    const pending = fetchLinkTitle('https://example.com')
    await vi.advanceTimersByTimeAsync(TITLE_TIMEOUT_MS)
    expect(await pending).toBe('')
  })

  it('cancels a stalled body at the deadline', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    mockNetwork(() => new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { 'content-type': 'text/html' },
    }))
    const pending = fetchLinkTitle('https://example.com')
    await vi.advanceTimersByTimeAsync(TITLE_TIMEOUT_MS)
    expect(await pending).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('revalidates DNS after a public-looking redirect', async () => {
    const targets: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: URL) => {
      if (input.hostname === 'cloudflare-dns.com') {
        const address = input.searchParams.get('name') === 'evil.example.com' ? '127.0.0.1' : '93.184.215.14'
        return Response.json({ Status: 0, Answer: [{ type: 1, data: address }] })
      }
      targets.push(input.hostname)
      return new Response(null, { status: 302, headers: { location: 'https://evil.example.com/' } })
    }))
    expect(await fetchLinkTitle('https://example.com')).toBe('')
    expect(targets).toEqual(['example.com'])
  })

  it('fails closed on DNS errors and unsafe aliases', async () => {
    for (const data of [{ Status: 2 }, { Status: 0, Answer: [] }, { Status: 0, Answer: [{ type: 5, data: 'metadata.google.internal.' }] }]) {
      const network = vi.fn(async () => Response.json(data))
      vi.stubGlobal('fetch', network)
      expect(await fetchLinkTitle('https://example.com')).toBe('')
      expect(network).toHaveBeenCalledTimes(2)
    }
  })

  it('preserves explicit titles including an empty string without fetching', async () => {
    const network = mockNetwork(() => html('<title>Other</title>'))
    for (const title of ['Custom', '']) {
      const link = { url: 'https://example.com', title }
      await populateLinkTitle(link)
      expect(link.title).toBe(title)
    }
    expect(network).not.toHaveBeenCalled()
  })

  it('fills an omitted title and skips Node development runtimes', async () => {
    const network = mockNetwork(() => html('<title>Found</title>'))
    const link: { url: string, title?: string } = { url: 'https://example.com' }
    await populateLinkTitle(link)
    expect(link.title).toBe('Found')
    network.mockClear()
    vi.stubGlobal('navigator', { userAgent: 'Node.js' })
    expect(await fetchLinkTitle(link.url)).toBe('')
    expect(network).not.toHaveBeenCalled()
  })
})
