# Automatic titles on link creation

`POST /api/link/create` now populates the existing `title` field when the JSON request omits it. Explicit titles, including `"title": ""`, retain the existing validation and behavior. Editing and importing links do not fetch titles; existing links are not backfilled. No database migration or additional Cloudflare binding is required.

## Retrieval policy

- Prefer the first non-empty `meta[property="og:title"]`; otherwise use the first completed HTML `title`.
- Parse HTML incrementally, decoding entities and streamed text. A completed `<title>` is provisional until an OpenGraph title is found, `</head>` / `<body>` is encountered, the stream ends, or the 64 KiB decoded response-byte budget is exhausted.
- Stop reading and cancel the response stream as soon as an OpenGraph title or head boundary is found. Never fetch scripts, images, CSS, or other subresources. Bytes already buffered by the network may exceed the application limit; the parser receives at most 64 KiB.
- Normalize whitespace and cap titles at the existing 256 UTF-16 code-unit limit without splitting surrogate pairs. HTTP charset declarations are supported; otherwise UTF-8 is used. JavaScript-only titles and titles outside the bounded prefix may be unavailable.
- One 3-second deadline covers DNS, at most three redirects, headers, and body reads. No retry. Errors, timeouts, non-HTML responses, and missing titles produce an empty title without preventing creation.

## SSRF boundary

Only HTTP and HTTPS on their default ports are eligible. URLs with credentials, localhost/internal/metadata names, and non-public IP literals (including alternate IPv4 encodings and IPv6 mapped/transition ranges) are rejected. Both A and AAAA answers from a fixed Cloudflare DNS-over-HTTPS endpoint are checked; any non-public answer, unsafe alias, failed lookup, or oversized DNS response prevents the target request. Every redirect is manual and revalidated. No incoming authentication, cookies, or Cloudflare Access headers are forwarded.

**The production network boundary is Cloudflare Workers global `fetch`.** DNS preflight alone does not pin an IP and is not a DNS-rebinding defense on an arbitrary server. Cloudflare's global fetch supplies the network-level SSRF protection; do not replace it with a VPC/service binding or Node HTTP client. The helper skips Node development runtimes. Local workerd/Miniflare emulation is a trusted development environment, not proof of Cloudflare's production egress boundary; do not expose local previews to untrusted clients.

References:

- [Cloudflare global fetch and SSRF](https://blog.cloudflare.com/workers-environment-live-object-bindings/)
- [Cloudflare redirect behavior](https://developers.cloudflare.com/workers/runtime-apis/request/)

## Validation and deployment

Use Node 24+ and the repository's pnpm version. Build and run tests with the same disposable `NUXT_SITE_TOKEN`, for example:

```sh
NUXT_SITE_TOKEN=local-title-test-token pnpm build
NUXT_SITE_TOKEN=local-title-test-token pnpm test --run tests/unit/link-title.spec.ts tests/api/link-title.spec.ts tests/api/link.spec.ts
pnpm lint
pnpm types:check
```

Tests mock outbound requests. They cover title priority, entity decoding, split UTF-8 chunks, cancellation, byte limits, timeouts, DNS/private-address rejection, redirects, explicit titles, and persistence to both D1 and KV.

The Cloudflare Worker must be rebuilt and redeployed to activate this change. If Workers Builds watches the production branch, merging the change there can trigger deployment automatically. Otherwise use the existing build/deploy workflow. `pnpm deploy:worker` is a production mutation and also runs the repository's normal remote migrations; it is not a test command.
