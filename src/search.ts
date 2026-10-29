import { SHOPS, shopById } from './shops/index.js'
import { BlockedError, defaultIo } from './net.js'
import { pricenaSearchUrl, parsePricenaSearch, parsePricenaOffers } from './pricena.js'
import { titleMatches, sameModel, filterListings } from './matching.js'
import type { Listing, ShopIo, SourceOutcome } from './types.js'

export interface SearchOptions {
  /** Registry ids to search (default: every shop). */
  shops?: string[]
  /** Time box per shop, in ms (default 25 000). */
  timeoutMs?: number
  /** How many shops are read at once (default 6). */
  concurrency?: number
  /** Use eg.pricena.com for shops that can't be read directly and as a fallback (default true). */
  pricena?: boolean
  /**
   * Which titles are the product. Default: `titleMatches(title, query)` (every
   * query word, no accessories or dearer variants). `false` keeps every listing.
   */
  match?: ((title: string) => boolean) | false
  /** A price you were quoted: listings far from it (×0.3 … ×3) are dropped as other products. */
  refPrice?: number | null
  /** Network seam (tests, proxies, caching). */
  io?: ShopIo
}

export interface SearchResult {
  query: string
  /** Matching listings, cheapest first (unpriced last). */
  listings: Listing[]
  /** One row per searched shop, plus shops Pricena relayed that aren't in the registry. */
  sources: SourceOutcome[]
}

const DEFAULT_TIMEOUT = 25_000
/** Pricena product pages read per search. */
const MAX_PRICENA_PAGES = 4

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const t = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`timed out after ${ms} ms`)), ms); timer.unref?.() })
  return Promise.race([p, t]).finally(() => clearTimeout(timer))
}

/** Run tasks with at most `n` in flight. */
async function pool<T>(tasks: (() => Promise<T>)[], n: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length)
  let next = 0
  const worker = async () => { while (next < tasks.length) { const i = next++; out[i] = await tasks[i]() } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tasks.length)) }, worker))
  return out
}

const ioWithModel = (io: ShopIo): ShopIo => ({ sameModel, ...io })

/**
 * One shop's raw search results (unfiltered, in the shop's own order).
 * Throws when the shop can't be reached (a BlockedError when it refuses this IP),
 * or when the shop has no direct reader (Pricena-only shops).
 */
export async function searchShop(id: string, query: string, opts: { io?: ShopIo; timeoutMs?: number } = {}): Promise<Listing[]> {
  const shop = shopById(id)
  if (!shop) throw new Error(`Unknown shop "${id}" (known: ${SHOPS.map(s => s.id).join(', ')})`)
  if (!shop.search) throw new Error(`${shop.name} has no direct reader (Pricena only)`)
  const ls = await withTimeout(shop.search(query, ioWithModel(opts.io ?? defaultIo)), opts.timeoutMs ?? DEFAULT_TIMEOUT)
  return ls.map(l => ({ ...l, storeSearchUrl: l.storeSearchUrl ?? shop.searchUrl(query), via: 'direct' as const }))
}

/** Offers for a query from Pricena's product pages (best-matching products only). */
export async function searchPricena(query: string, opts: { io?: ShopIo; match?: (title: string) => boolean } = {}): Promise<Listing[]> {
  const io = opts.io ?? defaultIo
  const match = opts.match ?? ((t: string) => titleMatches(t, query))
  const products = parsePricenaSearch(await io.fetchText(pricenaSearchUrl(query), 2)).filter(p => match(p.name)).slice(0, MAX_PRICENA_PAGES)
  const pages = await Promise.all(products.map(p =>
    io.fetchText(p.url, 2).then(h => parsePricenaOffers(h, p.url, query, SHOPS)).catch(() => [] as Listing[])))
  return pages.flat()
}

type Outcome = { ok: true; listings: Listing[] } | { ok: false; error: unknown }
const settle = (p: Promise<Listing[]>): Promise<Outcome> => p.then(listings => ({ ok: true as const, listings }), error => ({ ok: false as const, error }))
const errText = (e: unknown) => String((e as any)?.message ?? e).slice(0, 200)

/**
 * Search every shop (or `opts.shops`) for a product. Shops read directly
 * win over Pricena's copies of their offers, which only fill in for shops
 * that can't be read or found nothing.
 */
export async function searchAll(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const io = ioWithModel(opts.io ?? defaultIo)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT
  if (opts.shops) for (const id of opts.shops) if (!shopById(id)) throw new Error(`Unknown shop "${id}"`)
  const selected = opts.shops ? SHOPS.filter(s => opts.shops!.includes(s.id)) : SHOPS
  const match = opts.match === false ? () => true : opts.match ?? ((t: string) => titleMatches(t, query))
  const direct = selected.filter(s => s.search)
  const usePricena = opts.pricena !== false

  const tasks: (() => Promise<Outcome>)[] = direct.map(s => () => settle(searchShop(s.id, query, { io, timeoutMs })))
  if (usePricena) tasks.push(() => settle(withTimeout(searchPricena(query, { io, match }), timeoutMs)))
  const results = await pool(tasks, opts.concurrency ?? 6)
  const pricena: Outcome | null = usePricena ? results.pop()! : null

  const byShop = new Map(direct.map((s, i) => [s.id, results[i]]))
  const rawDirect = direct.flatMap(s => { const r = byShop.get(s.id)!; return r.ok ? r.listings : [] })
  const hadDirect = new Set(rawDirect.map(l => l.source))
  const wanted = (source: string) => !opts.shops || opts.shops.includes(source)
  const fromPricena = pricena?.ok ? pricena.listings.filter(l => !hadDirect.has(l.source) && wanted(l.source)) : []

  const listings = filterListings([...rawDirect, ...fromPricena], query, opts.refPrice ?? null, match)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))

  const sources: SourceOutcome[] = selected.map(s => {
    const mine = listings.filter(l => l.source === s.id)
    const r = byShop.get(s.id)
    if (mine.length) return { source: s.id, store: s.name, status: 'found', via: mine.some(l => l.via !== 'pricena') ? 'direct' : 'pricena', count: mine.length }
    if (r && !r.ok) {
      const status = r.error instanceof BlockedError ? 'blocked' : 'failed'
      return { source: s.id, store: s.name, status, via: 'direct', count: 0, error: errText(r.error) }
    }
    if (!r) {
      // Pricena-only shop.
      if (!pricena || !pricena.ok) return { source: s.id, store: s.name, status: 'failed', via: 'pricena', count: 0, error: pricena ? errText((pricena as any).error) : 'Pricena disabled' }
      return { source: s.id, store: s.name, status: 'none', via: 'pricena', count: 0 }
    }
    return { source: s.id, store: s.name, status: 'none', via: 'direct', count: 0 }
  })
  // Shops Pricena relayed that aren't in the registry.
  for (const l of listings) {
    if (sources.some(o => o.source === l.source)) continue
    sources.push({ source: l.source, store: l.store, status: 'found', via: 'pricena', count: listings.filter(x => x.source === l.source).length })
  }
  return { query, listings, sources }
}
