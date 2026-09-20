import { Parser } from 'htmlparser2'
import ipaddr from 'ipaddr.js'

export const TITLE_MAX_BYTES = 64 * 1024
export const TITLE_TIMEOUT_MS = 6000
const MAX_REDIRECTS = 3
const DNS_MAX_BYTES = 16 * 1024

function publicAddress(value: string): boolean {
  try {
    // Only ordinary global unicast addresses; mapped/transition IPv6 is rejected.
    return ipaddr.parse(value).range() === 'unicast'
      && value !== '168.63.129.16' // Azure platform virtual IP
  }
  catch {
    return false
  }
}

function publicHostname(value: string): boolean {
  const hostname = value.toLowerCase().replace(/\.$/, '')
  if (ipaddr.isValid(hostname.replace(/^\[|\]$/g, '')))
    return publicAddress(hostname.replace(/^\[|\]$/g, ''))
  return hostname.includes('.')
    && !/(?:^|\.)(?:localhost|local|internal|localhost\.localdomain|home\.arpa|test|invalid|onion)$/.test(hostname)
    && !/(?:^|\.)(?:metadata|instance-data)(?:\.|$)/.test(hostname)
    && /^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/.test(hostname)
}

export function titleFetchURL(value: string): URL {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.port || !publicHostname(url.hostname)) {
    throw new Error('Disallowed title URL')
  }
  url.hash = ''
  return url
}

function cancelBody(body: ReadableStream<Uint8Array> | null): void {
  void body?.cancel().catch(() => {})
}

async function publicDNS(url: URL, signal: AbortSignal): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (ipaddr.isValid(hostname))
    return

  const results = await Promise.all(['A', 'AAAA'].map(async (type) => {
    const dnsURL = new URL('https://cloudflare-dns.com/dns-query')
    dnsURL.searchParams.set('name', hostname)
    dnsURL.searchParams.set('type', type)
    const response = await fetch(dnsURL, {
      headers: { accept: 'application/dns-json' },
      // Cloudflare Workers only supports "follow" and "manual". Keep DNS
      // redirects visible so an unexpected redirect fails the response checks.
      redirect: 'manual',
      signal,
    })
    if (!response.ok || !response.body) {
      cancelBody(response.body)
      throw new Error('DNS lookup failed')
    }
    const reader = response.body.getReader()
    const abort = () => {
      void reader.cancel().catch(() => {})
    }
    signal.addEventListener('abort', abort, { once: true })
    const decoder = new TextDecoder()
    let bytes = 0
    let json = ''
    try {
      while (true) {
        signal.throwIfAborted()
        const { value, done } = await reader.read()
        if (done)
          break
        bytes += value.byteLength
        if (bytes > DNS_MAX_BYTES)
          throw new Error('DNS response too large')
        json += decoder.decode(value, { stream: true })
      }
      json += decoder.decode()
    }
    finally {
      signal.removeEventListener('abort', abort)
      void reader.cancel().catch(() => {})
    }
    const data = JSON.parse(json) as { Status?: number, Answer?: { type: number, data: string }[] }
    if (data.Status !== 0)
      throw new Error('DNS lookup failed')
    let addresses = 0
    for (const answer of data.Answer || []) {
      if (answer.type === 1 || answer.type === 28) {
        if (!publicAddress(answer.data))
          throw new Error('Non-public DNS address')
        addresses++
      }
      else if (answer.type === 5 && !publicHostname(answer.data)) {
        throw new Error('Non-public DNS alias')
      }
    }
    return addresses
  }))
  if (!results.some(Boolean))
    throw new Error('No public DNS address')
}

function normalizeTitle(value: string): string {
  // The existing title schema allows at most 256 UTF-16 code units.
  return value.replace(/\s+/g, ' ').trim().slice(0, 256).replace(/[\uD800-\uDBFF]$/, '')
}

async function readTitle(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body)
    return ''
  const reader = response.body.getReader()
  const abort = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', abort, { once: true })
  let fallback = ''
  let titleText = ''
  let inTitle = false
  let ogTitle = ''
  let stopped = false
  const stop = () => {
    stopped = true
  }
  const parser = new Parser({
    onopentag(name, attributes) {
      if (stopped)
        return
      if (name === 'body')
        stop()
      if (name === 'title') {
        inTitle = true
        titleText = ''
      }
      if (name === 'meta' && attributes.property?.trim().toLowerCase() === 'og:title') {
        ogTitle = normalizeTitle(attributes.content || '')
        if (ogTitle)
          stop()
      }
    },
    ontext(text) {
      if (stopped)
        return
      if (inTitle)
        titleText += text
    },
    onclosetag(name, implied) {
      if (stopped)
        return
      if (name === 'title') {
        if (!implied && !fallback)
          fallback = normalizeTitle(titleText)
        inTitle = false
      }
      if (name === 'head')
        stop()
    },
  }, { decodeEntities: true })
  let bytes = 0
  try {
    const charset = response.headers.get('content-type')?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] || 'utf-8'
    const decoder = new TextDecoder(charset)
    while (bytes < TITLE_MAX_BYTES) {
      if (stopped)
        break
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) {
        parser.end(decoder.decode())
        break
      }
      const chunk = value.subarray(0, TITLE_MAX_BYTES - bytes)
      bytes += chunk.byteLength
      parser.write(decoder.decode(chunk, { stream: true }))
    }
    return ogTitle || fallback
  }
  finally {
    signal.removeEventListener('abort', abort)
    // Do not wait for a remote peer to acknowledge cancellation.
    void reader.cancel().catch(() => {})
  }
}

export async function fetchLinkTitle(value: string): Promise<string> {
  // Cloudflare's global fetch is the network-level SSRF boundary, including
  // DNS rebinding. Never substitute a VPC/service binding or a Node fetch here.
  // Skip Nuxt's Node dev server rather than use its unrestricted local network.
  if (typeof navigator === 'undefined' || navigator.userAgent !== 'Cloudflare-Workers')
    return ''
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve('')
    }, TITLE_TIMEOUT_MS)
  })
  try {
    const work = async () => {
      let url = titleFetchURL(value)
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        controller.signal.throwIfAborted()
        await publicDNS(url, controller.signal)
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'accept': 'text/html', 'user-agent': 'Sink-Title/1.0' },
          redirect: 'manual',
          signal: controller.signal,
        })
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          cancelBody(response.body)
          const location = response.headers.get('location')
          if (!location || redirects === MAX_REDIRECTS)
            return ''
          url = titleFetchURL(new URL(location, url).href)
          continue
        }
        if (!response.ok || response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'text/html') {
          cancelBody(response.body)
          return ''
        }
        return readTitle(response, controller.signal)
      }
      return ''
    }
    return await Promise.race([work(), timeout])
  }
  catch {
    return ''
  }
  finally {
    clearTimeout(timer)
    controller.abort()
  }
}

export async function populateLinkTitle(link: { url: string, title?: string }): Promise<void> {
  if (link.title === undefined)
    link.title = await fetchLinkTitle(link.url)
}
