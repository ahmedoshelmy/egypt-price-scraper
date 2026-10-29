import { blockAware } from '../net.js'
import type { Listing, ShopDef } from '../types.js'

const base = 'https://egyptlaptop.com'
const ent = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/​/g, '')
const searchUrl = (q: string) => `${base}/?dispatch=products.search&search_performed=Y&subcats=Y&pname=Y&pkeywords=Y&pcode_from_q=Y&items_per_page=24&q=${encodeURIComponent(q)}`

/** Egypt Laptop (CS-Cart, UniTheme2): one `ut2-gl__item` card per product; "unavailable" ones say Out of stock. */
export function parseEgyptLaptopSearch(html: string): Listing[] {
  const out: Listing[] = []
  for (const card of html.split('class="ut2-gl__item').slice(1)) {
    const a = card.match(/<a href="([^"]+)" class="product-title"[^>]*title="([^"]*)"/)
    if (!a) continue
    const price = Number((card.match(/id="discounted_price_\d+" class="ty-price-num">([^<]+)</)?.[1] ?? '').replace(/[^\d.]/g, ''))
    out.push({
      source: 'egyptlaptop', store: 'Egypt Laptop', title: ent(a[2]).trim(), url: ent(a[1]), storeSearchUrl: null,
      price: price > 0 ? price : null, rating: null, ratingCount: null,
      sold: /^[^"]*\bunavailable\b/.test(card) || /ty-qty-out-of-stock/.test(card) ? 'Out of stock' : null,
      image: card.match(/<img class="ty-pict[^"]*"[^>]*src="([^"]+)"/)?.[1] ?? null,
    })
    if (out.length >= 30) break
  }
  return out
}

export const egyptlaptop: ShopDef = {
  id: 'egyptlaptop', name: 'Egypt Laptop', domain: 'egyptlaptop.com',
  categories: ['laptops', 'electronics'], mode: 'direct', pricenaName: /egypt\s?laptop/i,
  searchUrl,
  search: async (q, io) => {
    const html = await blockAware('Egypt Laptop', io.fetchText(searchUrl(q), 2))
    if (!/products\.search/.test(html)) throw new Error('Egypt Laptop showed no search page')
    return parseEgyptLaptopSearch(html)
  },
  datacenter: 'no',
  note: 'CS-Cart search page. Cloudflare challenges datacenter IPs.',
}
