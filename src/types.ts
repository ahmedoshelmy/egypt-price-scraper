/** One product offer found at one shop. Prices are in EGP. */
export interface Listing {
  /** Shop id (registry slug): "amazon", "btech", "noon", … */
  source: string
  /** Shop display name. */
  store: string
  title: string
  url: string
  /** The shop's own search page for the query, when known. */
  storeSearchUrl: string | null
  price: number | null
  /** Product rating out of 5, when the shop shows one. */
  rating: number | null
  ratingCount: number | null
  /** Stock or sales note: "Out of stock", "Only 2 left in stock", "1K+ bought in past month". */
  sold: string | null
  image: string | null
  /** "pricena" when the offer came from eg.pricena.com rather than the shop itself. */
  via?: 'direct' | 'pricena'
}

/**
 * found: the shop has matching listings. none: it answered but had no match.
 * failed: it could not be reached (timeout, HTTP error, cut-off page).
 * blocked: it refuses this IP outright (Cloudflare 403 / challenge) — common from datacenter IPs.
 */
export type SourceStatus = 'found' | 'none' | 'failed' | 'blocked'

export interface SourceOutcome {
  source: string
  store: string
  status: SourceStatus
  via: 'direct' | 'pricena'
  count: number
  /** Why it failed or was blocked. */
  error?: string
}

export type ShopCategory = 'laptops' | 'phones' | 'appliances' | 'electronics' | 'furniture'

/**
 * direct: the shop's own search is read over plain HTTP.
 * pricena: the shop can't be read directly (bot checks, needs a real browser);
 * only Pricena's copy of its offers is used.
 */
export type ShopMode = 'direct' | 'pricena'

/** Network seam given to every shop reader (swap it in tests). */
export interface ShopIo {
  /** GET a URL as text; retries `tries` times on network errors and bot checks. */
  fetchText(url: string, tries?: number): Promise<string>
  /** Does a title name the searched product, storage / RAM / colour aside? */
  sameModel?(title: string, query: string): boolean
}

export interface ShopDef {
  id: string
  name: string
  domain: string
  categories: ShopCategory[]
  mode: ShopMode
  /** How Pricena names the shop, to file its offers under this id. */
  pricenaName?: RegExp
  /** The shop's own search page for a query. */
  searchUrl(query: string): string
  /** Reads the shop's search results. Throws when it can't be reached (BlockedError when it refuses this IP). */
  search?(query: string, io: ShopIo): Promise<Listing[]>
  /** Works from datacenter IPs (cloud VMs) as of the last check, or not. */
  datacenter?: 'yes' | 'no' | 'flaky'
  note?: string
}
