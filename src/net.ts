import { execFile } from 'node:child_process'

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** Full desktop-Chrome headers: several shops (Jumia, 2B, Noon) answer only with these. */
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"Windows"',
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** The shop answered with an HTTP error status. */
export class HttpError extends Error {
  constructor(public host: string, public status: number) {
    super(`${host} answered ${status || 'nothing'}`)
    this.name = 'HttpError'
  }
}

/** The shop refuses this IP (Cloudflare 403 or challenge page): reported as "blocked", not "failed". */
export class BlockedError extends Error {
  constructor(shop: string, why = 'refuses this IP') {
    super(`${shop} ${why}`)
    this.name = 'BlockedError'
  }
}

/** Amazon answers some clients 200 with a script challenge instead of results. */
export const isBotChallenge = (html: string) => /bm-verify|triggerInterstitialChallenge|\/errors\/validateCaptcha/.test(html)
/** Cloudflare's interstitial instead of the page. */
export const isCloudflareChallenge = (html: string) => /<title>Just a moment|cf_chl_opt|challenge-form/.test(html)

/** Turn a 403 or a Cloudflare challenge into a BlockedError. */
export async function blockAware(shop: string, page: Promise<string>): Promise<string> {
  let html: string
  try { html = await page } catch (e) {
    if (e instanceof HttpError && e.status === 403) throw new BlockedError(shop)
    throw e
  }
  if (isCloudflareChallenge(html)) throw new BlockedError(shop, 'showed a Cloudflare check')
  return html
}

// Amazon challenges Node's own fetch (its TLS fingerprint) but not curl, so
// pages are fetched with curl when it is installed, else with fetch.
let hasCurl: boolean | null = null

export interface RequestOptions { headers?: Record<string, string>; timeoutS?: number }

export function curlText(url: string, o: RequestOptions = {}): Promise<string> {
  const args = ['-s', '-L', '--compressed', '--max-time', String(o.timeoutS ?? 15), '-w', '\n%{http_code}']
  for (const [k, v] of Object.entries(o.headers ?? BROWSER_HEADERS)) args.push('-H', `${k}: ${v}`)
  args.push(url)
  return new Promise((resolve, reject) => {
    execFile('curl', args, { maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err) return reject(err)
      const cut = stdout.lastIndexOf('\n')
      const status = Number(stdout.slice(cut + 1))
      if (status >= 200 && status < 300) resolve(stdout.slice(0, cut))
      else reject(new HttpError(new URL(url).host, status))
    })
  })
}

export async function fetchOnce(url: string, o: RequestOptions = {}): Promise<string> {
  if (hasCurl !== false) {
    try {
      return await curlText(url, o)
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e
      hasCurl = false
    }
  }
  const r = await fetch(url, { headers: o.headers ?? BROWSER_HEADERS, signal: AbortSignal.timeout((o.timeoutS ?? 15) * 1000) })
  if (!r.ok) throw new HttpError(new URL(url).host, r.status)
  return r.text()
}

/**
 * GET with retries. Bot-check pages and network errors are retried; HTTP 4xx
 * answers (403 block, 404, 429 rate limit) are not — asking again only makes
 * a rate limit worse.
 */
export async function fetchText(url: string, attempts = 1): Promise<string> {
  let last: unknown = null
  for (let i = 0; i < attempts; i++) {
    if (i) await sleep(800 * i + Math.random() * 600)
    try {
      const html = await fetchOnce(url)
      if (!isBotChallenge(html)) return html
      last = new Error(`${new URL(url).host} showed a bot check`)
    } catch (e) {
      last = e
      if (e instanceof HttpError && e.status >= 400 && e.status < 500) break
    }
  }
  throw last
}

/** The default network seam. */
export const defaultIo = { fetchText }

// ─── Text helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }

/** Decode HTML entities. */
export function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

export const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** "1,234" / "EGP 1,234.50" / "6.5K" → number. */
export function parseNumber(s: string | number | null | undefined): number | null {
  if (s == null || s === '') return null
  const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([kK])?/)
  if (!m) return null
  const n = Number(m[1]) * (m[2] ? 1000 : 1)
  return Number.isFinite(n) ? n : null
}

/** A positive price or null. */
export const price = (n: unknown): number | null => {
  const v = typeof n === 'number' ? n : parseNumber(n as string)
  return v != null && v > 0 ? v : null
}
