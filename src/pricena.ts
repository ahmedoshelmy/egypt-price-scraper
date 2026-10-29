// eg.pricena.com, a public price-comparison site: it relays offers from
// shops that can't be read directly (Sigma, Dubai Phone…) and serves as the
// fallback when a shop's own search fails.

import { decode, parseNumber } from './net.js'
import type { Listing, ShopDef } from './types.js'

export interface PricenaProduct { name: string; url: string; price: number | null; image: string | null }

export const pricenaSearchUrl = (q: string) => `https://eg.pricena.com/en/search?s=${encodeURIComponent(q)}`

/** Search results carry a schema.org ItemList of products. */
export function parsePricenaSearch(html: string): PricenaProduct[] {
  const out: PricenaProduct[] = []
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data: any
    try { data = JSON.parse(m[1]) } catch { continue }
    for (const it of Array.isArray(data?.itemListElement) ? data.itemListElement : []) {
      if (typeof it?.name !== 'string' || typeof it?.url !== 'string') continue
      if (!/^https:\/\/eg\.pricena\.com\//.test(it.url)) continue
      out.push({
        name: decode(it.name).trim(),
        url: it.url,
        price: parseNumber(it.offers?.price),
        image: typeof it.image === 'string' ? it.image : null,
      })
    }
  }
  return out
}

/** Map Pricena's store name to a registry id (else a slug of the name). */
export function storeSlug(store: string, shops: ShopDef[]): { slug: string; shop: ShopDef | null } {
  for (const s of shops) if (s.pricenaName?.test(store)) return { slug: s.id, shop: s }
  return { slug: store.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop', shop: null }
}

/**
 * A Pricena product page lists one offer per shop. Pricena's "Go to Shop"
 * button redirects through script, so each offer links to the Pricena page
 * itself, plus a search for the query on the shop's own site.
 */
export function parsePricenaOffers(html: string, productUrl: string, query: string, shops: ShopDef[]): Listing[] {
  const out: Listing[] = []
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null
  // The page's own product id ends its URL; the "related products" strip has buttons for other products.
  const pageId = productUrl.match(/-(\d{5,})(?:[/?#]|$)/)?.[1] ?? null
  for (const m of html.matchAll(/<button[^>]*class="green-button"[^>]*>/g)) {
    const tag = m[0]
    if (/data-ref3="related/i.test(tag)) continue
    const pid = tag.match(/data-product="(\d+)"/)?.[1]
    if (pageId && pid && pid !== pageId) continue
    const store = decode(tag.match(/data-storename="([^"]*)"/)?.[1] ?? '').trim()
    if (!store) continue
    const name = decode(tag.match(/data-productname="([^"]*)"/)?.[1] ?? '').replace(/\s*\|\s*Price updated.*$/i, '').trim()
    const { slug, shop } = storeSlug(store, shops)
    out.push({
      source: slug, store: shop?.name ?? store, title: name, url: productUrl,
      storeSearchUrl: shop ? shop.searchUrl(query) : null,
      price: parseNumber(tag.match(/data-price="([^"]*)"/)?.[1]),
      rating: null, ratingCount: null, sold: null, image, via: 'pricena',
    })
  }
  return out
}
