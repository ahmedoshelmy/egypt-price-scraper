import type { Listing } from '../types.js'
import type { ShopDef } from '../types.js'

const base = 'https://www.noon.com'
const ent = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

/** "3.0K" → 3000, "245" → 245. */
const count = (s: string | undefined) => {
  if (!s) return null
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([kK])?/)
  return m ? Math.round(Number(m[1]) * (m[2] ? 1000 : 1)) : null
}

/**
 * Noon's search page (server-rendered since autumn 2026; it used to need a real
 * browser). Each product box: link, data-qa product name, rating and count,
 * selling price, first image. Class names are hashed, so only their stems are matched.
 */
export function parseNoonSearch(html: string): Listing[] {
  const out: Listing[] = []
  const seen = new Set<string>()
  for (const box of html.split('data-qa="plp-product-box"').slice(1)) {
    const href = box.match(/<a href="(\/egypt-en\/[^"]+\/p\/[^"]*)"/)?.[1]
    const title = box.match(/data-qa="plp-product-box-name"[^>]*title="([^"]+)"/)?.[1]
    if (!href || !title) continue
    const url = `${base}${ent(href).replace(/\?.*$/, '')}`
    if (seen.has(url)) continue
    seen.add(url)
    const price = Number((box.match(/_amount_[a-z0-9_]+">([\d,.]+)</)?.[1] ?? '').replace(/,/g, ''))
    const rating = Number(box.match(/_textCtr_[a-z0-9_]+">([\d.]+)</)?.[1])
    const n = count(box.match(/_countCtr_[a-z0-9_]+">[\s\S]*?<span>([\d.,]+[kK]?)<\/span>/)?.[1])
    out.push({
      source: 'noon', store: 'Noon', title: ent(title).trim(), url, storeSearchUrl: null,
      price: price > 0 ? price : null,
      rating: rating > 0 && rating <= 5 && n ? rating : null, ratingCount: rating > 0 ? n : null,
      sold: /out of stock/i.test(box.slice(0, 6000)) ? 'Out of stock' : null,
      image: box.match(/<img class="_productImage_[^"]*"[^>]*src="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') ?? null,
    })
    if (out.length >= 30) break
  }
  return out
}

export const noon: ShopDef = {
  id: 'noon', name: 'Noon', domain: 'noon.com',
  categories: ['laptops', 'phones', 'appliances', 'electronics', 'furniture'], mode: 'direct', pricenaName: /noon/i,
  searchUrl: q => `${base}/egypt-en/search/?q=${encodeURIComponent(q)}`,
  search: async (q, io) => {
    const html = await io.fetchText(`${base}/egypt-en/search/?q=${encodeURIComponent(q)}`, 2)
    // A search page with no product boxes is an empty search; anything else (a block page, a cut-off answer) a failure.
    if (!/plp-product-box/.test(html) && !(html.length > 30_000 && /<title>Online Shopping in Egypt/.test(html))) throw new Error('Noon showed no search page (blocked?)')
    return parseNoonSearch(html)
  },
  datacenter: 'yes',
  note: 'Server-rendered search page, with ratings. HTTP/2 errors after ~40 quick searches.',
}
