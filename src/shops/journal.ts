// Shared adapter for OpenCart shops on the Journal 3 theme (Elnekhely, El Badr,
// Maximum Hardware — PC parts and gaming gear). The search page is server-
// rendered: product cards inside the `main-products` grid (side and footer
// modules repeat the same card markup, so only that grid is read).

import { blockAware } from '../net.js'
import type { Listing, ShopDef, ShopIo } from '../types.js'

const ent = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
const num = (s: string | undefined) => Number((s ?? '').replace(/[^\d.]/g, ''))

const NO_RESULTS = /no product that matches the search criteria|لا يوجد أي منتجات تطابق/

export const journalSearchUrl = (base: string, q: string) => `${base}/index.php?route=product/search&search=${encodeURIComponent(q)}&limit=24`

export function parseJournalSearch(html: string, store: string, source: string): Listing[] {
  // An empty search says so, then shows "featured" products in the same grid.
  if (NO_RESULTS.test(html)) return []
  const start = html.indexOf('class="main-products')
  if (start < 0) return []
  const end = html.indexOf('Showing ', start)
  const grid = html.slice(start, end > 0 ? end : undefined)
  const out: Listing[] = []
  for (const card of grid.split('class="product-layout').slice(1)) {
    const a = card.match(/<div\s+class="name">\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/)
    if (!a) continue
    // A sale shows price-new (and price-old); otherwise price-normal.
    const price = num(card.match(/class="price-(?:new|normal)">([^<]+)</)?.[1])
    const stock = card.match(/Stock:<\/span>\s*<span>([^<]+)</)?.[1]?.trim()
    const url = new URL(ent(a[1]))
    url.searchParams.delete('search')
    url.searchParams.delete('limit')
    out.push({
      source, store, title: ent(a[2]).trim(), url: url.toString(), storeSearchUrl: null,
      price: price > 0 ? price : null, rating: null, ratingCount: null,
      sold: /out-of-stock/.test(card.slice(0, 200)) || (stock && /out of stock|pre-?order|نفذ/i.test(stock)) ? 'Out of stock' : null,
      image: card.match(/<img\s+src="([^"]+)"/)?.[1] ?? null,
    })
    if (out.length >= 30) break
  }
  return out
}

export function journalSearch(def: Pick<ShopDef, 'id' | 'name'>, base: string) {
  return async (q: string, io: ShopIo): Promise<Listing[]> => {
    const html = await blockAware(def.name, io.fetchText(journalSearchUrl(base, q), 2))
    // Neither a results grid nor OpenCart's "no product" line: a block page or a cut-off answer.
    if (!/class="main-products|no product that matches|product\/search/.test(html)) throw new Error(`${def.name} showed no search page`)
    return parseJournalSearch(html, def.name, def.id)
  }
}
