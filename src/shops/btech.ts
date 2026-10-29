import type { Listing, ShopDef } from '../types.js'

// btech.com is a Next.js app: every listing page (/en/s?q=…) ships its first
// 20 products inside the page's streamed payload (self.__next_f).

export const btechSearchUrl = (q: string) => `https://btech.com/en/s?q=${encodeURIComponent(q)}`

/** The text the page streams into `self.__next_f`, decoded and joined. */
export function nextFlightText(html: string): string {
  let out = ''
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { out += JSON.parse(`"${m[1]}"`) } catch { /* skip a malformed chunk */ }
  }
  return out
}

export interface BtechProduct {
  name: string; brand: string; price: number; basePrice: number | null; inStock: boolean
  url: string; category: string; image: string | null
}

function btechProduct(it: any): BtechProduct | null {
  const price = Number(it?.price?.final_price)
  if (typeof it?.name !== 'string' || typeof it?.slug !== 'string' || !Number.isFinite(price)) return null
  const offerId = typeof it.offer_id === 'string' && /^[0-9a-f-]{36}$/i.test(it.offer_id) ? it.offer_id.toLowerCase() : null
  const thumb = typeof it.thumbnail_url === 'string' ? it.thumbnail_url : ''
  return {
    name: it.name.replace(/\s+/g, ' ').trim(), brand: String(it.brand ?? ''), price,
    basePrice: Number.isFinite(Number(it.price?.base_price)) ? Number(it.price.base_price) : null,
    inStock: it.is_in_stock !== false,
    url: `https://btech.com/en/p/${it.slug}${offerId ? `?offering_id=${offerId}` : ''}`,
    image: thumb ? (/^https:/.test(thumb) ? thumb : `https://media.btech.com/catalogs/${thumb.replace(/^\//, '')}`) : null,
    category: String(it.categories?.l3?.name ?? it.categories?.l2?.name ?? ''),
  }
}

/** Products and the total count from a B.TECH listing page. */
export function parseBtechListing(html: string): { products: BtechProduct[]; total: number } {
  const t = nextFlightText(html)
  const start = t.indexOf('{"items":[')
  const end = start >= 0 ? t.indexOf(',"total_items":', start) : -1
  let items: any[] = []
  if (start >= 0 && end > start) {
    try { items = JSON.parse(t.slice(start + 9, end)) } catch { items = [] }
  }
  const total = Number(t.slice(end).match(/^,"total_items":(\d+)/)?.[1] ?? items.length)
  return { products: items.map(btechProduct).filter((p): p is BtechProduct => !!p), total }
}

export function parseBtechSearch(html: string): Listing[] {
  return parseBtechListing(html).products.map(p => ({
    source: 'btech', store: 'B.TECH', title: p.name, url: p.url, storeSearchUrl: null,
    price: p.price > 0 ? p.price : null, rating: null, ratingCount: null,
    sold: p.inStock ? null : 'Out of stock', image: p.image,
  }))
}

export const btech: ShopDef = {
  id: 'btech', name: 'B.TECH', domain: 'btech.com',
  categories: ['laptops', 'phones', 'appliances', 'electronics'], mode: 'direct', pricenaName: /b\.?\s?tech/i,
  searchUrl: btechSearchUrl,
  search: async (q, io) => parseBtechSearch(await io.fetchText(btechSearchUrl(q), 2)),
  datacenter: 'yes',
  note: 'First 20 results from the Next.js page payload.',
}
